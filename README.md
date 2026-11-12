# BF Logistics — Website (static build)

> **Pricing update — November 2026.** The site now uses **3 zones + distance**:
> Zone 1 $19 · Zone 2 $22 · Zone 3 $32 (Same Day). Between two zones the higher rate applies;
> inside one zone it is $19. Rush = base × 1.5, Direct = base × 1.7. After the first 50 km
> add $1/km (not multiplied). Customers enter **postal codes**; the zone and distance are
> worked out from `assets/js/postal-data.js` (postal-area centres, straight-line distance × 1.3
> road factor). Towns outside the zones keep their out-of-town flat rate (Same Day only).
> All numbers live in `SETTINGS` and `ZONES` at the top of `assets/js/rates.js`.
> Sections below that mention 10 zones or the $10 uplift describe the earlier version.

Built from **BF-Logistics-Website-Blueprint-v2.md**, Phase 1 core scope.

**To view it:** double-click `index.html`. No server, no install, no build step — it opens
in any browser straight off the disk or a USB stick.

---

## What was built — 16 pages

| Page | File | Notes |
|---|---|---|
| Homepage | `index.html` | Hero, gateway, inline calculator, tiers, zones, industries, out-of-town |
| Courier hub | `courier.html` | Calculator in the hero, full rate chart, surcharges, accounts, FAQ |
| Same Day | `courier-same-day.html` | Cutoff explainer + worked example |
| Rush | `courier-rush.html` | Cutoff explainer + worked example |
| Direct | `courier-direct.html` | Cutoff explainer + worked example |
| Rates & calculator | `courier-pricing.html` | All 30 rates published, formula, the three edge-case rules |
| The 10 zones | `courier-zones.html` | Schematic zone map (inline SVG) + full table |
| Out-of-town | `courier-out-of-town.html` | 62 destinations, searchable |
| Book a pickup | `courier-book.html` | 3-step form, live price, carries the calculator quote through |
| Logistics hub | `logistics.html` | Steel accent, six capabilities, no pricing anywhere |
| Freight quote | `logistics-quote.html` | The only freight pricing path |
| About | `about.html` | |
| FAQ | `faq.html` | 21 questions + FAQPage schema |
| Contact | `contact.html` | |
| Thank you | `thank-you.html` | Reference number + quote recap |
| 404 | `404.html` | |

Plus `sitemap.xml` and `robots.txt`.

## File map

```
website/
├── index.html … 404.html      the 16 pages — plain static HTML, edit freely
├── assets/
│   ├── css/style.css          the whole design system
│   ├── js/rates.js            ★ rate tables + pricing engine
│   ├── js/main.js             nav, cutoff clock, calculator UI, forms
│   └── img/                   logo.png, logo-white.png, mark.png, van.jpg
├── sitemap.xml, robots.txt
└── _build/                    optional page assembler — see below
```

### `_build/` — how the pages are kept in sync

The header, footer, nav and schema markup are identical on all 16 pages. Rather than
maintain 16 copies by hand, `_build/layout.html` holds them once and
`_build/build.ps1` stitches that around each body fragment in `_build/pages/`.

**You do not need this to run or host the site** — the output is ordinary HTML. But if you
edit a page directly in the root, a later rebuild will overwrite it. Either edit the
fragments in `_build/pages/` and re-run:

```bash
powershell -ExecutionPolicy Bypass -File _build\build.ps1
```

…or delete the `_build` folder entirely and hand-edit the root HTML from then on.

---

## The decisions applied

Your four answers are baked in, all of them changeable in one place (`assets/js/rates.js`):

| Blueprint item | Applied |
|---|---|
| Issue 1 — neither end in Zone 1 | Higher zone rate **+ $10** inter-zone uplift, shown as its own line |
| Issue 2 — Whitby / Oshawa | **$46** (Zone 10 wins); both removed from the out-of-town list |
| Issue 3 — out-of-town Rush/Direct | "Call for pricing" |
| Business hours | **Mon–Fri 10:00 AM – 5:00 PM**, closed weekends — in the header, footer, FAQ and schema |
| Buffalo / Montreal | Never auto-priced — "Contact us" in both the table and the calculator |
| Publish the rate chart | Yes — all 30 rates public |

**Source data was verified, not assumed.** The `.docx` zone matrix and the photographed
out-of-town sheet were both read directly and match the blueprint's transcription. Four
spellings were corrected against standard place names: Coburg → Cobourg,
Huntville → Huntsville, Exter → Exeter, St. Catherines → St. Catharines.

## Changing a rate

Everything lives in `assets/js/rates.js` — `SETTINGS`, `ZONES`, `OUT_OF_TOWN`. Change a
number there and the calculator follows immediately.

**The published tables are separate HTML** and will not update automatically. If you
change a zone price, also edit `_build/partials/zone-table.html` (used on four pages) and
rebuild. The out-of-town table lives in `_build/pages/courier-out-of-town.html`.

*This duplication is the main thing the Next.js port removes — there, both the calculator
and the tables read from one admin-editable database table.*

---

## What was verified

- **All 30 zone/service rate combinations** checked against the rate card by hand
- Both blueprint worked examples reproduce exactly — $47.74 and $36.16
- Weight surcharge correct at 29, 30, 31, 45 and 100 lbs (the 30 lb boundary is exclusive)
- Van charge applies and clears; HST is 13%, rounded to cents, on the correct subtotal
- Cutoff logic correct at 11:29 / 11:30 / 11:31 and 2:29 / 2:30 / 2:31, plus before-open,
  after-close and weekends
- **Clock reads America/Toronto, not the visitor's timezone** (verified against a
  simulated Vancouver visitor)
- All 62 published out-of-town rates match the pricing engine exactly
- No broken internal links or missing assets across all 16 pages
- One `<h1>` per page, no heading-level jumps, every form control labelled, valid JSON-LD
- No horizontal scroll at 1280px or 375px; tables and the zone map scroll inside their own
  containers

---

## Known limitations — read before going live

**1. Forms do not submit anywhere.** There is no server. Every form validates fully, then
shows a clearly-marked notice and offers a `mailto:` link to `admin@bflogistic.ca` instead.
This is deliberate — a form that silently discards a real customer booking is worse than
one that admits it. The notice is controlled by `DEMO_MODE = true` at the top of
`assets/js/main.js`; set it to `false` once a backend exists.

**2. The rate table is visible to competitors.** On a static site the pricing engine has to
run in the browser, so anyone can read all 30 rates in devtools. Blueprint §12 specifically
warns against this. `rates.js` is written with no DOM references precisely so it can be
lifted into a Next.js route handler unchanged — the client would then send inputs and
receive only a price.

**3. Legal pages are not built.** Privacy Policy, Terms, Accessibility and Shipping Terms
are listed in §14 as pending your content *and* lawyer review, so no links to them exist.
A live Canadian site handling names, phones and addresses needs the PIPEDA privacy policy
before launch.

**4. Deferred from this pass** (§1.3 lists them; nav does not link to what does not exist):
scheduled routes, medical courier, e-commerce, business accounts page, careers, partners,
testimonials, blog, the 16 city pages, and the staff dashboard.

**5. Nothing was invented.** Testimonials, team bios, the founding story, the year founded
and fleet inventory appear as clearly-marked placeholder blocks rather than plausible
fiction. Send the real content and they get written properly.

**6. Tracking is absent by design** (§8, deferred to Phase 2). The FAQ says so plainly
rather than implying a feature that does not exist.

---

## What is still needed from you

Highest value first:

1. **Testimonials** — 5–10 with name, company, city. Even three changes the site.
2. **Team members** — names, titles, photos, two-line bios. On a business where the
   phone call *is* the product, this matters more than usual.
3. **About content** — founding story, year founded, what you are known for. Bullets are fine.
4. **Legal business name** — "BF Logistics Inc."? A numbered company operating as BF Logistics?
5. **Confirm the logistics services** — which of LTL / FTL / warehousing / distribution /
   last-mile / dedicated fleet do you actually offer today?
6. **Fleet inventory** — how many vehicles, what types, max weight and dimensions.
7. **Prohibited items list**, liability limits, claims window, data retention period.
8. **Logo as SVG or transparent PNG** — I rebuilt transparency from the JPEG by unmixing it
   from its white background, which worked well, but a real vector file would be better for
   print and large displays.
9. **More photography** — the shoot list is in §10.4. You have one excellent van photo and
   it is currently doing all the work.

## Going live

1. Register/point **bflogistic.ca**, add SSL (free via Cloudflare or your host).
2. Upload everything except `_build/` to the web root.
3. Configure the host to serve `404.html` for missing pages.
4. Submit `sitemap.xml` in Google Search Console; set up the Google Business Profile
   (§11.6 — for a GTA courier this may outproduce organic search entirely).
5. Connect a backend before promoting the site anywhere, so the forms actually work.

### Porting to Next.js

The blueprint's stack (Next.js + Supabase + Vercel + Resend) needs **Node.js**, which is not
installed on this machine. When you are ready:

- `rates.js` moves to a server route almost as-is — it is dependency-free and DOM-free
- Zone and out-of-town rates move into database tables, which makes §5.2's admin rate
  management possible and removes the HTML/JS duplication noted above
- `layout.html` becomes the root layout; each root `.html` file becomes a route
- `style.css` carries over unchanged
- Form handlers replace `DEMO_MODE`

One flag worth revisiting commercially: **opening at 10:00 AM against an 11:30 AM Same Day
cutoff leaves customers a 90-minute booking window each day.** The site states this honestly
and the live clock shows the real remaining time, but it is a genuine constraint on your
highest-volume product.
