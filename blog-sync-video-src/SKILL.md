---
name: blog-sync-video-src
description: Sync blog media files (video/audio/image) from library/ and projects/ to Google Drive using rclone. Only syncs whitelisted media extensions, preserving directory structure. Use when the user wants to upload or sync blog media to Google Drive.
compatibility: Requires rclone with 'gdrive' remote configured
metadata:
  author: dandaka
  version: "2.0"
  source: ~/projects/dn-blog/{library,projects}/
  destination: "gdrive: (Google Drive folder ID configured via GDRIVE_BLOG_FOLDER_ID in ~/.claude/.env)"
allowed-tools: Bash(rclone *)
---

# Blog Media Sync to Google Drive

Syncs media files from `library/` and `projects/` in `~/projects/dn-blog/` to Google Drive using rclone. Only uploads whitelisted media extensions — code, JSON, and text files are excluded.

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

## Media filter

Only these extensions are synced:

```
--include "*.mp4" --include "*.mov" --include "*.webm"
--include "*.wav" --include "*.mp3" --include "*.m4a" --include "*.aac" --include "*.flac"
--include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.gif" --include "*.webp"
--include "*.psd" --include "*.ai" --include "*.svg"
```

## Usage

### Upload media to Google Drive

```bash
# Sync both library/ and projects/ media
rclone copy ~/projects/dn-blog/library/ gdrive:library/ --include "*.mp4" --include "*.mov" --include "*.webm" --include "*.wav" --include "*.mp3" --include "*.m4a" --include "*.aac" --include "*.flac" --include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.gif" --include "*.webp" --include "*.psd" --include "*.ai" --include "*.svg" --progress

rclone copy ~/projects/dn-blog/projects/ gdrive:projects/ --include "*.mp4" --include "*.mov" --include "*.webm" --include "*.wav" --include "*.mp3" --include "*.m4a" --include "*.aac" --include "*.flac" --include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.gif" --include "*.webp" --include "*.psd" --include "*.ai" --include "*.svg" --progress
```

### Dry run (check what would be uploaded)

```bash
rclone copy ~/projects/dn-blog/library/ gdrive:library/ --include "*.mp4" --include "*.mov" --include "*.webm" --include "*.wav" --include "*.mp3" --include "*.m4a" --include "*.aac" --include "*.flac" --include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.gif" --include "*.webp" --include "*.psd" --include "*.ai" --include "*.svg" --progress --dry-run

rclone copy ~/projects/dn-blog/projects/ gdrive:projects/ --include "*.mp4" --include "*.mov" --include "*.webm" --include "*.wav" --include "*.mp3" --include "*.m4a" --include "*.aac" --include "*.flac" --include "*.jpg" --include "*.jpeg" --include "*.png" --include "*.gif" --include "*.webp" --include "*.psd" --include "*.ai" --include "*.svg" --progress --dry-run
```

### List media on Google Drive

```bash
rclone ls gdrive:library/
rclone ls gdrive:projects/
```

## Whitelisted folders

- `~/projects/dn-blog/library/` — reference videos, b-roll library
- `~/projects/dn-blog/projects/` — per-project source video, footage, assets, output

## Google Drive

- Folder ID: set via `GDRIVE_BLOG_FOLDER_ID` in `~/.claude/.env`
- rclone remote: `gdrive`
