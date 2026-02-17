---
name: adobe-podcast-enhance
description: Enhance audio files using Adobe Podcast Enhance (podcast.adobe.com/en/enhance). Uploads an audio file via Chrome browser automation, waits for enhancement, downloads the result, and moves it to the source directory. Use when the user wants to clean up or enhance spoken audio.
compatibility: Requires Claude in Chrome MCP extension
allowed-tools: Bash(ls *), Bash(mv *)
metadata:
  author: dandaka
  version: "1.0"
  url: https://podcast.adobe.com/en/enhance
---

# Adobe Podcast Enhance

Enhance spoken audio files using Adobe's free AI speech enhancement tool via Chrome browser automation.

## Process

### 1. Verify the input file exists

Check that the audio file the user wants to enhance exists. Supported formats: `.mp3`, `.wav`, `.aac`, `.flac`, `.oga`, `.ogg`, `.m4a`, `.mp4`, `.m4v`, `.mov`, `.3gpp`, `.3gp`, `.webm`.

### 2. Get browser context

Call `tabs_context_mcp` to get available tabs, then create a new tab with `tabs_create_mcp`.

### 3. Navigate to Adobe Podcast Enhance

Navigate to `https://podcast.adobe.com/en/enhance`.

### 4. Upload the file

- Click the "Choose files" button on the page
- The native file dialog will open — **tell the user the full file path** so they can select it manually
- The browser security sandbox prevents programmatic file uploads from the local filesystem, so the user must select the file in the dialog themselves

### 5. Wait for enhancement

- After the file is selected, Adobe will show "Enhancing speech..." status
- Ask the user to tell you when it's done, or periodically take screenshots to check
- Enhancement typically takes 30-120 seconds depending on file length
- When done, you'll see the audio player with Original/Enhanced toggle, Speech/Background sliders, and the "Download" button at the bottom

### 6. Download the enhanced file

- Find and click the "Download" button at the bottom of the page
- Use `find` tool with query "Download button" to get a reliable ref, then click via ref
- The file downloads to `~/Downloads/` with `-enhanced-v2` suffix appended to the original filename
- There may be a `(1)` or similar suffix if the file was downloaded before

### 7. Move to source directory

- Move the downloaded file from `~/Downloads/` to the same directory as the original file
- Remove any `(1)` numbering suffix from the filename when moving
- Example: `mv ~/Downloads/"filename-enhanced-v2 (1).wav" /original/dir/"filename-enhanced-v2.wav"`

## Important Notes

- **File upload cannot be automated**: Browser security prevents setting files on `<input type="file">` programmatically from local disk. You must click "Choose files" and let the user pick the file from the OS dialog.
- **Do NOT try** to serve files locally and fetch them or use DataTransfer API hacks — these approaches are blocked or unreliable.
- The file input element has id `enhance-file-upload` and is hidden behind the "Choose files" button.
- The page may already have a previously enhanced file loaded — ignore it, just upload the new one.
- Default enhancement settings (Speech 90%, Background 10%) are fine for most use cases.

## Arguments

Path to the audio file to enhance. If not provided, ask the user which file to enhance.
