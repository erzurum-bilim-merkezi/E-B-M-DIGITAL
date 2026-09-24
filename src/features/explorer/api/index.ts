import { createMockExplorerService } from './explorer.mock'
import type { ExplorerService } from './port'

export const explorerService: ExplorerService = createMockExplorerService()

export type * from './port'
