import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '@/test/mocks/server'

import { useCaptionsUrl } from './useCaptionsUrl'

const REMOTE = 'https://files.example.test/storage/v1/object/public/media/uploads/altyazi.vtt'
const VTT = 'WEBVTT\n\n00:00.000 --> 00:02.000\nMerhaba\n'

describe('useCaptionsUrl', () => {
  beforeEach(() => {
    // jsdom has no object URLs.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local/altyazi')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  it('passes same-origin captions through', () => {
    const local = `${window.location.origin}/altyazi.vtt`
    const { result } = renderHook(() => useCaptionsUrl(local))
    expect(result.current).toBe(local)
  })

  it('hands captions from another origin to the track as a local object URL', async () => {
    server.use(
      http.get(REMOTE, () => new HttpResponse(VTT, { headers: { 'Content-Type': 'text/vtt' } })),
    )
    const { result, unmount } = renderHook(() => useCaptionsUrl(REMOTE))

    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe('blob:local/altyazi'))
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0]
    expect(blob instanceof Blob && (await blob.text())).toBe(VTT)

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local/altyazi')
  })

  it('keeps the loaded captions usable when the URL changes away and back', async () => {
    const other = REMOTE.replace('altyazi', 'diger')
    let objectUrls = 0
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:local/${++objectUrls}`)
    let finishOther: (() => void) | undefined
    server.use(
      http.get(REMOTE, () => new HttpResponse(VTT)),
      http.get(
        other,
        () =>
          new Promise<Response>((resolve) => {
            finishOther = () => resolve(new HttpResponse(VTT))
          }),
      ),
    )
    const { result, rerender, unmount } = renderHook(({ url }) => useCaptionsUrl(url), {
      initialProps: { url: REMOTE },
    })
    await waitFor(() => expect(result.current).toBe('blob:local/1'))

    rerender({ url: other })
    expect(result.current).toBeUndefined()
    rerender({ url: REMOTE })
    expect(result.current).toBe('blob:local/1')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    // The fresh copy replaces the first; the late answer for the other URL is ignored.
    await waitFor(() => expect(result.current).toBe('blob:local/2'))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local/1')
    finishOther?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current).toBe('blob:local/2')
    expect(objectUrls).toBe(2)

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local/2')
  })

  it('plays without captions when they cannot be loaded', async () => {
    server.use(http.get(REMOTE, () => new HttpResponse(null, { status: 404 })))
    const { result } = renderHook(() => useCaptionsUrl(REMOTE))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('has nothing to load without captions', () => {
    const { result } = renderHook(() => useCaptionsUrl(null))
    expect(result.current).toBeNull()
  })
})
