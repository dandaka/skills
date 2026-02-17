# Discord Post Generator

Generate Discord announcement messages for Trendle community channels.

## How It Works

Take the user's original message/idea and transform it into a polished Discord announcement post following Trendle's established style.

## Style Guidelines (from examples.md)

Study the examples in `examples.md` carefully and follow these patterns:

- **Tone**: Casual, crypto-native, confident but not corporate. Talk like a friend, not a brand.
- **Structure**: Short punchy lines. Use line breaks liberally. No walls of text.
- **Lists**: Use bullet points or emoji bullets for feature lists and key points.
- **Openers**: Start with a bold topic line or greeting (e.g. "gmgm", "heads up", the feature name).
- **CTAs**: End with a clear call to action — go check it out, share on X, apply, etc.
- **Sign-off**: Use "gtrendle" as the sign-off when appropriate.
- **Length**: Match the complexity of the topic. Simple announcements are 2-3 lines. Feature launches or collabs get more detail.
- **No corporate speak**: No "we're excited to announce" or "we're thrilled". Just say what's happening.
- **Lowercase preferred**: Casual capitalization. Headers/titles can be caps for emphasis.

## Requirements

1. Read `examples.md` in this skill directory to match the voice and formatting.
2. Transform the user's input into a Discord-ready announcement.
3. **ALWAYS end every post with `@everyone @Member`** — this is mandatory, no exceptions.
4. Output the final post in a code block so the user can copy-paste it directly into Discord.
5. If the user's message is vague, ask for clarification before generating.

## Arguments

The user's message describing what they want to announce. Can be rough notes, bullet points, or a full draft.
