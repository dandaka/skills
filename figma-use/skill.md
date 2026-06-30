---
name: figma-use
description: >
  Figma automation via the figma-use CLI (by dannote). Use when the user needs to create, modify, or inspect Figma designs programmatically. Triggers on requests to render components in Figma, sync design tokens, query or find nodes, export assets, manage variables/pages, compose screens from component instances, delta-sync web app CSS against Figma properties, or troubleshoot Figma CDP connections. Also triggers on mentions of "figma-use", "figma automation", "figma cli", "render to figma", "figma eval", or "design system sync". Never use computer-use (screenshot/click) for Figma — always use figma-use CLI.
allowed-tools: Bash(figma-use:*), Bash(echo:*), Bash(npx:*), Bash(pkill:*), Bash(codesign:*), Bash(python3:*), Bash(nohup:*), Bash(grep:*), Bash(open:*)
---

# figma-use — Figma Automation CLI

`figma-use` (by dannote) controls Figma Desktop via Chrome DevTools Protocol. No plugins needed.

**IMPORTANT**: This is NOT `figma-ds-cli` — they are completely different packages. Never install or use `figma-ds-cli`.

**IMPORTANT**: Never use computer-use MCP tools (screenshot, click, type) to interact with Figma. Always use `figma-use` CLI. If connection is broken, fix it — don't fall back to computer-use.

## Setup

```bash
npm install -g figma-use
```

### Patching Figma (required for Figma 126+)

Figma 126+ strips `--remote-debugging-port` at startup via `removeSwitch()`. The patch flips one byte in `app.asar` to neutralize this. Re-run after every Figma auto-update.

```bash
#!/usr/bin/env bash
# patch-figma.sh — Re-enable raw CDP on Figma Desktop 126+
set -euo pipefail

ASAR="/Applications/Figma.app/Contents/Resources/app.asar"
BACKUP_DIR="$HOME/.figma-debug-start/backups"
OLD='remote-debugging-port'
NEW='remote-debugXing-port'

[ -f "$ASAR" ] || { echo "ERROR: $ASAR not found"; exit 1; }
[ -w "$ASAR" ] || { echo "ERROR: $ASAR not writable (try: sudo $0)"; exit 1; }

if LC_ALL=C grep -q -a "$NEW" "$ASAR"; then
  echo "Already patched. Nothing to do."
  exit 0
fi
if ! LC_ALL=C grep -q -a "$OLD" "$ASAR"; then
  echo "ERROR: target string '$OLD' not found — Figma version may have changed the code."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
BAK="$BACKUP_DIR/app.asar.$TS.bak"
cp "$ASAR" "$BAK"
echo "Backup: $BAK"

python3 - "$ASAR" "$OLD" "$NEW" <<'PY'
import sys
p, old, new = sys.argv[1], sys.argv[2].encode(), sys.argv[3].encode()
assert len(old) == len(new), "length mismatch would corrupt asar"
b = open(p, 'rb').read()
n = b.count(old)
open(p, 'wb').write(b.replace(old, new))
print(f"Patched {n} occurrence(s); size unchanged ({len(b)} bytes).")
PY

codesign --force --deep --sign - /Applications/Figma.app
codesign --verify --deep /Applications/Figma.app && echo "Signature OK"
echo "Done. Now launch Figma with CDP enabled."
```

Alternatively, `figma-use patch` does the same thing built-in.

### Launching Figma with CDP

`figma-use` v0.13.3 hardcodes CDP port **9222**. Figma must own that port. If Chrome is using 9222, kill it or move Chrome to another port (e.g. `--remote-debugging-port=9224`).

```bash
#!/usr/bin/env bash
# launch-figma.sh — Launch patched Figma with CDP and print the WebSocket URL
# NOTE: HTTP /json discovery endpoints are gated by modern Chromium and hang.
# The reliable handle is the "DevTools listening on ws://..." line from stderr.
set -euo pipefail

PORT="${1:-9222}"   # figma-use hardcodes 9222, so default to that
BIN="/Applications/Figma.app/Contents/MacOS/Figma"
LOG="/tmp/figma-stderr.log"

echo "Killing any running Figma..."
pkill -9 -f 'Figma.app/Contents/MacOS/Figma' 2>/dev/null || true
pkill -9 -f 'Figma Helper' 2>/dev/null || true
sleep 3

echo "Launching Figma with CDP on port $PORT..."
nohup "$BIN" --remote-debugging-port="$PORT" '--remote-allow-origins=*' >"$LOG" 2>&1 &
echo "pid=$!"

# Wait for the DevTools ws URL to appear
for i in $(seq 1 20); do
  WS=$(grep -oE "ws://127.0.0.1:$PORT/devtools/browser/[a-f0-9-]+" "$LOG" 2>/dev/null | tail -1 || true)
  [ -n "$WS" ] && break
  sleep 1
done

if [ -z "${WS:-}" ]; then
  echo "ERROR: no DevTools ws URL after 20s. Tail of $LOG:"; tail -15 "$LOG"; exit 1
fi

echo "CDP_WS=$WS"
echo "$WS" > /tmp/figma-cdp-ws.txt
echo "(also saved to /tmp/figma-cdp-ws.txt)"
```

### Unpatching (restore stock Figma)

```bash
#!/usr/bin/env bash
# unpatch-figma.sh — Restore the most recent app.asar backup
set -euo pipefail

ASAR="/Applications/Figma.app/Contents/Resources/app.asar"
BACKUP_DIR="$HOME/.figma-debug-start/backups"

LATEST=$(ls -t "$BACKUP_DIR"/app.asar.*.bak 2>/dev/null | head -1 || true)
[ -n "$LATEST" ] || { echo "ERROR: no backup found in $BACKUP_DIR"; exit 1; }

echo "Restoring: $LATEST"
pkill -9 -f 'Figma.app/Contents/MacOS/Figma' 2>/dev/null || true
sleep 2
cp "$LATEST" "$ASAR"
codesign --force --deep --sign - /Applications/Figma.app
codesign --verify --deep /Applications/Figma.app && echo "Signature OK"
echo "Reverted to stock. CDP is now disabled again."
```

### Quick Start (TL;DR)

```bash
figma-use patch              # or run patch-figma.sh manually
# Quit and reopen Figma, or run launch-figma.sh
figma-use status             # verify: "✓ Connected to Figma"
```

### Port Rules

| Port | Owner | Notes |
|------|-------|-------|
| 9222 | Figma (required) | `figma-use` hardcodes this — Figma must own it |
| 9224 | Chrome Beta (optional) | Use for web app CSS extraction via `agent-browser` |
| 9222 | Chrome (conflict!) | If Chrome has 9222, kill it or move to 9224 |

## Core Commands

| Command | Purpose |
|---------|---------|
| `figma-use status` | Check connection to Figma Desktop |
| `figma-use render --stdin` | Render JSX to Figma (pipe JSX via stdin) |
| `figma-use render file.tsx` | Render JSX file to Figma |
| `figma-use eval '<code>'` | Execute JS in Figma plugin context (full `figma.*` API) |
| `figma-use variable list` | List all variables |
| `figma-use variable list --collection Name` | Filter variables by collection |
| `figma-use collection list` | List variable collections |
| `figma-use page list` | List pages |
| `figma-use page create "Name"` | Create new page |
| `figma-use page switch "Name"` | Switch to page |
| `figma-use find --type FRAME` | Find nodes by type |
| `figma-use find --name "Button"` | Find nodes by name |
| `figma-use query "//COMPONENT_SET"` | XPath queries on the document |
| `figma-use export png <nodeId>` | Export node as PNG |
| `figma-use export svg <nodeId>` | Export node as SVG |
| `figma-use node info <nodeId>` | Get node details |
| `figma-use node delete <nodeId>` | Delete node |
| `figma-use set <nodeId> --name "New"` | Set node properties |
| `figma-use arrange` | Auto-arrange top-level nodes |
| `figma-use font list` | List available fonts |
| `figma-use patch` | Patch Figma 126+ to re-enable CDP |

## Render JSX

The primary way to create UI in Figma. Pipe JSX or use a file.

```bash
# Inline
echo '<Frame w={400} h={300} bg="#1a1a2e" rounded={16} p={24} flex="col" gap={12}>
  <Text size={24} weight="bold" color="#FFF">Dashboard</Text>
  <Text size={14} color="#888">Welcome back</Text>
</Frame>' | figma-use render --stdin

# From file
figma-use render ./screens/overview.figma.tsx

# With props
figma-use render ./screens/overview.figma.tsx --props '{"title": "Overview"}'

# Into specific parent
figma-use render --stdin --parent "123:456"
```

### JSX Elements

| Element | Purpose |
|---------|---------|
| `Frame` | Container with auto-layout |
| `Text` | Text node |
| `Rectangle` | Rectangle shape |
| `Ellipse` | Circle / ellipse |
| `Line` | Line |
| `Image` | Image (from URL) |
| `SVG` | Inline SVG |
| `Icon` | Iconify icon |
| `Instance` | Component instance (use for all UI elements from the library) |

### Layout Props

```
flex="row"|"col"       direction
gap={12}               spacing
justify="start"|"center"|"end"|"between"
items="start"|"center"|"end"
p={24}  px={24}  py={12}  pt/pr/pb/pl={N}
w={400}  h={300}  w="fill"  h="fill"
grow={1}  stretch
overflow="hidden"
```

### Appearance Props

```
bg="#hex"  bg="var:CollectionName/VariableName"
stroke="#hex"  strokeWidth={1}
opacity={0.5}
rounded={12}  roundedTL={8}
shadow="0px 4px 12px rgba(0,0,0,0.1)"
blur={4}
```

### Text Props

```
size={16}  font="Inter"  weight="bold"|500
color="#hex"  color="var:CollectionName/VariableName"
```

## Eval — Full Figma API Access

`figma-use eval` runs JavaScript in Figma's plugin context, giving full access to the `figma.*` API.

```bash
# Read current page name
figma-use eval 'figma.currentPage.name'

# Count variables
figma-use eval 'figma.variables.getLocalVariables().length'

# Find all component sets
figma-use eval 'figma.root.findAll(n => n.type === "COMPONENT_SET").map(c => c.name)'

# Get JSON output
figma-use eval --json 'return figma.currentPage.children.map(n => ({name: n.name, id: n.id}))'

# Create a component instance
figma-use eval '
var cs = figma.getNodeById("COMPONENT_SET_ID");
var instance = cs.defaultVariant.createInstance();
figma.currentPage.appendChild(instance);
return instance.id;
'
```

### Eval Gotchas

- Use `--json` flag when you need structured output (and include `return` in code).
- CDP has a ~10s timeout. Sync operations (radius, padding) can handle 200+ nodes per call. Async operations (`loadFontAsync` + mutations) must be batched to ~30 nodes per call.
- `figma-use find --type COMPONENT` returns empty — use `figma-use eval` with `page.findAll(n => n.type === "COMPONENT_SET")` instead.
- `figma-use component list` does not exist (as of v0.13.3). Use eval.

## Variable Binding in JSX

Use `var:CollectionName/VariableName` syntax for variable-bound colors:

```jsx
<Frame bg="var:Theme/background" stroke="var:Theme/border" rounded={16} p={24}>
  <Text color="var:Theme/foreground" size={18}>Hello</Text>
  <Text color="var:Theme/muted-foreground" size={12}>Subtitle</Text>
</Frame>
```

### Variable Operations via Eval

```bash
# List variables in a collection
figma-use eval --json '
var col = figma.variables.getLocalVariableCollections().find(c => c.name === "Theme");
return col.variableIds.map(id => figma.variables.getVariableById(id).name);
'

# Rebind a node's fill to a variable
figma-use eval '
var targetVar = figma.variables.getLocalVariables().find(v => v.name === "base/primary");
var node = figma.getNodeById("NODE_ID");
var fills = JSON.parse(JSON.stringify(node.fills));
fills[0] = figma.variables.setBoundVariableForPaint(fills[0], "color", targetVar);
node.fills = fills;
return "Rebound to " + targetVar.name;
'

# Bind typography to variables
figma-use eval '
var vars = figma.variables.getLocalVariables();
var fsVar = vars.find(v => v.name === "text/sm/font-size");
var node = figma.getNodeById("TEXT_NODE_ID");
if (fsVar) node.setBoundVariable("fontSize", fsVar);
'
```

## Screen Composition — Component-First

When composing screens, ALWAYS use `<Instance>` for UI elements from the component library. Only use raw `<Frame>` for layout containers.

**Correct:**
```jsx
<Frame w="fill" bg="var:base/background" flex="col" gap={18} p={24}>
  <Instance component="Button" variant="Default" size="lg" />
  <Instance component="Card" />
  <Instance component="Badge" variant="Default" />
</Frame>
```

**Wrong — never do this:**
```jsx
<!-- Raw frames lose all component variants, states, and theme inheritance -->
<Frame bg="var:base/primary" rounded={8} px={16} py={8}>
  <Text>Click me</Text>
</Frame>
```

To find a component's default variant ID:
```bash
figma-use eval --json 'var cs = figma.getNodeById("COMPONENT_SET_ID"); return cs.defaultVariant.id;'
```

## Delta Sync: Web App ↔ Figma

When syncing a design system against a running web app, extract properties from both sides and diff:

### 1. Extract Web CSS (via Chrome CDP)

```bash
# Launch Chrome with debug port
# chrome --remote-debugging-port=9224

# Extract computed styles
agent-browser --cdp 9224 eval '
(() => {
  const el = document.querySelector("[data-slot=\"button\"]");
  const cs = getComputedStyle(el);
  return JSON.stringify({
    borderRadius: cs.borderRadius,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily.split(",")[0].trim(),
    fontWeight: cs.fontWeight,
    textTransform: cs.textTransform,
    height: cs.height,
    padding: cs.padding,
  });
})()'
```

### 2. Extract Figma Properties

```bash
figma-use eval --json '
var cs = figma.getNodeById("COMPONENT_SET_ID");
return cs.children.filter(v => (v.variantProperties || {}).State === "Default").map(v => {
  var t = v.findOne(n => n.type === "TEXT");
  return {
    name: Object.values(v.variantProperties || {}).join("/"),
    radius: v.cornerRadius,
    font: t ? t.fontName.family + " " + t.fontSize : "no text",
  };
});
'
```

### 3. Apply Fixes

```bash
# Fix radius across all variants (sync, handles 200+)
figma-use eval '
var cs = figma.getNodeById("COMPONENT_SET_ID");
cs.children.forEach(v => { v.cornerRadius = 8; });
return "Fixed " + cs.children.length + " variants";
'

# Fix font (async — batch ~30 variants per call)
figma-use eval '
await figma.loadFontAsync({ family: "Inter", style: "Medium" });
var cs = figma.getNodeById("COMPONENT_SET_ID");
for (var i = 0; i < Math.min(30, cs.children.length); i++) {
  cs.children[i].findAll(n => n.type === "TEXT").forEach(t => {
    t.fontName = { family: "Inter", style: "Medium" };
    t.fontSize = 14;
  });
}
return "Batch done";
'
```

### 4. Verify

```bash
figma-use eval --json 'return figma.getNodeById("COMPONENT_SET_ID").defaultVariant.id;'
figma-use export png <variant-id> --scale 2 --output /tmp/check.png
open /tmp/check.png
```

## Workflow for Composing Screens

1. Verify connection: `figma-use status`
2. Check existing state: `figma-use page list`, `figma-use variable list`
3. Create/switch to target page: `figma-use page create "Screens"` or `figma-use page switch "Screens"`
4. Write screen JSX as `.figma.tsx` files using `<Instance>` for all UI components
5. Render: `figma-use render ./screens/overview.figma.tsx`
6. Verify: `figma-use export png <nodeId>` to screenshot
7. Iterate: delete with `figma-use node delete <id>`, re-render

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `figma-use status` says not connected | Run `figma-use patch`, restart Figma. Note: `status` may fail even when `eval`/`page list` work — test with `figma-use eval --json 'return figma.currentPage.name'` |
| CDP port not opening after launch | Re-run `figma-use patch` (Figma update may have reverted it) |
| Port 9222 already in use | Kill Chrome's debugging instance |
| Auth lost after restart | Sign back into Figma (expected behavior) |
| `figma-use eval` returns empty | Use `--json` flag; ensure `return` in code |
| `figma.*` is undefined | You're using raw CDP, not `figma-use eval` |
| Async eval times out on many nodes | Batch to ~30 nodes per call (CDP 10s timeout) |
| `figma-use find --type COMPONENT` empty | Use `figma-use eval` with `findAll` instead |
| `Failed to inject RPC` / `loadFontAsync` undefined | Figma switched from webpack to rspack — apply the hotpatch below |

### Hotpatch: Figma 126.6+ rspack migration (figma-use 0.13.3)

Figma 126.6+ replaced `webpackChunk_figma_web_bundler` with `rspackChunk_figma_web_bundler` and changed internal module structure. figma-use 0.13.3 fails with `loadFontAsync` errors because:
1. It looks for `webpackChunk_figma_web_bundler` which no longer exists
2. Its function matcher picks the config factory instead of the actual `defineVm`

Apply this patch to the installed figma-use CLI (`/opt/homebrew/lib/node_modules/figma-use/dist/cli/index.js` or equivalent):

**Change 1** — chunk name (search for `webpackChunk_figma_web_bundler.push`):
```js
// BEFORE:
if (!window.__webpackRequire__) {
    window.webpackChunk_figma_web_bundler.push([

// AFTER:
if (!window.__webpackRequire__) {
    var _chunk = window.webpackChunk_figma_web_bundler || window.rspackChunk_figma_web_bundler;
    _chunk.push([
```

**Change 2** — function matcher (search for `apiMode:e,pluginID`):
```js
// BEFORE:
  for (const id in r.m) {
    if (r.m[id].toString().includes('apiMode:e,pluginID')) {
      const hit = Object.values(r(id)).find(
        v => typeof v === 'function' && v.toString().includes('apiMode')
      );

// AFTER:
  for (const id in r.m) {
    const src = r.m[id].toString();
    if (src.includes('apiMode') && src.includes('pluginID') && src.includes('sceneGraph')) {
      const hit = Object.values(r(id)).find(
        v => typeof v === 'function' && v.length === 1 && v.toString().includes('apiMode') && v.toString().includes('sceneGraph')
      );
```

The `v.length === 1` filter ensures we pick the function that takes one config argument (`defineVm({...})`), not the zero-argument config factory. The `sceneGraph` check further narrows the search.

**Why this breaks**: rspack uses different minified parameter names (`apiMode:t,pluginID` vs `apiMode:e,pluginID`), and the module now exports both a config factory (0 args) and the actual defineVm (1 arg). The old matcher found the factory first.

**Verify after patching**:
```bash
figma-use eval --json 'return figma.currentPage.name'
# Should return the current page name
```

Note: `figma-use status` may still report "not connected" due to a separate check, but `eval`, `page list`, `render`, and all other commands work correctly.
