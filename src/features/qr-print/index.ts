// Public API of the feature. Import from '@/features/qr-print' only — never from internal paths.
export { PrintSheet, type PrintLabel, type PrintSheetProps } from './components/PrintSheet'
export {
  QrPreviewGrid,
  type QrCodeState,
  type QrPreviewGridProps,
  type QrPreviewItem,
} from './components/QrPreviewGrid'
export {
  LABEL_SIZES_MM,
  PRINT_TEMPLATE_IDS,
  PRINT_TEMPLATES,
  printTemplateSchema,
  type LabelSizeMm,
  type PrintTemplate,
} from './lib/print-layout'
export {
  buildQrZip,
  qrFileName,
  qrZipFileName,
  renderQrPng,
  renderQrSvg,
  wrapLines,
  type QrLabel,
} from './lib/qr-image'
