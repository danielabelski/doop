import { getBrowser } from './screenshot.ts'

/**
 * Website importer: discover a bounded set of same-site pages, or load one
 * URL in the shared Chromium and turn it into a self-contained frame. Scripts
 * are stripped from imported frames so they stay editable (WYSIWYG and the
 * agents both refuse script-bearing frames).
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 DoopImporter/1.0'
const VIEWPORT_WIDTH = 1280
const MAX_HEIGHT = 6000
const MAX_SHEET_BYTES = 600_000
const MAX_TOTAL_BYTES = 2_000_000
const MAX_DISCOVERY_BYTES = 2_000_000
const MAX_SITEMAPS = 12
const DISCOVERY_CONCURRENCY = 6
export const MAX_SITE_PAGES = 100

const NON_PAGE_EXTENSIONS =
  /\.(?:avif|bmp|css|csv|docx?|eot|gif|gz|ico|jpe?g|js|json|map|mov|mp3|mp4|mpeg|ogg|otf|pdf|png|pptx?|rar|rss|svg|tar|tiff?|txt|wav|webm|webp|woff2?|xlsx?|xml|zip)$/i

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

/** A website is scoped to one hostname and (when explicit) port. We allow an
 * http URL on a page to resolve to https without treating it as another site. */
export function isSameSiteUrl(candidate: URL, site: URL): boolean {
  return candidate.hostname.toLowerCase() === site.hostname.toLowerCase() && candidate.port === site.port
}

/** Normalize a navigable page URL and reject links that cannot represent an
 * importable web page. Exported because the crawler rules are useful to test
 * without making network requests. */
export function normalizePageUrl(raw: string, base: URL, site: URL): URL | null {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !isSameSiteUrl(url, site)) return null
  if (url.username || url.password || NON_PAGE_EXTENSIONS.test(url.pathname)) return null
  if (site.protocol === 'https:' && url.protocol === 'http:') url.protocol = 'https:'
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid|dclid|msclkid)$/i.test(key)) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  return url
}

function pageKey(url: URL): string {
  const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host}${path}${url.search}`
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' ' }
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x'
      const parsed = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 0x10ffff ? String.fromCodePoint(parsed) : all
    }
    return named[entity.toLowerCase()] ?? all
  })
}

function cleanTitle(value: string): string {
  return decodeEntities(
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, 160)
}

export function parseHtmlPage(html: string, pageUrl: URL): { title: string; links: string[] } {
  const title = cleanTitle(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const baseHref = html.match(/<base\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
  let base = pageUrl
  try {
    if (baseHref) base = new URL(baseHref[1] ?? baseHref[2] ?? baseHref[3], pageUrl)
  } catch {
    /* malformed base; ordinary document-relative resolution is safer */
  }
  const links: string[] = []
  const hrefs = html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)
  for (const match of hrefs) {
    try {
      links.push(new URL(decodeEntities(match[1] ?? match[2] ?? match[3]), base).href)
    } catch {
      /* malformed link */
    }
  }
  return { title, links }
}

export function parseSitemap(xml: string): { index: boolean; urls: string[] } {
  const urls: string[] = []
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    let value = match[1].trim()
    if (value.startsWith('<![CDATA[') && value.endsWith(']]>')) value = value.slice(9, -3)
    value = decodeEntities(value.trim())
    if (value) urls.push(value)
  }
  return { index: /<sitemapindex\b/i.test(xml), urls }
}

function fallbackTitle(url: URL): string {
  if (url.pathname === '/') return 'Home'
  const last = url.pathname.split('/').filter(Boolean).pop() ?? url.hostname
  try {
    return decodeURIComponent(last)
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return last
  }
}

/** Homepage first, then shallower paths before deeper descendants. Within a
 * level, keep the deterministic alphabetical/numeric order users expect. */
export function comparePageUrlsByDepth(a: string, b: string): number {
  const left = new URL(a)
  const right = new URL(b)
  const leftDepth = left.pathname.split('/').filter(Boolean).length
  const rightDepth = right.pathname.split('/').filter(Boolean).length
  if (leftDepth !== rightDepth) return leftDepth - rightDepth
  return `${left.pathname}${left.search}`.localeCompare(`${right.pathname}${right.search}`, undefined, {
    numeric: true,
  })
}

interface TextResponse {
  url: URL
  text: string
  contentType: string
}

/** Follow redirects manually so every hop is re-checked before it is fetched. */
async function fetchSiteText(rawUrl: string, site: URL, timeout = 8_000): Promise<TextResponse | null> {
  let url = assertPublicHttpUrl(rawUrl)
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!isSameSiteUrl(url, site)) return null
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml,text/xml,*/*;q=0.1' },
        signal: AbortSignal.timeout(timeout),
      })
    } catch {
      return null
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      try {
        url = assertPublicHttpUrl(new URL(location, url).href)
      } catch {
        return null
      }
      continue
    }
    if (!res.ok) return null
    const declared = Number(res.headers.get('content-length') || 0)
    if (declared > MAX_DISCOVERY_BYTES) return null
    const text = (await res.text()).slice(0, MAX_DISCOVERY_BYTES)
    return { url, text, contentType: res.headers.get('content-type') ?? '' }
  }
  return null
}

async function sitemapPages(site: URL): Promise<string[]> {
  const sitemapQueue = [`${site.origin}/sitemap.xml`]
  const robots = await fetchSiteText(`${site.origin}/robots.txt`, site)
  if (robots) {
    for (const match of robots.text.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)) sitemapQueue.push(match[1])
  }

  const seen = new Set<string>()
  const pages: string[] = []
  while (sitemapQueue.length && seen.size < MAX_SITEMAPS && pages.length < MAX_SITE_PAGES) {
    const raw = sitemapQueue.shift()!
    let sitemapUrl: URL
    try {
      sitemapUrl = assertPublicHttpUrl(new URL(raw, site).href)
    } catch {
      continue
    }
    if (!isSameSiteUrl(sitemapUrl, site) || seen.has(sitemapUrl.href)) continue
    seen.add(sitemapUrl.href)
    const response = await fetchSiteText(sitemapUrl.href, site)
    if (!response) continue
    const parsed = parseSitemap(response.text)
    if (parsed.index) sitemapQueue.push(...parsed.urls)
    else pages.push(...parsed.urls)
  }
  return pages
}

export interface DiscoveredPage {
  url: string
  title: string
}

export interface DiscoveredSite {
  siteUrl: string
  pages: DiscoveredPage[]
  truncated: boolean
}

/** Discover the homepage, sitemap entries, and recursively linked HTML pages.
 * The hard cap keeps an accidental calendar/archive crawl from becoming an
 * unbounded background job; the UI calls this out when it is reached. */
export async function discoverSitePages(rawUrl: string): Promise<DiscoveredSite> {
  assertPublicHttpUrl(rawUrl)
  const browser = await getBrowser()
  const page = await browser.newPage()
  let seed: { url: URL; title: string; links: string[] }
  try {
    await page.setViewport({ width: VIEWPORT_WIDTH, height: 900 })
    await page.setUserAgent(UA)
    await page.goto(rawUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 })
    await new Promise((resolve) => setTimeout(resolve, 700))
    const finalUrl = assertPublicHttpUrl(page.url())
    const snapshot = await page.evaluate(() => ({
      title: document.title,
      links: Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'), (a) => a.href),
    }))
    seed = { url: finalUrl, title: cleanTitle(snapshot.title), links: snapshot.links }
  } finally {
    await page.close().catch(() => {})
  }

  const pages = new Map<string, DiscoveredPage>()
  let truncated = false
  const add = (raw: string, base = seed.url, title = '') => {
    const url = normalizePageUrl(raw, base, seed.url)
    if (!url) return
    const key = pageKey(url)
    const existing = pages.get(key)
    if (existing) {
      if (title && !existing.title) existing.title = cleanTitle(title)
      return
    }
    if (pages.size >= MAX_SITE_PAGES) {
      truncated = true
      return
    }
    pages.set(key, { url: url.href, title: cleanTitle(title) })
  }

  add(`${seed.url.origin}/`)
  add(seed.url.href, seed.url, seed.title)
  for (const link of seed.links) add(link)
  for (const link of await sitemapPages(seed.url)) add(link)

  /* The rendered seed already gave us its links. Fetch the remaining pages
     in small batches to obtain titles and discover deeper static links. */
  const scanned = new Set<string>([pageKey(seed.url)])
  for (;;) {
    const batch = [...pages.entries()].filter(([key]) => !scanned.has(key)).slice(0, DISCOVERY_CONCURRENCY)
    if (!batch.length) break
    batch.forEach(([key]) => scanned.add(key))
    const results = await Promise.all(
      batch.map(async ([key, found]) => ({ key, found, response: await fetchSiteText(found.url, seed.url) })),
    )
    for (const { key, found, response } of results) {
      if (!response || (response.contentType && !/html|xhtml/i.test(response.contentType))) continue
      const parsed = parseHtmlPage(response.text, response.url)
      if (parsed.title) pages.get(key)!.title = parsed.title
      for (const link of parsed.links) add(link, response.url)
      /* Preserve the requested URL in the list; importPage follows the same
         redirect and the label remains recognizable to the user. */
      if (!pages.get(key)?.title) pages.get(key)!.title = fallbackTitle(new URL(found.url))
    }
  }

  const result = [...pages.values()]
    .map((found) => ({ ...found, title: found.title || fallbackTitle(new URL(found.url)) }))
    .sort((a, b) => comparePageUrlsByDepth(a.url, b.url))

  return { siteUrl: seed.url.origin, pages: result, truncated }
}

export interface ImportedPageResult {
  url: string
  page?: ImportedPage
  error?: string
}

/** Capture several pages without opening an unbounded number of Chromium tabs. */
export async function importSitePages(rawUrls: string[], concurrency = 3): Promise<ImportedPageResult[]> {
  const results = new Array<ImportedPageResult>(rawUrls.length)
  let cursor = 0
  async function worker() {
    for (;;) {
      const index = cursor++
      if (index >= rawUrls.length) return
      const url = rawUrls[index]
      try {
        results[index] = { url, page: await importPage(url) }
      } catch (error) {
        results[index] = { url, error: error instanceof Error ? error.message : 'import failed' }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), rawUrls.length) }, () => worker()))
  return results
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
