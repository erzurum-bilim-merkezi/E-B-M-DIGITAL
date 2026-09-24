import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CloudOff,
  Copy,
  Download,
  Eye,
  History,
  Keyboard,
  LoaderCircle,
  MoreHorizontal,
  QrCode,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { validateKitForPublish, type KitIssue, type StudioKit } from '@/entities/kit'
import { errorMessage } from '@/shared/api/errors'
import { useHotkeys, modKeyLabel } from '@/shared/hooks/browser-hooks'
import { downloadJson } from '@/shared/lib/download'
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import {
  Alert,
  Badge,
  Button,
  buttonClasses,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Shortcut,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@/shared/ui'

import { KitStatusBadge } from '../KitsTable'
import { CardsTab } from './CardsTab'
import { fieldId } from './field-id'
import { GeneralTab } from './GeneralTab'
import { exportFileName, importKitJson } from './import-export'
import { PublishTab } from './PublishTab'
import { BadgeTab, ThemeTab } from './ThemeTab'
import { readDraftBackup, clearDraftBackup, useKitDraft, type SaveState } from './useKitDraft'
import { EDITOR_TABS, type EditorTabId } from './editor-tabs'

export type { EditorTabId } from './editor-tabs'

const TAB_LABELS: Record<EditorTabId, string> = {
  genel: 'Genel',
  kartlar: 'Kartlar',
  tema: 'Tema',
  rozet: 'Rozet',
  yayin: 'Yayın',
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const content = {
    saved: {
      icon: <Check aria-hidden="true" className="size-3.5" />,
      text: 'Kaydedildi',
      className: 'text-fg-muted',
    },
    dirty: {
      icon: <span aria-hidden="true" className="size-2 rounded-full bg-warning" />,
      text: 'Kaydedilmemiş değişiklik',
      className: 'text-fg-muted',
    },
    saving: {
      icon: <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />,
      text: 'Kaydediliyor…',
      className: 'text-fg-muted',
    },
    offline: {
      icon: <CloudOff aria-hidden="true" className="size-3.5" />,
      text: 'Çevrimdışı — yerelde saklandı',
      className: 'text-warning-fg',
    },
    error: {
      icon: <AlertTriangle aria-hidden="true" className="size-3.5" />,
      text: 'Kaydedilemedi',
      className: 'text-danger-fg',
    },
    conflict: {
      icon: <AlertTriangle aria-hidden="true" className="size-3.5" />,
      text: 'Çakışma',
      className: 'text-danger-fg',
    },
  }[state]
  return (
    <output
      aria-live="polite"
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', content.className)}
      data-save-state={state}
    >
      {content.icon}
      {content.text}
      {state === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Tekrar dene
        </button>
      )}
    </output>
  )
}

type KitEditorProps = {
  kit: StudioKit
  role: 'admin' | 'editor'
  tab: EditorTabId
  stepId: string | null
  onNavigate: (next: { tab?: EditorTabId; stepId?: string | null }) => void
  /** "Kopya olarak kaydet" on conflicts (page composes kit creation). */
  onSaveCopy: (draft: StudioKit['draft']) => Promise<void>
}

export function KitEditor({ kit, role, tab, stepId, onNavigate, onSaveCopy }: KitEditorProps) {
  const controller = useKitDraft(kit)
  const { draft, state, conflict } = controller
  const navigate = useNavigate()
  const issues = useMemo(() => validateKitForPublish(draft), [draft])
  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const [backup, setBackup] = useState<Awaited<ReturnType<typeof readDraftBackup>>>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)

  // Unsaved local edits from an earlier session (offline, expired session) → offer restore.
  const serverDraft = useRef(kit.draft)
  useEffect(() => {
    let cancelled = false
    void readDraftBackup(kit.id).then((found) => {
      if (
        !cancelled &&
        found &&
        JSON.stringify(found.draft) !== JSON.stringify(serverDraft.current)
      )
        setBackup(found)
    })
    return () => {
      cancelled = true
    }
  }, [kit.id])

  useHotkeys([
    { combo: 'shift+?', handler: () => setShortcutsOpen(true) },
    {
      combo: 'mod+shift+p',
      allowInInputs: true,
      handler: (event) => {
        event.preventDefault()
        // The preview reads the server draft: open it only once the edits are saved.
        controller
          .flush()
          .then(() => navigate(`/studio/kitler/${kit.id}/onizleme`))
          .catch((error: unknown) => toast.error(errorMessage(error)))
      },
    },
  ])

  const goToIssue = (issue: KitIssue) => {
    const targetTab: EditorTabId = issue.tab
    onNavigate({ tab: targetTab, ...(issue.stepId ? { stepId: issue.stepId } : {}) })
    const id =
      issue.field === 'ai'
        ? fieldId(issue.stepId ?? 'kit', 'title')
        : fieldId(issue.stepId ?? 'kit', issue.field)
    window.setTimeout(() => {
      const element = document.getElementById(id)
      element?.focus()
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          to="/studio/kitler"
          className="inline-flex items-center gap-1.5 self-start rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Kâşif Kitleri
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
            {draft.title || 'Adsız kit'}
          </h1>
          <KitStatusBadge kit={kit} />
          <SaveIndicator state={state} onRetry={() => controller.flush().catch(() => {})} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              to={`/studio/kitler/${kit.id}/onizleme`}
              onClick={() => controller.flush().catch(() => {})}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              <Eye aria-hidden="true" /> Önizle
            </Link>
            <Link
              to={`/studio/kitler/${kit.id}/qr`}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              <QrCode aria-hidden="true" /> QR oluştur
            </Link>
            <Link
              to={`/studio/kitler/${kit.id}/analiz`}
              className={buttonClasses({
                variant: 'ghost',
                size: 'sm',
                className: 'hidden sm:inline-flex',
              })}
            >
              <BarChart3 aria-hidden="true" /> Analiz
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Diğer işlemler">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => navigate(`/studio/kitler/${kit.id}/surumler`)}>
                  <History aria-hidden="true" /> Sürümler
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => downloadJson(draft, exportFileName(draft))}>
                  <Download aria-hidden="true" /> JSON olarak dışa aktar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => importInput.current?.click()}
                  disabled={role === 'editor' && kit.status === 'in_review'}
                >
                  <Upload aria-hidden="true" /> JSON içe aktar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                  <Keyboard aria-hidden="true" /> Klavye kısayolları
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={importInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Kit JSON dosyası"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file.text().then((text) => {
                  const result = importKitJson(text, draft)
                  if (!result.ok) {
                    toast.error(result.message)
                    return
                  }
                  controller.update(() => result.document)
                  toast.success('Kit içe aktarıldı', {
                    description: `${result.document.steps.length} kart yüklendi.`,
                  })
                })
              }}
            />
          </div>
        </div>
      </div>

      {backup && (
        <Alert
          variant="warning"
          title="Kaydedilmemiş yerel değişiklikler bulundu"
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  controller.restoreBackup(backup)
                  setBackup(null)
                  toast.success('Yerel değişiklikler geri yüklendi')
                }}
              >
                Geri yükle
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void clearDraftBackup(kit.id)
                  setBackup(null)
                }}
              >
                Sil
              </Button>
            </div>
          }
        >
          {formatDateTime(backup.savedAt)} tarihinde bu cihazda sunucuya ulaşmamış değişiklikler
          var.
        </Alert>
      )}

      {role === 'editor' && kit.status === 'in_review' && (
        <Alert variant="info">
          Bu kit incelemede ve editörlere kilitli. Düzenlemek için Yayın sekmesinden incelemeden
          geri çekin.
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) =>
          onNavigate({ tab: EDITOR_TABS.find((candidate) => candidate === value) ?? 'genel' })
        }
      >
        <TabsList aria-label="Kit editörü">
          {EDITOR_TABS.map((id) => {
            const count =
              id === 'yayin'
                ? 0
                : issues.filter((issue) => issue.severity === 'error' && issue.tab === id).length
            return (
              <TabsTrigger key={id} value={id}>
                {TAB_LABELS[id]}
                {count > 0 && (
                  // aria-label on a plain element is not reliably read; use visually hidden text.
                  <Badge variant="danger" className="h-5 px-1.5">
                    <span aria-hidden="true">{count}</span>
                    <span className="sr-only"> {count} sorun</span>
                  </Badge>
                )}
                {id === 'yayin' && errorCount > 0 && (
                  <Badge variant="danger" className="h-5 px-1.5">
                    <span aria-hidden="true">{errorCount}</span>
                    <span className="sr-only"> toplam {errorCount} sorun</span>
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div className="pt-5">
          <TabsContent value="genel">
            <GeneralTab
              kit={kit}
              draft={draft}
              issues={issues}
              update={controller.update}
              beforeRename={async () => void (await controller.flush())}
            />
          </TabsContent>
          <TabsContent value="kartlar">
            <CardsTab
              kit={kit}
              controller={controller}
              issues={issues}
              selectedId={stepId}
              onSelect={(id) => onNavigate({ stepId: id })}
            />
          </TabsContent>
          <TabsContent value="tema">
            <ThemeTab draft={draft} update={controller.update} />
          </TabsContent>
          <TabsContent value="rozet">
            <BadgeTab
              draft={draft}
              update={controller.update}
              issueFor={(field) =>
                issues.find((issue) => issue.field === field && !issue.stepId)?.message
              }
            />
          </TabsContent>
          <TabsContent value="yayin">
            <PublishTab
              kit={kit}
              draft={draft}
              issues={issues}
              role={role}
              flush={controller.flush}
              onGo={goToIssue}
            />
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={conflict !== null} onOpenChange={() => undefined}>
        <DialogContent
          title="Bu kit başka bir yerde değiştirildi"
          description="Siz düzenlerken kit başka bir sekmede ya da başka bir kişi tarafından kaydedildi."
          footer={
            <>
              <Button variant="secondary" onClick={() => controller.resolveConflict('theirs')}>
                Son hâlini yükle
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Copy aria-hidden="true" />}
                onClick={() => {
                  void onSaveCopy(draft).then(() => controller.resolveConflict('theirs'))
                }}
              >
                Benimkini kopya olarak kaydet
              </Button>
              <Button variant="danger" onClick={() => controller.resolveConflict('mine')}>
                Benimkiyle üzerine yaz
              </Button>
            </>
          }
        >
          <p className="text-sm text-fg-muted">
            {conflict ? `Son kayıt: ${formatDateTime(conflict.updatedAt)}.` : ''} Değişikliklerinizi
            kaybetmemek için kopya olarak kaydedebilirsiniz.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent title="Klavye kısayolları" size="sm">
          <dl className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <dt>Kaydet</dt>
            <dd>
              <Shortcut keys={[modKeyLabel(), 'S']} />
            </dd>
            <dt>Önizle</dt>
            <dd>
              <Shortcut keys={[modKeyLabel(), 'Shift', 'P']} />
            </dd>
            <dt>Komut paleti</dt>
            <dd>
              <Shortcut keys={[modKeyLabel(), 'K']} />
            </dd>
            <dt>Kartı taşı</dt>
            <dd>
              <Shortcut keys={['Alt', '↑ / ↓']} />
            </dd>
            <dt>Bu pencere</dt>
            <dd>
              <Shortcut keys={['?']} />
            </dd>
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  )
}
