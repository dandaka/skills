#!/usr/bin/env bun
/**
 * Extracts Slack xoxc tokens + xoxd cookies from the Slack desktop app and
 * writes them to ~/.claude/.env
 *
 * Token source: LevelDB local storage (xoxc)
 * Cookie source: SQLite Cookies DB, decrypted via macOS Keychain (xoxd)
 *
 * Usage: bun scripts/extract-slack-tokens.ts
 */

import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createDecipheriv, pbkdf2Sync } from "crypto";

const SLACK_BASE = join(homedir(), "Library/Application Support/Slack");
const SLACK_LEVELDB = join(SLACK_BASE, "Local Storage/leveldb");
const SLACK_COOKIES_DB = join(SLACK_BASE, "Cookies");
const ENV_FILE = join(homedir(), ".claude/.env");

// ── Cookie decryption (Chrome/Electron macOS pattern) ─────────────────────────

async function getDecryptionKey(): Promise<Buffer> {
  const proc = Bun.spawn(
    ["security", "find-generic-password", "-s", "Slack Safe Storage", "-w"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const raw = await new Response(proc.stdout).text();
  const password = raw.trim();
  // Chrome uses PBKDF2-SHA1, 1003 iterations, salt "saltysalt", 16-byte key
  return pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
}

function decryptChromeValue(encrypted: Buffer, key: Buffer): string {
  // Chrome encrypted values: prefix "v10" (3 bytes) + IV (16 bytes of spaces) + ciphertext
  if (!encrypted.slice(0, 3).equals(Buffer.from("v10"))) {
    return encrypted.toString("utf8"); // unencrypted
  }
  const iv = Buffer.alloc(16, " ");
  const ciphertext = encrypted.slice(3);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  // Extract just the xoxd token — strip any leading garbage bytes from AES block alignment
  const match = decrypted.match(/xoxd-[A-Za-z0-9_%\-]+/);
  return match ? match[0] : decrypted;
}

async function extractXoxdCookie(): Promise<string | null> {
  if (!existsSync(SLACK_COOKIES_DB)) return null;
  try {
    const key = await getDecryptionKey();
    // Use sqlite3 CLI to read encrypted cookie value as hex
    const proc = Bun.spawn(
      ["sqlite3", SLACK_COOKIES_DB, "SELECT hex(encrypted_value) FROM cookies WHERE name='d' AND host_key LIKE '%.slack.com' LIMIT 1;"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const hex = (await new Response(proc.stdout).text()).trim();
    if (!hex) return null;
    const encrypted = Buffer.from(hex, "hex");
    const decrypted = decryptChromeValue(encrypted, key);
    return decrypted || null;
  } catch (e) {
    console.warn("  Warning: could not decrypt xoxd cookie:", (e as Error).message);
    return null;
  }
}

// ── Token extraction from LevelDB ─────────────────────────────────────────────

async function extractXoxcTokens(): Promise<string[]> {
  const files = await readdir(SLACK_LEVELDB);
  const ldbFiles = files.filter((f) => f.endsWith(".ldb") || f.endsWith(".log"));
  const tokens = new Set<string>();

  for (const file of ldbFiles) {
    const buf = await readFile(join(SLACK_LEVELDB, file));
    const text = buf.toString("latin1");
    const matches = text.matchAll(/xoxc-[\d]+-[\d]+-[\d]+-[a-f0-9]{64}/g);
    for (const m of matches) tokens.add(m[0]);
  }

  return [...tokens];
}

// ── Workspace name resolution ─────────────────────────────────────────────────

async function resolveWorkspaceName(xoxc: string, xoxd: string): Promise<string | null> {
  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      headers: {
        Authorization: `Bearer ${xoxc}`,
        Cookie: `d=${xoxd}`,
        "Content-Type": "application/json",
      },
    });
    const json = (await res.json()) as { ok: boolean; team?: string; error?: string };
    if (json.ok && json.team) return json.team;
    if (json.error) console.warn(`  auth.test error: ${json.error}`);
  } catch (e) {
    console.warn(`  auth.test failed: ${(e as Error).message}`);
  }
  return null;
}

// ── .env update ───────────────────────────────────────────────────────────────

async function updateEnvFile(
  entries: Array<{ key: string; xoxc: string; xoxd?: string }>
) {
  let existing = "";
  if (existsSync(ENV_FILE)) {
    existing = await readFile(ENV_FILE, "utf-8");
  }

  const lines = existing
    .split("\n")
    .filter((l) => !l.startsWith("SLACK_TOKEN_") && !l.startsWith("SLACK_COOKIE_"));

  for (const { key, xoxc, xoxd } of entries) {
    lines.push(`SLACK_TOKEN_${key}=${xoxc}`);
    if (xoxd) lines.push(`SLACK_COOKIE_${key}=${xoxd}`);
  }

  const content = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  await Bun.write(ENV_FILE, content);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("Extracting xoxc tokens from LevelDB...");
const xoxcTokens = await extractXoxcTokens();

if (xoxcTokens.length === 0) {
  console.error("No tokens found. Is Slack installed and logged in?");
  process.exit(1);
}
console.log(`Found ${xoxcTokens.length} xoxc token(s).`);

console.log("Decrypting xoxd cookie from Keychain + Cookies DB...");
const xoxd = await extractXoxdCookie();
if (xoxd) {
  console.log("  xoxd cookie decrypted successfully.");
} else {
  console.warn("  xoxd cookie not found — workspace name lookup will be skipped.");
}

const entries: Array<{ key: string; xoxc: string; xoxd?: string }> = [];

for (const xoxc of xoxcTokens) {
  let name: string | null = null;
  if (xoxd) name = await resolveWorkspaceName(xoxc, xoxd);

  // Fallback: team ID from token segments
  const parts = xoxc.split("-");
  const fallback = `TEAM_${parts[1] ?? "UNKNOWN"}`;
  const key = (name ?? fallback).toUpperCase().replace(/[^A-Z0-9]/g, "_");

  console.log(`  → ${key}${name ? ` (${name})` : " (name lookup failed)"}`);
  entries.push({ key, xoxc, xoxd: xoxd ?? undefined });
}

await updateEnvFile(entries);
console.log(`\nWritten to ${ENV_FILE}`);
for (const { key } of entries) {
  console.log(`  SLACK_TOKEN_${key}`);
  console.log(`  SLACK_COOKIE_${key}`);
}
