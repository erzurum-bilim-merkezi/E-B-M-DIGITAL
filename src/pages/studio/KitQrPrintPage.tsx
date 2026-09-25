import { Printer } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'

import {
  LABEL_SIZES_MM,
  PRINT_TEMPLATE_IDS,
  PRINT_TEMPLATES,
  PrintSheet,
  type LabelSizeMm,
  type PrintTemplate,
} from '@/features/qr-print'
import { errorMessage } from '@/shared/api/errors'
import { useStudioTheme } from '@/shared/hooks/studio-theme'
import { Alert, Button, Field, Input, SegmentedControl, Select, Skeleton } from '@/shared/ui'

import { BackLink } from './components/BackLink'
import { useKitQrLabels } from './components/useKitQrLabels'

// Turkish URL values: `?sablon=kart|etiket|kutu&boyut=50`.
const TEMPLATE_PARAMS: Record<PrintTemplate, string> = {
  card: 'kart',
  label: 'etiket',
  box: 'kutu',
}

function parseTemplate(value: string | null): PrintTemplate {
  return PRINT_TEMPLATE_IDS.find((id) => TEMPLATE_PARAMS[id] === value) ?? 'card'
}

function parseSize(value: string | null): LabelSizeMm {
  return LABEL_SIZES_MM.find((size) => String(size) === value) ?? 50
}

/** Optional positive number from a text box: empty → automatic (`undefined`). */
function optionalNumber(value: string) {
  const parsed = Number(value)
  return value.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed
}

/** Printable A4 sheets of a kit's QR codes: cards, equipment labels or kit-box labels (F9.2). */
export function KitQrPrintPage() {
  const { kitId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const theme = useStudioTheme()
  const { kit, codes, active } = useKitQrLabels(kitId)
  const template = parseTemplate(params.get('sablon'))
  const sizeMm = parseSize(params.get('boyut'))
  const [grid, setGrid] = useState({ columns: '', rows: '', margin: '', gap: '' })
  const [note, setNote] = useState('')

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(key, value)
        return next
      },
      { replace: true },
    )

  return (
    <div
      data-theme={theme === 'system' ? undefined : theme}
      className="flex min-h-dvh flex-col bg-canvas text-fg"
    >
      <title>{`Yazdır · ${kit.data?.draft.title ?? 'Kit'} · Kâşif Studio`}</title>
      <header className="flex flex-col gap-4 border-b border-border bg-surface px-4 py-4 sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink to={`/studio/kitler/${kitId}/qr`}>QR kodlarına dön</BackLink>
          <h1 className="font-display text-lg font-semibold">
            QR yazdır: {kit.data?.draft.title ?? '…'}
          </h1>
          <Button
            className="ml-auto"
            leadingIcon={<Printer aria-hidden="true" />}
            disabled={active.length === 0}
            onClick={() => window.print()}
          >
            Yazdır / PDF
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <SegmentedControl
            label="Şablon"
            value={template}
            onValueChange={(value) => setParam('sablon', TEMPLATE_PARAMS[value])}
            options={PRINT_TEMPLATE_IDS.map((id) => ({
              value: id,
              label: PRINT_TEMPLATES[id].label,
            }))}
          />
          {template === 'label' && (
            <>
              <Field label="Etiket boyutu">
                <Select
                  value={String(sizeMm)}
                  onChange={(event) => setParam('boyut', event.target.value)}
                >
                  {LABEL_SIZES_MM.map((size) => (
                    <option key={size} value={size}>
                      {size} × {size} mm
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sütun" description="Boş = otomatik">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="w-24"
                  value={grid.columns}
                  onChange={(event) => setGrid({ ...grid, columns: event.target.value })}
                />
              </Field>
              <Field label="Satır" description="Boş = otomatik">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="w-24"
                  value={grid.rows}
                  onChange={(event) => setGrid({ ...grid, rows: event.target.value })}
                />
              </Field>
              <Field label="Kenar (mm)">
                <Input
                  type="number"
                  min={0}
                  max={60}
                  className="w-24"
                  placeholder="10"
                  value={grid.margin}
                  onChange={(event) => setGrid({ ...grid, margin: event.target.value })}
                />
              </Field>
              <Field label="Aralık (mm)">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  className="w-24"
                  placeholder="5"
                  value={grid.gap}
                  onChange={(event) => setGrid({ ...grid, gap: event.target.value })}
                />
              </Field>
            </>
          )}
          {template !== 'label' && (
            <Field
              label={template === 'card' ? 'Arka yüz notu' : 'Kutu notu'}
              description={
                template === 'card'
                  ? 'Doldurursanız çift taraflı baskı için ayna arka yüz sayfası eklenir.'
                  : 'Kutu etiketinin altına yazılır.'
              }
              className="min-w-64 flex-1"
            >
              <Input
                value={note}
                maxLength={160}
                placeholder="Kâşif uygulamasıyla okut, keşfet!"
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          )}
        </div>
        <p className="text-sm text-fg-muted">{PRINT_TEMPLATES[template].description}</p>
      </header>

      <main className="flex-1 p-4 sm:p-6 print:p-0">
        {codes.isPending || kit.isPending ? (
          <Skeleton className="mx-auto h-[70vh] max-w-[210mm]" />
        ) : codes.isError ? (
          <Alert variant="danger">{errorMessage(codes.error)}</Alert>
        ) : (
          <PrintSheet
            template={template}
            labels={active}
            kitTitle={kit.data?.draft.title ?? ''}
            entryMode={kit.data?.draft.qrEntryMode}
            labelSizeMm={sizeMm}
            columns={optionalNumber(grid.columns)}
            rows={optionalNumber(grid.rows)}
            marginMm={optionalNumber(grid.margin)}
            gapMm={optionalNumber(grid.gap)}
            backNote={note}
          />
        )}
      </main>
    </div>
  )
}
