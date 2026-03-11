---
name: adobe-podcast-enhance
description: Enhance audio files using Adobe Podcast Enhance (podcast.adobe.com/en/enhance). Uploads an audio file via Chrome browser automation, waits for enhancement, downloads the result, and moves it to the source directory. Use when the user wants to clean up or enhance spoken audio.
compatibility: Requires real-browser (Chrome Beta with remote debugging)
allowed-tools: Bash(ls *), Bash(mv *), Bash(ffmpeg *), Bash(pkill *), Bash(sleep *), Bash(agent-browser *)
metadata:
  author: dandaka
  version: "2.0"
  url: https://podcast.adobe.com/en/enhance
---

# Adobe Podcast Enhance

Enhance spoken audio files using Adobe's free AI speech enhancement tool via Chrome browser automation.

## Process

### 1. Verify the input file exists

Check that the file exists. If the input is a **video file** (`.mov`, `.mp4`, `.m4v`, etc.), extract audio first (see step 2). Pure audio formats work directly: `.mp3`, `.wav`, `.aac`, `.flac`, `.m4a`, `.ogg`.

### 2. Extract audio if input is a video file

Adobe Podcast shows an "Upgrade to enhance videos" modal for video files. Extract audio to `.mp3` first:

```bash
ffmpeg -i "/path/to/input.mov" -vn -acodec libmp3lame -q:a 2 "/path/to/input.mp3"
```

Use the same directory and base filename as the original. Keep this intermediate `.mp3` until the final video is produced.

### 3. Launch Chrome Beta with real-browser skill

Use `/real-browser` to launch Chrome Beta:

```bash
pkill -9 -f "Google Chrome Beta" 2>/dev/null; sleep 2
# then launch in background with --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-beta-profile"
agent-browser --session main connect 9222
agent-browser --session main open "https://podcast.adobe.com/en/enhance"
```

### 4. Sign in if needed

Take a screenshot. If the page shows "Sign up / Sign in" instead of the upload area, click the Sign in link and wait for the user to authenticate manually.

### 5. Upload the audio file

The file input has id `enhance-file-upload` (hidden behind the "Choose files" button). Use `agent-browser upload` directly on the input — **no need for user to manually select**:

```bash
agent-browser --session main upload "#enhance-file-upload" "/path/to/input.mp3"
```

If an "Upgrade to enhance videos" modal appears, dismiss it:
```bash
agent-browser --session main snapshot -i  # find "Dismiss modal" ref
agent-browser --session main click <ref>
```

### 6. Wait for enhancement

Poll with screenshots every 30 seconds. Enhancement shows "Enhancing speech... Separating background..." and takes 30–120 seconds. Done when the audio player appears with Original/Enhanced toggle and "Download" button at the bottom.

### 7. Download the enhanced file

Use `agent-browser download` (not just click) with a full output path:

```bash
agent-browser --session main snapshot -i  # find "Download" ref
agent-browser --session main download <ref> ~/Downloads/basename-enhanced-v2.mp3
```

### 8. Move to source directory

```bash
mv ~/Downloads/basename-enhanced-v2.mp3 /original/dir/
```

### 9. Merge enhanced audio back into original video (if input was video)

If the original input was a video file, replace its audio track with the enhanced mp3:

```bash
ffmpeg -i "/path/to/original.mov" -i "/path/to/enhanced-v2.mp3" \
  -c:v copy -c:a aac \
  -map 0:v:0 -map 1:a:0 -shortest \
  "/path/to/original-final.mov"
```

Output: `<basename>-final.mov` in the same directory.

### 10. Cleanup (optional)

The intermediate `.mp3` extract can be deleted once the final video is confirmed:
```bash
rm "/path/to/input.mp3"
```

## Important Notes

- **Video files require audio extraction first** — uploading `.mov`/`.mp4` directly triggers a premium upgrade modal
- **File upload IS automatable** via `agent-browser upload "#enhance-file-upload" <path>` — the hidden input accepts `setInputFiles` from Playwright
- **Download requires a full file path** (not a directory) — `agent-browser download <ref> ~/Downloads/filename.mp3`
- The page may show a previously enhanced file on load — ignore it, just upload the new one
- Default enhancement settings (Speech 90%, Background 10%) are fine; adjusting strength requires premium

## Arguments

Path to the audio or video file to enhance. If not provided, ask the user which file to enhance.
