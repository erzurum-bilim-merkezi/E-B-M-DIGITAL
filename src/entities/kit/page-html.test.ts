import {
  checkPageHtml,
  checkPageUrl,
  createDefaultStep,
  createKitFromTemplate,
  kitDocumentSchema,
  MAX_KIT_PAGE_HTML,
  MAX_PAGE_HTML,
  PAGE_PROBLEM_MESSAGES,
  validateKitForPublish,
  type KitDocument,
  type Step,
} from './index.ts'

const page = (script: string, body = '<canvas></canvas>') =>
  `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><title>Gezegen</title><style>body{margin:0}</style></head>
<body>${body}
<script type="module">
${script}
</script>
</body>
</html>`

const GOOD = page(`import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
// rotate the planet: comments with // must not look like addresses
const scene = new THREE.Scene()
const location = new THREE.Vector3(0, 1, 0)
const group = new THREE.Group()
group.parent?.remove(group)
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
const controls = new OrbitControls(new THREE.PerspectiveCamera(), document.querySelector('canvas'))
setTimeout(() => scene.add(group), 10)
if (location.y > 0) controls.update()`)

describe('checkPageHtml', () => {
  it('accepts a self-contained three.js page', () => {
    expect(checkPageHtml(GOOD)).toEqual([])
  })

  it('reports an empty page as empty only', () => {
    expect(checkPageHtml('   ')).toEqual(['empty'])
  })

  it('needs a whole document', () => {
    expect(checkPageHtml('<canvas></canvas>')).toContain('not-html')
  })

  it('refuses pages longer than the limit', () => {
    const long = page(`const text = '${'a'.repeat(MAX_PAGE_HTML)}'`)

    expect(checkPageHtml(long)).toContain('too-large')
  })

  it.each([
    ['an https address', page(`const u = 'https://example.org/a.png'`), 'external-url'],
    ['a scheme-relative image', page('', '<img src="//cdn.example.org/a.png">'), 'external-url'],
    [
      'a CSS url to another host',
      page('', '<div style="background:url(//x.org/a)"></div>'),
      'external-url',
    ],
    ['a stylesheet link', page('', '<link rel="stylesheet" href="a.css">'), 'external-url'],
    ['@import', page('', '<style>@import "a.css";</style>'), 'external-url'],
    ['a link', page('', '<a href="#x">Git</a>'), 'link'],
    ['a form', page('', '<form><button>Gönder</button></form>'), 'form'],
    ['an iframe', page('', '<iframe></iframe>'), 'embed'],
    ['an object', page('', '<object></object>'), 'embed'],
    ['a base tag', page('', '<base href="/">'), 'base'],
    ['a meta refresh', page('', '<meta http-equiv="refresh" content="0">'), 'http-equiv'],
    ['fetch', page(`fetch('data.json')`), 'network'],
    ['XMLHttpRequest', page('new XMLHttpRequest()'), 'network'],
    ['a WebSocket', page(`new WebSocket('wss')`), 'network'],
    ['a worker', page(`new Worker('w.js')`), 'network'],
    ['localStorage', page(`localStorage.setItem('a', '1')`), 'storage'],
    ['cookies', page(`document.cookie = 'a=1'`), 'storage'],
    ['location.href', page(`location.href = '/x'`), 'navigation'],
    ['assigning location', page(`window.location = '/x'`), 'navigation'],
    ['location.replace', page(`location.replace('/x')`), 'navigation'],
    ['history', page(`history.pushState({}, '', '/x')`), 'navigation'],
    ['a javascript: URL', page('', '<button onclick="javascript:void 0">x</button>'), 'navigation'],
    ['window.open', page(`window.open('/x')`), 'popup'],
    ['eval', page(`eval('1')`), 'eval'],
    ['new Function', page(`new Function('return 1')`), 'eval'],
    ['a string timer', page(`setTimeout('go()', 10)`), 'eval'],
    ['window.parent', page('window.parent.document'), 'parent-access'],
    ['top.location', page(`top.location = '/'`), 'parent-access'],
    ['postMessage', page(`postMessage('x', '*')`), 'parent-access'],
    ['another module', page(`import confetti from 'canvas-confetti'`), 'import'],
    ['a dynamic import', page(`import('three/addons/loaders/GLTFLoader.js')`), 'import'],
    ['a computed import', page('import(name)'), 'import'],
    ['a script file', page('', '<script src="a.js"></script>'), 'import'],
    ['its own import map', page('', '<script type="importmap">{}</script>'), 'import'],
  ])('rejects %s', (_, html, problem) => {
    expect(checkPageHtml(html)).toContain(problem)
  })

  it('has a Turkish reason for every problem', () => {
    for (const message of Object.values(PAGE_PROBLEM_MESSAGES)) expect(message).toMatch(/\S/)
  })
})

describe('checkPageUrl', () => {
  it.each([
    ['', 'empty'],
    ['ornek', 'invalid'],
    ['https://localhost/a', 'invalid'],
    ['https://kisi:sifre@ornek.org/', 'invalid'],
    ['http://phet.colorado.edu/sims/a.html', 'not-https'],
    ['javascript:alert(1)', 'not-https'],
  ])('rejects “%s” (%s)', (url, problem) => {
    expect(checkPageUrl(url)).toBe(problem)
  })

  it('accepts an https page of another site', () => {
    expect(checkPageUrl(' https://phet.colorado.edu/sims/html/a/latest/a_tr.html ')).toBeNull()
  })

  it('refuses the app’s own origin: framed with its origin it could read the device session', () => {
    const app = 'https://erzurum-bilim-merkezi.github.io'

    expect(checkPageUrl(`${app}/E-B-M-DIGITAL/`, app)).toBe('same-origin')
    expect(checkPageUrl('https://serdar.github.io/demo/', app)).toBeNull()
  })
})

function pageKit(steps: Step[]): KitDocument {
  const kit = createKitFromTemplate('page', {
    id: crypto.randomUUID(),
    title: 'Güneş Sistemi',
    slug: 'gunes-sistemi',
    qrPrefix: 'GS',
  })
  return { ...kit, steps, qrSequence: steps.length }
}

function pageStep(index: number, source: Extract<Step, { type: 'interactive-page' }>['source']) {
  return {
    ...createDefaultStep('interactive-page', {
      id: crypto.randomUUID(),
      slug: `sayfa-${index}`,
      qrCode: `GS-0${index}`,
    }),
    source,
  }
}

function sourceIssues(source: Extract<Step, { type: 'interactive-page' }>['source']) {
  return validateKitForPublish(pageKit([pageStep(1, source)])).filter(
    (issue) => issue.field === 'source',
  )
}

describe('interactive page cards', () => {
  it('start from the page template as one card with an empty page', () => {
    const kit = pageKit([])
    const fresh = createKitFromTemplate('page', {
      id: kit.id,
      title: 'Güneş Sistemi',
      slug: 'gunes-sistemi',
      qrPrefix: 'GS',
    })

    expect(fresh.steps).toHaveLength(1)
    expect(fresh.steps[0]).toMatchObject({
      type: 'interactive-page',
      qrCode: 'GS-01',
      source: { kind: 'html', html: '' },
    })
    expect(kitDocumentSchema.safeParse(fresh).success).toBe(true)
  })

  it('keep all pages of a kit under the draft budget', () => {
    const html = page(`const a = '${'a'.repeat(MAX_PAGE_HTML - 400)}'`)
    const count = Math.ceil(MAX_KIT_PAGE_HTML / html.length) + 1
    const steps = Array.from({ length: count }, (_, i) =>
      pageStep(i + 1, { kind: 'html', prompt: '', html }),
    )

    const result = kitDocumentSchema.safeParse(pageKit(steps))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/toplam boyutu/)
  })

  it('need a page that passes the check before publishing', () => {
    expect(sourceIssues({ kind: 'html', prompt: '', html: '' })[0]?.message).toMatch(/henüz yok/)
    expect(sourceIssues({ kind: 'html', prompt: '', html: page(`fetch('x')`) })[0]).toMatchObject({
      severity: 'error',
      message: expect.stringContaining('internete') as unknown,
    })
    expect(sourceIssues({ kind: 'html', prompt: '', html: GOOD })).toEqual([])
    expect(sourceIssues({ kind: 'url', url: 'http://ornek.org' })[0]?.severity).toBe('error')
    expect(sourceIssues({ kind: 'url', url: 'https://ornek.org/a' })[0]).toMatchObject({
      severity: 'warning',
      message: expect.stringContaining('çocuklara uygun') as unknown,
    })
  })

  it('need no answer text', () => {
    const kit = pageKit([pageStep(1, { kind: 'html', prompt: '', html: GOOD })])

    expect(validateKitForPublish(kit).some((issue) => issue.field === 'answer')).toBe(false)
  })
})
