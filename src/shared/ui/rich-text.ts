/** Plain text of rich text (for speech, titles, CSV). */
export function richTextToPlain(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
}
