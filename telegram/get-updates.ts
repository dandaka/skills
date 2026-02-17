#!/usr/bin/env bun
import { Bot } from "grammy";

// Get bot token from environment
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN not found in environment variables");
  process.exit(1);
}

// Create bot instance
const bot = new Bot(token);

try {
  // Get bot info
  const me = await bot.api.getMe();
  console.log("Bot Information:");
  console.log(`  Username: @${me.username}`);
  console.log(`  Name: ${me.first_name}`);
  console.log(`  ID: ${me.id}`);
  console.log("\n");

  // Get recent updates to find channels
  const updates = await bot.api.getUpdates({ limit: 100 });

  if (updates.length === 0) {
    console.log("No recent updates found.");
    console.log("\nTo find your channel ID:");
    console.log("1. Post a message to your channel");
    console.log("2. If the channel is public, you can use @channelname");
    console.log("3. Run this script again to see channel IDs from recent messages");
  } else {
    console.log("Recent channels/chats:");
    const chats = new Map();

    updates.forEach(update => {
      if (update.channel_post) {
        const chat = update.channel_post.chat;
        chats.set(chat.id, {
          id: chat.id,
          title: chat.title,
          username: chat.username,
          type: chat.type
        });
      }
      if (update.message) {
        const chat = update.message.chat;
        chats.set(chat.id, {
          id: chat.id,
          title: chat.title || chat.first_name,
          username: chat.username,
          type: chat.type
        });
      }
    });

    if (chats.size === 0) {
      console.log("No channels found in recent updates.");
    } else {
      chats.forEach(chat => {
        console.log(`\n  Type: ${chat.type}`);
        console.log(`  Title: ${chat.title}`);
        if (chat.username) {
          console.log(`  Username: @${chat.username}`);
        }
        console.log(`  ID: ${chat.id}`);
      });
    }
  }
} catch (error) {
  console.error("Error:", error);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
