import type { Avatar, Explorer, ExplorerSettings } from '@/entities/explorer'

export type RegisterInput = { nickname: string; avatar: Avatar }

export type ExplorerPatch = Partial<{
  nickname: string
  avatar: Avatar
  settings: ExplorerSettings
}>

/** Kâşif membership (ADR 0009): nickname + avatar; the device is linked, never the identity. */
export type ExplorerService = {
  register(input: RegisterInput): Promise<{ explorer: Explorer; restoreCode: string }>
  /** "Kâşif kodum var": links an existing membership to this device (rate limited). */
  restore(code: string): Promise<{ explorer: Explorer; restoreCode: string }>
  listOnDevice(): Promise<Explorer[]>
  update(explorerId: string, patch: ExplorerPatch): Promise<Explorer>
  /** "Kodumu yenile": the old code stops working. */
  renewCode(explorerId: string): Promise<{ restoreCode: string }>
  /** Removes the link to this device only (the membership stays). */
  unlink(explorerId: string): Promise<void>
  /** Centre tablet hand-over: removes every member link of this device and its stored codes. */
  unlinkAll(): Promise<void>
  /** "Üyeliğimi ve verilerimi sil": deletes membership, progress, badges and events. */
  deleteMembership(explorerId: string): Promise<void>
  activateCenterDevice(setupCode: string): Promise<{ id: string; label: string }>
  exitCenterMode(pin: string): Promise<void>
}
