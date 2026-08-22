# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting — **Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it, and the impact you believe it has.
You'll get an acknowledgement within a few days; please give us a reasonable
window to ship a fix before disclosing publicly.

## Scope notes for self-hosters

- Canvases are private by default; sharing is by invite or an explicit per-canvas link toggle.
- `/i/<frameId>.png` frame images and `/a/<assetId>` uploads are intentionally public-by-unguessable-id (they power og:images and cross-origin embeds).
- Set `BETTER_AUTH_SECRET` and run behind TLS in any real deployment; without SMTP configured, signup is open (no email verification).
