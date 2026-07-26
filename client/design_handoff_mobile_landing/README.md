# Handoff: LighterPack mobile landing page

## Overview
The LighterPack landing page (the logged-out page at `/`) adapted for phone widths. It is the page that serves three different visitors at once: a returning user signing in, a first-time visitor deciding what this is, and someone arriving from a shared list link. On desktop these are handled side by side; at 390px they have to be stacked, and this design decides the order.

**The recommended design is `8a` — a hero with a tabbed Sign in / Register card, followed by a labelled "How it works" section, a cropped product screenshot, and a footer.** Everything else in the bundled file is exploration that led there and is kept for context.

## About the Design Files
The file in this bundle is a **design reference created in HTML** — a prototype showing intended look and structure, not production code to copy. The mocks are static: fields are `<div>`s styled to look like inputs, and nothing is wired up.

The task is to **recreate this design in the LighterPack codebase using its existing environment, templates, and CSS**. LighterPack's landing page is server-rendered with its own stylesheet; the intent is to add mobile styles/markup to that page, not to introduce a new framework or component library. Where the codebase already has a class or partial for something described here (form fields, the orange button, the footer), use it and adjust — the values below are the target rendering, not a demand for new one-off CSS.

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, and radii below are exact and were chosen to match what is live on desktop today. Recreate the layout and values as specified. Two caveats:

- The product screenshot in the mock is **hand-built HTML approximating the app**, not a real screenshot. In production this should be either a real screenshot of a list or the real components rendered read-only. Match its *placement and crop behavior*, not its pixel internals.
- The photographic hero background is represented in the mock by a blue gradient placeholder. Production should use the existing landing page hero photograph.

## Screens / Views

### Mobile landing page (logged out) — `8a`

**Purpose:** Sign in (primary for returning users), register, or start a list anonymously; and for a first-time visitor, understand what LighterPack is.

**Viewport:** designed at 390 × 844 (iPhone 14/15 class). Total page height at that width is ~1027px, i.e. one screen plus roughly one short scroll. Layout is a single column; all sections are full-bleed with 20px horizontal padding on text content and 16px on the floating card.

**Above the fold (top 844px):** the wordmark, the headline, the full auth card including both tabs, both fields, the Sign in button, the forgot link, and the anonymous "start a list without an account" strip. Nothing required to act is below the fold. The hero block ends at y≈514, so the card's bottom strip lands at roughly y≈500–560 — comfortably clear.

#### 1. Hero
- Background: photograph (mock uses `linear-gradient(180deg, #6f8fba, #9fb5d0 62%, #c3d1e0)` as a stand-in). Bottom of the hero is a light blue-grey so the white card reads against it.
- Padding: `16px 20px 0` for the wordmark; hero block has `padding-bottom: 24px` below the card.
- **Wordmark** "LighterPack": 17px / 700, `#fff`, `text-shadow: 0 1px 8px rgba(20,40,70,.45)`.
- **Headline** "Track the gear you bring on adventures.": 24px / 400 / line-height 1.24, `#fff`, `text-shadow: 0 1px 14px rgba(20,40,70,.5)`, padding `18px 20px 22px`.
  - Note: this is a shortened version of the live desktop headline ("LighterPack helps you track the gear you bring on adventures."). The subject is already the wordmark directly above it, so it is dropped on mobile.

#### 2. Auth card (floating over the hero)
- Container: `margin: 0 16px`, background `#fff`, `border: 1px solid rgba(0,0,0,.08)`, `border-radius: 7px`, `box-shadow: 0 8px 26px rgba(20,40,70,.22)`, `overflow: hidden`.
- **Tab strip:** two equal-width tabs, each 46px tall, on a `#f0eee9` strip with a `1px solid #e0e1e3` bottom border.
  - Active tab: background `#fff`, label 15px / 700 `#24272b`, `box-shadow: inset 0 -2.5px 0 #efa026` (the orange underline).
  - Inactive tab: transparent (shows the `#f0eee9` strip), label 15px / 600 `#82868c`.
  - Default active tab is **Sign in**.
- **Form body:** padding `16px 18px 18px`, `display:flex; flex-direction:column; gap:10px`.
  - Text fields: 48px tall, `border: 1px solid #d5d7da`, `border-radius: 6px`, padding `0 13px`, font-size **16px** (required — anything smaller triggers iOS zoom-on-focus), placeholder color `#9a9da3`, entered text `#24272b`.
  - Focused field: `border: 1.5px solid #efa026` with padding reduced to `0 12.5px` so the text does not shift. This matches the app's "live field" rule used elsewhere in the product.
  - Sign in tab fields: Username, Password. Register tab fields: Username, Email, Password, Confirm password.
  - **Primary button:** 48px tall, full width, `margin-top: 2px`, `background: linear-gradient(105deg, #f4a72c, #e39110)`, `border-radius: 6px`, `box-shadow: inset 0 1px 0 rgba(255,255,255,.32), inset 0 -1px 0 rgba(0,0,0,.12)`, label 16px / 700 `#fff`. Text: "Sign in" / "Register".
  - **Forgot link:** 40px tall centered row, 14.5px `#82868c`, underlined with `border-bottom: 1px solid #c8cacd`. Text: "Forgot username/password?" On the Register tab this row is not present.
- **Anonymous strip (card footer):** `border-top: 1px solid #e9eaec`, background `#faf9f7`, padding `13px 18px`, centered, 14.5px `#3a3d42`. Copy: `or ` + link "start a list without an account" (600 weight, `#24272b`, `border-bottom: 1px solid #c8cacd`). This strip is shared by both tabs — it does not move or change when tabs switch.

**There is no "keep me signed in" checkbox.** Sessions persist by default. This is a deliberate decision from the review: the correct behavior should be the default, not a thing the user has to opt into.

#### 3. "How it works" section
- Section on `#fff`, padding `26px 20px 0`.
- **Section label:** "How it works" — 12px / 700, `letter-spacing: .08em`, `text-transform: uppercase`, `#82868c`, `padding-bottom: 14px`, `border-bottom: 1px solid #e0e1e3`.
  - This label is the point of the section. Without it the three lines below read as instructions to the user ("Enter your packing lists" — enter where?); with it they read as a description of the product. If the copy is ever rewritten in the third person, the label can go.
- **Steps list:** `display:flex; flex-direction:column; gap:13px`, padding `16px 0 22px`. Each row is `display:flex; gap:11px`, 15.5px `#3a3d42`, with the numeral in `#24272b` 700.
  1. Enter your packing lists
  2. Visualize your pack weights
  3. Share your lists with others

#### 4. Product screenshot (cropped)
- Container: `border: 1px solid #e0e1e3`, top corners rounded 6px, **no bottom border**, `overflow: hidden`, fixed `height: 190px`, padding `12px 14px 0`. The content inside is taller than 190px, so it is deliberately cut off at the bottom — this reads as "there is more of this app below" rather than a small framed picture.
- Contents (approximating a real list view): list title row "Denali" (14px/700) with a "Share" affordance (11px/600 `#3a3d42`) above a `1px solid #e0e1e3` rule; then a donut chart beside a category legend; then a category header row and item rows.
- **Donut:** 78px square, `border-radius: 50%`, conic gradient of category colors with a radial mask cutting a 35% hole (`-webkit-mask: radial-gradient(circle, transparent 35%, #000 36%)`).
- **Legend rows:** 11px, each with an 8px color square, category name, tabular-nums value, and a 9px `#9a9da3` unit; separated by `1px solid rgba(0,0,0,.06)`. The Total row is 700 weight with no swatch.
- In production, replace this whole block with a real screenshot or a real read-only render, keeping the crop.

#### 5. Footer
- Background `#f0eee9`, `border-top: 1px solid rgba(0,0,0,.07)`, padding `20px 20px 26px`, `display:flex; flex-direction:column; gap:14px`.
- Link row: `display:flex; flex-wrap:wrap; gap: 8px 20px`, 14.5px `#3a3d42`, each underlined with `border-bottom: 1px solid #c8cacd`. Links: About, Donate, Contact, Privacy.
- Note line: 13px / line-height 1.5, `#82868c` — "LighterPack is free and has no ads. It's kept running by donations."
- The footer reuses the same `#f0eee9` as the tab strip, closing the page on the color the card opened with.

## Interactions & Behavior
- **Tab switch (Sign in ⇄ Register):** swaps the form body in place; the tab strip and the anonymous strip stay put. The card's height changes because Register has four fields and no forgot-link row — animate the height or accept the jump, but do not let the anonymous strip appear to move independently of the card. No page navigation; no scroll position change.
- **Deep link:** if the page is reached with a register intent (e.g. `?register` or an existing server-side equivalent), open with the Register tab active.
- **Sessions persist by default.** No checkbox. A returning visitor on a phone should normally not see this page at all.
- **"start a list without an account":** creates an anonymous list and navigates straight into it.
- **Focus:** field gets the 1.5px `#efa026` border. Do not add a focus glow or drop shadow — the product's convention for a live field is the orange border only.
- **Touch targets:** every actionable row is ≥ 44px; fields and buttons are 48px; tabs are 46px full-half-width.
- **Validation:** unchanged from the current landing page. Errors should render inside the card, above the button, and must not push the anonymous strip off screen — the card scrolls with the page, so this is acceptable, but the error must be visible without a second scroll after submit.
- **Responsive:** this layout is the small-screen end. It should hold from 320px to roughly 600px; above that, fall back to the existing desktop layout. At 320px the two tab labels and the 48px fields still fit; nothing below needs to change.
- **Reduced motion:** no animations are required by this design beyond the optional tab height transition.

## State Management
Minimal:
- `activeTab: 'signin' | 'register'` — default `'signin'`, or `'register'` when arrived with register intent.
- Standard form field state and validation errors per tab, preserved when switching tabs and back.
- No data fetching for the page itself; the screenshot block is static.

## Design Tokens

**Colors**
| Purpose | Value |
| --- | --- |
| Text, primary | `#24272b` |
| Text, body | `#3a3d42` |
| Text, muted / placeholder | `#82868c`, `#9a9da3` |
| Field border | `#d5d7da` |
| Hairline / divider | `#e0e1e3`, `#e9eaec`, `rgba(0,0,0,.06)` |
| Underline (link) | `#c8cacd` |
| Surface, white | `#fff` |
| Surface, tint (tabs, footer) | `#f0eee9` |
| Surface, subtle (card footer strip) | `#faf9f7` |
| Accent / orange | `#efa026` |
| Button gradient | `linear-gradient(105deg, #f4a72c, #e39110)` |
| Chart: carry / sleep / clothing / (4th) / (5th) / (6th) | `#2a72c8` / `#d6203c` / `#e8c400` / `#3e9c35` / `#8a2be2` / `#f28022` |

**Spacing** — 2, 6, 8, 10, 11, 13, 14, 16, 18, 20, 22, 24, 26 px. Page gutter 20px; card gutter 16px; card inner padding 18px.

**Typography** — system UI stack as the live site uses. 24px/1.24 headline · 17px wordmark · 16px fields and primary buttons · 15.5px body and step rows · 15px tab labels · 14.5px secondary links · 13px footer note · 12px uppercase section label (letter-spacing .08em) · 11–12px inside the product screenshot only. Weights used: 400, 600, 700.

**Radii** — 7px card · 6px fields, buttons, screenshot frame · 5px small inline controls · 50% donut.

**Shadows** — card `0 8px 26px rgba(20,40,70,.22)` · button `inset 0 1px 0 rgba(255,255,255,.32), inset 0 -1px 0 rgba(0,0,0,.12)` · hero text `0 1px 14px rgba(20,40,70,.5)` (headline), `0 1px 8px rgba(20,40,70,.45)` (wordmark).

**Minimum sizes** — 16px on any text input (iOS zoom), 44px minimum touch target.

## Assets
- **Hero photograph** — existing landing page asset; not included in this bundle. The mock substitutes a gradient.
- **Product screenshot** — not a real asset. The mock hand-builds an approximation in HTML; production should supply a real screenshot or render.
- No icons are used. The disclosure chevrons and check marks that appear in earlier explorations are not part of `8a`.

## Files
- `Landing Page.dc.html` — the design file. Open it in a browser; it is a canvas of explorations, newest at the top.
  - **Turn 8 / option `8a` is the design to build** — the full page.
  - Turn 7 (`7a`–`7d`) explores how to give the value prop context; `7a` is what `8a` uses. `7b` is a copy alternative worth knowing about: it replaces the numbered list with a descriptive sentence ("A LighterPack list holds every item you're carrying and what it weighs…") and drops the "How it works" label. It slots into the same layout with no structural change.
  - Turn 6 explores what follows the card; turn 5 (`5a`–`5d`) explores the page architecture — `5c`, the tabbed card, is the one that won.
  - Turns 1–4 are the desktop-era explorations that preceded this work.
- `support.js` — runtime required to open the `.dc.html` file locally. Not part of the design.

## Open questions for the implementer
- The real screenshot asset needs to be produced at a size that stays legible at 390px wide (the mock's is ~348px of usable width). A cropped region of a list is better than a scaled-down full page.
- If the codebase can only ship one wording for both desktop and mobile, `7b`'s descriptive sentence is the safer choice — the imperative list has the same "enter where?" problem on desktop, it is just masked by the register form sitting next to it.
