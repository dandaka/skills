#!/usr/bin/env bun
import { Bot } from "grammy";

// Get arguments
const articleUrl = process.argv[2];

if (!articleUrl) {
  console.error("Usage: bun run summarize-and-post.ts <article-url>");
  console.error("Example: bun run summarize-and-post.ts https://example.com/article");
  process.exit(1);
}

// Get bot token and channel from environment
const token = process.env.TELEGRAM_BOT_TOKEN;
const channel = process.env.TELEGRAM_CHANNEL_ID;

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN not found in environment variables");
  console.error("Please add TELEGRAM_BOT_TOKEN to your .env file");
  process.exit(1);
}

if (!channel) {
  console.error("Error: TELEGRAM_CHANNEL_ID not found in environment variables");
  console.error("Please add TELEGRAM_CHANNEL_ID to your .env file");
  process.exit(1);
}

console.log(`Fetching article from: ${articleUrl}`);
console.log("This script expects Claude to provide the summary...");
console.log("Use this script through Claude Code's telegram skill");
process.exit(1);
