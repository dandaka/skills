#!/usr/bin/env bun
/**
 * unified-dev-env reference implementation
 * Adapt to your stack: replace runProc() calls with your services,
 * change LOG_DIR/SYMLINK_DIR to match your project layout.
 *
 * Dependencies: bun add rotating-file-stream ws
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, symlinkSync, existsSync, unlinkSync } from "node:fs";
import { createStream } from "rotating-file-stream";
import { resolve, join } from "node:path";
import WebSocket from "ws";

// ── Config ────────────────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dir, "../.."); // adjust to your project root
const PROJECT = "myproject";                     // used for /tmp dir name
const LOG_DIR = `/tmp/${PROJECT}-logs`;
const SYMLINK_DIR = join(ROOT, "logs");
const CURRENT = join(LOG_DIR, "dev-current.log");
const LATEST = join(SYMLINK_DIR, "dev-latest.log");
const CDP_PORT = 9222;

// ── Log setup ─────────────────────────────────────────────────────────────────
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(SYMLINK_DIR, { recursive: true });

const rotator = createStream("dev-current.log", {
  path: LOG_DIR,
  size: "5M",
  maxFiles: 10,
  compress: "gzip",
});

try {
  if (existsSync(LATEST)) unlinkSync(LATEST);
  symlinkSync(CURRENT, LATEST);
} catch {}

const COLORS: Record<string, string> = {
  server:  "\x1b[36m",
  web:     "\x1b[32m",
  worker:  "\x1b[35m",
  browser: "\x1b[33m",
};
const RESET = "\x1b[0m";

function emit(prefix: string, line: string) {
  if (!line) return;
  const ts = new Date().toISOString();
  const plain = `${ts} [${prefix}] ${line}\n`;
  const color = COLORS[prefix.split(":")[0]] ?? "";
  process.stdout.write(`${color}[${prefix}]${RESET} ${line}\n`);
  rotator.write(plain);
}

// ── Process manager ───────────────────────────────────────────────────────────
function pipe(prefix: string, child: ChildProcess) {
  const handle = (buf: Buffer) => {
    for (const line of buf.toString("utf8").split("\n")) {
      if (line.length) emit(prefix, line);
    }
  };
  child.stdout?.on("data", handle);
  child.stderr?.on("data", handle);
  child.on("exit", (code) => emit(prefix, `(exit ${code})`));
}

function runProc(name: string, cmd: string, cwd: string) {
  const child = spawn(cmd, {
    cwd,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: "/bin/bash",
  });
  pipe(name, child);
  return child;
}

emit("dev-logs", `starting — logs at ${CURRENT} (symlink: ${LATEST})`);

// ── Start your services here ──────────────────────────────────────────────────
const children = [
  runProc("server", "bun run src/index.ts", join(ROOT, "packages/server")),
  runProc("web",    "bun run dev",          join(ROOT, "packages/web")),
  // runProc("worker", "bun run src/worker.ts", join(ROOT, "packages/worker")),
];

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  emit("dev-logs", "shutting down");
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── CDP browser tap (optional) ────────────────────────────────────────────────
let browserWs: WebSocket | null = null;
let attachedTargetId: string | null = null;
let cdpMsgId = 1;
const pending = new Map<number, (r: any) => void>();

function cdpSend(method: string, params: any = {}) {
  if (!browserWs || browserWs.readyState !== WebSocket.OPEN)
    return Promise.reject(new Error("no ws"));
  const id = cdpMsgId++;
  browserWs.send(JSON.stringify({ id, method, params }));
  return new Promise<any>((r) => pending.set(id, r));
}

async function tryAttachBrowser() {
  try {
    const res = await fetch(`http://localhost:${CDP_PORT}/json`);
    if (!res.ok) return false;
    const targets: any[] = await res.json();
    const page = targets.find(
      (t) => t.type === "page" && !t.url.startsWith("devtools://")
    );
    if (!page) return false;
    if (attachedTargetId === page.id) return true;

    if (browserWs) { try { browserWs.close(); } catch {} }
    browserWs = new WebSocket(page.webSocketDebuggerUrl);

    browserWs.on("open", async () => {
      attachedTargetId = page.id;
      emit("browser", `attached to tab: ${page.url}`);
      await cdpSend("Runtime.enable");
      await cdpSend("Log.enable");
    });

    browserWs.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)!(msg.result);
        pending.delete(msg.id);
        return;
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        const p = msg.params;
        const text = (p.args ?? [])
          .map((a: any) => a.value ?? a.description ?? JSON.stringify(a.preview ?? ""))
          .join(" ");
        emit("browser", `[${p.type}] ${text}`);
      } else if (msg.method === "Log.entryAdded") {
        const e = msg.params.entry;
        emit("browser", `[${e.level}] ${e.text}${e.url ? " @ " + e.url : ""}`);
      } else if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        emit("browser", `[exception] ${d.text} ${d.exception?.description ?? ""}`);
      }
    });

    browserWs.on("close", () => {
      emit("browser", "detached");
      browserWs = null;
      attachedTargetId = null;
    });
    browserWs.on("error", () => {});
    return true;
  } catch {
    return false;
  }
}

setInterval(() => {
  if (!browserWs) tryAttachBrowser();
}, 3000);
