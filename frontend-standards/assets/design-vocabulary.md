# Design Vocabulary

Shared terms between human and agent, adapted from
[impeccable](https://github.com/pbakaus/impeccable) (which itself codifies
industry-standard design language). Use these words with these meanings — in
intent intake, causal chains, findings, and reviews. This is vocabulary only;
impeccable's *generative* guidance does not apply in a design-reproduction
workflow (see "Command verbs" below and the Scope guard in
[frontend-protocol.md](frontend-protocol.md)).

## Framing

- **Register** — the stance of a surface: **brand** (design IS the product:
  marketing, landing, portfolio) vs. **product** (design SERVES the product:
  app UI, dashboards). Expectations differ per register.
- **Identity lock** — a one-sentence *factual* description of the existing
  surface in actual values (real hex/tokens, real font names, layout topology,
  surface treatment). Write it before changing anything; every change must
  leave the surface readable as that sentence. "Modern" is not a color;
  "elegant" is not a type pairing.
- **Default mode vs. departure mode** — change *within* the existing identity
  vs. change that leaves it. When the identity is fixed in a design source of
  truth, **departure mode requires explicit user sanction** (this is the Scope
  guard, named).
- **Expression axes** — the six dimensions a design change can move on:
  hierarchy, layout topology, typographic system, color strategy, density,
  structural decomposition. Name the axis when describing a mismatch or change.
- **Color strategy (commitment ladder)** — **restrained** (tinted neutrals +
  one accent ≤10%) → **committed** (one saturated color carries 30–60%) →
  **full palette** (3–4 named roles) → **drenched** (the surface IS the color).

## Layout & spacing

- **Visual hierarchy** — importance communicated by combining 2–3 dimensions:
  size (≥3:1 for dominance), weight, color contrast, position, surrounding
  space. Use the fewest dimensions needed.
- **Layout topology** — arrangement of dominant elements: stacked /
  side-by-side / grid / asymmetric / overlay.
- **Rhythm** — alternation of tight and generous spacing: tight within a group
  (8–12px between siblings), generous between sections (48–96px). Failure
  mode: **monotone spacing** (equal padding everywhere).
- **Spacing scale / tokens** — all spacing from a defined scale (4pt base: 4,
  8, 12, 16, 24, 32, 48, 64, 96), never arbitrary numbers.
- **Density** — minimal / comfortable / dense; must match content type.
- **Optical alignment** — nudging elements that are geometrically centered but
  *look* off (icons, display type overhang); optics win over geometry.
- **Elevation scale** — semantic z-index ladder (dropdown → sticky → modal
  backdrop → modal → toast → tooltip); never `z-index: 999`.
- **Squint test** — blur your eyes: primary element, secondary element, and
  groupings should still be identifiable.

## Typography

- **Measure** — line length; comfortable at 45–75ch, cap body at ~65ch.
- **Modular scale** — consistent ratio between type sizes (≥1.25 brand,
  1.125–1.2 product). Fewer sizes with more contrast beats many near-identical
  sizes (14/15/16px = **muddy hierarchy**).
- **Vertical rhythm** — line-height as the base unit for vertical spacing
  (24px body line → spacing in multiples of 24).
- **Fluid type** — `clamp(min, preferred, max)` sizing; keep bounded
  (max ≤ ~2.5× min).
- **Tracking** — letter-spacing; tighten display type (floor ≈ −0.04em),
  widen small all-caps labels.
- **Eyebrow / kicker** — the small all-caps tracked label above a heading.
- **Leading** — line-height; body ~1.5–1.8, display ~0.9–1.1.

## Evaluation

- **P0–P3 severity** — blocking / major / minor / polish. "Would a user
  contact support about this?" → at least P1. Use for triaging findings.
- **Nielsen heuristics (0–4 each, /40)** — the standard 10-heuristic design
  health score; most real interfaces land 20–32. For "how good is this page?"
  questions — not for design-fidelity questions, which are answered by
  measurement.
- **Cognitive load** — intrinsic / extraneous / germane; ≤4 items in a
  working-memory group.
- **Component states** — default, hover, focus-visible, active, disabled,
  loading, error, success, empty. "Interactive element is missing states X, Y"
  is a precise finding.
- **Affordance** — a control's learned, expected behavior; don't reinvent
  standard affordances for flavor.
- **Contrast (WCAG)** — 4.5:1 body text, 3:1 large text/UI components.

## Command verbs (sanctioned subset)

Impeccable's verbs are useful shorthand, but only some are legal in a
fidelity-reproduction repo:

- **Sanctioned:** `audit` (technical checks: a11y, performance, responsive,
  tokens), `harden` (overflow, i18n, edge cases, network states), `critique`
  (heuristic evaluation — report only), `optimize` (performance), `adapt`
  (device/breakpoint work — against the matching design artboard).
- **Departure-mode only (require explicit user sanction):** `bolder`,
  `quieter`, `colorize`, `typeset`, `layout`, `distill`, `animate`, `delight`,
  `overdrive`, `polish` — all taste-driven modification; here the taste is
  fixed in the design source of truth.

Optional lint: `npx impeccable detect --json <dir|url>` runs deterministic
quality rules standalone (no install). If used, ignore its entire `slop`
category — those rules assume AI-generated design and false-positive on
deliberate design decisions.
