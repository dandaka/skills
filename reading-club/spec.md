# Reading Club Skill — Refined Spec

## Summary

A Claude Code skill for collecting articles into a reading buffer and sending them as a Kindle-optimized PDF digest.

## Invocation

```
/reading-club https://url1.com https://url2.com   # Fetch & buffer articles
/reading-club send                                  # Build PDF digest + send to Kindle
```

---

## Fetch Mode (`/reading-club <urls>`)

1. For each URL:
   - Try `WebFetch` first
   - Fall back to `agent-browser` if WebFetch fails or returns poor content
2. Extract article content, convert to clean Markdown
3. Save as `reading/YYYY-MM-DD-slug.md`
   - Slug derived from URL path (last meaningful segment, lowercased, hyphens)
4. Append entry to `reading/index.md` with status `-` (unsent)

---

## Send Mode (`/reading-club send`)

1. Read `reading/index.md`, collect all rows where Sent = `-`
2. Load their corresponding `.md` files
3. Build combined Markdown:
   - **Section 1 — Navigation**: Table of contents with title + 1-sentence summary per article
   - **Section 2+**: Full article content, one H1 section per article
4. Convert to PDF using `md-to-pdf` (npm package)
   - Optimized for Kindle A6 (108mm × 144mm), medium font, comfortable margins
   - Style hardcoded in skill file, tunable by editing
5. Save PDF as `reading/digest-YYYY-MM-DD.pdf`
6. Send PDF to `vlad19_tO3UAg@kindle.com` via `/mail` skill
7. Update `reading/index.md` — mark sent articles with ✅ YYYY-MM-DD

---

## Index File Format

Location: `reading/index.md`

```markdown
# Reading Club Index

| # | Title | Added | Sent |
|---|-------|-------|------|
| 1 | [Article Title](https://url) | 2026-02-20 | - |
| 2 | [Another Article](https://url) | 2026-02-19 | ✅ 2026-02-20 |
```

---

## PDF Style (Kindle A6)

Hardcoded defaults in skill file (edit to tune):

- Page size: 108mm × 144mm (A6)
- Font size: 11pt
- Body font: serif (Georgia or similar)
- Margins: 8mm all sides
- Line height: 1.5
- Navigation section: smaller font, compact table
- Article sections: clear H1 separator, page break between articles

---

## File Structure

```
reading/
  index.md                     ← tracking file
  2026-02-20-article-slug.md   ← fetched articles
  digest-2026-02-20.pdf        ← sent digests (kept for reference)
```

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Invocation | `reading-club <urls>` / `reading-club send` | Clear, natural |
| Send scope | All unsent articles | Tracked in index.md |
| PDF tool | md-to-pdf | User specified |
| Fetching | WebFetch → agent-browser fallback | Fast + robust |
| Style config | Hardcoded in skill, editable | Simple |
| Index format | MD table with ✅ markers | Human-readable |
| File naming | YYYY-MM-DD-slug.md | Sortable, descriptive |
| PDF retention | Keep as digest-YYYY-MM-DD.pdf | Reference archive |

---

## Open Questions

- None — all key decisions resolved in interview.
