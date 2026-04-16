#!/bin/bash
# Transcribes audio using Deepgram API and saves transcript.json
# Usage: DEEPGRAM_API_KEY=... ./transcribe-deepgram.sh <session_folder>
#
# Produces transcript.json compatible with convert.ts format

set -euo pipefail

SESSION_FOLDER="$1"
AUDIO_PATH="$SESSION_FOLDER/audio.mp3"
TRANSCRIPT_PATH="$SESSION_FOLDER/transcript.json"
DG_RESPONSE="$SESSION_FOLDER/_deepgram_response.json"

if [ ! -f "$AUDIO_PATH" ]; then
  echo "No audio.mp3 found in $SESSION_FOLDER" >&2
  exit 1
fi

if [ -f "$TRANSCRIPT_PATH" ]; then
  echo "transcript.json already exists, skipping" >&2
  exit 0
fi

echo "Sending $(du -h "$AUDIO_PATH" | cut -f1) audio to Deepgram..."

curl -s -X POST \
  "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&diarize=true&language=ru&detect_language=true&punctuate=true&utterances=true" \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@$AUDIO_PATH" \
  -o "$DG_RESPONSE"

if [ ! -s "$DG_RESPONSE" ]; then
  echo "Deepgram returned empty response" >&2
  exit 1
fi

# Check for API errors
if jq -e '.err_code' "$DG_RESPONSE" > /dev/null 2>&1; then
  echo "Deepgram error: $(jq -r '.err_msg' "$DG_RESPONSE")" >&2
  rm -f "$DG_RESPONSE"
  exit 1
fi

WORD_COUNT=$(jq '.results.channels[0].alternatives[0].words | length' "$DG_RESPONSE")
SPEAKER_COUNT=$(jq '[.results.channels[0].alternatives[0].words[].speaker] | unique | length' "$DG_RESPONSE")
echo "Got $WORD_COUNT words, $SPEAKER_COUNT speakers"

# Convert Deepgram format to Hyprnote transcript.json format
jq '{
  transcripts: [{
    words: [
      .results.channels[0].alternatives[0].words[] |
      {
        channel: (.speaker // 0),
        start_ms: ((.start * 1000) | round),
        end_ms: ((.end * 1000) | round),
        text: (" " + (.punctuated_word // .word))
      }
    ]
  }]
}' "$DG_RESPONSE" > "$TRANSCRIPT_PATH"

echo "Saved transcript.json ($WORD_COUNT words)"
rm -f "$DG_RESPONSE"
