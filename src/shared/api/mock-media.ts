import { createStore, del, entries, get, set, setMany, clear } from 'idb-keyval'

/**
 * Blob store for the mock backend's uploaded media (IndexedDB, so large files do not exhaust
 * the 5 MB localStorage quota). Content refers to blobs as `mock-media:<assetId>` URLs, which
 * `resolveMediaUrl` turns into object URLs at render time.
 */
export const MOCK_MEDIA_SCHEME = 'mock-media:'

let store: ReturnType<typeof createStore> | null = null
function mediaStore() {
  store ??= createStore('kasif-mock-media', 'blobs')
  return store
}

const objectUrls = new Map<string, string>()

export function mockMediaUrl(assetId: string) {
  return `${MOCK_MEDIA_SCHEME}${assetId}`
}

export function isMockMediaUrl(url: string) {
  return url.startsWith(MOCK_MEDIA_SCHEME)
}

export async function putMockMedia(assetId: string, blob: Blob) {
  await set(assetId, blob, mediaStore())
}

export async function getMockMedia(assetId: string): Promise<Blob | undefined> {
  const value: unknown = await get(assetId, mediaStore())
  return value instanceof Blob ? value : undefined
}

export async function deleteMockMedia(assetId: string) {
  const url = objectUrls.get(assetId)
  if (url) URL.revokeObjectURL(url)
  objectUrls.delete(assetId)
  await del(assetId, mediaStore())
}

/** `mock-media:<id>` → object URL (cached); any other URL is returned unchanged. */
export async function resolveMediaUrl(url: string): Promise<string | null> {
  if (!isMockMediaUrl(url)) return url
  const assetId = url.slice(MOCK_MEDIA_SCHEME.length)
  const cached = objectUrls.get(assetId)
  if (cached) return cached
  const blob = await getMockMedia(assetId)
  if (!blob) return null
  const objectUrl = URL.createObjectURL(blob)
  objectUrls.set(assetId, objectUrl)
  return objectUrl
}

export function peekResolvedMediaUrl(url: string) {
  return isMockMediaUrl(url) ? (objectUrls.get(url.slice(MOCK_MEDIA_SCHEME.length)) ?? null) : url
}

export type MockMediaDump = { id: string; type: string; base64: string }[]

async function blobToBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export async function exportMockMedia(): Promise<MockMediaDump> {
  const all = await entries<string, unknown>(mediaStore())
  const blobs = all.filter((entry): entry is [string, Blob] => entry[1] instanceof Blob)
  return Promise.all(
    blobs.map(async ([id, blob]) => ({ id, type: blob.type, base64: await blobToBase64(blob) })),
  )
}

export async function importMockMedia(dump: MockMediaDump) {
  await clear(mediaStore())
  const blobs = dump.map(({ id, type, base64 }): [string, Blob] => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return [id, new Blob([bytes], { type })]
  })
  // One IndexedDB transaction for all blobs.
  await setMany(blobs, mediaStore())
}

export async function resetMockMedia() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url)
  objectUrls.clear()
  await clear(mediaStore())
}
