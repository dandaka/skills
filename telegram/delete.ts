#!/usr/bin/env bun
import { Bot } from "grammy";

const argCount = process.argv.length - 2;

if (argCount !== 1) {
  console.error("Usage: bun run delete.ts <message_id>");
  console.error("Example: bun run delete.ts 12");
  process.exit(1);
}

const messageId = parseInt(process.argv[2]);

if (isNaN(messageId)) {
  console.error("Error: Message ID must be a number");
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const channel = process.env.TELEGRAM_CHANNEL_ID;

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN not found in environment variables");
  process.exit(1);
}

if (!channel) {
  console.error("Error: TELEGRAM_CHANNEL_ID not found in environment variables");
  process.exit(1);
}

const bot = new Bot(token);

try {
  await bot.api.deleteMessage(channel, messageId);
  console.log(`✓ Message ${messageId} deleted successfully from ${channel}`);
  process.exit(0);
} catch (error) {
  console.error("Error deleting message:", error);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
