/**
 * apps-data.js
 * Single source of truth for every app on Caps Unlocked.
 *
 * TO ADD A NEW APP: add an object here, then create <slug>.html by
 * copying an existing app page (e.g. compas.html) and swapping data-app.
 * The dashboard grid and nav pick up new entries automatically.
 *
 * Fields to fill in per app:
 *  - name: display name (real capitalization/accents, e.g. "Compás")
 *  - slug: lowercase URL segment, e.g. "compas"
 *  - glyph: 1-2 letters shown on the keycap (usually first letter(s) of name)
 *  - tagline: one short line, shown under the app name
 *  - description: 2-4 sentences for the app's own page
 *  - features: short bullet list of what it does
 *  - status: "live" | "in progress" | "idea"
 *  - launchUrl: the app's Google Apps Script web app URL (or later, its own path)
 */

const APPS = [
  {
    name: "Compás",
    slug: "compas",
    glyph: "Cp",
    tagline: "TODO — one line describing what Compás does.",
    description: "TODO — replace with 2–3 sentences about what Compás helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#" // TODO: paste the Google Apps Script /exec URL
  },
  {
    name: "theWardrobe",
    slug: "thewardrobe",
    glyph: "Wd",
    tagline: "TODO — one line describing what theWardrobe does.",
    description: "TODO — replace with 2–3 sentences about what theWardrobe helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#"
  },
  {
    name: "OBOB",
    slug: "obob",
    glyph: "Ob",
    tagline: "TODO — one line describing what OBOB does.",
    description: "TODO — replace with 2–3 sentences about what OBOB helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#"
  },
  {
    name: "Boardzzz",
    slug: "boardzzz",
    glyph: "Bz",
    tagline: "TODO — one line describing what Boardzzz does.",
    description: "TODO — replace with 2–3 sentences about what Boardzzz helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#"
  },
  {
    name: "JimGym",
    slug: "jimgym",
    glyph: "Jg",
    tagline: "TODO — one line describing what JimGym does.",
    description: "TODO — replace with 2–3 sentences about what JimGym helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#"
  },
  {
    name: "Dissolution",
    slug: "dissolution",
    glyph: "Ds",
    tagline: "TODO — one line describing what Dissolution does.",
    description: "TODO — replace with 2–3 sentences about what Dissolution helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#"
  },
  {
    name: "Careerist",
    slug: "careerist",
    glyph: "Cr",
    tagline: "TODO — one line describing what Careerist does.",
    description: "TODO — replace with 2–3 sentences about what Careerist helps you do, who it's for, and what makes it useful.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#"
  },
  {
    name: "Tlaxcala Trail",
    slug: "tlaxcalatrail",
    glyph: "Tx",
    tagline: "TODO — one line describing Tlaxcala Trail.",
    description: "TODO — replace with 2–3 sentences. Flagged as a creative demo piece, so this is a good page to show range beyond the operational/policy tools — describe the idea, the world it builds, and what a visitor should try first.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#" // TODO: paste the Google Apps Script /exec URL
  },
  {
    name: "Marathons & Health",
    slug: "marathonsandhealth",
    glyph: "Mh",
    tagline: "TODO — one line describing what it does. (Flagged as a 2025 win — worth saying what it won or shipped.)",
    description: "TODO — replace with 2–3 sentences on the nutrition/training tracking it does, who it's for, and what made 2025 the milestone year for it.",
    features: [
      "TODO — feature one",
      "TODO — feature two",
      "TODO — feature three"
    ],
    status: "live",
    launchUrl: "#" // TODO: paste the Google Apps Script /exec URL
  }
];

if (typeof module !== "undefined") module.exports = APPS;
