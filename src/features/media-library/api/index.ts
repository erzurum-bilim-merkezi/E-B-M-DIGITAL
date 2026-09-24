import { createMockMediaRepository } from './media.mock'
import type { MediaRepository } from './port'

export const mediaRepository: MediaRepository = createMockMediaRepository()

export type * from './port'
