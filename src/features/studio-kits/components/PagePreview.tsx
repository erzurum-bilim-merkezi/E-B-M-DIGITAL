import { Eye } from 'lucide-react'
import { useRef, useState } from 'react'

import { checkPageUrl, type PageSource } from '@/entities/kit'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import {
  Alert,
  Button,
  HtmlPageFrame,
  Skeleton,
  UrlPageFrame,
  type PageFrameStatus,
} from '@/shared/ui'

const BOX =
  'relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-surface-muted'
const FRAME = 'absolute inset-0 size-full border-0'

function Placeholder({ children }: { children: string }) {
  return (
    <div className={BOX}>
      <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-fg-muted">
        {children}
      </p>
    </div>
  )
}

function HtmlPreview({ html, title }: { html: string; title: string }) {
  const [status, setStatus] = useState<PageFrameStatus>({ state: 'loading' })
  return (
    <div className="flex flex-col gap-3">
      <div className={BOX}>
        <HtmlPageFrame
          html={html}
          title={`Önizleme: ${title}`}
          className={FRAME}
          onStatus={setStatus}
        />
        {status.state === 'loading' && (
          <output className="absolute inset-0 block">
            <Skeleton className="size-full rounded-none" />
            <span className="sr-only">Sayfa hazırlanıyor…</span>
          </output>
        )}
      </div>
      {status.state === 'error' && (
        <Alert variant="warning" title="Sayfa bir hata bildirdi">
          {status.message || 'Ayrıntı yok.'} Kâşif’te çocuklara “Bu sayfa bu cihazda tam
          çalışmayabilir” denir. Sayfayı yeniden tasarlayabilir ya da HTML’i düzeltebilirsiniz.
        </Alert>
      )}
      {status.state === 'blocked' && (
        <Alert variant="danger" title="Sayfa kapatıldı">
          Sayfa kendi çerçevesini başka bir adrese götürmeye çalıştı; Kâşif böyle bir sayfayı
          çocuklara göstermez. Sayfayı yeniden tasarlayın ya da HTML’deki yönlendirmeyi kaldırın.
        </Alert>
      )}
      {status.state === 'unavailable' && (
        <Alert variant="danger" title="Önizleme açılamadı">
          Sayfanın çalışma dosyası indirilemedi. İnternet bağlantınızı kontrol edip sayfayı
          yenileyin.
        </Alert>
      )}
    </div>
  )
}

function UrlPreview({ url, title }: { url: string; title: string }) {
  const [opened, setOpened] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()
  const open = () => {
    setOpened(true)
    // The button is replaced by the page: focus follows into it instead of falling to <body>.
    focusAfterUpdate(frame)
  }
  return (
    <div className="flex flex-col gap-3">
      {opened ? (
        <div className={BOX}>
          <UrlPageFrame ref={frame} url={url} title={`Önizleme: ${title}`} className={FRAME} />
        </div>
      ) : (
        <div className={BOX}>
          <div className="absolute inset-0 grid place-items-center p-6">
            <Button variant="secondary" leadingIcon={<Eye aria-hidden="true" />} onClick={open}>
              Sayfayı önizle
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-fg-muted">
        Bazı siteler başka sitelerin içinde gösterilmeyi engeller. Önizleme boş ya da hata sayfası
        gösteriyorsa bu bağlantı Kâşif’te de açılmaz.
      </p>
    </div>
  )
}

/** The page as children will see it (Studio look); a link loads only when asked. */
export function PagePreview({ source, title }: { source: PageSource; title: string }) {
  if (source.kind === 'html') {
    return source.html.trim() ? (
      <HtmlPreview html={source.html} title={title} />
    ) : (
      <Placeholder>Sayfa tasarlanınca burada görünecek.</Placeholder>
    )
  }
  return checkPageUrl(source.url, window.location.origin) ? (
    <Placeholder>Geçerli bir bağlantı girince önizleyebilirsiniz.</Placeholder>
  ) : (
    // A new address starts closed again: nothing loads until asked.
    <UrlPreview key={source.url} url={source.url.trim()} title={title} />
  )
}
