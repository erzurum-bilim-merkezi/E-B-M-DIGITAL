/** Kit editor tabs, in display order (`?sekme=` values). */
export const EDITOR_TABS = ['genel', 'kartlar', 'tema', 'rozet', 'yayin'] as const
export type EditorTabId = (typeof EDITOR_TABS)[number]
