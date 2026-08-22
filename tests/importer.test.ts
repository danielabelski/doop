import { describe, expect, it } from 'vitest'
import { comparePageUrlsByDepth, normalizePageUrl, parseHtmlPage, parseSitemap } from '../server/importer.ts'

describe('website page discovery helpers', () => {
  const site = new URL('https://example.com/pricing')

  it('keeps same-site pages while normalizing tracking parameters and fragments', () => {
    const page = normalizePageUrl('http://example.com/docs/?utm_source=newsletter&b=2&a=1#overview', site, site)
    expect(page?.href).toBe('https://example.com/docs/?a=1&b=2')
    expect(normalizePageUrl('https://other.example/docs', site, site)).toBeNull()
    expect(normalizePageUrl('/assets/diagram.svg', site, site)).toBeNull()
    expect(normalizePageUrl('mailto:hello@example.com', site, site)).toBeNull()
  })

  it('extracts a readable title and resolves links against a document base', () => {
    const parsed = parseHtmlPage(
      `<!doctype html><title>Docs &amp; Guides</title>
       <base href="/help/">
       <a href="getting-started">Start</a>
       <a href='/pricing?plan=pro&amp;cycle=annual'>Pricing</a>`,
      new URL('https://example.com/docs'),
    )
    expect(parsed.title).toBe('Docs & Guides')
    expect(parsed.links).toEqual([
      'https://example.com/help/getting-started',
      'https://example.com/pricing?plan=pro&cycle=annual',
    ])
  })

  it('reads ordinary and CDATA sitemap locations', () => {
    const parsed = parseSitemap(`
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/pages.xml?part=1&amp;lang=en</loc></sitemap>
        <sitemap><loc><![CDATA[https://example.com/pages-2.xml]]></loc></sitemap>
      </sitemapindex>
    `)
    expect(parsed).toEqual({
      index: true,
      urls: ['https://example.com/pages.xml?part=1&lang=en', 'https://example.com/pages-2.xml'],
    })
  })

  it('orders first-level paths before nested pages', () => {
    const pages = [
      'https://example.com/use-cases/education',
      'https://example.com/blog/launch',
      'https://example.com/privacy',
      'https://example.com/',
      'https://example.com/blog',
      'https://example.com/use-cases',
    ]
    expect(pages.sort(comparePageUrlsByDepth)).toEqual([
      'https://example.com/',
      'https://example.com/blog',
      'https://example.com/privacy',
      'https://example.com/use-cases',
      'https://example.com/blog/launch',
      'https://example.com/use-cases/education',
    ])
  })
})
