import { createServer } from 'node:http'

import { expect, joinFromHome, test } from '../support/test.ts'

test.describe('Interactive page card', () => {
  test('runs the three.js page isolated from Kâşif and completes with “Keşfettim”', async ({
    page,
  }) => {
    await joinFromHome(page, 'Ada')
    await page.goto('kit/blok-vitrini/dunya-ve-ay')
    await expect(page.getByRole('heading', { level: 1, name: /Dünya ve Ay/ })).toBeVisible()
    await expect(page.getByText('Dünya’yı parmağınla döndür, Ay’a dokun!')).toBeVisible()

    const frame = page.getByTitle('Dünya ve Ay', { exact: true })
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
    const inside = page.frameLocator('iframe[title="Dünya ve Ay"]')
    const scene = inside.getByRole('img', { name: /Dünya ve etrafında dönen Ay/ })
    await expect(scene).toBeVisible()

    // three.js runs: a tap on the Earth in the middle of the scene is hit-tested in 3D.
    await scene.click()
    await expect(inside.getByRole('status')).toHaveText(/^Dünya: üzerinde yaşadığımız gezegen/)

    // An opaque origin: no way to Kâşif's document or the device's session.
    const content = await (await frame.elementHandle())?.contentFrame()
    const isolation = await content?.evaluate(() => {
      let parent = 'open'
      let storage = 'open'
      try {
        void window.parent.document.title
      } catch {
        parent = 'blocked'
      }
      try {
        void window.localStorage.length
      } catch {
        storage = 'blocked'
      }
      return { origin: window.origin, parent, storage }
    })
    expect(isolation).toEqual({ origin: 'null', parent: 'blocked', storage: 'blocked' })

    await page.getByRole('button', { name: /Keşfettim/ }).click()
    await expect(page.getByRole('button', { name: /Keşfettin!/ })).toBeFocused()
  })

  test('the runner refuses to run a page for any other site', async ({ page, baseURL }) => {
    // Another site frames the public runner — once without the sandbox (it would run with
    // Kâşif's origin) and once with it — and offers each a page that would report back. A real
    // loopback server: Chromium keeps pages it cannot place on the network off localhost.
    const runner = `${baseURL}page-runner.html`
    const offer = `{ type: 'kasif:page-runner:load', runtime: 'export {}', html: '<html><head></head><body><script>parent.postMessage({ type: "ran", origin: origin }, "*")</' + 'script></body></html>' }`
    const elsewhere = createServer((_, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html><body>
        <iframe id="open" src="${runner}"></iframe>
        <iframe id="sandboxed" sandbox="allow-scripts" src="${runner}"></iframe>
        <script>
          window.heard = []
          addEventListener('message', (event) => window.heard.push(event.data && event.data.type))
          for (const id of ['open', 'sandboxed']) {
            const frame = document.getElementById(id)
            frame.addEventListener('load', () => frame.contentWindow.postMessage(${offer}, '*'))
          }
        </script>
      </body></html>`)
    })
    await new Promise<void>((resolve) => elsewhere.listen(0, '127.0.0.1', resolve))
    const address = elsewhere.address()
    const port = address && typeof address === 'object' ? address.port : 0
    try {
      await page.goto(`http://127.0.0.1:${port}/`)
      // Both runners really loaded; the sandboxed one even greets its (foreign) parent …
      await expect
        .poll(() => page.frames().filter((frame) => frame.url() === runner).length)
        .toBe(2)
      const heard = () => page.evaluate(() => (window as unknown as { heard: string[] }).heard)
      await expect.poll(heard).toContain('kasif:page-runner:ready')
      // … but neither writes the offered page. Its script would answer within milliseconds.
      await page.waitForTimeout(1000)
      expect(await heard()).not.toContain('ran')
    } finally {
      elsewhere.close()
    }
  })
})
