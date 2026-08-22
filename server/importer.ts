import { getBrowser } from './screenshot.ts'

/**
 * Landing-page importer: load a URL in the shared Chromium, snapshot the
 * rendered DOM, inline every stylesheet, and return a self-contained HTML
 * document sized to the page. Scripts are stripped — imported frames are
 * static snapshots, which also keeps them editable (WYSIWYG and the agents
 * both refuse script-bearing frames).
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 DoopImporter/1.0'
const VIEWPORT_WIDTH = 1280
const MAX_HEIGHT = 6000
const MAX_SHEET_BYTES = 600_000
const MAX_TOTAL_BYTES = 2_000_000

/** Basic SSRF guard: public http(s) hosts only. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('not a valid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http(s) URLs can be imported')
  const h = url.hostname.toLowerCase()
  const privateHost =
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '[::1]' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.railway.internal') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  if (privateHost) throw new Error('that host cannot be imported')
  return url
}

/** Fetch a stylesheet, resolve depth-1 @imports, absolutize its url() refs. */
async function fetchCss(sheetUrl: string, depth = 0): Promise<string> {
  if (depth > 1) return ''
  let css: string
  try {
    const res = await fetch(sheetUrl, {
      headers: { 'user-agent': UA, accept: 'text/css,*/*;q=0.1' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return ''
    css = await res.text()
  } catch {
    return ''
  }
  if (css.length > MAX_SHEET_BYTES) css = css.slice(0, MAX_SHEET_BYTES)

  const imports = [...css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s]+)['"]?\s*\)?[^;]*;/g)]
  for (const m of imports) {
    let child = ''
    try {
      child = await fetchCss(new URL(m[1], sheetUrl).href, depth + 1)
    } catch {
      /* dead import */
    }
    css = css.replace(m[0], child)
  }
  /* relative url(...) inside the sheet must resolve against the SHEET's URL,
     not the document base */
  css = css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/|#)([^'")]+)\1\s*\)/g, (_all, q, p) => {
    try {
      return `url(${q}${new URL(p, sheetUrl).href}${q})`
    } catch {
      return _all
    }
  })
  return css
}

export interface ImportedPage {
  title: string
  width: number
  height: number
  html: string
}

export async function importPage(rawUrl: string): Promise<ImportedPage> {
  assertPublicHttpUrl(rawUrl)
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: VIEWPORT_WIDTH, height: 900 })
    await page.setUserAgent(UA)
    await page.goto(rawUrl, { waitUntil: 'networkidle2', timeout: 30_000 })
    /* redirects can land somewhere private — re-check the final origin */
    assertPublicHttpUrl(page.url())
    /* walk the page before capturing: scroll-reveal animations and lazy
       images only materialize once their elements have been in view */
    await page.evaluate(async () => {
      /* the window isn't always the scroller — app-shell pages scroll an
         overflow container. Walk the tallest scrollables too. */
      const scrollables: (Element | null)[] = [document.scrollingElement]
      for (const el of Array.from(document.querySelectorAll('body, body *')).slice(0, 4000)) {
        if (el.scrollHeight > el.clientHeight + 300 && el.clientHeight > 200) {
          const o = getComputedStyle(el).overflowY
          if (o === 'auto' || o === 'scroll') scrollables.push(el)
        }
      }
      const targets = scrollables
        .filter((el): el is Element => !!el)
        .sort((a, b) => b.scrollHeight - a.scrollHeight)
        .slice(0, 3)
      for (const el of targets) {
        let y = 0
        for (let i = 0; i < 40; i++) {
          y += 700
          el.scrollTop = y
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
          if (y >= el.scrollHeight) break
        }
        el.scrollTop = 0
      }
      window.scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 400))
    })
    await new Promise((r) => setTimeout(r, 600)) // late layout/lazy paint

    const snap = await page.evaluate((maxHeight: number) => {
      for (const el of document.querySelectorAll('script, noscript, iframe')) el.remove()
      const sheets: string[] = []
      for (const l of document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')) {
        if (l.href) sheets.push(l.href)
        l.remove()
      }
      for (const l of document.querySelectorAll('link[rel="preload"], link[rel="modulepreload"], base')) l.remove()
      return {
        sheets,
        title: document.title,
        height: Math.min(Math.max(document.documentElement.scrollHeight, 400), maxHeight),
        html: document.documentElement.outerHTML,
      }
    }, MAX_HEIGHT)
    const finalUrl = page.url()

    let css = ''
    for (const sheet of snap.sheets) {
      css += (await fetchCss(sheet)) + '\n'
      if (css.length > MAX_TOTAL_BYTES) break
    }

    /* self-contained document: a base tag so in-document relative URLs
       (images, srcset) keep resolving, plus every stylesheet inlined */
    const inject =
      `<base href="${finalUrl.replace(/"/g, '%22')}">` +
      (css.trim() ? `<style data-doop-import>\n${css}\n</style>` : '')
    let html = snap.html
    const headMatch = html.match(/<head[^>]*>/i)
    if (headMatch) html = html.replace(headMatch[0], headMatch[0] + inject)
    else html = inject + html
    html = '<!doctype html>\n' + html

    if (html.length > MAX_TOTAL_BYTES * 1.5) throw new Error('page too large to import')

    return {
      title: snap.title || new URL(finalUrl).hostname,
      width: VIEWPORT_WIDTH,
      height: Math.round(snap.height),
      html,
    }
  } finally {
    await page.close().catch(() => {})
  }
}
