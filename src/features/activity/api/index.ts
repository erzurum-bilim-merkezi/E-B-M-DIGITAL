import { createMockEventSink, createMockProgressService } from './activity.mock'
import type { EventSink, ProgressService } from './port'
import { configureQueue } from './queue'

export const eventSink: EventSink = createMockEventSink()
export const progressService: ProgressService = createMockProgressService()

configureQueue({ sink: eventSink })

export type * from './port'
