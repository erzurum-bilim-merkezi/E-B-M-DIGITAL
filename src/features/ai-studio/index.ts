// Studio-only AI assistance (ADR 0018): scenes, icons, card text, kit drafts. Children never
// reach it. The provider (Gemini free tier or the fake) is chosen server-side.
export { aiService } from './api'
export type * from './api/port'
export {
  aiKeys,
  aiQuotaQueryOptions,
  useRefreshAiQuota,
  useSaveAiIcon,
  useSaveScene,
} from './api/queries'
export { FAKE_TRIGGERS } from './api/fake-provider'
export { AiIconGenerator, AiKitDraftForm, AiScenePanel, AiTextButton } from './components/AiPanels'
export { useAiEnabled } from './hooks/useAiEnabled'
