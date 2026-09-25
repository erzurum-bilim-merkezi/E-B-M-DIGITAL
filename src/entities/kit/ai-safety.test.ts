import { describe, expect, it } from 'vitest'

import { AI_ICON_MAX_BYTES, checkAiSvg } from './index.ts'

const OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">'
const LABELS = '<title>Tohum</title><desc>Toprakta bir tohum</desc>'

/** A scene frame with the given body between the labels and the closing tag. */
function scene(body: string, open = OPEN) {
  return `${open}${LABELS}${body}</svg>`
}

describe('checkAiSvg', () => {
  it('accepts plain drawings with gradients, text and animation CSS', () => {
    const svg = scene(
      '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#112233"/></linearGradient></defs>' +
        '<style>@keyframes pop{from{opacity:0}to{opacity:1}}.a{animation:pop .5s}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>' +
        '<rect width="400" height="260" fill="url(#sky)"/>' +
        '<g class="a" transform="translate(10 10)"><circle cx="20" cy="20" r="10" fill="#ffcc00"/>' +
        '<text x="200" y="150" text-anchor="middle" font-size="40">Tohum &amp; toprak</text></g>',
    )
    expect(checkAiSvg(svg)).toEqual([])
  })

  it('accepts a small icon without the scene viewBox', () => {
    const icon =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Roket</title><desc>Roket ikonu</desc><circle cx="32" cy="32" r="30" fill="#6655ff"/></svg>'
    expect(checkAiSvg(icon, { maxBytes: AI_ICON_MAX_BYTES, requireViewBox: false })).toEqual([])
  })

  it('accepts entities in text', () => {
    const svg = `${OPEN}<title>Ali&apos;nin tohumu</title><desc>Su &amp; toprak</desc></svg>`
    expect(checkAiSvg(svg)).toEqual([])
  })

  it.each([
    ['a namespaced script', '<h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script>'],
    ['an XHTML island', '<x:div xmlns:x="http://www.w3.org/1999/xhtml">hi</x:div>'],
    ['a link', '<a href="#x"><rect width="1" height="1"/></a>'],
    ['an image', '<image href="#x"/>'],
    ['a use reference', '<use href="#x"/>'],
    [
      'animation elements',
      '<rect width="1" height="1"><set attributeName="fill" to="red"/></rect>',
    ],
    ['an iframe', '<iframe/>'],
    ['a filter', '<filter id="f"/>'],
  ])('rejects %s', (_, body) => {
    expect(checkAiSvg(scene(body))).toContain('element')
  })

  it.each([
    ['a namespaced attribute', '<rect width="1" height="1" xlink:title="x"/>'],
    ['an unknown attribute', '<rect width="1" height="1" data-x="1"/>'],
    ['a second namespace', '<g xmlns="http://www.w3.org/1999/xhtml"/>'],
    ['a character reference in a value', '<rect width="1" height="1" fill="u&#114;l(x)"/>'],
    ['a CSS escape in a value', '<rect width="1" height="1" fill="\\75rl(https://x.test/p#p)"/>'],
    ['a value that hides a tag end', '<rect fill="a>" width="1"/>'],
    ['an unquoted value', '<rect width=1 height="1"/>'],
    ['attributes on a closing tag', '<g></g fill="red">'],
  ])('rejects %s', (_, body) => {
    expect(checkAiSvg(scene(body))).toContain('attribute')
  })

  it('rejects any namespace declaration on the root but the SVG one', () => {
    expect(
      checkAiSvg(scene('', `${OPEN.slice(0, -1)} xmlns:h="http://www.w3.org/1999/xhtml">`)),
    ).toContain('attribute')
    expect(
      checkAiSvg(scene('', '<svg xmlns="http://www.w3.org/1999/xhtml" viewBox="0 0 400 260">')),
    ).toContain('attribute')
  })

  it.each([
    ['a DOCTYPE', '<!DOCTYPE svg [<!ENTITY x "y">]>'],
    ['CDATA', '<style><![CDATA[.a{}]]></style>'],
    ['a comment', '<!-- hi -->'],
    ['a processing instruction', '<?xml-stylesheet href="x.css"?>'],
  ])('rejects %s', (_, body) => {
    expect(checkAiSvg(scene(body))).toContain('markup-declaration')
  })

  it.each([
    ['an escaped at-rule', '<style>\\40 import "x.css";</style>'],
    ['a font face', '<style>@font-face{font-family:x}</style>'],
    ['an external URL', '<style>.a{fill:url(https://example.com/x)}</style>'],
    ['inline style with a URL', '<rect width="1" height="1" style="fill:url(//x)"/>'],
    ['a CSS expression', '<rect width="1" height="1" style="width:expression(alert(1))"/>'],
    ['a spaced end tag', '<style>@\\69mport "https://x.test/a.css";</style >'],
    ['an element inside', '<style><g></g>@\\69mport "https://x.test/a.css";</style>'],
    ['an allowed element hiding a URL', '<style>.a{fill:u\\72 l(https://x.test/p)}<g/></style>'],
    ['a character reference', '<style>&#64;import "https://x.test/a.css";</style>'],
    ['an image set', '<style>svg{background-image:image-set("https://x.test/p.png" 1x)}</style>'],
    ['an unquoted image set', '<style>svg{mask-image:-webkit-image-set(x 1x)}</style>'],
    ['a src function', '<rect width="1" height="1" style="mask-image:src(x)"/>'],
    ['no end tag', '<style>.a{opacity:1}'],
  ])('rejects CSS with %s', (_, body) => {
    expect(checkAiSvg(scene(body))).toContain('css')
  })

  it('names the classic problems too', () => {
    const svg = scene('<script>alert(1)</script><rect onload="x()" width="1" height="1"/>')
    expect(checkAiSvg(svg)).toEqual(
      expect.arrayContaining(['script', 'event-handler', 'element', 'attribute']),
    )
    expect(checkAiSvg(scene('<h:script>1</h:script>'))).toContain('script')
    expect(checkAiSvg(scene('<svg:foreignObject/>'))).toContain('foreign-object')
  })

  it('rejects a stray angle bracket and requires the labels', () => {
    expect(checkAiSvg(scene('< script>'))).toContain('element')
    expect(checkAiSvg(`${OPEN}<rect width="1" height="1"/></svg>`)).toEqual(
      expect.arrayContaining(['missing-title', 'missing-desc']),
    )
  })
})
