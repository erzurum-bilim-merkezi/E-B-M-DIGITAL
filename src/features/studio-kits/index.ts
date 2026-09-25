// Public API of Studio kit management (repository, publishing, QR registry + editor UI).
export { kitRepository, publishingService, qrRegistry } from './api'
export type * from './api/port'
export {
  allKitsQueryOptions,
  kitListQueryOptions,
  kitQrQueryOptions,
  kitQueryOptions,
  kitVersionsQueryOptions,
  studioKitKeys,
  takenQrPrefixesQueryOptions,
  useArchiveKit,
  useCreateKit,
  useDeleteKit,
  useDuplicateKit,
  usePublishKit,
  useRegenerateSnapshots,
  useRenameKit,
  useRequestChanges,
  useRestoreVersion,
  useSaveKit,
  useSetVisibility,
  useSubmitForReview,
  useWithdrawReview,
} from './api/queries'
export { KitsTable, KitStatusBadge, type KitRowStats } from './components/KitsTable'
export { KitWizard, type AiKitDraftComponent } from './components/KitWizard'
export { EDITOR_TABS, type EditorTabId } from './components/editor/editor-tabs'
export { KitEditor } from './components/editor/KitEditor'
export {
  EditorServicesProvider,
  type AiCardText,
  type AiSceneVisual,
  type EditorServices,
  type ResolvedAsset,
} from './components/editor/services'
export { applyAiText } from './components/editor/apply-ai-text'
export { importKitJson } from './components/editor/import-export'
