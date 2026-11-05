---
name: doc
description: Create Google Docs and Google Sheets with the gog CLI for sharing with external parties (clients, partners, investors, anyone outside the team). Use whenever the user says "doc", "docs", "sheet", "sheets", "gdoc" or "gog", or asks for a document, spreadsheet or write-up that someone else will read. Prefer this over Claude Docs, Artifacts, local .md/.docx/.xlsx files or other connectors when the result is to be shared outside.
metadata:
  author: dandaka
  version: "1.0"
allowed-tools: Bash(gog *)
---

# Docs and Sheets for external parties (gog)

**Rule: documents and spreadsheets meant for people outside the team are made
with the `gog` CLI as Google Docs / Google Sheets.** Do not use Claude Docs,
Artifacts, the Google Drive MCP connector, or a local .md/.docx/.xlsx file for
them. A local file is fine only as the source you import (`--file`), and only
if the user asks for the file itself.

## Account

Always pass `--account "$GOOGLE_ACCOUNT"` (set in `~/.claude/.env`). Use `-j`
for JSON output when you need the new file's ID or URL.

```bash
source ~/.claude/.env
```

## Google Doc

Write the content as Markdown first (scratchpad), then import it in one go:

```bash
gog docs create "Title" --file /path/to/draft.md --account "$GOOGLE_ACCOUNT" -j
# --parent=<folderId> to put it in a folder; --pageless for pageless mode
```

Edit later:

```bash
gog docs cat <docId> --account "$GOOGLE_ACCOUNT"              # read as text
gog docs write <docId> --help                                  # replace/append content
gog docs find-replace <docId> "old" "new" --account "$GOOGLE_ACCOUNT"
gog docs insert-table --rows=3 --cols=2 <docId> --at-end ...  # native table
gog docs export <docId> --format pdf ...                       # pdf|docx|md|html|txt
```

## Google Sheet

```bash
gog sheets create "Title" --account "$GOOGLE_ACCOUNT" -j
gog sheets update <sheetId> 'Sheet1!A1' 'Name' 'Amount' --account "$GOOGLE_ACCOUNT"
gog sheets append <sheetId> 'Sheet1!A:B' 'Alice' '100' --account "$GOOGLE_ACCOUNT"
gog sheets batch-update <sheetId> --data-json '<json>' --account "$GOOGLE_ACCOUNT"
gog sheets format <sheetId> 'Sheet1!A1:B1' --help             # bold header etc.
gog sheets get <sheetId> 'Sheet1!A1:Z100' --account "$GOOGLE_ACCOUNT"
```

## Sharing

Sharing sends access outside the account, so **ask the user who gets access and
with what role before running it**, unless they already said so.

```bash
gog drive share <fileId> --to=user --email=person@example.com --role=commenter --account "$GOOGLE_ACCOUNT"
gog drive share <fileId> --to=anyone --role=reader --account "$GOOGLE_ACCOUNT"   # link sharing
# roles: reader|commenter|writer; add --notify to send the Drive invitation email
```

Use `-n` (`--dry-run`) to preview any mutating command.

## Finish

Give the user the doc/sheet link (`https://docs.google.com/document/d/<id>` or
`https://docs.google.com/spreadsheets/d/<id>`) and say who it is shared with.
Run `gog <docs|sheets|drive> <command> --help` for flags not listed here.
