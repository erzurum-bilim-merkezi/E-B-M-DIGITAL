/** Anchor-based download (works in every browser; testable via Playwright's download event). */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function downloadText(text: string, fileName: string, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), fileName)
}

export function downloadJson(value: unknown, fileName: string) {
  downloadText(`${JSON.stringify(value, null, 2)}\n`, fileName, 'application/json')
}
