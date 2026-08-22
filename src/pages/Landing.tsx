import { useEffect, useState } from 'react'
import { navigate, Logo } from '../App'
import { AgentIcon } from '../components/AgentIcon'

/**
 * Marketing landing for signed-out visitors. The hero is a canvas mid-session
 * (staggered viewport-filling letterforms + real product artifacts); below it,
 * a full page: app showcase mock, manifesto band, how-it-works with a real
 * terminal, feature grid, FAQ and a closing CTA. Sections fade in on scroll.
 */
export function Landing() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('rv-in')),
      { threshold: 0.15 },
    )
    document.querySelectorAll('[data-rv]').forEach((el) => io.observe(el))
    /* the showcase mock keeps its desktop composition on phones by scaling —
       CSS can't divide lengths into a unitless scale, so compute it here */
    const setMockScale = () => {
      document.documentElement.style.setProperty('--mock-scale', String((window.innerWidth - 32) / 1600))
      /* desktop: designed at a native 1600px — fills ~90% of the viewport,
         never upscaled past 1:1, so it stays pixel-sharp */
      document.documentElement.style.setProperty(
        '--mock-scale-lg',
        String(Math.min((window.innerWidth * 0.9) / 1600, 1)),
      )
    }
    setMockScale()
    window.addEventListener('resize', setMockScale)
    /* canvas-zoom: scrolling the hero pushes the camera into the dot grid */
    const lp = document.querySelector('.lp')
    const onScroll = () => {
      const t = Math.min((lp?.scrollTop ?? 0) / (window.innerHeight * 1.2), 1)
      document.documentElement.style.setProperty('--dot-zoom', String(1 + t * 0.9))
    }
    lp?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('resize', setMockScale)
      lp?.removeEventListener('scroll', onScroll)
    }
  }, [])

  const mcpUrl = `${location.origin}/mcp`

  return (
    <div className="lp">
      <nav className="lp-nav">
        <span className="home-mark">
          <Logo /> Doop
        </span>
        <div className="lp-nav-links">
          <a href="#app">Product</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          {/* server-rendered page — plain anchor, full load on purpose */}
          <a href="/blog">Blog</a>
        </div>
        <span className="spacer" />
        <button className="btn ghost" onClick={() => navigate('/auth')}>
          Sign in
        </button>
        <button className="btn primary" onClick={() => navigate('/auth')}>
          Get started
        </button>
      </nav>

      <header className="lp-hero">
        <div className="lp-kicker">Design by</div>
        <h1 className="lp-giant" aria-label="Agents and Humans">
          <span className="g-agents">Agents</span>
          <span className="g-humans">&amp;&nbsp;Humans</span>
        </h1>
        <div className="lp-hero-inner">
          <p className="lp-sub">
            Doop is a multiplayer canvas where people and AI agents design side by side. Agents join through MCP — as{' '}
            <strong>yours</strong>, via OAuth — and every frame streams in live, with their status, tasks and your
            feedback flowing both ways.
          </p>
          <div className="lp-ctas">
            <button className="btn primary lp-cta" onClick={() => navigate('/auth')}>
              Start designing — it's free
            </button>
            <a className="btn ghost lp-cta" href="#how">
              How it works
            </a>
          </div>
        </div>

        <div className="lp-frame" aria-hidden>
          <div className="lp-frame-bar">
            <span className="lp-frame-name">Pricing page</span>
            <span className="lp-frame-chip">✦ streaming</span>
          </div>
          <div className="lp-frame-body">
            <div className="lp-el lp-el-nav" />
            <div className="lp-el lp-el-h1" />
            <div className="lp-el lp-el-p" />
            <div className="lp-el lp-el-p short" />
            <div className="lp-el-row">
              <div className="lp-el lp-el-card" />
              <div className="lp-el lp-el-card mid" />
              <div className="lp-el lp-el-card" />
            </div>
            <div className="lp-el lp-el-btn" />
          </div>
        </div>

        <div className="lp-cursor lp-cursor-human" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#2D5FE0" stroke="#fff" strokeWidth="1.4" />
          </svg>
          <span>Kevin</span>
        </div>
        <div className="lp-cursor lp-cursor-agent" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#D97757" stroke="#fff" strokeWidth="1.4" />
          </svg>
          <span>
            <AgentIcon name="claude" size={11} /> Claude
          </span>
        </div>

        <div className="lp-status" aria-hidden>
          <span className="pulse-dot" style={{ background: '#D97757' }} />
          <strong>
            <AgentIcon name="claude" size={12} /> Claude
          </strong>{' '}
          Sketching the pricing grid…
        </div>

        <div className="lp-task" aria-hidden>
          <div className="lp-task-row done">
            <span>✓</span> Hero section <i>1m</i>
          </div>
          <div className="lp-task-row done">
            <span>✓</span> Pricing grid <i>2m</i>
          </div>
          <div className="lp-task-row live">
            <span className="pulse-dot" style={{ background: '#E5533C' }} /> Reviewing screenshot <i>now</i>
          </div>
        </div>

        <div className="lp-sticky" aria-hidden>
          any MCP agent
          <br />
          can join →
        </div>
      </header>

      {/* ---- app showcase ---- */}
      <section className="lp-show" id="app">
        <div className="lp-section-head" data-rv>
          <span className="lp-sec-eyebrow">The canvas</span>
          <h2>See what every agent is working on — live</h2>
          <p>
            Agents sync their tasks to the canvas as they work, so you can watch anyone's agent mid-design — not just
            your own. And they share the canvas's memory: what's been designed, decided and commented stays visible to
            the next agent that joins.
          </p>
        </div>
        <div className="mock-scale" data-rv>
          <ShowcaseMock />
        </div>
      </section>

      {/* ---- manifesto ---- */}
      <section className="lp-manifesto" data-rv>
        <p>
          Design tools bolted AI on as a <s>feature</s>. Doop starts from the other end: agents are{' '}
          <em>collaborators</em> — with presence, tasks and accountability — on the same canvas as the people they work
          for.
        </p>
        <div className="lp-manifesto-chips">
          <span className="lp-works-label">Works with</span>
          <span>
            <AgentIcon name="claude" size={14} /> Claude Code
          </span>
          <span>
            <AgentIcon name="codex" size={14} /> Codex
          </span>
          <span>✦ any MCP client</span>
        </div>
      </section>

      {/* ---- how it works ---- */}
      <section className="lp-how" id="how">
        <div className="lp-section-head" data-rv>
          <span className="lp-sec-eyebrow">Workflow</span>
          <h2>Three steps to a shared studio</h2>
        </div>
        <div className="lp-steps">
          <div className="lp-step" data-rv>
            <span className="lp-n">01</span>
            <h3>Open a canvas</h3>
            <p>
              Frames are live HTML artboards. Sketch in the browser, or leave them blank — your agents will fill them.
            </p>
          </div>
          <div className="lp-step" data-rv>
            <span className="lp-n">02</span>
            <h3>Connect your agent</h3>
            <p>
              One command, one browser approval — the agent works on the canvas <em>as you</em>, attributed and
              accountable.
            </p>
          </div>
          <div className="lp-step" data-rv>
            <span className="lp-n">03</span>
            <h3>Design together, live</h3>
            <p>
              Designs stream in keystroke by keystroke. Agents narrate tasks, review their work with screenshots, and
              pick up your feedback mid-flight.
            </p>
          </div>
        </div>
        <div className="lp-terminal" data-rv>
          <div className="lp-term-bar">
            <i />
            <i />
            <i />
            <span>terminal</span>
          </div>
          <pre>
            <span className="t-dim">$</span> claude mcp add --transport http doop {mcpUrl}
            {'\n'}
            <span className="t-dim">→</span> browser opens · sign in to Doop · approve
            {'\n'}
            <span className="t-ok">✓</span> doop connected — your agent now designs <b>as you</b>
            <span className="t-caret" />
          </pre>
        </div>
      </section>

      {/* ---- features ---- */}
      <section className="lp-features-wrap">
        <div className="lp-section-head" data-rv>
          <span className="lp-sec-eyebrow">Capabilities</span>
          <h2>Built for the pair, not the person</h2>
        </div>
        <div className="lp-features">
          <div className="lp-feature" data-rv>
            <svg className="lp-glyph" viewBox="0 0 24 24">
              <rect x="3" y="6" width="18" height="3" rx="1.5" fill="currentColor" />
              <rect x="3" y="12" width="12" height="3" rx="1.5" fill="currentColor" />
              <rect x="3" y="18" width="6" height="3" rx="1.5" fill="#e5533c" />
            </svg>
            <h3>Live streaming reveal</h3>
            <p>
              Agent HTML plays back as a smooth typewriter stream — even one-shot designs feel like watching someone
              work.
            </p>
          </div>
          <div className="lp-feature" data-rv>
            <svg className="lp-glyph" viewBox="0 0 24 24">
              <circle cx="5" cy="6" r="2.4" fill="#e5533c" />
              <rect x="10" y="4.5" width="11" height="3" rx="1.5" fill="currentColor" />
              <circle cx="5" cy="14" r="2.4" fill="currentColor" />
              <rect x="10" y="12.5" width="8" height="3" rx="1.5" fill="currentColor" />
            </svg>
            <h3>Tasks &amp; narration</h3>
            <p>
              Agents announce what they're working on. The Tasks panel keeps a per-agent history — a standup that writes
              itself.
            </p>
          </div>
          <div className="lp-feature" data-rv>
            <svg className="lp-glyph" viewBox="0 0 24 24">
              <path d="M4 4 h16 v10 h-9 l-4.5 5 v-5 H4 Z" fill="currentColor" />
              <circle cx="17" cy="9" r="2.2" fill="#e5533c" />
            </svg>
            <h3>Feedback that lands</h3>
            <p>
              Reply to any task and your note becomes an open request on the canvas — the next agent to call in picks it
              up.
            </p>
          </div>
          <div className="lp-feature" data-rv>
            <svg className="lp-glyph" viewBox="0 0 24 24">
              <path d="M4 3 L18 11 L11 12.5 L8 19 Z" fill="currentColor" />
              <circle cx="18" cy="18" r="4" fill="#e5533c" />
            </svg>
            <h3>Agents carry their owner</h3>
            <p>
              MCP OAuth means every agent belongs to a person. No anonymous edits — presence and tasks name the human
              behind the bot.
            </p>
          </div>
          <div className="lp-feature" data-rv>
            <svg className="lp-glyph" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="2.5" fill="currentColor" />
              <circle cx="12" cy="12" r="4" fill="#fcfcfb" />
              <circle cx="12" cy="12" r="1.8" fill="#e5533c" />
            </svg>
            <h3>Agents see their work</h3>
            <p>
              A built-in headless renderer hands agents screenshots of their own frames, so they review and fix before
              you have to.
            </p>
          </div>
          <div className="lp-feature" data-rv>
            <svg className="lp-glyph" viewBox="0 0 24 24">
              <ellipse cx="12" cy="6" rx="8" ry="3" fill="currentColor" />
              <path
                d="M4 6 v12 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3 V6"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
              />
              <ellipse cx="12" cy="18" rx="3" ry="1.4" fill="#e5533c" />
            </svg>
            <h3>Everything persists</h3>
            <p>
              Canvases, tasks and feedback live in Postgres, owned by your account. Share a canvas with a link,
              Figma-style.
            </p>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="lp-faq" id="faq">
        <div className="lp-section-head" data-rv>
          <span className="lp-sec-eyebrow">Questions</span>
          <h2>Asked and answered</h2>
        </div>
        <div className="lp-faq-list" data-rv>
          <details>
            <summary>Which agents can join?</summary>
            <p>
              Anything that speaks MCP over streamable HTTP with OAuth — Claude Code and Codex out of the box, and any
              other MCP client pointed at your canvas's <code>/mcp</code> endpoint.
            </p>
          </details>
          <details>
            <summary>Do agents need my API keys?</summary>
            <p>
              No. Your agent keeps running wherever it already runs, on whatever model you already pay for. Doop is the
              canvas it connects to — not another AI subscription.
            </p>
          </details>
          <details>
            <summary>How does an agent become "mine"?</summary>
            <p>
              When you add the MCP server, a browser window opens and you approve the connection while signed in. From
              then on its bearer token carries your identity — its tasks literally read "for you".
            </p>
          </details>
          <details>
            <summary>Can I self-host it?</summary>
            <p>
              Yes — Doop is a single Docker container plus Postgres, open on GitHub. Point <code>BETTER_AUTH_URL</code>{' '}
              at your domain and you're running the whole thing, agents and all.
            </p>
          </details>
        </div>
      </section>

      {/* ---- final CTA ---- */}
      <section className="lp-final" data-rv>
        <h2>
          Start <em>designing.</em>
        </h2>
        <p>Free while in beta. Bring your people — and your agents.</p>
        <div className="lp-final-cta">
          <svg className="lp-final-cursor a" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#D97757" stroke="#fff" strokeWidth="1.4" />
          </svg>
          <button className="btn primary lp-cta" onClick={() => navigate('/auth')}>
            Create your canvas
          </button>
          <svg className="lp-final-cursor b" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#2D5FE0" stroke="#fff" strokeWidth="1.4" />
          </svg>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-foot-top">
          <div className="lp-foot-brand">
            <span className="home-mark">
              <Logo /> Doop
            </span>
            <span className="lp-foot-note">Humans &amp; agents, one canvas.</span>
          </div>
          <div className="lp-foot-col">
            <b>Product</b>
            <a href="#app">The canvas</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="/blog">Blog</a>
          </div>
          <div className="lp-foot-col">
            <b>Get going</b>
            <a onClick={() => navigate('/auth')}>Sign in</a>
            <a onClick={() => navigate('/auth')}>Create an account</a>
            <a href="https://github.com/kgoedecke/design-multiplayer" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </div>
        </div>
        <div className="lp-foot-giant" aria-hidden>
          <span className="lp-foot-word">DOOP</span>
          <div className="lp-cursor lp-fg-cursor-a">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#D97757" stroke="#17150f" strokeWidth="1.4" />
            </svg>
            <span>
              <AgentIcon name="claude" size={11} /> Claude
            </span>
          </div>
          <div className="lp-cursor lp-fg-cursor-b">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#2D5FE0" stroke="#17150f" strokeWidth="1.4" />
            </svg>
            <span>Kevin</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* Beat durations (ms): idle → task starts → frame streams in → screenshot review → feedback lands → done */
const PLAY = [1600, 1800, 6200, 3000, 4200, 3400]

/**
 * The app showcase as a looping scripted screenplay — real DOM, no video.
 * Beats accumulate as pb0…pbN classes on the root; CSS transitions with
 * per-beat delays do the acting, React only swaps the narrated text.
 */
function ShowcaseMock() {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [beat, setBeat] = useState(still ? PLAY.length - 1 : 0)
  useEffect(() => {
    if (still) return
    let t: number
    const step = (b: number) => {
      setBeat(b)
      t = window.setTimeout(() => step((b + 1) % PLAY.length), PLAY[b])
    }
    t = window.setTimeout(() => step(1), PLAY[0])
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const strip = [
    'Reading canvas memory…',
    'Sketching the pricing grid…',
    'Streaming the pricing grid…',
    'Reviewing my screenshot…',
    "Applying Kevin's feedback…",
    'Pricing grid finished',
  ][beat]
  const chip = [
    '',
    '✦ Claude is designing…',
    '✦ Claude is designing…',
    'reviewing screenshot…',
    'applying feedback…',
    '✓ done',
  ][beat]
  const task = [
    'Sketching the pricing grid',
    'Sketching the pricing grid',
    'Streaming the pricing grid',
    'Reviewing the screenshot',
    "Applying Kevin's feedback",
    'Pricing grid',
  ][beat]
  const done = beat === PLAY.length - 1

  return (
    <div className={`mock play ${['pb0', 'pb1', 'pb2', 'pb3', 'pb4', 'pb5'].slice(0, beat + 1).join(' ')}`} aria-hidden>
      <div className="mock-top">
        <span className="mock-logo">
          <Logo className="mock-logo-svg" />
        </span>
        <span className="mock-name">spring-launch</span>
        <span className="mock-chip">Xq3wThV9pK</span>
        <span className="spacer" />
        <span className="mock-av mock-av-k">K</span>
        <span className="mock-av mock-av-a">A</span>
        <span className="mock-av mock-av-agent">
          <AgentIcon name="claude" size={15} />
        </span>
        <span className="mock-btn">Share</span>
        <span className="mock-btn primary">✦ Connect AI</span>
      </div>
      <div className="mock-body">
        <div className="mock-stage">
          <div className="mock-frame mock-frame-done">
            <div className="mk-label">Hero — Terrarium</div>
            <span className="mk-pin">💬</span>
            <div className="mk-body mf-canvas terrarium">
              <div className="t-orb" />
              <div className="t-eyebrow" />
              <div className="t-h1" />
              <div className="t-h1 short" />
              <div className="t-p" />
              <div className="t-btn" />
            </div>
          </div>
          <div className="mock-frame mock-frame-poster">
            <div className="mk-label">
              Poster — Doop launch
              <span className="editor-chip" style={{ background: '#1E7A4C' }}>
                ✎ Ana
              </span>
            </div>
            <div className="mk-body mf-canvas poster">
              <div className="p-word">DOOP</div>
              <div className="p-bar" />
              <div className="p-dots">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
          <div className="mock-frame mock-frame-streaming">
            <div className="mk-label">
              Pricing{' '}
              {chip && (
                <span key={chip} className="editor-chip" style={{ background: done ? '#1E7A4C' : '#D97757' }}>
                  {chip}
                </span>
              )}
            </div>
            <div className="mk-body mf-canvas">
              <div className="sf-el sf-nav">
                <i />
                <i />
                <i />
              </div>
              <div className="sf-el sf-h1" />
              <div className="sf-el sf-p" />
              <div className="sf-cards">
                <div className="sf-el sf-card">
                  <i className="c-t" />
                  <i className="c-price" />
                  <i className="c-line" />
                  <i className="c-line s" />
                  <i className="c-btn" />
                </div>
                <div className="sf-el sf-card mid">
                  <i className="c-t" />
                  <i className="c-price" />
                  <i className="c-line" />
                  <i className="c-line s" />
                  <i className="c-btn" />
                </div>
                <div className="sf-el sf-card">
                  <i className="c-t" />
                  <i className="c-price" />
                  <i className="c-line" />
                  <i className="c-line s" />
                  <i className="c-btn" />
                </div>
              </div>
              <div className="sf-el sf-btn" />
              <div className="sf-el sf-footer" />
              <div className="sf-caret" />
              <div className="sf-flash" />
              <div className="sf-shot">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
          <div className="mock-frame mock-frame-new">
            <div className="mk-label">
              Footer
              <span className="editor-chip" style={{ background: '#17150F' }}>
                ✦ Codex
              </span>
            </div>
            <div className="mk-body mf-canvas nf">
              <div className="sf-el nf-a" />
              <div className="sf-el nf-b" />
              <div className="sf-el nf-c" />
            </div>
          </div>
          <div className="mock-cursor c1">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#1E7A4C" stroke="#fff" strokeWidth="1.6" />
            </svg>
            <span>Ana</span>
          </div>
          <div className="mock-cursor c2">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#0F0F0F" stroke="#fff" strokeWidth="1.6" />
            </svg>
            <span className="dark">
              <AgentIcon name="codex" size={10} /> Codex
            </span>
          </div>
          <div className="mock-cursor c3">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path d="M4 2 L20 12 L12 13.5 L8.5 21 Z" fill="#D97757" stroke="#fff" strokeWidth="1.6" />
            </svg>
            <span className="claude">
              <AgentIcon name="claude" size={10} /> Claude
            </span>
          </div>
          <div className="mk-working">
            <div className="wn-pill">
              <span className="pulse-dot" style={{ background: done ? '#1E7A4C' : '#D97757' }} />
              <b>
                <AgentIcon name="claude" size={11} /> Claude
              </b>{' '}
              <span key={strip} className="sp-say">
                {strip}
              </span>
            </div>
            {beat >= 4 && (
              <div className="wn-pill sp-codex">
                <span className="pulse-dot" style={{ background: '#17150F' }} />
                <b>
                  <AgentIcon name="codex" size={11} /> Codex
                </b>{' '}
                <span>Sketching the footer…</span>
              </div>
            )}
          </div>
          <div className="mk-toolbar">
            <span className="tb-btn">+ Frame</span>
            <i className="tb-div" />
            <span className="tb-btn">−</span>
            <span className="tb-zoom">100%</span>
            <span className="tb-btn">+</span>
            <i className="tb-div" />
            <span className="tb-btn">Fit</span>
          </div>
        </div>
        <div className="mock-panel">
          <div className="mock-tabs">
            <span className="on">Tasks</span>
            <span>Activity</span>
          </div>
          <div className="mock-group">
            <div className="mock-agent">
              <AgentIcon name="claude" size={12} /> Claude <i>for Kevin</i> <em>{done ? 'idle' : 'working'}</em>
            </div>
            {done ? (
              <div className="mock-task done sp-task">
                ✓ Pricing grid <i>2m</i>
              </div>
            ) : (
              <div className="mock-task live sp-task">
                <span className="pulse-dot" style={{ background: '#E5533C' }} />{' '}
                <span key={task} className="sp-say">
                  {task}
                </span>{' '}
                <i>now</i>
              </div>
            )}
            <div className="mock-task done">
              ✓ Hero section <i>4m</i>
            </div>
            <div className="mock-fb">
              <b>Kevin:</b> try a darker footer
              <span className="mock-fb-state">✓ picked up by Claude</span>
            </div>
          </div>
          <div className="mock-group">
            <div className="mock-agent">
              <AgentIcon name="codex" size={12} /> Codex <i>for Ana</i> {beat >= 4 && <em>working</em>}
            </div>
            {beat >= 4 && (
              <div className="mock-task live sp-codex">
                <span className="pulse-dot" style={{ background: '#17150F' }} /> Sketching the footer <i>now</i>
              </div>
            )}
            <div className="mock-task done">
              ✓ Terrarium hero <i>12m</i>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
