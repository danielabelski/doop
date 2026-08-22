import dns from 'node:dns/promises'
import net from 'node:net'
import { getBrowser } from './screenshot.ts'
import * as assets from './assets.ts'
import * as actions from './actions.ts'
import { PUBLIC_ORIGIN } from './auth.ts'
import type { Actor, Frame } from '../shared/types.ts'

/**
 * Live-site viewer behind the resident view_website tool: load a public page
 * in the same headless Chrome that renders frames and hand the agent a
 * screenshot plus the page's visible text, so a "redesign X.com" card starts
 * from what is actually on X.com instead of guesses based on the name.
 */

const NAV_TIMEOUT_MS = 20_000
const VIEWPORT_WIDTH = 1280
/** same crop convention as screenshot_frame: full detail, top of page */
const MAX_SHOT_HEIGHT = 4000
const MAX_TEXT_CHARS = 6_000

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    /* unique-local fc00::/7, link-local fe80::/10, v4-mapped ::ffff:a.b.c.d */
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateIp(mapped[1]) : false
  }
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

/** The server sits on Railway's private network — a fetched URL must never
 *  reach localhost, *.internal service names, or private address space. */
async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new Error(`"${raw}" is not a valid URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('only http(s) URLs can be viewed')
  }
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || !host.includes('.')) {
    throw new Error('that host is not reachable from here')
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true })
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error('that host is not reachable from here')
  }
  return url
}

export interface WebsiteView {
  /** JPEG screenshot of the top of the page at desktop width. */
  screenshot: Buffer
  finalUrl: string
  title: string
  description: string
  /** Visible body text, whitespace-collapsed, capped at MAX_TEXT_CHARS. */
  text: string
  textTruncated: boolean
  /** True when the page is taller than the screenshot shows. */
  shotCropped: boolean
  pageHeight: number
  /** CSS-pixel height of the screenshot itself. */
  shotHeight: number
}

export async function viewWebsite(raw: string): Promise<WebsiteView> {
  const url = await assertPublicHttpUrl(raw)
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: VIEWPORT_WIDTH, height: 900, deviceScaleFactor: 1 })
    try {
      await page.goto(url.href, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS })
    } catch {
      /* slow third-party resources: capture whatever has rendered */
    }
    /* a public host may redirect somewhere private — re-check where we landed */
    await assertPublicHttpUrl(page.url())
    await new Promise((resolve) => setTimeout(resolve, 500))

    await page.evaluate('globalThis.__name = (target) => target')
    const info = await page.evaluate(() => {
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
      const text = (document.body?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim()
      return { title: document.title, description, text, pageHeight: document.documentElement.scrollHeight }
    })
    if (!info.text && !info.title) throw new Error('the page rendered empty — it may block automated browsers')

    const shotHeight = Math.min(Math.max(info.pageHeight, 400), MAX_SHOT_HEIGHT)
    const screenshot = (await page.screenshot({
      type: 'jpeg',
      quality: 80,
      clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: shotHeight },
    })) as Buffer

    return {
      screenshot,
      finalUrl: page.url(),
      title: info.title,
      description: info.description,
      text: info.text.slice(0, MAX_TEXT_CHARS),
      textTruncated: info.text.length > MAX_TEXT_CHARS,
      shotCropped: info.pageHeight > MAX_SHOT_HEIGHT,
      pageHeight: info.pageHeight,
      shotHeight,
    }
  } finally {
    await page.close().catch(() => {})
  }
}

const REFERENCE_HEADER_PX = 44

/** Pin a captured page to the canvas as a visible reference frame: the
 *  screenshot becomes a permanent asset and lands in a frame everyone can
 *  see next to the redesign — the source of truth the design came from.
 *  Humans can pin the frame to Memory like any other. */
export async function saveWebsiteReferenceFrame(
  canvasId: string,
  actor: Actor,
  view: WebsiteView,
): Promise<Frame | undefined> {
  const asset = await assets.createAsset(view.screenshot, { canvasId, uploadedBy: actor.name })
  const src = `${PUBLIC_ORIGIN}/a/${asset.id}.${asset.ext}`
  const host = new URL(view.finalUrl).hostname.replace(/^www\./, '')
  const html = `<!doctype html>
<html>
<head><style>
  body { margin: 0; font: 12px/1.4 -apple-system, system-ui, sans-serif; }
  header { height: ${REFERENCE_HEADER_PX}px; box-sizing: border-box; display: flex; align-items: center; gap: 10px;
    padding: 0 14px; background: #111318; color: #e7e9ee; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: #5eead4; flex: none; }
  header strong { font-size: 13px; font-weight: 600; }
  header a { color: #9aa3b2; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header .tag { margin-left: auto; flex: none; color: #9aa3b2; letter-spacing: 0.04em; text-transform: uppercase; font-size: 10px; }
  img { display: block; width: 100%; }
</style></head>
<body>
  <header>
    <span class="dot"></span>
    <strong>${host}</strong>
    <a href="${view.finalUrl}" target="_blank" rel="noopener">${view.finalUrl}</a>
    <span class="tag">live capture — reference</span>
  </header>
  <img src="${src}" alt="Screenshot of ${host}${view.shotCropped ? ' (top of page)' : ''}">
</body>
</html>`
  return actions.createFrame(
    canvasId,
    { name: `Reference — ${host}`, html, width: VIEWPORT_WIDTH, height: view.shotHeight + REFERENCE_HEADER_PX },
    actor,
  )
}

/** URLs and bare domains mentioned in work-request text — the harness nudges
 *  the agent to view each one before designing. File names are not sites. */
export function referencedUrls(text: string): string[] {
  const NOT_SITES = /\.(png|jpe?g|gif|svg|webp|ico|css|js|ts|tsx|json|html?|md|pdf|txt|mp4|webm|woff2?)$/i
  const matches =
    text.match(/\bhttps?:\/\/[^\s"'<>()]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s"'<>()]*)?/gi) ?? []
  const urls = matches.map((m) => m.replace(/[.,;:!?]+$/, '')).filter((m) => !NOT_SITES.test(m))
  return [...new Set(urls)]
}
