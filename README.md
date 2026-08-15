# Caps Unlocked

A static site — no build step, no framework. Every page is plain HTML that
pulls its content from `apps-data.js` at load time via `layout.js`.

## Structure

```
index.html            Public welcome page ("Capital, unlocked.")
about.html             The thesis + identity narrative + resume placeholder
dashboard.html         Grid of all apps ("the keyboard") — nav label "Portfolio"
compas.html
thewardrobe.html
obob.html                Nine app pages — thin shells that render
boardzzz.html             from apps-data.js via layout.js
jimgym.html
dissolution.html
careerist.html
tlaxcalatrail.html
marathonsandhealth.html
apps-data.js           Single source of truth: name, description, launch URL, etc.
layout.js               Renders header/footer + fills in dashboard/app content
styles.css              The whole design system (colors, type, keycap components)
vercel.json             Enables clean URLs: /compas instead of /compas.html
```

## Before you launch: fill in `apps-data.js`

Every app currently has placeholder `TODO` copy and `launchUrl: "#"`.
For each of the 9 apps, replace:
- `tagline` — one line, shown on the dashboard card and app header
- `description` — 2–3 sentences for the app's own page
- `features` — 3 short bullets
- `launchUrl` — the app's live Google Apps Script `/exec` URL

Nothing else needs to change — the dashboard grid and all 9 app pages
read from this file automatically.

## Before you launch: fill in `about.html`

Two spots are marked `TODO` directly in the HTML:
- The throughline paragraph (planning → housing finance, what's held
  constant across that move)
- The "Experience" panel — either a resume summary written out, or a
  "Download resume" button linking to a PDF you provide

## About the GAS banner

Heads up on the thing you flagged: the "created by ... using Google Apps
Script, not associated with Google" banner is added by Google to every
GAS web app served with "Anyone" access — it shows regardless of how you
link to it (new tab, iframe, or otherwise), because it's rendered by
Google's servers, not by the linking page. Right now the "Open ↗" button
just opens the GAS URL directly, which is the cleanest option available
while apps stay on GAS. The banner goes away only once an app is migrated
off Apps Script and rebuilt to deploy through Vercel — which is already
the longer-term plan for this site.

## Deploying

1. Push this folder to a new GitHub repo (e.g. `capsunlocked`).
2. In Vercel: **Add New → Project**, import that repo.
   - No framework preset needed — leave build command empty, output
     directory as root (`.`). It's static HTML.
3. Once deployed, go to the project's **Domains** tab in Vercel and add
   `capsunlocked.com`.
4. In GoDaddy's DNS settings for capsunlocked.com, add the records Vercel
   shows you (usually an `A` record for the root domain and a `CNAME` for
   `www`). Vercel issues the HTTPS certificate automatically once DNS
   resolves.

## Adding an 8th app later

1. Add an object to the `APPS` array in `apps-data.js`.
2. Copy `compas.html`, rename it to `<newslug>.html`, and change
   `data-app="compas"` to `data-app="<newslug>"`.
3. Done — it shows up on the dashboard automatically.
