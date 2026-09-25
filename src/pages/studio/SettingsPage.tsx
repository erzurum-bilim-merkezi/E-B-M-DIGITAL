import { useQuery } from '@tanstack/react-query'
import { KeyRound, MonitorSmartphone, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { type AppSettings } from '@/entities/studio'
import { BarList } from '@/features/analytics'
import { useStaffSession } from '@/features/auth'
import {
  aiUsageQueryOptions,
  appSettingsQueryOptions,
  auditLogQueryOptions,
  centerDevicesQueryOptions,
  useCreateCenterDevice,
  useRevokeCenterDevice,
  useUpdateSettings,
} from '@/features/settings'
import { resetMockDb } from '@/shared/api/mock-db'
import { resetMockMedia } from '@/shared/api/mock-media'
import { errorMessage } from '@/shared/api/errors'
import { isMockBackend } from '@/shared/config/backend'
import { previewDevice } from '@/shared/config/device-flags'
import { formatDateTime, formatShortDate } from '@/shared/lib/format'
import { removeStorage, storageKeys } from '@/shared/lib/storage'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  DialogContent,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  toast,
  TR,
} from '@/shared/ui'

function AiSettings({ settings, editable }: { settings: AppSettings; editable: boolean }) {
  const update = useUpdateSettings()
  const usage = useQuery(aiUsageQueryOptions())
  const [form, setForm] = useState({
    project: settings.aiDailyProjectLimit,
    user: settings.aiDailyUserLimit,
    suggestions: settings.aiSuggestionCount,
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate(
      {
        aiDailyProjectLimit: form.project,
        aiDailyUserLimit: form.user,
        aiSuggestionCount: form.suggestions,
      },
      { onSuccess: () => toast.success('Yapay zekâ ayarları kaydedildi') },
    )
  }
  return (
    <Card>
      <CardHeader
        title="Yapay zekâ"
        description="Gemini API ücretsiz katmanı; anahtar yalnızca sunucu tarafında (Edge Function secret) tutulur."
        action={
          <Badge variant={settings.aiProvider === 'off' ? 'neutral' : 'primary'}>
            <Sparkles aria-hidden="true" className="size-3" />{' '}
            {settings.aiProvider === 'off'
              ? 'Kapalı'
              : settings.aiProvider === 'fake'
                ? 'Deneme sağlayıcısı'
                : 'Gemini'}
          </Badge>
        }
      />
      <form onSubmit={submit} className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field
            label="Kurum geneli günlük üretim sınırı"
            description="AI Studio’daki günlük istek kotasının (RPD) altında tutun."
          >
            <Input
              type="number"
              min={0}
              max={10000}
              value={form.project}
              disabled={!editable}
              onChange={(event) => setForm({ ...form, project: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field label="Kullanıcı başına günlük sınır">
            <Input
              type="number"
              min={0}
              max={500}
              value={form.user}
              disabled={!editable}
              onChange={(event) => setForm({ ...form, user: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field
            label="Öneri sayısı"
            description="Her “Oluştur” kaç sahne önerisi üretsin (her biri kotadan düşer)."
          >
            <Select
              value={String(form.suggestions)}
              disabled={!editable}
              onChange={(event) => setForm({ ...form, suggestions: Number(event.target.value) })}
            >
              <option value="1">1 öneri</option>
              <option value="2">2 öneri</option>
              <option value="3">3 öneri</option>
            </Select>
          </Field>
          {isMockBackend && editable && (
            <Field
              label="Sağlayıcı (deneme ortamı)"
              description="Canlıda sunucu secret’ı AI_PROVIDER belirler. “Kapalı” iken tüm yapay zekâ girişleri gizlenir."
            >
              <Select
                value={settings.aiProvider}
                onChange={(event) =>
                  update.mutate({ aiProvider: event.target.value === 'off' ? 'off' : 'fake' })
                }
              >
                <option value="fake">Deneme sağlayıcısı (fake)</option>
                <option value="off">Kapalı (off)</option>
              </Select>
            </Field>
          )}
          {editable && (
            <Button type="submit" className="self-start" loading={update.isPending}>
              Kaydet
            </Button>
          )}
          {update.isError && <Alert variant="danger">{errorMessage(update.error)}</Alert>}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Son 14 gün üretim</p>
          {usage.data ? (
            <BarList
              ariaLabel="Son 14 günde günlük yapay zekâ üretimi"
              items={usage.data.map((row) => ({
                label: formatShortDate(`${row.day}T12:00:00+03:00`),
                value: row.count,
              }))}
            />
          ) : (
            <Skeleton className="h-48" />
          )}
        </div>
      </form>
    </Card>
  )
}

function RetentionSettings({ settings, editable }: { settings: AppSettings; editable: boolean }) {
  const update = useUpdateSettings()
  const [raw, setRaw] = useState(settings.rawEventRetentionDays)
  const [inactive, setInactive] = useState(settings.inactiveExplorerMonths)
  return (
    <Card>
      <CardHeader
        title="Saklama süreleri (KVKK)"
        description="Süresi dolan kayıtlar gece çalışan işlerle otomatik silinir."
      />
      <form
        className="grid gap-5 p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate(
            { rawEventRetentionDays: raw, inactiveExplorerMonths: inactive },
            { onSuccess: () => toast.success('Saklama süreleri kaydedildi') },
          )
        }}
      >
        <Field
          label="Ham etkinlik kayıtları"
          description="7–60 gün. Sonrasında yalnızca günlük toplamlar kalır."
        >
          <Input
            type="number"
            min={7}
            max={60}
            value={raw}
            disabled={!editable}
            onChange={(event) => setRaw(Math.min(60, Math.max(7, Number(event.target.value) || 7)))}
          />
        </Field>
        <Field label="Hareketsiz kâşif üyelikleri" description="3–24 ay. Tüm verisiyle silinir.">
          <Input
            type="number"
            min={3}
            max={24}
            value={inactive}
            disabled={!editable}
            onChange={(event) =>
              setInactive(Math.min(24, Math.max(3, Number(event.target.value) || 3)))
            }
          />
        </Field>
        {editable && (
          <Button
            type="submit"
            className="justify-self-start sm:col-span-2"
            loading={update.isPending}
          >
            Kaydet
          </Button>
        )}
      </form>
    </Card>
  )
}

function CenterDevices() {
  const devices = useQuery(centerDevicesQueryOptions())
  const create = useCreateCenterDevice()
  const revoke = useRevokeCenterDevice()
  const [label, setLabel] = useState('')
  const [pin, setPin] = useState('')
  const [created, setCreated] = useState<{ label: string; code: string } | null>(null)
  return (
    <Card>
      <CardHeader
        title="Merkez cihazları"
        description="Paylaşılan tabletler: kurulum kodu 24 saat geçerli ve tek kullanımlıktır; çıkış eğitmen PIN’iyle yapılır."
      />
      <form
        className="flex flex-wrap items-end gap-3 border-b border-border p-5"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate(
            { label, pin },
            {
              onSuccess: ({ device, setupCode }) => {
                setCreated({ label: device.label, code: setupCode })
                setLabel('')
                setPin('')
              },
            },
          )
        }}
      >
        <Field label="Cihaz adı" className="min-w-48 flex-1">
          <Input
            value={label}
            maxLength={60}
            placeholder="Giriş tableti 1"
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        <Field label="Eğitmen PIN’i (4–8 rakam)">
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            maxLength={8}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
            className="w-32"
          />
        </Field>
        <Button
          type="submit"
          leadingIcon={<KeyRound aria-hidden="true" />}
          loading={create.isPending}
          disabled={!label.trim() || pin.length < 4}
        >
          Kurulum kodu üret
        </Button>
        {create.isError && (
          <Alert variant="danger" className="w-full">
            {errorMessage(create.error)}
          </Alert>
        )}
      </form>
      {devices.isPending ? (
        <Skeleton className="m-5 h-20" />
      ) : (devices.data?.length ?? 0) === 0 ? (
        <p className="p-5 text-sm text-fg-muted">Henüz merkez cihazı yok.</p>
      ) : (
        <Table caption="Merkez cihazları">
          <THead>
            <tr>
              <TH>Cihaz</TH>
              <TH>Durum</TH>
              <TH>Oluşturma</TH>
              <TH className="w-12">
                <span className="sr-only">İşlemler</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {devices.data?.map((device) => (
              <TR key={device.id}>
                <TD className="font-medium">{device.label}</TD>
                <TD>
                  {device.revokedAt ? (
                    <Badge>İptal edildi</Badge>
                  ) : device.deviceUid ? (
                    <Badge variant="success" dot>
                      Etkin
                    </Badge>
                  ) : device.setupExpiresAt &&
                    Date.parse(device.setupExpiresAt) > devices.dataUpdatedAt ? (
                    <Badge variant="warning" dot>
                      Kurulum bekliyor
                    </Badge>
                  ) : (
                    <Badge>Kodun süresi doldu</Badge>
                  )}
                </TD>
                <TD className="text-fg-muted">{formatDateTime(device.createdAt)}</TD>
                <TD>
                  {!device.revokedAt && (
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      aria-label={`${device.label} iptal et`}
                      onClick={() =>
                        revoke.mutate(device.id, {
                          onSuccess: () => toast.success('Cihaz iptal edildi'),
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent
          title="Kurulum kodu"
          description={`${created?.label ?? ''} için 24 saat geçerli, tek kullanımlık kod.`}
          footer={<Button onClick={() => setCreated(null)}>Tamam</Button>}
        >
          <p
            className="rounded-lg bg-surface-muted p-4 text-center font-mono text-3xl font-semibold tracking-[0.3em]"
            data-testid="center-setup-code"
          >
            {created?.code}
          </p>
          <p className="mt-3 text-sm text-fg-muted">
            Tablette Kâşif → Profilim → “Eğitmen: bu cihazı merkez cihazı yap” ekranına girin.
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function AuditLog() {
  const audit = useQuery(auditLogQueryOptions())
  return (
    <Card>
      <CardHeader
        title="Denetim kaydı"
        description="Yayın, durum, kullanıcı, veri silme ve yapay zekâ işlemleri (son 50)."
      />
      {audit.isPending ? (
        <Skeleton className="m-5 h-40" />
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <Table caption="Denetim kaydı">
            <THead>
              <tr>
                <TH>Zaman</TH>
                <TH>İşlem</TH>
                <TH>Kayıt</TH>
              </tr>
            </THead>
            <TBody>
              {audit.data?.map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDateTime(entry.at)}</TD>
                  <TD className="font-mono text-xs">{entry.action}</TD>
                  <TD className="text-xs text-fg-muted">
                    {entry.entity}
                    {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ''}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

/** Mock backend only: wipes the local demo data (keeps the Studio theme) and reloads. */
async function resetDemo() {
  resetMockDb()
  await resetMockMedia()
  for (const key of storageKeys('kasif:'))
    if (!key.startsWith('kasif:studio-theme')) removeStorage(key)
  window.location.reload()
}

export function SettingsPage() {
  const session = useStaffSession()
  const admin = session?.user.role === 'admin'
  const settings = useQuery(appSettingsQueryOptions())
  const preview = previewDevice.useValue()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <title>Ayarlar · Kâşif Studio</title>
      <PageHeader
        title="Ayarlar"
        description={
          admin
            ? 'Platform ayarları, merkez cihazları ve denetim kaydı.'
            : 'Bu cihazın önizleme ayarı. Platform ayarlarını yöneticiler değiştirir.'
        }
      />

      <Card>
        <CardHeader
          title="Önizleme cihazı"
          description="Açıkken bu cihazda Kâşif, yayına açılmadan (coming-soon) gösterilir ve etkinlikler “önizleme” olarak işaretlenir (istatistiklere girmez)."
        />
        <div className="flex items-center justify-between gap-4 p-5">
          <label htmlFor="preview-device" className="flex items-center gap-3 text-sm font-medium">
            <MonitorSmartphone aria-hidden="true" className="size-5 text-fg-subtle" /> Bu cihazda
            Kâşif’i önizle
          </label>
          <Switch
            id="preview-device"
            checked={preview}
            onCheckedChange={(checked) => previewDevice.set(checked)}
          />
        </div>
      </Card>

      {settings.isPending ? (
        <Skeleton className="h-72" />
      ) : settings.isError ? (
        <Alert variant="danger">{errorMessage(settings.error)}</Alert>
      ) : (
        <>
          <AiSettings settings={settings.data} editable={admin} />
          <RetentionSettings settings={settings.data} editable={admin} />
        </>
      )}

      {admin && <CenterDevices />}
      {admin && <AuditLog />}

      {isMockBackend && admin && (
        <Card>
          <CardHeader
            title="Deneme ortamı"
            description="Tüm deneme verisini (kitler, kâşifler, medya) silip örnek verilerle yeniden başlar. Yalnızca bu tarayıcıyı etkiler."
          />
          <div className="p-5">
            <Button
              variant="danger"
              leadingIcon={<RotateCcw aria-hidden="true" />}
              onClick={() => setConfirmReset(true)}
            >
              Deneme verisini sıfırla
            </Button>
          </div>
          <ConfirmDialog
            open={confirmReset}
            onOpenChange={setConfirmReset}
            title="Deneme verisi sıfırlansın mı?"
            description="Bu tarayıcıdaki tüm deneme verisi silinir ve örnek içerik yeniden yüklenir."
            confirmLabel="Sıfırla"
            onConfirm={() => void resetDemo()}
          />
        </Card>
      )}
    </div>
  )
}
