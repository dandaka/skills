#!/usr/bin/env bun
import { Bot } from "grammy";

// Determine if we're using default channel from .env or explicit channel
const hasDefaultChannel = !!process.env.TELEGRAM_CHANNEL_ID;

// Get arguments after the script name
// For bun, process.argv[0] is 'bun', process.argv[1] is the script path
const args = process.argv.slice(2);

let channel: string;
let message: string;

if (hasDefaultChannel && args.length === 1) {
  // Single argument with default channel set = message only
  channel = process.env.TELEGRAM_CHANNEL_ID;
  message = args[0];
} else if (args.length === 2) {
  // Two arguments = channel + message
  channel = args[0];
  message = args[1];
} else {
  console.error("Usage: bun run post.ts [channel] <message>");
  console.error("Example: bun run post.ts @mychannel 'Hello world!'");
  console.error("Or set TELEGRAM_CHANNEL_ID in .env and run: bun run post.ts 'Hello world!'");
  console.error(`\nReceived ${args.length} argument(s)`);
  process.exit(1);
}

if (!channel || !message) {
  console.error("Error: Channel and message are required");
  process.exit(1);
}

// Get bot token from environment
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN not found in environment variables");
  console.error("Please add TELEGRAM_BOT_TOKEN to your .env file");
  process.exit(1);
}

// Create bot instance
const bot = new Bot(token);

try {
  // Send message to channel
  const result = await bot.api.sendMessage(channel, message, {
    parse_mode: "Markdown",
  });

  console.log(`✓ Message posted successfully to ${channel}`);
  console.log(`Message ID: ${result.message_id}`);
  process.exit(0);
} catch (error) {
  console.error("Error posting to Telegram:", error);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
