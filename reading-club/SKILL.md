---
name: reading-club
description: >
  Fetch articles and save them to a local reading buffer, or compile all unsent
  articles into a Kindle-optimized PDF digest and email it to Kindle.
  Use when the user provides URLs to save for reading, or says "send" / "send to kindle"
  to compile and dispatch the digest.
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Bash(md-to-pdf*), Bash(gog gmail*), Bash(mv*), WebFetch, Read, Write, Edit, Glob
---

# Reading Club

Manages a personal reading buffer: fetch articles → buffer locally → compile PDF → send to Kindle.

## Invocation

```
/reading-club https://url1.com https://url2.com   # Fetch & buffer articles
/reading-club send                                  # Build PDF digest + send to Kindle
```

## Base Directory

All files live in: `~/projects/knowledge-base/reading/`

- `index.md` — tracking table (title, url, date added, sent status)
- `YYYY-MM-DD-slug.md` — individual fetched articles
- `digest-YYYY-MM-DD.pdf` — compiled digests (kept for reference)

## Fetch Mode

When args contain URLs (not "send"):

1. For each URL:
   a. Try `WebFetch` to get the article content
   b. If content is poor/empty, use `agent-browser` skill as fallback
2. Extract: title, clean body text → Markdown
3. Save as `reading/YYYY-MM-DD-slug.md` where slug = last URL path segment, lowercased, hyphens
4. Create `reading/index.md` if it doesn't exist (with header row)
5. Append row to index: `| N | [Title](url) | YYYY-MM-DD | - |`

### Article MD format

```markdown
# Article Title

**Source:** https://original-url.com
**Fetched:** YYYY-MM-DD

---

[article body in clean markdown]
```

## Send Mode

When args = "send":

1. Read `reading/index.md`, find all rows where Sent column = `-`
2. Load their `.md` files from `reading/`
3. For each unsent article, generate a 1-sentence summary (15–25 words)
4. Build combined markdown `reading/_digest-tmp.md`:
   - Header: `# Reading Digest — YYYY-MM-DD`
   - **Intro paragraph**: 3–5 sentences synthesising all articles — common themes, overall conclusion, what they mean together
   - **Numbered article list**: for each article:
     - `**N. [Article Title](url)**` (bold, linked)
     - blank line
     - 2–4 sentence summary of that article
   - `---` separator
   - **Article sections**: one per article, H1 title, full body, separated by `---`

### Navigation section example format

```markdown
# Reading Digest — 2026-02-20

This digest explores [themes...]. [Overall conclusion sentence.]

**1. [Article Title](https://url)**

Summary of this article in 2–4 sentences.

**2. [Another Article](https://url)**

Summary of this article in 2–4 sentences.

---
```
5. Run `md-to-pdf` with Kindle A6 CSS (see style spec below)
6. Save output as `reading/digest-YYYY-MM-DD.pdf`
7. Send via `gog gmail send` (Bash): attach PDF, recipient = `$KINDLE_EMAIL` from `~/.claude/.env`, subject `Reading Digest YYYY-MM-DD`
8. Update `reading/index.md`: set Sent = `✅ YYYY-MM-DD` for all sent articles
9. Delete temp file `reading/_digest-tmp.md`

## PDF Style — Kindle A6

Pass this CSS inline to md-to-pdf via a config or `--stylesheet` flag:

```css
/* Kindle A6: 108mm × 144mm */
@page {
  size: 108mm 144mm;
  margin: 8mm;
}

body {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #000;
  max-width: 100%;
}

h1 {
  font-size: 16pt;
  margin-top: 1em;
  margin-bottom: 0.5em;
  page-break-before: always;
}

h1:first-of-type {
  page-break-before: avoid;
}

h2 { font-size: 14pt; }
h3 { font-size: 12pt; }

p { margin: 0.4em 0; }

a { color: #000; text-decoration: underline; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
}

th, td {
  border: 1px solid #ccc;
  padding: 2mm 3mm;
  text-align: left;
}

hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1em 0;
}

img { max-width: 100%; }
```

## Running md-to-pdf

```bash
md-to-pdf \
  --stylesheet ~/.claude/skills/reading-club/kindle-a6.css \
  --pdf-options '{"width":"108mm","height":"144mm","margin":{"top":"8mm","right":"8mm","bottom":"8mm","left":"8mm"}}' \
  reading/_digest-tmp.md
# Output: reading/_digest-tmp.pdf — rename to digest-YYYY-MM-DD.pdf
```

## Index File Format

```markdown
# Reading Club Index

| # | Title | Added | Sent |
|---|-------|-------|------|
| 1 | [Article Title](https://url) | 2026-02-20 | - |
| 2 | [Another Article](https://url) | 2026-02-19 | ✅ 2026-02-21 |
```

## Sending via gog gmail

Send the PDF using `gog gmail send` directly (use Bash, not the mail skill).
`KINDLE_EMAIL` and `GOOGLE_ACCOUNT` are loaded from `~/.claude/.env`.

```bash
source ~/.claude/.env
gog gmail send \
  --account $GOOGLE_ACCOUNT \
  --to "$KINDLE_EMAIL" \
  --subject "Reading Digest YYYY-MM-DD" \
  --body "Reading digest — N articles." \
  --attach "~/projects/knowledge-base/reading/digest-YYYY-MM-DD.pdf"
```
