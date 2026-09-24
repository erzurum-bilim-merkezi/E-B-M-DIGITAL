import type {
  KitCategory,
  KitDocument,
  KitIcon,
  KitIssue,
  KitStatus,
  KitTemplateId,
  KitVersion,
  KitVisibility,
  StudioKit,
} from '@/entities/kit'

export type KitStatusFilter = KitStatus | 'all'

export type KitListFilter = {
  status: KitStatusFilter
  query: string
  page: number
  pageSize: number
}

export type KitListPage = {
  items: StudioKit[]
  total: number
  page: number
  pageCount: number
}

export type CreateKitInput = {
  templateId: KitTemplateId
  title: string
  slug: string
  qrPrefix: string
  tagline: string
  description: string
  category: KitCategory
  ageRange: { min: number; max: number }
  durationMinutes: number
  icon: KitIcon
  /** Full document (AI kit draft, JSON import) instead of a template. */
  document?: KitDocument
}

export type KitRepository = {
  list(filter: KitListFilter): Promise<KitListPage>
  listAll(): Promise<StudioKit[]>
  get(id: string): Promise<StudioKit>
  create(input: CreateKitInput): Promise<StudioKit>
  /** Saves the working copy. Throws `conflict` (with `details.latest`) on a stale lockVersion. */
  update(id: string, draft: KitDocument, lockVersion: number): Promise<StudioKit>
  /** Changes slug and QR prefix — only before the first publish. */
  rename(id: string, slug: string, qrPrefix: string, lockVersion: number): Promise<StudioKit>
  duplicate(id: string): Promise<StudioKit>
  /** Only kits that were never published can be deleted. */
  remove(id: string): Promise<void>
  checkAvailability(
    slug: string,
    qrPrefix: string,
    exceptId?: string,
  ): Promise<{ slugTaken: boolean; prefixTaken: boolean }>
  /** QR prefixes no new kit may take: in use, registered, or kept by a renamed/deleted kit. */
  listTakenPrefixes(): Promise<string[]>
}

export type PublishInput = {
  notes: string
  visibility: KitVisibility
  lockVersion: number
  /** "AI içeriğini bilimsel doğruluk açısından kontrol ettim" — required when the kit uses AI. */
  aiReviewConfirmed: boolean
}

export type PublishingService = {
  submitForReview(kitId: string, lockVersion: number): Promise<StudioKit>
  withdrawReview(kitId: string): Promise<StudioKit>
  requestChanges(kitId: string, note: string): Promise<StudioKit>
  publish(kitId: string, input: PublishInput): Promise<{ kit: StudioKit; version: KitVersion }>
  setVisibility(kitId: string, visibility: KitVisibility): Promise<StudioKit>
  archive(kitId: string): Promise<StudioKit>
  unarchive(kitId: string): Promise<StudioKit>
  listVersions(kitId: string): Promise<KitVersion[]>
  restoreToDraft(kitId: string, version: number, lockVersion: number): Promise<StudioKit>
  /** Rebuilds catalog / qr-index / latest pointers from the database (admin, recovery). */
  regenerateSnapshots(): Promise<void>
}

export type QrCodeState = 'live' | 'pending' | 'retired'

export type KitQrCode = {
  code: string
  /** `null` = the kit's own code. */
  stepId: string | null
  title: string
  icon: KitIcon
  cardNumber: number | null
  state: QrCodeState
}

export type QrRegistry = {
  listForKit(kitId: string): Promise<KitQrCode[]>
}

export type PublishValidationDetails = { issues: KitIssue[]; missingAssets: string[] }
