import { Archive, ArchiveRestore, MessageSquareWarning, Rocket, Send, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import {
  describeKitState,
  hasBlockingIssues,
  hasUnpublishedChanges,
  isKitLive,
  kitUsesAi,
  type KitDocument,
  type KitIssue,
  type KitVisibility,
  type StudioKit,
} from '@/entities/kit'
import { errorMessage, isAppError } from '@/shared/api/errors'
import { formatDateTime } from '@/shared/lib/format'
import {
  Alert,
  Badge,
  Button,
  buttonClasses,
  Card,
  CardHeader,
  CheckboxField,
  Field,
  RadioGroup,
  RadioItem,
  Textarea,
  toast,
} from '@/shared/ui'

import {
  useArchiveKit,
  usePublishKit,
  useRequestChanges,
  useSetVisibility,
  useSubmitForReview,
  useWithdrawReview,
} from '../../api/queries'
import { ValidationPanel } from './ValidationPanel'

type PublishTabProps = {
  kit: StudioKit
  draft: KitDocument
  issues: readonly KitIssue[]
  role: 'admin' | 'editor'
  /** Saves pending edits and returns once the server has them. */
  flush: () => Promise<number>
  onGo: (issue: KitIssue) => void
}

export function PublishTab({ kit, draft, issues, role, flush, onGo }: PublishTabProps) {
  const [visibility, setVisibility] = useState<KitVisibility>(kit.visibility)
  const [notes, setNotes] = useState('')
  const [aiConfirmed, setAiConfirmed] = useState(false)
  const [changeNote, setChangeNote] = useState('')
  const publish = usePublishKit()
  const submit = useSubmitForReview()
  const withdraw = useWithdrawReview()
  const requestChanges = useRequestChanges()
  const setKitVisibility = useSetVisibility()
  const archive = useArchiveKit()
  const blocking = hasBlockingIssues(issues)
  const usesAi = kitUsesAi(draft)
  const live = isKitLive(kit)
  const state = describeKitState(kit)
  const admin = role === 'admin'

  /** Pending edits first — never publish (or send for review) an older server draft. */
  const saved = async () => {
    try {
      return await flush()
    } catch (error) {
      toast.error('Değişiklikler kaydedilemedi, işlem yapılmadı.', {
        description: errorMessage(error),
      })
      return null
    }
  }

  const doPublish = async () => {
    const lockVersion = await saved()
    if (lockVersion === null) return
    publish.mutate(
      {
        id: kit.id,
        input: { notes, visibility, lockVersion, aiReviewConfirmed: aiConfirmed },
      },
      {
        onSuccess: ({ version }) => {
          toast.success(`v${version.version} yayınlandı`, {
            description: 'Kâşif uygulamasında artık bu sürüm görünüyor.',
          })
          setNotes('')
          setAiConfirmed(false)
        },
      },
    )
  }

  const publishDisabled = blocking || (usesAi && !aiConfirmed) || kit.status === 'archived'
  const editorLocked = role === 'editor' && kit.status === 'in_review'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-5">
        {kit.reviewNote && (
          <Alert variant="warning" title="Yöneticiden değişiklik isteği">
            {kit.reviewNote}
          </Alert>
        )}
        <Card>
          <CardHeader
            title="Yayına hazırlık"
            description="Yayından önce düzeltilmesi gerekenler ve uyarılar."
          />
          <div className="p-5">
            <ValidationPanel issues={issues} draft={draft} onGo={onGo} />
          </div>
        </Card>

        {admin ? (
          <Card>
            <CardHeader
              title={live ? 'Yeni sürüm yayınla' : 'Yayınla'}
              description="Yayın, kitin değişmez bir anlık görüntüsünü oluşturur; Kâşif uygulaması bir sonraki açılışta onu gösterir."
            />
            <div className="flex flex-col gap-5 p-5">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-medium">Görünürlük</legend>
                <RadioGroup
                  value={visibility}
                  onValueChange={(value) =>
                    setVisibility(value === 'unlisted' ? 'unlisted' : 'public')
                  }
                  className="flex flex-col gap-3"
                >
                  <RadioItem
                    id="visibility-public"
                    value="public"
                    label="Herkese açık"
                    description="Bilim Merkezi’ndeki kit listesinde görünür."
                  />
                  <RadioItem
                    id="visibility-unlisted"
                    value="unlisted"
                    label="Liste dışı"
                    description="Katalogda görünmez, ama bağlantı ve QR ile açılır. Gizli değildir."
                  />
                </RadioGroup>
              </fieldset>
              <Field label="Yayın notu (isteğe bağlı)" description="Sürüm geçmişinde görünür.">
                <Textarea
                  value={notes}
                  maxLength={500}
                  rows={2}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="ör. 3. karta video eklendi"
                />
              </Field>
              {usesAi && (
                <CheckboxField
                  id="ai-review"
                  label="Yapay zekâ içeriğini bilimsel doğruluk açısından kontrol ettim"
                  description="Bu kitte yapay zekâ ile üretilmiş metin ya da animasyon var. Çocuklara yayınlamadan önce kontrol zorunludur."
                  checked={aiConfirmed}
                  onCheckedChange={(checked) => setAiConfirmed(checked === true)}
                />
              )}
              {publish.isError && (
                <Alert
                  variant="danger"
                  title="Yayınlanamadı"
                  action={
                    !isAppError(publish.error, 'validation') && (
                      <Button size="sm" variant="secondary" onClick={() => void doPublish()}>
                        Tekrar dene
                      </Button>
                    )
                  }
                >
                  {errorMessage(publish.error)}
                </Alert>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  leadingIcon={<Rocket aria-hidden="true" />}
                  disabled={publishDisabled}
                  loading={publish.isPending}
                  onClick={() => void doPublish()}
                >
                  {live ? 'Yeni sürümü yayınla' : 'Yayınla'}
                </Button>
                {blocking && (
                  <span className="text-sm text-danger-fg">Önce sorunları düzeltin.</span>
                )}
                {!blocking && usesAi && !aiConfirmed && (
                  <span className="text-sm text-fg-muted">Yapay zekâ onayını işaretleyin.</span>
                )}
              </div>
              {publish.isSuccess && (
                <Alert
                  variant="success"
                  title={`v${publish.data.version.version} yayında`}
                  action={
                    <Link
                      to={`/studio/kitler/${kit.id}/qr`}
                      className={buttonClasses({ size: 'sm', variant: 'secondary' })}
                    >
                      QR oluştur
                    </Link>
                  }
                >
                  Ekipman etiketlerini basmak için QR sayfasına geçin.
                </Alert>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="İncelemeye gönder"
              description="Editörler kitleri yöneticinin incelemesine gönderir; yönetici yayınlar."
            />
            <div className="flex flex-col gap-4 p-5">
              {kit.status === 'in_review' ? (
                <>
                  <Alert variant="info">
                    Kit incelemede. Değişiklik yapmak için incelemeden geri çekin.
                  </Alert>
                  <Button
                    variant="secondary"
                    leadingIcon={<Undo2 aria-hidden="true" />}
                    loading={withdraw.isPending}
                    onClick={() =>
                      withdraw.mutate(kit.id, {
                        onSuccess: () => toast.success('İncelemeden geri çekildi'),
                      })
                    }
                    className="self-start"
                  >
                    İncelemeden geri çek
                  </Button>
                </>
              ) : (
                <Button
                  leadingIcon={<Send aria-hidden="true" />}
                  disabled={blocking || kit.status === 'archived'}
                  loading={submit.isPending}
                  className="self-start"
                  onClick={() => {
                    void saved().then((lockVersion) => {
                      if (lockVersion === null) return
                      submit.mutate(
                        { id: kit.id, lockVersion },
                        { onSuccess: () => toast.success('İncelemeye gönderildi') },
                      )
                    })
                  }}
                >
                  İncelemeye gönder
                </Button>
              )}
              {submit.isError && <Alert variant="danger">{errorMessage(submit.error)}</Alert>}
            </div>
          </Card>
        )}

        {admin && kit.status === 'in_review' && (
          <Card>
            <CardHeader
              title="Değişiklik iste"
              description="Kit editöre geri döner; notunuzu görür."
            />
            <div className="flex flex-col gap-3 p-5">
              <Field label="Editöre not">
                <Textarea
                  value={changeNote}
                  maxLength={1000}
                  rows={3}
                  onChange={(event) => setChangeNote(event.target.value)}
                  placeholder="ör. 4. kartın cevabını sadeleştirin."
                />
              </Field>
              <Button
                variant="secondary"
                className="self-start"
                leadingIcon={<MessageSquareWarning aria-hidden="true" />}
                disabled={!changeNote.trim()}
                loading={requestChanges.isPending}
                onClick={() =>
                  requestChanges.mutate(
                    { id: kit.id, note: changeNote },
                    {
                      onSuccess: () => {
                        setChangeNote('')
                        toast.success('Değişiklik istendi')
                      },
                    },
                  )
                }
              >
                Değişiklik iste
              </Button>
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Durum" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
            <dt className="text-fg-muted">Durum</dt>
            <dd>
              <Badge variant={state.tone} dot>
                {state.label}
              </Badge>
            </dd>
            <dt className="text-fg-muted">Canlı sürüm</dt>
            <dd className="tabular">{kit.publishedVersion ? `v${kit.publishedVersion}` : '—'}</dd>
            <dt className="text-fg-muted">Son yayın</dt>
            <dd>{kit.lastPublishedAt ? formatDateTime(kit.lastPublishedAt) : '—'}</dd>
            <dt className="text-fg-muted">Görünürlük</dt>
            <dd>{kit.visibility === 'public' ? 'Herkese açık' : 'Liste dışı'}</dd>
          </dl>
          {hasUnpublishedChanges(kit) && (
            <p className="border-t border-border px-5 py-3 text-xs text-primary-subtle-fg">
              Yayında olmayan değişiklikler var.
            </p>
          )}
          {editorLocked && (
            <p className="border-t border-border px-5 py-3 text-xs text-warning-fg">
              İncelemedeki kit editörlere kilitlidir.
            </p>
          )}
        </Card>
        {admin && live && visibility !== kit.visibility && (
          <Button
            variant="secondary"
            loading={setKitVisibility.isPending}
            onClick={() =>
              setKitVisibility.mutate(
                { id: kit.id, visibility },
                { onSuccess: () => toast.success('Görünürlük güncellendi') },
              )
            }
          >
            Yalnızca görünürlüğü güncelle
          </Button>
        )}
        {admin && kit.publishedVersion !== null && (
          <Card className="p-5">
            {kit.status === 'archived' ? (
              <Button
                variant="secondary"
                leadingIcon={<ArchiveRestore aria-hidden="true" />}
                loading={archive.isPending}
                onClick={() =>
                  archive.mutate(
                    { id: kit.id, archived: false },
                    { onSuccess: () => toast.success('Kit arşivden çıkarıldı') },
                  )
                }
              >
                Arşivden çıkar
              </Button>
            ) : (
              <Button
                variant="danger-ghost"
                leadingIcon={<Archive aria-hidden="true" />}
                loading={archive.isPending}
                onClick={() =>
                  archive.mutate(
                    { id: kit.id, archived: true },
                    { onSuccess: () => toast.success('Kit arşivlendi') },
                  )
                }
              >
                Arşivle
              </Button>
            )}
            <p className="mt-2 text-xs text-fg-muted">
              Arşivdeki kit katalogdan çıkar; QR kodları “artık yayında değil” der.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
