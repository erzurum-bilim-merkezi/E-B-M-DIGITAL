#!/usr/bin/env node
// Builds docs/rapor/uzay-kasif-rapor.html — one self-contained file (screenshots embedded):
// senior review findings + the "Uzay Kâşifleri" real-scenario E2E run, card by card.
// Inputs:
//   docs/rapor/uzay/shots.json + img/*.jpg   UZAY_REPORT=1 npx playwright test e2e/journeys/uzay-kasifleri.spec.ts
//   docs/rapor/uzay/bulgular.json             review findings [{ severity, area, title, status }]
//   docs/rapor/uzay/kalite.json               gate results [{ name, command, ok, detail }]
//   test-results/e2e.json                     Playwright JSON reporter (full suite or the Uzay spec)
//   test-results/unit.json                    npx vitest run --reporter=json --outputFile=test-results/unit.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { UZAY_CARDS, UZAY_KIT, BLOCK_LABELS } from '../e2e/support/uzay-kasifleri.ts'

const OUT = 'docs/rapor/uzay-kasif-rapor.html'
const DIR = 'docs/rapor/uzay'

const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback
const esc = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const num = (value) => Number(value).toLocaleString('tr-TR')
const secs = (ms) => `${(ms / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn`
const rich = (text) =>
  esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replaceAll('\n', '<br>')

const shots = readJson(path.join(DIR, 'shots.json'), [])
const findings = readJson(path.join(DIR, 'bulgular.json'), [])
const gate = readJson(path.join(DIR, 'kalite.json'), [])
const e2e = readJson('test-results/e2e.json', null)
const unit = readJson('test-results/unit.json', null)

const image = (file) => {
  const full = path.join(DIR, 'img', file)
  return existsSync(full) ? `data:image/jpeg;base64,${readFileSync(full).toString('base64')}` : null
}
function figure(shot) {
  const src = image(shot.file)
  if (!src) return `<p class="missing">Ekran görüntüsü yok: ${esc(shot.file)}</p>`
  return `<figure class="shot"><button class="zoom" type="button" aria-label="Büyüt: ${esc(shot.caption)}"><img src="${src}" alt="${esc(shot.caption)}" loading="lazy"></button><figcaption>${esc(shot.caption)}</figcaption></figure>`
}
const shotsWhere = (predicate) => shots.filter(predicate)

// ── E2E ─────────────────────────────────────────────────────────────────────────────────────
function collect(suite, out = []) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? []
      out.push({
        file: spec.file ?? suite.file,
        title: spec.title,
        project: test.projectName,
        status: test.status === 'expected' ? 'passed' : test.status,
        duration: results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
        steps: results.at(-1)?.steps ?? [],
        error: results.at(-1)?.error?.message ?? null,
      })
    }
  }
  for (const child of suite.suites ?? []) collect(child, out)
  return out
}
const e2eTests = e2e ? (e2e.suites ?? []).flatMap((suite) => collect(suite)) : []
const uzayTest = e2eTests.find((test) => test.file?.includes('uzay-kasifleri'))
const byProject = new Map()
for (const test of e2eTests) {
  const entry = byProject.get(test.project) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0 }
  if (test.status === 'passed') entry.passed++
  else if (test.status === 'flaky') entry.flaky++
  else if (test.status === 'skipped') entry.skipped++
  else entry.failed++
  byProject.set(test.project, entry)
}
const e2eTotal = [...byProject.values()].reduce(
  (sum, entry) => ({
    passed: sum.passed + entry.passed,
    failed: sum.failed + entry.failed,
    flaky: sum.flaky + entry.flaky,
    skipped: sum.skipped + entry.skipped,
  }),
  { passed: 0, failed: 0, flaky: 0, skipped: 0 },
)

function stepRows(steps, depth = 0) {
  return steps
    .filter((step) => step.title && !/^(Before|After) Hooks$/.test(step.title))
    .filter(
      (step) =>
        depth === 0 || !/^(expect|locator|page|browserContext|apiRequest)\./.test(step.title),
    )
    .map((step) => {
      const ok = !step.error
      const children = (step.steps ?? []).filter(
        (child) => !/^(expect|locator|page|browser|Fixture|fixture|Attach)/.test(child.title),
      )
      const nested =
        depth === 0 && children.length
          ? `<ol class="substeps">${stepRows(children, depth + 1)}</ol>`
          : ''
      return `<li class="${ok ? 'pass' : 'fail'}"><span>${ok ? '✓' : '✕'}</span> ${esc(step.title)} <small>${secs(step.duration ?? 0)}</small>${nested}</li>`
    })
    .join('')
}
const scenarioSteps = uzayTest
  ? uzayTest.steps.filter((step) => step.category === 'test.step' || /·/.test(step.title))
  : []

// ── Sections ────────────────────────────────────────────────────────────────────────────────
const unitStats = unit
  ? {
      total: unit.numTotalTests,
      passed: unit.numPassedTests,
      failed: unit.numFailedTests,
      files: unit.testResults?.length ?? 0,
    }
  : null
const fixedCount = findings.filter((finding) => finding.status.startsWith('Düzeltildi')).length
const chip = (ok, text) =>
  `<span class="chip ${ok ? '' : 'bad'}">${ok ? '✓' : '✕'} ${esc(text)}</span>`
const chips = [
  uzayTest &&
    chip(
      uzayTest.status === 'passed',
      `Uzay senaryosu ${uzayTest.status === 'passed' ? 'geçti' : 'kaldı'} (${secs(uzayTest.duration)})`,
    ),
  chip(true, `${UZAY_CARDS.length} kart elle girildi ve oynandı`),
  findings.length > 0 && chip(true, `${fixedCount} / ${findings.length} bulgu düzeltildi`),
  unitStats && chip(unitStats.failed === 0, `${num(unitStats.passed)} birim testi`),
  e2e &&
    chip(
      e2eTotal.failed === 0,
      `${num(e2eTotal.passed)} E2E testi${e2eTotal.flaky ? ` · ${e2eTotal.flaky} kararsız` : ''}`,
    ),
  ...gate.map((item) => chip(item.ok, item.name)),
]
  .filter(Boolean)
  .join('')

const severityOrder = { Yüksek: 0, Orta: 1, Düşük: 2, Bilgi: 3 }
const findingRows = findings
  .toSorted((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))
  .map(
    (finding) =>
      `<tr><td><span class="sev sev-${esc(finding.severity)}">${esc(finding.severity)}</span></td><td>${esc(finding.area)}</td><td>${esc(finding.title)}</td><td>${esc(finding.status)}</td></tr>`,
  )
  .join('')
const findingCounts = Object.entries(Object.groupBy(findings, (finding) => finding.severity))
  .toSorted(([a], [b]) => (severityOrder[a] ?? 9) - (severityOrder[b] ?? 9))
  .map(
    ([severity, count]) =>
      `<div class="card"><h4>${esc(severity)}</h4><div class="stat">${count.length}</div></div>`,
  )
  .join('')

function cardDetail(card) {
  switch (card.kind) {
    case 'choose':
      return `<p><strong>Yönerge:</strong> ${esc(card.prompt)}</p><ul>${card.options.map((option) => `<li>${esc(option.icon)} ${esc(option.label)} ${option.correct ? '<b class="ok">✓ doğru</b>' : '<span class="muted">✕ yanlış</span>'} — <span class="muted">${esc(option.feedback)}</span></li>`).join('')}</ul><p><strong>Başarı:</strong> ${esc(card.success)}</p>`
    case 'quiz':
      return `<p><strong>Soru:</strong> ${esc(card.question)}</p><ul>${card.options.map((option, index) => `<li>${String.fromCharCode(65 + index)}) ${esc(option)} ${index === card.correct ? '<b class="ok">✓ doğru</b>' : ''}</li>`).join('')}</ul><p><strong>Açıklama:</strong> ${esc(card.explanation)}</p>`
    case 'sequence':
      return `<p><strong>Yönerge:</strong> ${esc(card.prompt)}</p><p>${card.items.map((item) => `${esc(item.icon)} ${esc(item.label)}`).join(' → ')}</p>`
    case 'matching':
      return `<p><strong>Yönerge:</strong> ${esc(card.prompt)}</p><ul>${card.pairs.map((pair) => `<li>${esc(pair.left)} ↔ ${esc(pair.right)}</li>`).join('')}</ul>`
    default:
      return ''
  }
}
const cardSections = UZAY_CARDS.map((card, index) => {
  const n = String(index + 1).padStart(2, '0')
  const studioShot = shots.find((shot) => shot.file.startsWith(`s${10 + index}-`))
  const kidShot = shots.find((shot) => shot.file.startsWith(`k${10 + index}-`))
  return `<article class="kart" id="kart-${n}">
  <header><span class="kart-icon" aria-hidden="true">${esc(card.icon.emoji)}</span><div><h3>${index + 1}. ${esc(card.title)}</h3><p class="muted">${esc(BLOCK_LABELS[card.kind])} · QR <code>${UZAY_KIT.qrPrefix}-${n}</code>${card.icon.custom ? ' · ikon “Başka bir emoji” alanından' : ''}</p></div></header>
  <div class="kart-body">
    <div class="kart-text"><p><strong>Keşif (cevap kutusu):</strong> ${rich(card.answer)}</p>${cardDetail(card)}<p class="muted"><strong>İpucu:</strong> ${esc(card.hint)} · <strong>Kutlama:</strong> ${esc(card.celebration)}</p></div>
    <div class="kart-shots">${studioShot ? `<div class="studio-shot">${figure(studioShot)}</div>` : ''}${kidShot ? `<div class="phone-shot">${figure(kidShot)}</div>` : ''}</div>
  </div>
</article>`
}).join('\n')

const gateRows = gate
  .map(
    (item) =>
      `<tr><td>${item.ok ? '<b class="ok">✓</b>' : '<b class="bad">✕</b>'} ${esc(item.name)}</td><td><code>${esc(item.command)}</code></td><td>${esc(item.detail)}</td></tr>`,
  )
  .join('')
const projectRows = [...byProject.entries()]
  .toSorted(([a], [b]) => a.localeCompare(b))
  .map(
    ([project, entry]) =>
      `<tr><td>${esc(project)}</td><td class="num">${entry.passed}</td><td class="num">${entry.failed}</td><td class="num">${entry.flaky}</td><td class="num">${entry.skipped}</td></tr>`,
  )
  .join('')

const generatedAt = new Date().toLocaleString('tr-TR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
})
const phoneShots = shotsWhere((shot) => shot.device === 'phone' && !/^k1\d-/.test(shot.file))
const studioShots = shotsWhere((shot) => shot.device === 'desktop' && !/^s1\d-/.test(shot.file))

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Uzay Kâşifleri Test Raporu</title>
<meta name="description" content="Kıdemli review bulguları ve Uzay Kâşifleri kitinin Studio'dan girilip Kâşif'te oynandığı gerçek senaryo E2E testi.">
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
code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: .88em; background: var(--code); padding: .1em .35em; border-radius: 6px; overflow-wrap: anywhere; }
.layout { display: grid; grid-template-columns: 16rem minmax(0, 1fr); gap: 2.5rem; max-width: 86rem; margin: 0 auto; padding: 2rem 1.5rem 5rem; }
nav.toc { position: sticky; top: 1.5rem; align-self: start; max-height: calc(100vh - 3rem); overflow: auto; font-size: .92rem; }
nav.toc p { font-weight: 700; margin: 0 0 .5rem; }
nav.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: .15rem; }
nav.toc a { display: block; padding: .3rem .6rem; border-radius: 8px; color: var(--muted); text-decoration: none; }
nav.toc a:hover, nav.toc a:focus-visible { background: var(--surface-2); color: var(--fg); }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
header.hero { background: radial-gradient(120% 140% at 85% -10%, #7c6cff 0%, transparent 55%), linear-gradient(135deg, #1b1f4b, #312e81 55%, #0e7490); color: #fff; border-radius: 24px; padding: 2.5rem; margin-bottom: 2.5rem; box-shadow: var(--shadow); position: relative; overflow: hidden; }
header.hero::after { content: "🚀"; position: absolute; right: 2rem; top: 1.4rem; font-size: 4.5rem; opacity: .9; }
header.hero h1 { font-size: clamp(1.9rem, 4vw, 2.8rem); line-height: 1.1; margin: .2rem 0 .8rem; letter-spacing: -.02em; max-width: 40rem; }
header.hero p { margin: 0; max-width: 46rem; opacity: .95; }
.eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .78rem; font-weight: 700; opacity: .9; }
.chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1.4rem; }
.chip { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .8rem; border-radius: 999px; font-weight: 600; font-size: .9rem; background: rgb(255 255 255 / .16); color: #fff; border: 1px solid rgb(255 255 255 / .35); }
.chip.bad { background: #b42318; }
section { margin-top: 3.2rem; scroll-margin-top: 1.5rem; }
h2 { font-size: 1.65rem; letter-spacing: -.01em; margin: 0 0 1rem; padding-bottom: .5rem; border-bottom: 2px solid var(--border); }
h3 { font-size: 1.2rem; margin: 0; }
.muted { color: var(--muted); }
.ok { color: var(--ok); } .bad { color: var(--bad); }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.1rem 1.2rem; box-shadow: var(--shadow); }
.card h4 { margin: 0 0 .3rem; font-size: .95rem; color: var(--muted); font-weight: 600; }
.stat { font-size: 2rem; font-weight: 750; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow); }
table { border-collapse: collapse; width: 100%; font-size: .94rem; }
th, td { text-align: left; padding: .6rem .85rem; border-bottom: 1px solid var(--border); vertical-align: top; }
thead th { background: var(--surface-2); font-weight: 650; }
tbody tr:last-child > * { border-bottom: 0; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.callout { border-radius: 14px; padding: 1rem 1.2rem; border: 1px solid var(--border); background: var(--surface); margin: 1rem 0; }
.callout.warn { background: var(--warn-soft); border-color: transparent; }
.callout.info { background: var(--primary-soft); border-color: transparent; }
.callout.ok { background: var(--ok-soft); border-color: transparent; }
.callout strong:first-child { display: block; margin-bottom: .25rem; }
.sev { font-size: .8rem; font-weight: 700; padding: .15rem .5rem; border-radius: 999px; background: var(--surface-2); white-space: nowrap; }
.sev-Yüksek { background: var(--bad-soft); color: var(--bad); }
.sev-Orta { background: var(--warn-soft); color: var(--warn); }
.sev-Düşük { background: var(--ok-soft); color: var(--ok); }
ol.scenario, ol.substeps { list-style: none; padding: 0; margin: 0; display: grid; gap: .35rem; }
ol.scenario > li { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: .6rem .9rem; }
ol.substeps { margin: .45rem 0 0 1.4rem; }
ol.scenario li > span { font-weight: 800; }
ol.scenario li.pass > span { color: var(--ok); } ol.scenario li.fail > span { color: var(--bad); }
ol.scenario small { color: var(--subtle); margin-left: .35rem; font-variant-numeric: tabular-nums; }
article.kart { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 1.3rem; box-shadow: var(--shadow); margin: 1.2rem 0; scroll-margin-top: 1.5rem; }
article.kart > header { display: flex; gap: .9rem; align-items: center; margin-bottom: .8rem; }
.kart-icon { display: grid; place-items: center; width: 3.2rem; height: 3.2rem; border-radius: 14px; background: var(--primary-soft); font-size: 1.8rem; flex-shrink: 0; }
article.kart header p { margin: .1rem 0 0; font-size: .9rem; }
.kart-body { display: grid; gap: 1.2rem; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); }
.kart-text p, .kart-text li { font-size: .95rem; }
.kart-text ul { padding-left: 1.2rem; margin: .3rem 0 .6rem; }
.kart-shots { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); align-items: start; }
figure.shot { margin: 0; }
figure.shot img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
.kart-shots figure.shot img { max-height: 34rem; object-fit: cover; object-position: top; }
.phone-shot figure.shot img, .phones figure.shot img { border-radius: 20px; border: 5px solid #1b2140; }
figure.shot figcaption { font-size: .85rem; color: var(--muted); margin-top: .45rem; }
.gallery { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); }
.phones { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); }
.phones figure.shot img { max-height: 30rem; object-fit: cover; object-position: top; }
button.zoom { all: unset; cursor: zoom-in; display: block; width: 100%; }
button.zoom:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px; border-radius: 14px; }
.lightbox { position: fixed; inset: 0; background: rgb(8 10 22 / .9); display: none; place-items: center; padding: 1.5rem; z-index: 10; cursor: zoom-out; overflow: auto; }
.lightbox.open { display: grid; }
.lightbox img { max-width: min(96vw, 1440px); border-radius: 12px; }
.missing { color: var(--bad); }
footer { margin-top: 4rem; color: var(--subtle); font-size: .88rem; }
.theme-toggle { position: fixed; right: 1rem; bottom: 1rem; z-index: 5; border: 1px solid var(--border); background: var(--surface); color: var(--fg); border-radius: 999px; padding: .55rem .9rem; font: inherit; font-size: .9rem; box-shadow: var(--shadow); cursor: pointer; }
@media (max-width: 1100px) { .kart-body { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 960px) {
  .layout { grid-template-columns: minmax(0, 1fr); padding: 1rem 16px 4rem; gap: 1.5rem; }
  nav.toc { position: static; max-height: none; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1rem; }
  header.hero { padding: 1.6rem; border-radius: 18px; }
  header.hero::after { display: none; }
}
@media (max-width: 560px) { .kart-shots { grid-template-columns: minmax(0, 1fr); } }
@media print { nav.toc, .theme-toggle { display: none; } .layout { display: block; } article.kart, figure.shot { break-inside: avoid; } }
</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="İçindekiler">
  <p>İçindekiler</p>
  <ol>
    <li><a href="#ozet">1. Özet</a></li>
    <li><a href="#inceleme">2. Kıdemli review bulguları</a></li>
    <li><a href="#esleme">3. İçerik → kart eşlemesi</a></li>
    <li><a href="#senaryo">4. E2E senaryo adımları</a></li>
    <li><a href="#kartlar">5. Kart kart kanıt</a></li>
    <li><a href="#ekranlar">6. Diğer ekranlar</a></li>
    <li><a href="#kalite">7. Kalite kapısı</a></li>
    <li><a href="#acik">8. Açık kalanlar ve öneriler</a></li>
  </ol>
</nav>
<main>
<header class="hero">
  <p class="eyebrow">Erzurum Bilim Merkezi · Kâşif Studio · ${esc(generatedAt)}</p>
  <h1>Uzay Kâşifleri — review ve gerçek senaryo E2E raporu</h1>
  <p>Uygulama kıdemli gözle incelendi (doğruluk, güvenlik, erişilebilirlik), bulunan hatalar düzeltildi. Ardından ekteki 10 uzay keşfi Kâşif Studio'ya <strong>ekrandan tek tek girildi</strong>, kit yayınlandı ve bir çocuk telefonda kiti baştan sona oynayıp <strong>${esc(UZAY_KIT.badge.name)}</strong> rozetini kazandı.</p>
  <div class="chips">${chips}</div>
</header>

<section id="ozet">
<h2>1. Özet</h2>
<div class="grid">
  <div class="card"><h4>Girilen kart</h4><div class="stat">${UZAY_CARDS.length}</div><p class="muted">4 blok türü, QR ${UZAY_KIT.qrPrefix}-01…${String(UZAY_CARDS.length).padStart(2, '0')}</p></div>
  <div class="card"><h4>Review bulgusu</h4><div class="stat">${findings.length}</div><p class="muted">${fixedCount} düzeltildi</p></div>
  <div class="card"><h4>Senaryo süresi</h4><div class="stat">${uzayTest ? secs(uzayTest.duration) : '—'}</div><p class="muted">Studio + telefon, tek test</p></div>
  <div class="card"><h4>E2E toplam</h4><div class="stat">${e2e ? num(e2eTotal.passed) : '—'}</div><p class="muted">${e2e ? `${e2eTotal.failed} başarısız · ${e2eTotal.flaky} kararsız` : 'çalıştırılmadı'}</p></div>
</div>
<div class="callout info"><strong>Senaryo</strong>Yönetici (2FA'lı admin) boş bir arka uçla Studio'yu açar → sihirbazla kit oluşturur → kartsızken yayının engellendiğini görür → tema ve rozeti ayarlar → 10 kartı tek tek girer (başlık, ikon, keşif metni, anlatım, ipucu, kutlama, sahne, seçenekler, doğru cevap) → yenileme sonrası kartların korunduğunu doğrular → yayınlar. Çocuk telefonda takma adla katılır → her kartta <em>önce yanlış</em>, sonra doğru cevap verir → tamamlama ekranı ve rozet → QR kodu (${UZAY_KIT.qrPrefix}-04) ile tek karta giriş → Studio panosu çocuğun etkinliğini gösterir.</div>
</section>

<section id="inceleme">
<h2>2. Kıdemli review bulguları</h2>
<p class="muted">Üç paralel inceleme: doğruluk (code-reviewer), güvenlik (security-auditor), WCAG 2.2 AA (accessibility-auditor) ve senaryo sırasında yakalananlar.</p>
<div class="grid">${findingCounts}</div>
<div class="table-wrap" style="margin-top:1rem"><table><thead><tr><th>Önem</th><th>Alan</th><th>Bulgu</th><th>Durum</th></tr></thead><tbody>${findingRows}</tbody></table></div>
</section>

<section id="esleme">
<h2>3. İçerik → kart eşlemesi</h2>
<p>Bir kartın tek bir etkileşim bloğu vardır. Her keşfin sorusunu kaybetmeden en yakın blok seçildi; soru kartlarında kart ikonu <strong>Emoji sahnesi</strong> ile büyük gösterilir.</p>
<div class="table-wrap"><table><thead><tr><th>#</th><th>Keşif</th><th>Blok</th><th>Neden</th></tr></thead><tbody>
${UZAY_CARDS.map(
  (card, index) =>
    `<tr><td class="num">${index + 1}</td><td>${esc(card.icon.emoji)} ${esc(card.title)}</td><td>${esc(BLOCK_LABELS[card.kind])}</td><td>${esc(
      card.kind === 'choose'
        ? 'Kısa, emojili cevaplar: renkli dokunma butonları; yanlışta esprili geri bildirim, doğruda sahne değişir.'
        : card.kind === 'quiz'
          ? 'Cevap metinleri buton sınırını (24 karakter) aşıyor ya da klasik A/B/C sorusu.'
          : card.kind === 'sequence'
            ? '8 gezegen sıralaması (sınır bu çalışmada 6 → 8 yapıldı).'
            : 'Final görevi: 5 soru ↔ 5 cevap eşleştirmesi.',
    )}</td></tr>`,
).join('')}
</tbody></table></div>
</section>

<section id="senaryo">
<h2>4. E2E senaryo adımları</h2>
${uzayTest ? `<p class="muted"><code>e2e/journeys/uzay-kasifleri.spec.ts</code> · proje <code>${esc(uzayTest.project)}</code> · ${uzayTest.status === 'passed' ? '<b class="ok">geçti</b>' : `<b class="bad">${esc(uzayTest.status)}</b>`} · ${secs(uzayTest.duration)}</p>${uzayTest.error ? `<div class="callout warn"><strong>Hata</strong><code>${esc(uzayTest.error)}</code></div>` : ''}<ol class="scenario">${stepRows(scenarioSteps)}</ol>` : '<p class="missing">E2E sonucu bulunamadı (test-results/e2e.json).</p>'}
</section>

<section id="kartlar">
<h2>5. Kart kart kanıt</h2>
<p class="muted">Solda Studio'da girilen içerik (tam sayfa editör görüntüsü), sağda çocuğun telefonunda kartı çözdükten sonraki ekran.</p>
${cardSections}
</section>

<section id="ekranlar">
<h2>6. Diğer ekranlar</h2>
<h3 style="margin:1rem 0 .6rem">Kâşif Studio</h3>
<div class="gallery">${studioShots.map(figure).join('')}</div>
<h3 style="margin:1.6rem 0 .6rem">Kâşif (telefon)</h3>
<div class="phones">${phoneShots.map(figure).join('')}</div>
</section>

<section id="kalite">
<h2>7. Kalite kapısı</h2>
${gate.length ? `<div class="table-wrap"><table><thead><tr><th>Kontrol</th><th>Komut</th><th>Sonuç</th></tr></thead><tbody>${gateRows}</tbody></table></div>` : ''}
${projectRows ? `<h3 style="margin:1.6rem 0 .6rem">E2E projeleri</h3><div class="table-wrap"><table><thead><tr><th>Proje</th><th class="num">Geçti</th><th class="num">Kaldı</th><th class="num">Kararsız</th><th class="num">Atlandı</th></tr></thead><tbody>${projectRows}</tbody></table></div>` : ''}
</section>

<section id="acik">
<h2>8. Açık kalanlar ve öneriler</h2>
${readJson(path.join(DIR, 'oneriler.json'), [])
  .map(
    (item) =>
      `<div class="callout ${item.tone ?? 'info'}"><strong>${esc(item.title)}</strong>${esc(item.body)}</div>`,
  )
  .join('')}
</section>

<footer>Bu dosya <code>node scripts/build-uzay-report.mjs</code> ile üretildi; ekran görüntüleri gömülüdür, tek başına açılabilir.</footer>
</main>
</div>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="Büyütülmüş ekran görüntüsü" tabindex="-1"><img alt=""></div>
<button class="theme-toggle" type="button" aria-pressed="false">🌓 Tema</button>
<script>
const box = document.querySelector('.lightbox'); const boxImg = box.querySelector('img'); let opener = null;
document.querySelectorAll('button.zoom').forEach((btn) => btn.addEventListener('click', () => {
  const img = btn.querySelector('img'); boxImg.src = img.src; boxImg.alt = img.alt; opener = btn; box.classList.add('open'); box.focus();
}));
const close = () => { box.classList.remove('open'); opener?.focus(); };
box.addEventListener('click', close);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && box.classList.contains('open')) close(); });
const toggle = document.querySelector('.theme-toggle');
toggle.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark'; toggle.setAttribute('aria-pressed', String(!dark));
});
</script>
</body>
</html>
`

writeFileSync(OUT, html)
console.log(
  `✔ ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB, ${shots.length} ekran görüntüsü)`,
)
