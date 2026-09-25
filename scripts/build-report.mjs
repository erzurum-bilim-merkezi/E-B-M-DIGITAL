#!/usr/bin/env node
// Builds docs/rapor/kasif-rapor.html — a single self-contained file (screenshots embedded):
// delivery report (scope, architecture, test results, review findings) + Turkish user guide.
// Inputs (produced by the quality gate):
//   test-results/unit.json            npx vitest run --reporter=json --outputFile=test-results/unit.json
//   coverage/coverage-summary.json   (--coverage.reporter=json-summary)
//   test-results/e2e.json             npx playwright test (json reporter in playwright.config.ts)
//   docs/rapor/img/*.jpg              node scripts/capture-screenshots.mjs
//   docs/rapor/bulgular.json          review findings [{ area, severity, title, status }]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const OUT = 'docs/rapor/kasif-rapor.html'
const IMG_DIR = 'docs/rapor/img'

const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback
const escape = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const pct = (value) => `%${(Math.round(value * 10) / 10).toLocaleString('tr-TR')}`
const num = (value) => Number(value).toLocaleString('tr-TR')

// ── Inputs ──────────────────────────────────────────────────────────────────────────────────
const unit = readJson('test-results/unit.json', null)
const coverage = readJson('coverage/coverage-summary.json', null)
const e2e = readJson('test-results/e2e.json', null)
const findings = readJson('docs/rapor/bulgular.json', [])
const images = Object.fromEntries(
  (existsSync(IMG_DIR) ? readdirSync(IMG_DIR) : [])
    .filter((file) => file.endsWith('.jpg'))
    .map((file) => [
      file.replace(/\.jpg$/, ''),
      `data:image/jpeg;base64,${readFileSync(path.join(IMG_DIR, file)).toString('base64')}`,
    ]),
)

function img(name, caption, kind = 'wide') {
  const src = images[name]
  if (!src) return `<p class="missing">Ekran görüntüsü bulunamadı: ${escape(name)}</p>`
  return `<figure class="shot shot-${kind}"><button class="zoom" type="button" aria-label="Büyüt: ${escape(caption)}"><img src="${src}" alt="${escape(caption)}" loading="lazy" /></button><figcaption>${caption}</figcaption></figure>`
}
const phones = (items) =>
  `<div class="phones">${items.map(([name, caption]) => img(name, caption, 'phone')).join('')}</div>`

// ── Unit tests ──────────────────────────────────────────────────────────────────────────────
const unitStats = unit
  ? {
      files: unit.numTotalTestSuites ?? unit.testResults?.length ?? 0,
      total: unit.numTotalTests,
      passed: unit.numPassedTests,
      failed: unit.numFailedTests,
      skipped: (unit.numPendingTests ?? 0) + (unit.numTodoTests ?? 0),
      fileCount: unit.testResults?.length ?? 0,
    }
  : null

const coverageTotal = coverage?.total
const coverageAreas = (() => {
  if (!coverage) return []
  const groups = new Map()
  for (const [file, value] of Object.entries(coverage)) {
    if (file === 'total') continue
    const rel = file.split(path.sep).join('/').split('/src/')[1] ?? file
    const parts = rel.split('/')
    const key = ['features', 'pages', 'entities'].includes(parts[0])
      ? parts.slice(0, 2).join('/')
      : parts[0]
    const group = groups.get(key) ?? { s: 0, st: 0, b: 0, bt: 0, f: 0, ft: 0, l: 0, lt: 0 }
    group.s += value.statements.covered
    group.st += value.statements.total
    group.b += value.branches.covered
    group.bt += value.branches.total
    group.f += value.functions.covered
    group.ft += value.functions.total
    group.l += value.lines.covered
    group.lt += value.lines.total
    groups.set(key, group)
  }
  return [...groups.entries()].toSorted(([a], [b]) => a.localeCompare(b))
})()

// ── E2E ─────────────────────────────────────────────────────────────────────────────────────
function collectSpecs(suite, file = suite.file, out = []) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? []
      const last = results.at(-1)
      out.push({
        file: spec.file ?? file,
        title: spec.title,
        project: test.projectName,
        status: test.status === 'expected' ? 'passed' : test.status,
        duration: results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
        error: last?.error?.message ?? null,
      })
    }
  }
  for (const child of suite.suites ?? []) collectSpecs(child, child.file ?? file, out)
  return out
}
const e2eTests = e2e ? (e2e.suites ?? []).flatMap((suite) => collectSpecs(suite)) : []
const byProject = new Map()
for (const test of e2eTests) {
  const entry = byProject.get(test.project) ?? {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    duration: 0,
  }
  if (test.status === 'passed') entry.passed++
  else if (test.status === 'flaky') entry.flaky++
  else if (test.status === 'skipped') entry.skipped++
  else entry.failed++
  entry.duration += test.duration
  byProject.set(test.project, entry)
}
const e2eTotals = [...byProject.values()].reduce(
  (sum, entry) => ({
    passed: sum.passed + entry.passed,
    failed: sum.failed + entry.failed,
    flaky: sum.flaky + entry.flaky,
    skipped: sum.skipped + entry.skipped,
  }),
  { passed: 0, failed: 0, flaky: 0, skipped: 0 },
)
const a11yTests = e2eTests.filter((test) => test.project === 'a11y')

const generatedAt = new Date().toLocaleString('tr-TR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
})

// ── Sections ────────────────────────────────────────────────────────────────────────────────
const statusChip = (ok, text) =>
  `<span class="chip ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✕'} ${text}</span>`

const summaryChips = [
  unitStats && statusChip(unitStats.failed === 0, `${num(unitStats.passed)} birim testi`),
  coverageTotal &&
    statusChip(coverageTotal.lines.pct >= 70, `Kapsam ${pct(coverageTotal.lines.pct)}`),
  e2e && statusChip(e2eTotals.failed === 0, `${num(e2eTotals.passed)} E2E testi`),
  a11yTests.length > 0 &&
    statusChip(
      a11yTests.every((test) => test.status === 'passed'),
      'WCAG 2.2 AA',
    ),
]
  .filter(Boolean)
  .join('')

function coverageCell(covered, total) {
  const value = total === 0 ? 100 : (covered / total) * 100
  return `<td class="num ${value >= 70 ? '' : 'warn'}">${pct(value)}</td>`
}

const coverageRows = coverageAreas
  .map(([area, g]) => {
    const cell = coverageCell
    return `<tr><th scope="row"><code>${escape(area)}</code></th>${cell(g.s, g.st)}${cell(g.b, g.bt)}${cell(g.f, g.ft)}${cell(g.l, g.lt)}</tr>`
  })
  .join('')

const projectRows = [...byProject.entries()]
  .map(
    ([project, entry]) =>
      `<tr><th scope="row"><code>${escape(project)}</code></th><td class="num">${entry.passed}</td><td class="num ${entry.failed ? 'warn' : ''}">${entry.failed}</td><td class="num">${entry.flaky}</td><td class="num">${(entry.duration / 1000).toFixed(0)} sn</td></tr>`,
  )
  .join('')

const e2eList = [...new Set(e2eTests.map((test) => test.file))]
  .toSorted()
  .map((file) => {
    const tests = e2eTests.filter((test) => test.file === file)
    const titles = [...new Set(tests.map((test) => test.title))]
    const items = titles
      .map((title) => {
        const runs = tests.filter((test) => test.title === title)
        const ok = runs.every((run) => run.status === 'passed' || run.status === 'flaky')
        const projects = runs.map((run) => run.project).join(', ')
        return `<li class="${ok ? 'pass' : 'fail'}"><span aria-hidden="true">${ok ? '✓' : '✕'}</span> ${escape(title)} <small>${escape(projects)}</small></li>`
      })
      .join('')
    return `<details><summary><code>e2e/${escape(file.replaceAll('\\', '/'))}</code> <small>${titles.length} senaryo</small></summary><ul class="tests">${items}</ul></details>`
  })
  .join('')

const findingRows = findings
  .map(
    (finding) =>
      `<tr><td><span class="sev sev-${escape(finding.severity)}">${escape(finding.severity)}</span></td><td>${escape(finding.area)}</td><td>${escape(finding.title)}</td><td>${escape(finding.status)}</td></tr>`,
  )
  .join('')

const BLOCKS = [
  ['Bilgi kartı', 'Metin, görsel ve cevap kutusu; “Dinle” ile sesli okunur.'],
  ['Dokun ve keşfet', 'Görsele dokununca sahne değişir ve açıklama çıkar.'],
  ['Evre kaydırıcı', 'Kaydırıcıyla büyüme evreleri arasında gezilir (klavyeyle de).'],
  [
    'Keşif butonları',
    'Her butona dokunarak sahnenin bir yönü keşfedilir; hepsi bulununca tamamlanır.',
  ],
  ['Aç / kapat', 'Tek düğmeyle sahne açılıp kapatılır (ör. ışığı aç).'],
  ['Animasyon', 'Döngüsel sahne; duraklat düğmesi vardır.'],
  ['Doğruları seç', 'Doğru seçenekleri bul; yanlışta nazik geri bildirim verilir.'],
  ['Karşılaştırma', 'İki ya da daha fazla kart yan yana incelenir.'],
  ['Quiz', 'Tek doğru cevaplı soru; cevaplar analitiğe yansır.'],
  ['Sıralama', 'Adımları doğru sıraya diz.'],
  ['Eşleştirme', 'Eşleri bul.'],
  ['Deney', 'Hazırlık + deney adımları, isteğe bağlı sayaç.'],
  ['Video', 'YouTube (gizlilik modu) ya da MP4 bağlantısı; %80 izlenince tamamlanır.'],
]

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kâşif · Teslim Raporu ve Kullanım Kılavuzu</title>
<meta name="description" content="Kâşif (çocuk PWA) ve Kâşif Studio: kapsam, mimari, test sonuçları, inceleme bulguları ve görsellerle kullanım kılavuzu." />
<style>
:root {
  color-scheme: light;
  --bg: #f6f7fb; --surface: #ffffff; --surface-2: #eef1f8; --fg: #141a33; --muted: #4c5575; --subtle: #6b7390;
  --border: #dde2ef; --primary: #4f46e5; --primary-soft: #eceafe; --ok: #137a3f; --ok-soft: #e3f6ea;
  --bad: #b42318; --bad-soft: #fdecea; --warn: #9a5b00; --warn-soft: #fff4dc; --code: #eef0f7;
  --shadow: 0 1px 2px rgb(20 26 51 / .06), 0 8px 24px rgb(20 26 51 / .06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0d1122; --surface: #151a31; --surface-2: #1c2240; --fg: #eef1ff; --muted: #b3bad6; --subtle: #8f97b8;
    --border: #2a3155; --primary: #a5a0ff; --primary-soft: #26245a; --ok: #6ee7a0; --ok-soft: #133524;
    --bad: #ff9a8f; --bad-soft: #3b1714; --warn: #ffcf70; --warn-soft: #3a2b0c; --code: #1f2647;
    --shadow: 0 1px 2px rgb(0 0 0 / .4), 0 8px 24px rgb(0 0 0 / .3);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1122; --surface: #151a31; --surface-2: #1c2240; --fg: #eef1ff; --muted: #b3bad6; --subtle: #8f97b8;
  --border: #2a3155; --primary: #a5a0ff; --primary-soft: #26245a; --ok: #6ee7a0; --ok-soft: #133524;
  --bad: #ff9a8f; --bad-soft: #3b1714; --warn: #ffcf70; --warn-soft: #3a2b0c; --code: #1f2647;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--primary); }
code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: .88em; background: var(--code); padding: .1em .35em; border-radius: 6px; }
.layout { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 2.5rem; max-width: 84rem; margin: 0 auto; padding: 2rem 1.5rem 5rem; }
nav.toc { position: sticky; top: 1.5rem; align-self: start; max-height: calc(100vh - 3rem); overflow: auto; font-size: .92rem; }
nav.toc p { font-weight: 700; margin: 0 0 .5rem; }
nav.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: .15rem; }
nav.toc ol ol { padding-left: .9rem; margin: .15rem 0 .35rem; }
nav.toc a { display: block; padding: .3rem .6rem; border-radius: 8px; color: var(--muted); text-decoration: none; }
nav.toc a:hover, nav.toc a:focus-visible { background: var(--surface-2); color: var(--fg); }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
header.hero { background: linear-gradient(135deg, #4f46e5, #0ea5a4); color: #fff; border-radius: 24px; padding: 2.5rem; margin-bottom: 2.5rem; box-shadow: var(--shadow); }
header.hero h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); line-height: 1.1; margin: .2rem 0 .8rem; letter-spacing: -.02em; }
header.hero p { margin: 0; max-width: 46rem; opacity: .95; }
.eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .78rem; font-weight: 700; opacity: .9; }
.chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1.4rem; }
.chip { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .8rem; border-radius: 999px; font-weight: 600; font-size: .9rem; background: rgb(255 255 255 / .18); color: #fff; border: 1px solid rgb(255 255 255 / .35); }
.chip.bad { background: #b42318; }
section { margin-top: 3.2rem; scroll-margin-top: 1.5rem; }
h2 { font-size: 1.65rem; letter-spacing: -.01em; margin: 0 0 1rem; padding-bottom: .5rem; border-bottom: 2px solid var(--border); }
h3 { font-size: 1.2rem; margin: 2rem 0 .6rem; scroll-margin-top: 1.5rem; }
p, li { color: var(--fg); }
.muted { color: var(--muted); }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.2rem 1.3rem; box-shadow: var(--shadow); }
.card h4 { margin: 0 0 .4rem; font-size: 1rem; }
.stat { font-size: 2rem; font-weight: 750; letter-spacing: -.02em; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow); }
table { border-collapse: collapse; width: 100%; font-size: .94rem; }
th, td { text-align: left; padding: .6rem .85rem; border-bottom: 1px solid var(--border); vertical-align: top; }
thead th { background: var(--surface-2); font-weight: 650; }
tbody tr:last-child > * { border-bottom: 0; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.warn { color: var(--warn); font-weight: 650; }
.callout { border-radius: 14px; padding: 1rem 1.2rem; border: 1px solid var(--border); background: var(--surface); margin: 1rem 0; }
.callout.warn { background: var(--warn-soft); border-color: transparent; }
.callout.info { background: var(--primary-soft); border-color: transparent; }
.callout.ok { background: var(--ok-soft); border-color: transparent; }
.callout strong:first-child { display: block; margin-bottom: .25rem; }
ol.steps { counter-reset: step; list-style: none; padding: 0; display: grid; gap: .6rem; }
ol.steps > li { counter-increment: step; position: relative; padding-left: 2.6rem; }
ol.steps > li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 1.8rem; height: 1.8rem; border-radius: 50%; background: var(--primary); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: .9rem; }
figure.shot { margin: 1.2rem 0; }
figure.shot img { display: block; width: 100%; height: auto; border-radius: 14px; border: 1px solid var(--border); box-shadow: var(--shadow); background: var(--surface); }
figure.shot figcaption { font-size: .88rem; color: var(--muted); margin-top: .5rem; }
.phones { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr)); }
.phones figure.shot { margin: 0; }
.phones figure.shot img { border-radius: 22px; border: 6px solid #1b2140; }
button.zoom { all: unset; cursor: zoom-in; display: block; width: 100%; }
button.zoom:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; border-radius: 16px; }
.lightbox { position: fixed; inset: 0; background: rgb(8 10 22 / .88); display: none; place-items: center; padding: 2rem; z-index: 10; cursor: zoom-out; }
.lightbox.open { display: grid; }
.lightbox img { max-width: min(96vw, 1440px); max-height: 92vh; border-radius: 12px; }
details { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: .6rem .9rem; margin: .5rem 0; }
summary { cursor: pointer; font-weight: 600; }
ul.tests { list-style: none; padding: .4rem 0 0; margin: 0; display: grid; gap: .3rem; }
ul.tests li small, summary small { color: var(--subtle); font-weight: 400; margin-left: .35rem; }
ul.tests li.pass span { color: var(--ok); font-weight: 700; }
ul.tests li.fail span { color: var(--bad); font-weight: 700; }
.sev { font-size: .8rem; font-weight: 700; padding: .15rem .5rem; border-radius: 999px; background: var(--surface-2); white-space: nowrap; }
.sev-Yüksek { background: var(--bad-soft); color: var(--bad); }
.sev-Orta { background: var(--warn-soft); color: var(--warn); }
.sev-Düşük { background: var(--ok-soft); color: var(--ok); }
.missing { color: var(--bad); }
kbd { font-family: inherit; font-size: .85em; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 6px; padding: .05em .4em; background: var(--surface); }
footer { margin-top: 4rem; color: var(--subtle); font-size: .88rem; }
.theme-toggle { position: fixed; right: 1rem; bottom: 1rem; z-index: 5; border: 1px solid var(--border); background: var(--surface); color: var(--fg); border-radius: 999px; padding: .55rem .9rem; font: inherit; font-size: .9rem; box-shadow: var(--shadow); cursor: pointer; }
@media (max-width: 960px) {
  .layout { grid-template-columns: minmax(0, 1fr); padding: 1rem 16px 4rem; gap: 1.5rem; }
  nav.toc { position: static; max-height: none; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1rem; }
  header.hero { padding: 1.6rem; border-radius: 18px; }
}
@media print { nav.toc, .theme-toggle { display: none; } .layout { display: block; } section { break-inside: auto; } figure.shot { break-inside: avoid; } }
</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="İçindekiler">
  <p>İçindekiler</p>
  <ol>
    <li><a href="#ozet">1. Özet</a></li>
    <li><a href="#kapsam">2. Kapsam ve teslimat</a></li>
    <li><a href="#mimari">3. Mimari</a></li>
    <li><a href="#testler">4. Test sonuçları</a>
      <ol><li><a href="#birim">Birim ve entegrasyon</a></li><li><a href="#e2e">Uçtan uca (E2E)</a></li><li><a href="#a11y">Erişilebilirlik</a></li></ol></li>
    <li><a href="#inceleme">5. Kıdemli inceleme bulguları</a></li>
    <li><a href="#sinirlar">6. Kapsam sınırları ve sonraki adımlar</a></li>
    <li><a href="#kilavuz-kasif">7. Kılavuz: Kâşif (çocuklar)</a></li>
    <li><a href="#kilavuz-studio">8. Kılavuz: Kâşif Studio</a></li>
    <li><a href="#calistirma">9. Çalıştırma ve deneme hesapları</a></li>
  </ol>
</nav>
<main>
<header class="hero">
  <p class="eyebrow">Erzurum Bilim Merkezi · E-B-M Digital</p>
  <h1>Kâşif ve Kâşif Studio<br />Teslim Raporu ve Kullanım Kılavuzu</h1>
  <p>Bilim merkezindeki deney kitlerini QR kodlarla etkileşimli kartlara dönüştüren çocuk uygulaması (PWA) ve kitleri kod yazmadan tasarlayan, yayınlayan ve ölçen yönetim paneli.</p>
  <div class="chips">${summaryChips}</div>
  <p style="margin-top:1rem;font-size:.9rem;opacity:.85">Oluşturulma: ${escape(generatedAt)} · Dal: <code style="background:rgb(255 255 255 / .2);color:#fff">feat/kasif-v1</code></p>
</header>

<section id="ozet">
<h2>1. Özet</h2>
<p><strong>Kâşif</strong>, çocukların bilim merkezindeki ekipmanın üzerindeki QR kodu okutarak etkileşimli kartlara ulaştığı, rozet ve sertifika kazandığı bir PWA'dır. <strong>Kâşif Studio</strong>, eğitmen ve yöneticilerin 13 etkileşim türüyle kit tasarladığı, yapay zekâ desteğiyle içerik ürettiği, inceleme–yayın akışını yönettiği, QR etiketlerini bastığı ve kâşiflerin etkinliğini izlediği paneldir.</p>
<div class="grid">
  <div class="card"><h4>Kâşif (çocuk)</h4><p class="muted">Katılım (takma ad + avatar), QR ile giriş, 13 kart türü, sesli okuma, rozet ve sertifika, Kâşif kodu ile başka cihazda devam, merkez cihazı (kiosk) modu.</p></div>
  <div class="card"><h4>Kâşif Studio</h4><p class="muted">Rol tabanlı giriş + 2FA, sihirbaz ve kart editörü, canlı önizleme, medya ve yapay zekâ, inceleme/yayın/sürümler, QR yazdırma, analitik, KVKK araçları, kullanıcılar ve ayarlar.</p></div>
  <div class="card"><h4>Kalite</h4><p class="muted">TypeScript strict, katman sınırı denetimi, Zod ile her sınırda doğrulama, WCAG 2.2 AA (açık/koyu), tek kaynaklı CSP, Pages benzeri sunucuda E2E.</p></div>
</div>
</section>

<section id="kapsam">
<h2>2. Kapsam ve teslimat</h2>
<div class="table-wrap"><table>
<thead><tr><th>Alan</th><th>Teslim edilenler</th></tr></thead>
<tbody>
<tr><th scope="row">İçerik modeli</th><td>13 blok şeması, görsel alan (7 sahne kütüphanesi, yapay zekâ sahnesi, görsel, video URL), tema/rozet/malzeme, yayın doğrulaması, 6 şablon, 2 örnek kit (Küçük Çiftçiler, Blok Vitrini)</td></tr>
<tr><th scope="row">Kâşif</th><td>Hoş geldin akışı, Bilim Merkezi, kit menüsü, kart oynatıcı, tamamlama/rozet/sertifika, QR okuyucu (kamera + elle kod), profil ve Kâşif kartı, merkez cihazı modu, çevrimdışı olay kuyruğu, coming-soon ve önizleme cihazı</td></tr>
<tr><th scope="row">Studio</th><td>Giriş + TOTP, parola politikası, pano, kit listesi, sihirbaz, 5 sekmeli editör (otomatik kayıt, yedek, çakışma denetimi, JSON içe/dışa aktarma), 13 blok editörü, önizleme, inceleme/yayın/arşiv/görünürlük, sürümler, QR (PNG/SVG/ZIP) ve baskı şablonları (kart, ekipman etiketi, kit kutusu), analitik (pano, dönem, kit hunisi, CSV), kâşifler (JSON dışa aktarma, silme), medya, kullanıcılar, ayarlar ve denetim kaydı</td></tr>
<tr><th scope="row">Altyapı</th><td>Port/adapter veri katmanı ve tarayıcı içi mock arka uç, tek kaynaklı CSP (meta + nginx), PWA manifesti, Pages benzeri E2E sunucusu, ekran görüntüsü ve rapor betikleri, ADR 0004 ve 0006–0020</td></tr>
</tbody></table></div>
</section>

<section id="mimari">
<h2>3. Mimari</h2>
<p>Katmanlar yalnızca aşağı doğru bağımlıdır ve <code>npm run lint:boundaries</code> ile denetlenir: <code>app → pages → features → entities → shared</code>. <code>entities</code> saf modüllerdir (yalnızca Zod), böylece aynı kurallar ileride Supabase Edge Function'larında da çalışır.</p>
<div class="grid">
  <div class="card"><h4>Veri erişimi</h4><p class="muted">Her özellik bir port tanımlar; bugün tarayıcıda çalışan mock adapter'lar (Zod ile doğrulanan localStorage tabloları, IndexedDB medya deposu, RLS benzeri rol denetimleri) kullanılır. Supabase adapter'ları UI değişmeden eklenecek (ADR 0015).</p></div>
  <div class="card"><h4>Durum</h4><p class="muted">Sunucu durumu TanStack Query'de; paylaşılabilir arayüz durumu (filtre, sekme, dönem, sayfa, baskı şablonu) URL'de; yerel durum <code>useState</code>'te.</p></div>
  <div class="card"><h4>Güvenlik</h4><p class="muted">Tek kaynaklı CSP (satır içi betik ve eval yok), YouTube yalnızca nocookie + sandbox, yönlendirme parametreleri doğrulanır, personel oturumu sessionStorage'da, yapay zekâ SVG'leri temizlenip <code>&lt;img&gt;</code> ile gösterilir.</p></div>
</div>
</section>

<section id="testler">
<h2>4. Test sonuçları</h2>
<h3 id="birim">Birim ve entegrasyon testleri (Vitest + Testing Library)</h3>
${
  unitStats
    ? `<div class="grid">
  <div class="card"><h4>Test</h4><div class="stat">${num(unitStats.passed)} / ${num(unitStats.total)}</div><p class="muted">${num(unitStats.fileCount)} test dosyası${unitStats.failed ? ` · <strong style="color:var(--bad)">${unitStats.failed} başarısız</strong>` : ' · hepsi geçti'}</p></div>
  ${
    coverageTotal
      ? `<div class="card"><h4>Satır kapsamı</h4><div class="stat">${pct(coverageTotal.lines.pct)}</div><p class="muted">Eşik %70</p></div>
  <div class="card"><h4>Dal kapsamı</h4><div class="stat">${pct(coverageTotal.branches.pct)}</div><p class="muted">Deyim ${pct(coverageTotal.statements.pct)} · fonksiyon ${pct(coverageTotal.functions.pct)}</p></div>`
      : ''
  }
</div>`
    : '<p class="missing">Birim testi sonucu bulunamadı.</p>'
}
${
  coverageRows
    ? `<details><summary>Alanlara göre kapsam</summary><div class="table-wrap" style="margin-top:.6rem"><table><thead><tr><th>Alan</th><th class="num">Deyim</th><th class="num">Dal</th><th class="num">Fonksiyon</th><th class="num">Satır</th></tr></thead><tbody>${coverageRows}</tbody></table></div></details>`
    : ''
}
<h3 id="e2e">Uçtan uca testler (Playwright)</h3>
<p class="muted">Üretim ile aynı derleme (CSP dahil), GitHub Pages benzeri sunucuda <code>/E-B-M-DIGITAL/</code> alt yolunda koşar. Her testte sayfa hatası, konsol hatası ve CSP ihlali testi düşürür.</p>
${
  e2e
    ? `<div class="table-wrap"><table><thead><tr><th>Proje</th><th class="num">Geçti</th><th class="num">Başarısız</th><th class="num">Kararsız</th><th class="num">Süre</th></tr></thead><tbody>${projectRows}</tbody></table></div>${e2eList}`
    : '<p class="missing">E2E sonucu bulunamadı.</p>'
}
<h3 id="a11y">Erişilebilirlik (axe, WCAG 2.2 AA)</h3>
<p>Tüm Kâşif sayfaları, Blok Vitrini'ndeki 13 kart türü ve tüm Studio sayfaları açık ve koyu temada denetlenir. ${
  a11yTests.length
    ? a11yTests.every((test) => test.status === 'passed')
      ? '<strong>Sonuç: ihlal yok.</strong>'
      : '<strong style="color:var(--bad)">Sonuç: ihlal bulundu, ayrıntılar E2E listesinde.</strong>'
    : ''
}</p>
</section>

<section id="inceleme">
<h2>5. Kıdemli inceleme bulguları</h2>
<p>Kod, erişilebilirlik ve güvenlik incelemeleri ile smoke/E2E testlerinde bulunan sorunlar ve durumları:</p>
${
  findingRows
    ? `<div class="table-wrap"><table><thead><tr><th>Önem</th><th>Alan</th><th>Bulgu</th><th>Durum</th></tr></thead><tbody>${findingRows}</tbody></table></div>`
    : '<p class="muted">Bulgu listesi yok.</p>'
}
<div class="callout warn"><strong>Sizin yapmanız gereken: yerel .env dosyası</strong>Yerel <code>.env</code> dosyanızda <code>VITE_GEMINI_API_KEY</code> ve <code>VITE_GITHUB_TOKEN</code> adlı değişkenler tanımlı (dosya okunmadı; yalnızca adları build uyarısından biliniyor). <code>VITE_</code> önekli değerler tarayıcı paketine gömülebilir. Bu anahtarları <code>.env</code>'den kaldırın ya da <code>VITE_</code> öneki olmadan yeniden adlandırın; Gemini anahtarı yalnızca Supabase Edge Function secret'ı olarak girilmelidir. Anahtarlar bir yerde paylaşıldıysa yenileyin. Uygulama bu değişkenleri okumaz; CI'da bu durumda build durdurulur.</div>
</section>

<section id="sinirlar">
<h2>6. Kapsam sınırları ve sonraki adımlar</h2>
<ul>
  <li><strong>Canlı arka uç (Supabase, F4/F12):</strong> Şema, RLS ve Edge Function'lar henüz canlıya uygulanmadı; plan gereği bu adım sizin onayınızla ve prova sonrası yapılır. Bugün tüm veriler tarayıcıdaki mock arka uçta (“Deneme ortamı”) tutulur ve cihazlar arasında paylaşılmaz.</li>
  <li><strong>Gemini (F0.10):</strong> Yapay zekâ özellikleri deneme sağlayıcısıyla çalışır. Gerçek Gemini, hukuk görüşü olumlu olduktan sonra Edge Function üzerinden ve anahtar sizin tarafınızdan girilerek açılacaktır.</li>
  <li><strong>Yayın durumu:</strong> Canlı site coming-soon modunda kalır; bu çalışma <code>main</code>'e alınsa bile ziyaretçiler görmez. Push, deploy ve lansman sizin onayınızı bekler.</li>
  <li><strong>Karar gerekli — alan adı:</strong> <code>github.io</code> kökeni org'daki diğer sitelerle paylaşılır ve onları birbirinden yalıtmaz. Studio gerçek arka uca bağlanmadan (F12) ve QR etiketleri toplu basılmadan önce özel alan adına geçilmesi önerilir (ADR 0013).</li>
  <li><strong>Supabase aşamasına devredilenler:</strong> <code>qr_prefix_reservations</code> tablosu (QR öneklerinin kalıcı ayrılması), merkez PIN'i için sunucu tarafı yavaş özet (pgcrypto <code>crypt</code>), IP ve genel hız sınırları, devir anında kuyrukta kalan olayların ele alınması.</li>
  <li><strong>Sonraki adımlar:</strong> Supabase adapter'ları, service worker için “güncelleme var” akışı (ADR 0019), gerçek cihaz testleri (iOS Safari kamera, VoiceOver), marka varlıklarının son hâli.</li>
</ul>
</section>

<section id="kilavuz-kasif">
<h2>7. Kullanım kılavuzu: Kâşif (çocuklar ve eğitmenler)</h2>
<h3>7.1 Kâşif ol</h3>
<ol class="steps">
  <li>Ekipmandaki QR kodu telefon kamerasıyla okut ya da uygulamayı aç.</li>
  <li><strong>Adın</strong> alanına adını ya da bir takma ad yaz, <strong>Devam</strong>'a dokun. Uygunsuz ya da çok kısa adlarda nazik bir uyarı çıkar.</li>
  <li>Altı Kâşif avatarından birini seç ve <strong>Bilim Merkezine Gir</strong>'e dokun.</li>
  <li>Ekranda görünen <strong>Kâşif kodunu</strong> (<code>KSF-XXXX-XXXX</code>) sakla: başka bir cihazda kaldığın yerden devam etmek için gerekir. Kod, Kâşif kartında her zaman görünür.</li>
</ol>
${phones([
  ['kids-01-hosgeldin', 'Hoş geldin: adını yaz'],
  ['kids-02-avatar', 'Avatarını seç'],
  ['kids-03-kasif-kodu', 'Kâşif kodu (bir kez gösterilir)'],
  ['kids-04-bilim-merkezi', 'Bilim Merkezi'],
])}
<div class="callout info"><strong>QR ile gelenler için kısa yol</strong>Bir QR okutarak gelen çocuk katıldıktan sonra doğrudan o karta gider (en fazla 3 dokunuş).</div>

<h3>7.2 Bilim Merkezi, kitler ve kartlar</h3>
<p>Bilim Merkezi'nde kitler kategoriye göre süzülür; her kitte ilerleme halkası görünür. Bir kiti açınca kartlar renkli döşemeler olarak listelenir. QR ile açılan kartlarda (odaklı mod) yalnızca o kart ve <em>Bu kitteki diğer kartlar</em> bağlantısı görünür; kit menüsünden açılan kartlarda <em>Sıradaki kart</em> ile ilerlenir.</p>
${phones([
  ['kids-05-kit', 'Kit menüsü ve ilerleme'],
  ['kids-06-kart-qr', 'QR ile açılan kart'],
  ['kids-07-kart-cevap', 'Dokun: sahne değişir, cevap açılır'],
  ['kids-08-evre-kaydirici', 'Evre kaydırıcı'],
  ['kids-09-kesif-butonlari', 'Keşif butonları'],
  ['kids-10-dogrulari-sec', 'Doğruları seç'],
])}
<div class="table-wrap"><table><thead><tr><th>Kart türü</th><th>Nasıl oynanır?</th></tr></thead><tbody>${BLOCKS.map(([name, text]) => `<tr><th scope="row">${escape(name)}</th><td>${escape(text)}</td></tr>`).join('')}</tbody></table></div>
<p><strong>Dinle</strong> düğmesi kartı sesli okur. Profil ayarlarında sesler, <em>Animasyonları azalt</em> ve <em>Büyük yazı</em> açılıp kapatılabilir; işletim sisteminin “hareketi azalt” tercihi de otomatik uygulanır.</p>
<h4>Tablette 13 kart türü (Blok Vitrini)</h4>
<div class="phones">${Object.keys(images)
  .filter((key) => key.startsWith('tablet-'))
  .toSorted()
  .map((key) =>
    img(
      key,
      key === 'tablet-01-blok-vitrini' ? 'Blok Vitrini kiti' : `Kart ${Number(key.slice(-2))}`,
      'phone',
    ),
  )
  .join('')}</div>

<h3>7.3 QR okut ya da kodu yaz</h3>
<p><strong>QR Okut</strong> ekranında kamera izni verilirse kod otomatik okunur. Kamera kullanılamıyorsa etiketin altındaki kodu (ör. <code>KC-01</code>) yazıp <strong>Aç</strong>'a dokun. Etkin olmayan, kaldırılmış ya da hatalı kodlar için anlaşılır bir mesaj gösterilir.</p>
${phones([
  ['kids-11-qr-okut', 'QR Okut / kodu yaz'],
  ['kids-14-tamamlandi', 'Kit tamamlama ekranı'],
  ['kids-12-rozetler', 'Rozetlerim'],
  ['kids-13-profil', 'Profil ve Kâşif kartı'],
  ['kids-15-kod-ile-giris', 'Kâşif kodum var'],
])}
<h3>7.4 Rozet, sertifika ve Kâşif kartı</h3>
<ul>
  <li>Bir kitin tüm kartları bitince <strong>Bitirdim!</strong> ile kit rozeti kazanılır; <strong>Sertifikamı gör</strong> ile sertifika yazdırılır ya da paylaşılır.</li>
  <li>Kâşif rozetleri: <em>İlk QR'ım</em>, <em>Bilim Kâşifi</em> (3 kit), <em>Quiz Ustası</em> (5 doğru cevap).</li>
  <li><strong>Profilim</strong> → Kâşif kartı: yazdır, resim olarak indir ya da kodu yenile. Aynı cihaza yeni kâşif eklenebilir (en fazla 10), cihazdan çıkılabilir, üyelik ve tüm veriler silinebilir.</li>
</ul>
<h3>7.5 Başka cihazda devam</h3>
<ol class="steps"><li>Hoş geldin ekranında <strong>Kâşif kodum var</strong>'a dokun.</li><li>Kâşif kodunu yaz ya da Kâşif kartındaki QR'ı okut, <strong>Giriş yap</strong>'a dokun.</li><li>Rozetler ve ilerleme geri gelir. Güvenlik için art arda 5 hatalı denemeden sonra 15 dakika beklenir.</li></ol>
<h3>7.6 Merkez cihazı (eğitmenler için)</h3>
<ol class="steps"><li>Studio → <strong>Ayarlar → Merkez cihazları</strong>'nda cihaz adı ve 4–8 haneli eğitmen PIN'i girip <strong>Kurulum kodu üret</strong>'e basın (kod 24 saat geçerli, tek kullanımlık).</li><li>Tablette Kâşif → <strong>Profilim → Eğitmen: bu cihazı merkez cihazı yap</strong> ekranına kodu girin.</li><li>Merkez cihazında 90 saniye işlem olmayınca <em>“Hâlâ orada mısın?”</em> sorulur; 20 saniye içinde dokunulmazsa kâşif kartı gösterilir ve cihaz sıradaki kâşife hazırlanır. Ekran açık kalır. Çıkış yalnızca eğitmen PIN'iyle yapılır.</li></ol>
</section>

<section id="kilavuz-studio">
<h2>8. Kullanım kılavuzu: Kâşif Studio (yönetici ve editör)</h2>
<h3>8.1 Giriş ve roller</h3>
<p>Studio'ya <code>/studio</code> adresinden, yöneticinizin oluşturduğu e-posta ve parolayla girilir. Yöneticiler ikinci adımda kimlik doğrulayıcı uygulamadaki 6 haneli kodu girer. Geçici parolayla ilk girişte kendi parolanızı belirlemeniz istenir (en az 10 karakter, harf ve rakam).</p>
${img('studio-00-giris', 'Studio girişi (deneme hesapları sağda)')}
${img('studio-00-2fa', 'Yöneticiler için iki adımlı doğrulama')}
<div class="table-wrap"><table><thead><tr><th>Yetki</th><th>Yönetici</th><th>Editör</th></tr></thead><tbody>
<tr><th scope="row">Kit oluşturma ve düzenleme</th><td>✓</td><td>✓</td></tr>
<tr><th scope="row">İncelemeye gönderme</th><td>✓</td><td>✓</td></tr>
<tr><th scope="row">Yayınlama, arşivleme, görünürlük, değişiklik isteme</th><td>✓</td><td>—</td></tr>
<tr><th scope="row">Analitik (toplu sayılar)</th><td>✓</td><td>✓</td></tr>
<tr><th scope="row">Kâşifler (ad, zaman çizelgesi, dışa aktarma, silme)</th><td>✓</td><td>—</td></tr>
<tr><th scope="row">Kullanıcılar, merkez cihazları, yapay zekâ ve saklama ayarları, denetim kaydı</th><td>✓</td><td>—</td></tr>
</tbody></table></div>
<h3>8.2 Pano</h3>
<p>Bugünkü aktif kâşifler, QR okutmaları, tamamlanan kitler, 30 günlük eğilim, en çok okutulan kartlar, canlı etkinlik akışı (30 sn'de bir yenilenir), incelemeyi bekleyen kitler ve Supabase Free / yapay zekâ kotaları. Her grafik <strong>Tablo olarak göster</strong> ile tabloya çevrilebilir.</p>
${img('studio-01-pano', 'Pano (açık tema)')}
${img('studio-01-pano-koyu', 'Pano (koyu tema)')}
<h3>8.3 Kit oluşturma</h3>
<ol class="steps"><li><strong>Kâşif Kitleri → Yeni Kâşif Kiti</strong>. Bir şablon seçin (Boş kit, 7 kartlı keşif, Deney, Quiz, Hikâye, Örnek: Küçük Çiftçiler) ya da yapay zekâyla taslak isteyin.</li><li>Kit adını yazın; adres (<code>/kit/…</code>) ve QR öneki (ör. <code>KC</code>) otomatik önerilir.</li><li>Kısa açıklama, kategori, yaş aralığı ve süreyi girip <strong>Oluştur ve kartları ekle</strong>'ye basın.</li></ol>
${img('studio-02-kitler', 'Kit listesi: durum filtresi, arama, tablo/kart görünümü')}
${img('studio-03-sihirbaz', 'Yeni kit sihirbazı')}
<h3>8.4 Kart editörü</h3>
<p>Editör beş sekmeden oluşur; değişiklikler 0,8 sn içinde otomatik kaydedilir ve tarayıcıda yedeklenir. Aynı kiti başka biri değiştirdiyse çakışma uyarısı çıkar. Sekmelerdeki kırmızı sayılar yayını engelleyen sorunları gösterir; <strong>Git</strong> ile ilgili alana gidilir.</p>
<ul>
  <li><strong>Genel:</strong> ad, kısa açıklama, açıklama (<code>**kalın**</code> desteklenir), ikon, kapak görseli, kategori, yaş, süre, öğrenme hedefleri, malzemeler, güvenlik notları, adres/QR öneki (yalnızca yayından önce değişir), QR ile girişte odaklı mod.</li>
  <li><strong>Kartlar:</strong> <strong>Kart ekle</strong> ile 13 türden biri eklenir; kartlar sürükle-bırak ya da <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> ile sıralanır. Her kartta başlık, ikon, renk, görsel alan (sahne kütüphanesi, yapay zekâ sahnesi, görsel ya da video bağlantısı), türüne özel alanlar, cevap, anlatım/ses, ipucu ve kutlama metni bulunur. Sağda canlı telefon/tablet önizlemesi vardır.</li>
  <li><strong>Tema:</strong> hazır temalar, yazı tipi, hareket düzeyi ve vurgu rengi (kontrast otomatik denetlenir).</li>
  <li><strong>Rozet:</strong> kit tamamlanınca verilen rozetin adı, emojisi, rengi ve açıklaması.</li>
  <li><strong>Yayın:</strong> yayına hazırlık listesi, inceleme/yayın düğmeleri, görünürlük (herkese açık / liste dışı) ve arşiv.</li>
</ul>
${img('studio-04-editor-genel', 'Editör: Genel')}
${img('studio-05-editor-kartlar', 'Editör: Kartlar ve canlı önizleme')}
${img('studio-06-editor-tema', 'Editör: Tema')}
${img('studio-07-editor-rozet', 'Editör: Rozet')}
${img('studio-08-editor-yayin', 'Editör: Yayın')}
<p>Kısayollar: <kbd>Ctrl</kbd>+<kbd>K</kbd> komut paleti · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> önizleme · <kbd>?</kbd> kısayol listesi. Kit JSON dosyası olarak dışa/içe aktarılabilir.</p>
<h3>8.5 Yapay zekâ</h3>
<p>Kart metni önerisi, sahne (durum başına SVG), ikon ve kit taslağı üretilebilir. Üretilen her şey taslaktır; siz onaylamadan karta yazılmaz. Yapay zekâ içeren bir kit yayınlanırken bilimsel doğruluk onayı istenir. Kişisel veri içeren istekler reddedilir; günlük kotalar Ayarlar'dan yönetilir. <em>Bu sürümde deneme sağlayıcısı çalışır.</em></p>
<h3>8.6 Önizleme, inceleme, yayın ve sürümler</h3>
<ol class="steps"><li><strong>Önizle</strong> ile kit, etkinlik kaydedilmeden telefon ya da tablet görünümünde oynanır.</li><li>Editör <strong>İncelemeye gönder</strong>'e basar (engelleyici sorun varken düğme kapalıdır). Gerekirse <strong>İncelemeden geri çek</strong>.</li><li>Yönetici <strong>Yayınla</strong> (ya da not yazarak <strong>Değişiklik iste</strong>). Her yayın değişmez bir sürümdür (<code>v1</code>, <code>v2</code>…).</li><li><strong>Sürümler</strong> sayfasından eski bir sürüm taslağa geri yüklenebilir; yönetici yayın dosyalarını yeniden üretebilir.</li></ol>
${img('studio-09-onizleme', 'Tam ekran önizleme (etkinlik kaydedilmez)')}
${img('studio-10-surumler', 'Sürüm geçmişi')}
<h3>8.7 QR kodları ve etiket basımı</h3>
<p><strong>QR oluştur</strong> sayfasında kit kodu ve her kartın kodu listelenir. Her kod PNG/SVG olarak ya da tümü ZIP olarak indirilir. QR içeriği sitenin kök adresi + <code>?q=KOD</code>'dur; kartlar yeniden sıralansa ya da adları değişse de basılı etiket çalışır. Silinen kartın kodu başka karta verilmez.</p>
<p><strong>Yazdır</strong> sayfasında üç şablon vardır: <em>Kart</em> (85×55 mm, A4'e 10 adet, isteğe bağlı çift taraflı arka yüz), <em>Ekipman etiketi</em> (40/50/70 mm, sütun/satır/kenar/aralık ayarlı) ve <em>Kit kutusu</em> (A6). Tarayıcının “PDF olarak kaydet” seçeneği de kullanılabilir.</p>
${img('studio-11-qr', 'QR kodları')}
${img('studio-12-qr-yazdir', 'Baskı şablonları')}
<h3>8.8 Analitik ve kâşifler</h3>
<p><strong>Analitik</strong> sayfası seçilen dönemdeki (7/30/90 gün) tekil, yeni ve geri dönen kâşifleri, ortalama ziyaret süresini ve kit karşılaştırmasını gösterir; yönetici CSV indirebilir. <strong>Kit analizi</strong> kart hunisini (en çok bırakılan kart işaretlenir), QR okutma kaynaklarını, soru başarısını ve yoğun saatleri gösterir. Önizleme etkinlikleri sayılmaz.</p>
${img('studio-13-kit-analizi', 'Kit analizi')}
${img('studio-14-analitik', 'Analitik')}
${img('studio-analitik-koyu', 'Analitik (koyu tema)')}
<p><strong>Kâşifler</strong> (yalnızca yönetici): takma ad/kod ile arama, kit ve tamamlama filtreleri; bir kâşifin zaman çizelgesi, kitleri ve rozetleri; <strong>Verileri indir (JSON)</strong> ve <strong>Kâşifi sil</strong> (KVKK). İşlemler denetim kaydına yazılır.</p>
${img('studio-15-kasifler', 'Kâşifler')}
${img('studio-16-kasif-detay', 'Kâşif ayrıntısı')}
<h3>8.9 Medya, kullanıcılar ve ayarlar</h3>
<ul>
  <li><strong>Medya:</strong> görsel, ses ve altyazı yükleme; ad/alt metin düzenleme; kullanımda olan dosya silinmez. Video yüklenmez, kart editöründe bağlantı olarak eklenir.</li>
  <li><strong>Kullanıcılar:</strong> kullanıcı ekleyin (geçici parola bir kez gösterilir, 72 saat geçerli), parola sıfırlayın, rol değiştirin, pasifleştirin. En az iki aktif yönetici önerilir; tek yönetici kaldığında panoda uyarı çıkar.</li>
  <li><strong>Ayarlar:</strong> bu cihazda Kâşif önizlemesi, yapay zekâ kotaları, saklama süreleri (ham olaylar 7–60 gün, hareketsiz üyelikler 3–24 ay), merkez cihazları, denetim kaydı ve deneme verisini sıfırlama.</li>
</ul>
${img('studio-17-medya', 'Medya kütüphanesi')}
${img('studio-18-kullanicilar', 'Kullanıcılar')}
${img('studio-19-ayarlar', 'Ayarlar')}
</section>

<section id="calistirma">
<h2>9. Çalıştırma ve deneme hesapları</h2>
<div class="table-wrap"><table><thead><tr><th>Amaç</th><th>Komut</th></tr></thead><tbody>
<tr><td>Geliştirme sunucusu (Kâşif: <code>/</code>, Studio: <code>/studio</code>)</td><td><code>npm run dev</code> → http://localhost:5173</td></tr>
<tr><td>Tam kalite kapısı</td><td><code>npm run validate</code></td></tr>
<tr><td>E2E + erişilebilirlik</td><td><code>npm run test:e2e</code></td></tr>
<tr><td>Üretim derlemesi</td><td><code>npm run build</code></td></tr>
<tr><td>Ekran görüntüleri ve bu rapor</td><td><code>node scripts/capture-screenshots.mjs</code> · <code>node scripts/build-report.mjs</code></td></tr>
</tbody></table></div>
<h3>Deneme hesapları (yalnızca yerel deneme ortamı)</h3>
<div class="table-wrap"><table><thead><tr><th>Rol</th><th>E-posta</th><th>Parola</th></tr></thead><tbody>
<tr><td>Yönetici</td><td><code>yonetici@kasif.dev</code></td><td><code>Kasif.Studio.2026</code> + giriş ekranında gösterilen deneme doğrulama kodu</td></tr>
<tr><td>İkinci yönetici</td><td><code>ikinci.yonetici@kasif.dev</code></td><td><code>Kasif.Studio.2026</code></td></tr>
<tr><td>Editör</td><td><code>editor@kasif.dev</code></td><td><code>Kasif.Editor.2026</code></td></tr>
</tbody></table></div>
<p class="muted">Deneme verisi yalnızca tarayıcınızda tutulur; Studio → Ayarlar → <em>Deneme verisini sıfırla</em> ile örnek içerik yeniden yüklenir.</p>
</section>
<footer>Kâşif · E-B-M Digital · Bu rapor <code>scripts/build-report.mjs</code> ile test çıktılarından otomatik üretildi.</footer>
</main>
</div>
<button class="theme-toggle" type="button" id="theme">Tema: sistem</button>
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Büyütülmüş ekran görüntüsü"><img alt="" id="lightbox-img" /></div>
<script>
(() => {
  const box = document.getElementById('lightbox')
  const boxImg = document.getElementById('lightbox-img')
  let opener = null
  document.querySelectorAll('button.zoom').forEach((button) => {
    button.addEventListener('click', () => {
      const image = button.querySelector('img')
      boxImg.src = image.src
      boxImg.alt = image.alt
      opener = button
      box.classList.add('open')
      box.tabIndex = -1
      box.focus()
    })
  })
  const close = () => { box.classList.remove('open'); opener?.focus() }
  box.addEventListener('click', close)
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && box.classList.contains('open')) close() })
  const toggle = document.getElementById('theme')
  const modes = ['system', 'light', 'dark']
  const labels = { system: 'Tema: sistem', light: 'Tema: açık', dark: 'Tema: koyu' }
  let mode = 'system'
  toggle.addEventListener('click', () => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length]
    if (mode === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.dataset.theme = mode
    toggle.textContent = labels[mode]
  })
})()
</script>
</body>
</html>
`

writeFileSync(OUT, html)
console.log(
  `✔ ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB, ${Object.keys(images).length} görsel)`,
)
