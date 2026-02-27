#!/usr/bin/env bun
/**
 * Slack sync — downloads all message history to comms/slack/
 *
 * Usage: bun ~/.claude/skills/slack/sync.ts
 *
 * Reads SLACK_TOKEN_* + SLACK_COOKIE_* from ~/.claude/.env
 * Writes to <knowledge-base>/comms/slack/<workspace>/
 */

import { WebClient } from "@slack/web-api";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const KB_ROOT = join(homedir(), "projects/knowledge-base");
const COMMS_ROOT = join(KB_ROOT, "comms/slack");
const ENV_FILE = join(homedir(), ".claude/.env");

// Slack Tier 3 rate limit — 50 req/min → ~1.2s between calls
const RATE_LIMIT_MS = 1300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadEnv(): Promise<Record<string, string>> {
  if (!existsSync(ENV_FILE)) return {};
  const text = await readFile(ENV_FILE, "utf-8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function parseWorkspaces(env: Record<string, string>): Array<{ key: string; token: string; cookie: string }> {
  const workspaces: Array<{ key: string; token: string; cookie: string }> = [];
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith("SLACK_TOKEN_")) {
      const key = k.slice("SLACK_TOKEN_".length);
      const cookie = env[`SLACK_COOKIE_${key}`] ?? "";
      workspaces.push({ key, token: v, cookie });
    }
  }
  return workspaces;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface ChannelState {
  name: string;
  last_ts: string;
}

interface WorkspaceState {
  workspace: string;
  last_synced: string;
  channels: Record<string, ChannelState>;
}

async function loadState(workspaceDir: string): Promise<WorkspaceState> {
  const path = join(workspaceDir, ".state.json");
  if (existsSync(path)) {
    return JSON.parse(await readFile(path, "utf-8"));
  }
  return { workspace: "", last_synced: "", channels: {} };
}

async function saveState(workspaceDir: string, state: WorkspaceState) {
  await writeFile(join(workspaceDir, ".state.json"), JSON.stringify(state, null, 2));
}

// ── Formatting ────────────────────────────────────────────────────────────────

function tsToDate(ts: string): Date {
  return new Date(parseFloat(ts) * 1000);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function formatMessage(
  msg: { ts: string; text?: string; user?: string; bot_id?: string },
  userMap: Map<string, string>,
  indent = ""
): string {
  const d = tsToDate(msg.ts);
  const who = msg.user
    ? userMap.get(msg.user) ?? `<${msg.user}>`
    : msg.bot_id
    ? "Bot"
    : "Unknown";
  const text = (msg.text ?? "").trim().replace(/\n/g, `\n${indent}`);
  return `${indent}**${who}** ${formatTimestamp(d)}\n${indent}${text}`;
}

// ── File writing ──────────────────────────────────────────────────────────────

type MonthlyBuffer = Map<string, string[]>; // monthKey → lines[]

async function flushBuffer(dir: string, title: (mk: string) => string, buffer: MonthlyBuffer) {
  await mkdir(dir, { recursive: true });
  for (const [mk, lines] of buffer) {
    const filePath = join(dir, `${mk}.md`);
    const header = `# ${title(mk)} — ${monthLabel(new Date(mk + "-01"))}\n\n---\n\n`;
    const content = lines.join("\n\n") + "\n";
    if (existsSync(filePath)) {
      // Append — skip header
      const existing = await readFile(filePath, "utf-8");
      await writeFile(filePath, existing.trimEnd() + "\n\n" + content);
    } else {
      await writeFile(filePath, header + content);
    }
  }
}

// ── Sync one conversation ─────────────────────────────────────────────────────

async function syncConversation(
  client: WebClient,
  conv: { id: string; name: string; type: "channel" | "dm" },
  workspaceDir: string,
  state: WorkspaceState,
  userMap: Map<string, string>
): Promise<number> {
  const chanState = state.channels[conv.id];
  const oldest = chanState?.last_ts ?? "0";
  const subdir = conv.type === "channel"
    ? join(workspaceDir, "channels", conv.name)
    : join(workspaceDir, "dms", conv.name);

  const buffer: MonthlyBuffer = new Map();
  let latestTs = oldest;
  let msgCount = 0;
  let cursor: string | undefined;

  do {
    await sleep(RATE_LIMIT_MS);
    const res = await client.conversations.history({
      channel: conv.id,
      oldest: oldest === "0" ? undefined : oldest,
      cursor,
      limit: 200,
    });

    for (const msg of res.messages ?? []) {
      if (!msg.ts || msg.subtype === "channel_join") continue;
      const d = tsToDate(msg.ts);
      const mk = monthKey(d);

      const lines: string[] = [];
      lines.push(formatMessage(msg as any, userMap));

      // Fetch thread replies
      if ((msg as any).reply_count > 0) {
        await sleep(RATE_LIMIT_MS);
        const thread = await client.conversations.replies({
          channel: conv.id,
          ts: msg.ts,
          limit: 200,
        });
        const replies = (thread.messages ?? []).slice(1); // skip parent
        if (replies.length > 0) {
          lines.push(`> **Thread** (${replies.length} repl${replies.length === 1 ? "y" : "ies"})`);
          for (const r of replies) {
            lines.push(formatMessage(r as any, userMap, "> "));
          }
        }
      }

      if (!buffer.has(mk)) buffer.set(mk, []);
      buffer.get(mk)!.push(lines.join("\n"));

      if (!latestTs || parseFloat(msg.ts) > parseFloat(latestTs)) {
        latestTs = msg.ts;
      }
      msgCount++;
    }

    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  if (msgCount > 0) {
    const titleFn = (mk: string) =>
      conv.type === "channel" ? `#${conv.name}` : conv.name;
    await flushBuffer(subdir, titleFn, buffer);
    state.channels[conv.id] = { name: conv.name, last_ts: latestTs };
  }

  return msgCount;
}

// ── Sync one workspace ────────────────────────────────────────────────────────

async function syncWorkspace(workspace: { key: string; token: string; cookie: string }) {
  const client = new WebClient(workspace.token, {
    headers: workspace.cookie ? { Cookie: `d=${workspace.cookie}` } : {},
  });

  // Verify auth
  const auth = await client.auth.test();
  if (!auth.ok) {
    console.error(`  [${workspace.key}] auth.test failed: ${auth.error}`);
    return;
  }
  const workspaceName = (auth.team as string).toLowerCase().replace(/\s+/g, "-");
  console.log(`  Workspace: ${auth.team} (${auth.user})`);

  const workspaceDir = join(COMMS_ROOT, workspaceName);
  await mkdir(workspaceDir, { recursive: true });

  const state = await loadState(workspaceDir);
  state.workspace = auth.team as string;

  // Build user map: ID → "Display Name (@handle)"
  console.log("  Loading users...");
  await sleep(RATE_LIMIT_MS);
  const usersRes = await client.users.list({ limit: 1000 });
  const userMap = new Map<string, string>();
  for (const u of usersRes.members ?? []) {
    if (u.id) {
      const display = u.profile?.real_name || u.name || u.id;
      const handle = u.name ? ` (@${u.name})` : "";
      userMap.set(u.id, `${display}${handle}`);
    }
  }
  console.log(`  ${userMap.size} users loaded.`);

  // List all conversations
  console.log("  Listing conversations...");
  const convTypes = "public_channel,private_channel,im,mpim";
  const conversations: Array<{ id: string; name: string; type: "channel" | "dm" }> = [];
  let cursor: string | undefined;

  do {
    await sleep(RATE_LIMIT_MS);
    const res = await client.conversations.list({
      types: convTypes,
      exclude_archived: false,
      limit: 200,
      cursor,
    });

    for (const c of res.channels ?? []) {
      if (!c.id) continue;
      const isDm = c.is_im || c.is_mpim;
      let name: string;
      if (isDm && c.is_im && c.user) {
        name = userMap.get(c.user)?.replace(/\s+\(@.*\)$/, "") ?? c.user;
        // Sanitize for filesystem
        name = name.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();
      } else {
        name = (c.name ?? c.id).replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();
      }
      conversations.push({ id: c.id, name, type: isDm ? "dm" : "channel" });
    }

    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  console.log(`  ${conversations.length} conversations found.`);

  // Sync each conversation
  let totalMessages = 0;
  for (const conv of conversations) {
    process.stdout.write(`  Syncing ${conv.type === "channel" ? "#" : "DM:"}${conv.name}...`);
    try {
      const count = await syncConversation(client, conv, workspaceDir, state, userMap);
      console.log(` ${count} messages`);
      totalMessages += count;
    } catch (e: any) {
      console.log(` error: ${e.message}`);
    }
  }

  state.last_synced = new Date().toISOString();
  await saveState(workspaceDir, state);
  console.log(`  Done. ${totalMessages} messages written.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("Loading Slack credentials from ~/.claude/.env...");
const env = await loadEnv();
const workspaces = parseWorkspaces(env);

if (workspaces.length === 0) {
  console.error("No SLACK_TOKEN_* entries found in ~/.claude/.env");
  console.error("Run /slack connect first.");
  process.exit(1);
}

console.log(`Found ${workspaces.length} workspace(s): ${workspaces.map((w) => w.key).join(", ")}\n`);
await mkdir(COMMS_ROOT, { recursive: true });

for (const ws of workspaces) {
  console.log(`Syncing workspace: ${ws.key}`);
  await syncWorkspace(ws);
}

console.log("Slack sync complete.");
