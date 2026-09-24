import { useQuery } from '@tanstack/react-query'
import {
  Copy,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'

import {
  MIN_ACTIVE_ADMINS,
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
  type StaffUser,
} from '@/entities/studio'
import { errorMessage, isAppError } from '@/shared/api/errors'
import { formatRelative } from '@/shared/lib/format'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  toast,
  TR,
} from '@/shared/ui'

import {
  useCreateUser,
  useResetPassword,
  useSetActive,
  useSetRole,
  usersQueryOptions,
  useStaffSession,
} from '../api/queries'

function TempPasswordDialog({
  open,
  onOpenChange,
  password,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  password: string
  user: StaffUser | undefined
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Geçici parola"
        description={user ? `${user.displayName} ilk girişte bu parolayı değiştirecek.` : undefined}
        footer={<Button onClick={() => onOpenChange(false)}>Kaydettim, kapat</Button>}
      >
        <div className="flex flex-col gap-4">
          <Alert variant="warning">
            Bu parola <strong>yalnızca bir kez</strong> gösterilir ve 72 saat geçerlidir. Kişiye
            güvenli bir kanaldan iletin.
          </Alert>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3">
            <code
              data-testid="temp-password"
              className="flex-1 font-mono text-base break-all text-fg"
            >
              {password}
            </code>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Copy aria-hidden="true" />}
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(password)
                  .then(() => toast.success('Parola kopyalandı'))
              }
            >
              Kopyala
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const createUserFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalı.')
    .max(60, 'Ad soyad en fazla 60 karakter olabilir.'),
  email: z
    .string()
    .trim()
    .min(1, 'E-posta adresini girin.')
    .pipe(z.email('Geçerli bir e-posta adresi girin (ör. ad.soyad@kurum.gov.tr).')),
})

type CreateUserErrors = { displayName?: string | undefined; email?: string | undefined }

/** First message per field, so each input shows (and announces) one clear error. */
function validateCreateUser(values: z.input<typeof createUserFormSchema>): CreateUserErrors {
  const result = createUserFormSchema.safeParse(values)
  if (result.success) return {}
  const { fieldErrors } = z.flattenError(result.error)
  return { displayName: fieldErrors.displayName?.[0], email: fieldErrors.email?.[0] }
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (user: StaffUser, password: string) => void
}) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<StaffRole>('editor')
  const [fieldErrors, setFieldErrors] = useState<CreateUserErrors>({})
  const displayNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const create = useCreateUser()
  // A taken e-mail belongs to the e-mail field; other failures stay a form-level alert.
  const formError = create.isError && !isAppError(create.error, 'conflict') ? create.error : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateCreateUser({ displayName, email })
    setFieldErrors(errors)
    if (errors.displayName) displayNameRef.current?.focus()
    else if (errors.email) emailRef.current?.focus()
    else
      create.mutate(
        { email, displayName, role },
        {
          onSuccess: ({ user, tempPassword }) => {
            setEmail('')
            setDisplayName('')
            setRole('editor')
            onOpenChange(false)
            onCreated(user, tempPassword)
          },
          onError: (error) => {
            if (!isAppError(error, 'conflict')) return
            setFieldErrors({ email: error.message })
            emailRef.current?.focus()
          },
        },
      )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          create.reset()
          setFieldErrors({})
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        title="Kullanıcı ekle"
        description="Kayıt kapalıdır; hesapları yöneticiler açar."
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {formError && <Alert variant="danger">{errorMessage(formError)}</Alert>}
          <Field label="Ad soyad" required error={fieldErrors.displayName}>
            <Input
              ref={displayNameRef}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="E-posta" required error={fieldErrors.email}>
            <Input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Rol"
            description="Editörler kit hazırlar ve incelemeye gönderir; yöneticiler yayınlar."
          >
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'editor')}
            >
              {STAFF_ROLES.map((value) => (
                <option key={value} value={value}>
                  {STAFF_ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              loading={create.isPending}
              leadingIcon={<UserPlus aria-hidden="true" />}
            >
              Kullanıcıyı oluştur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersManager() {
  const session = useStaffSession()
  const users = useQuery(usersQueryOptions())
  const setRole = useSetRole()
  const setActive = useSetActive()
  const resetPassword = useResetPassword()
  const [createOpen, setCreateOpen] = useState(false)
  const [temp, setTemp] = useState<{ user: StaffUser; password: string } | null>(null)
  const [confirm, setConfirm] = useState<{
    user: StaffUser
    action: 'deactivate' | 'reset'
  } | null>(null)

  const activeAdmins =
    users.data?.filter((user) => user.role === 'admin' && user.active).length ?? 0

  const runConfirm = () => {
    if (!confirm) return
    const { user, action } = confirm
    if (action === 'deactivate') {
      setActive.mutate(
        { userId: user.id, active: false },
        {
          onSuccess: () => toast.success(`${user.displayName} pasifleştirildi`),
          onError: (error) => toast.error(errorMessage(error)),
          onSettled: () => setConfirm(null),
        },
      )
    } else {
      resetPassword.mutate(user.id, {
        onSuccess: ({ tempPassword }) => setTemp({ user, password: tempPassword }),
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () => setConfirm(null),
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {users.isSuccess && activeAdmins < MIN_ACTIVE_ADMINS && (
        <Alert variant="danger" title="Tek yönetici kaldı">
          En az {MIN_ACTIVE_ADMINS} aktif yönetici olmalı. İki adımlı doğrulama cihazı kaybolursa
          Studio’ya erişim kilitlenebilir.
        </Alert>
      )}
      <div className="flex justify-end">
        <Button leadingIcon={<UserPlus aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
          Kullanıcı ekle
        </Button>
      </div>
      <Card>
        {users.isPending ? (
          <div
            className="flex flex-col gap-3 p-5"
            aria-busy="true"
            aria-label="Kullanıcılar yükleniyor"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : users.isError ? (
          <EmptyState
            title="Kullanıcılar yüklenemedi"
            description={errorMessage(users.error)}
            action={<Button onClick={() => void users.refetch()}>Tekrar dene</Button>}
          />
        ) : users.data.length === 0 ? (
          <EmptyState title="Henüz kullanıcı yok" description="İlk kullanıcıyı ekleyin." />
        ) : (
          <Table caption="Studio kullanıcıları">
            <THead>
              <tr>
                <TH>Kullanıcı</TH>
                <TH>Rol</TH>
                <TH>Durum</TH>
                <TH>İki adımlı doğrulama</TH>
                <TH>Son giriş</TH>
                <TH className="w-12">
                  <span className="sr-only">İşlemler</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {users.data.map((user) => {
                const self = user.id === session?.user.id
                return (
                  <TR key={user.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.displayName} />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium text-fg">
                            {user.displayName}
                            {self && <span className="ml-1.5 text-xs text-fg-subtle">(siz)</span>}
                          </span>
                          <span className="truncate text-xs text-fg-muted">{user.email}</span>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={user.role === 'admin' ? 'primary' : 'neutral'}>
                        {STAFF_ROLE_LABELS[user.role]}
                      </Badge>
                    </TD>
                    <TD>
                      {user.active ? (
                        user.mustChangePassword ? (
                          <Badge variant="warning" dot>
                            İlk giriş bekleniyor
                          </Badge>
                        ) : (
                          <Badge variant="success" dot>
                            Aktif
                          </Badge>
                        )
                      ) : (
                        <Badge dot>Pasif</Badge>
                      )}
                    </TD>
                    <TD>
                      {user.totpEnrolled ? (
                        <span className="inline-flex items-center gap-1.5 text-success-fg">
                          <ShieldCheck aria-hidden="true" className="size-4" /> Açık
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-fg-muted">
                          <ShieldOff aria-hidden="true" className="size-4" /> Kapalı
                        </span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-fg-muted">
                      {user.lastSignInAt ? formatRelative(user.lastSignInAt) : '—'}
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${user.displayName} için işlemler`}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Rol</DropdownMenuLabel>
                          {STAFF_ROLES.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              disabled={user.role === role}
                              onSelect={() =>
                                setRole.mutate(
                                  { userId: user.id, role },
                                  {
                                    onSuccess: () =>
                                      toast.success(
                                        `${user.displayName}: ${STAFF_ROLE_LABELS[role]}`,
                                      ),
                                    onError: (error) => toast.error(errorMessage(error)),
                                  },
                                )
                              }
                            >
                              {STAFF_ROLE_LABELS[role]} yap
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setConfirm({ user, action: 'reset' })}>
                            <KeyRound aria-hidden="true" /> Parolayı sıfırla
                          </DropdownMenuItem>
                          {user.active ? (
                            <DropdownMenuItem
                              destructive
                              disabled={self}
                              onSelect={() => setConfirm({ user, action: 'deactivate' })}
                            >
                              <UserX aria-hidden="true" /> Pasifleştir
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                setActive.mutate(
                                  { userId: user.id, active: true },
                                  {
                                    onSuccess: () =>
                                      toast.success(`${user.displayName} aktifleştirildi`),
                                  },
                                )
                              }
                            >
                              <UserCheck aria-hidden="true" /> Aktifleştir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(user, password) => setTemp({ user, password })}
      />
      <TempPasswordDialog
        open={temp !== null}
        onOpenChange={(open) => !open && setTemp(null)}
        password={temp?.password ?? ''}
        user={temp?.user}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.action === 'deactivate' ? 'Kullanıcıyı pasifleştir' : 'Parolayı sıfırla'}
        description={
          confirm?.action === 'deactivate'
            ? `${confirm.user.displayName} Studio’ya giremeyecek; açık oturumu bir sonraki işlemde kapanır.`
            : `${confirm?.user.displayName ?? ''} için yeni bir geçici parola oluşturulacak. Mevcut parolası geçersiz olur.`
        }
        confirmLabel={confirm?.action === 'deactivate' ? 'Pasifleştir' : 'Parolayı sıfırla'}
        variant={confirm?.action === 'deactivate' ? 'danger' : 'primary'}
        loading={setActive.isPending || resetPassword.isPending}
        onConfirm={runConfirm}
      />
    </div>
  )
}
