---
name: blog-sync-video-src
description: Sync blog video source files from ~/projects/dn-blog/ to Google Drive using rclone. Uploads all folders (video-source, b-roll, etc.) preserving directory structure. Use when the user wants to upload or sync blog videos to Google Drive.
compatibility: Requires rclone with 'gdrive' remote configured
metadata:
  author: dandaka
  version: "1.0"
  source: ~/projects/dn-blog/
  destination: "gdrive: (Google Drive folder ID configured via GDRIVE_BLOG_FOLDER_ID in ~/.claude/.env)"
allowed-tools: Bash(rclone *)
---

# Blog Video Source Sync to Google Drive

Syncs all video source files from `~/projects/dn-blog/` to a specific Google Drive folder using rclone.

## Prerequisites

1. **rclone** installed (`brew install rclone`)
2. **gdrive** remote configured pointing to the target folder:
   ```bash
   # Set GDRIVE_BLOG_FOLDER_ID in ~/.claude/.env first, then:
   rclone config create gdrive drive root_folder_id $GDRIVE_BLOG_FOLDER_ID
   ```
3. **Global filter** set up to exclude `.DS_Store` files:
   - Filter file: `~/.config/rclone/rclone-filter.txt`
   - Env var: `RCLONE_FILTER_FROM` in `~/.zshrc`

## Usage

### Upload all files to Google Drive

```bash
rclone copy ~/projects/dn-blog/ gdrive: --progress
```

This uploads all folders (`video-source/`, `b-roll/`, etc.) preserving the directory structure. `.DS_Store` files are excluded globally.

### Check what would be uploaded (dry run)

```bash
rclone copy ~/projects/dn-blog/ gdrive: --progress --dry-run
```

### List files on Google Drive

```bash
rclone ls gdrive:
```

### Sync (upload new + delete removed files from Drive)

```bash
rclone sync ~/projects/dn-blog/ gdrive: --progress
```

**Note:** `sync` deletes files on Drive that no longer exist locally. Use `copy` to only add new files.

## Folder Structure

- `~/projects/dn-blog/video-source/` — main video recordings
- `~/projects/dn-blog/b-roll/` — supplementary footage

## Google Drive

- Folder ID: set via `GDRIVE_BLOG_FOLDER_ID` in `~/.claude/.env`
- rclone remote: `gdrive`
