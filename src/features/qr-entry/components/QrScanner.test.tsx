import { renderWithProviders, screen, waitFor } from '@/test/test-utils'

import { QrScanner } from './QrScanner'

const EXPLANATION = 'Kâşif, QR kodu görmek için kamerayı kullanır. Görüntü kaydedilmez.'

/** jsdom has no camera API; tests install one on `navigator` and remove it afterwards. */
function stubCamera(getUserMedia: () => Promise<unknown>) {
  const spy = vi.fn<() => Promise<unknown>>(getUserMedia)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: spy },
  })
  return spy
}

function createFakeStream() {
  const track = {
    stop: vi.fn<() => void>(),
    getCapabilities: () => ({ torch: true }),
    applyConstraints: vi.fn<(constraints: MediaTrackConstraints) => Promise<void>>(async () => {}),
  }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  return { stream, track }
}

/** A playing video and a native QR detector that always sees `rawValue`. */
function stubVideoAndDetector(rawValue: string) {
  const detect = vi.fn<(source: unknown) => Promise<{ rawValue: string; format: string }[]>>(
    async () => [{ rawValue, format: 'qr_code' }],
  )
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      static getSupportedFormats = async () => ['qr_code']
      detect = detect
    },
  )
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(
    HTMLMediaElement.HAVE_ENOUGH_DATA,
  )
  return detect
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

describe('QrScanner', () => {
  it('explains the camera first and opens it only after a tap', () => {
    const getUserMedia = stubCamera(() => new Promise(() => {}))

    renderWithProviders(<QrScanner onDetected={vi.fn<(text: string) => void>()} />)

    expect(screen.getByText(EXPLANATION)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kamerayı aç' })).toBeInTheDocument()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('tells the child to type the code when camera permission is refused', async () => {
    const getUserMedia = stubCamera(() =>
      Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    )
    const { user } = renderWithProviders(<QrScanner onDetected={vi.fn<(text: string) => void>()} />)

    await user.click(screen.getByRole('button', { name: 'Kamerayı aç' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kamera izni verilmedi. Kodu elle yazabilirsin.',
    )
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: { facingMode: { ideal: 'environment' } } }),
    )
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
  })

  it('says there is no camera on devices without a camera API', async () => {
    const { user } = renderWithProviders(<QrScanner onDetected={vi.fn<(text: string) => void>()} />)

    await user.click(screen.getByRole('button', { name: 'Kamerayı aç' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu cihazda kamera bulunamadı.')
  })

  it('reports each code once, toggles the torch and stops the camera when paused', async () => {
    const { stream, track } = createFakeStream()
    const getUserMedia = stubCamera(async () => stream)
    const detect = stubVideoAndDetector('KC-01')
    const onDetected = vi.fn<(text: string) => void>()
    const { user, rerender } = renderWithProviders(<QrScanner onDetected={onDetected} />)

    await user.click(screen.getByRole('button', { name: 'Kamerayı aç' }))

    expect(await screen.findByText('QR kodu çerçevenin içine getir.')).toBeInTheDocument()
    // The same code stays in view for several frames: one detection only.
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(3))
    expect(onDetected).toHaveBeenCalledOnce()
    expect(onDetected).toHaveBeenCalledWith('KC-01')

    const torch = screen.getByRole('button', { name: 'Fener' })
    await user.click(torch)
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] })
    expect(torch).toHaveAttribute('aria-pressed', 'true')

    rerender(<QrScanner onDetected={onDetected} paused />)
    expect(track.stop).toHaveBeenCalled()
    expect(screen.getByText('Kamera bekliyor…')).toBeInTheDocument()

    rerender(<QrScanner onDetected={onDetected} />)
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
  })

  it('turns the camera off and returns to the explanation when closed', async () => {
    const { stream, track } = createFakeStream()
    stubCamera(async () => stream)
    stubVideoAndDetector('KC-01')
    const { user } = renderWithProviders(<QrScanner onDetected={vi.fn<(text: string) => void>()} />)

    await user.click(screen.getByRole('button', { name: 'Kamerayı aç' }))
    await user.click(await screen.findByRole('button', { name: 'Kamerayı kapat' }))

    expect(track.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Kamerayı aç' })).toHaveFocus()
  })
})
