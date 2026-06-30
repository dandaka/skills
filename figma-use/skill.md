---
name: figma-use
description: >
  Figma automation via the figma-use CLI (by dannote). Use when the user needs to create, modify, or inspect Figma designs programmatically. Triggers on requests to render components in Figma, sync design tokens, query or find nodes, export assets, manage variables/pages, compose screens from component instances, delta-sync web app CSS against Figma properties, or troubleshoot Figma CDP connections. Also triggers on mentions of "figma-use", "figma automation", "figma cli", "render to figma", "figma eval", or "design system sync".
allowed-tools: Bash(figma-use:*), Bash(echo:*), Bash(npx:*)
---

# figma-use — Figma Automation CLI

`figma-use` (by dannote) controls Figma Desktop via Chrome DevTools Protocol. No plugins needed.

**IMPORTANT**: This is NOT `figma-ds-cli` — they are completely different packages. Never install or use `figma-ds-cli`.

## Setup

```bash
npm install -g figma-use
figma-use patch              # patch Figma 126+ to allow CDP (redo after Figma updates)
# Restart Figma after patching
figma-use status             # verify connection
```

If `figma-use status` fails: re-run `figma-use patch`, then fully quit and reopen Figma.

Port note: Chrome must NOT be using port 9222. If Chrome debug is running, figma-use may conflict — kill it or use a different port for Chrome (`--remote-debugging-port=9224`).

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
| `figma-use status` says not connected | Run `figma-use patch`, restart Figma |
| CDP port not opening after launch | Re-run `figma-use patch` (Figma update may have reverted it) |
| Port 9222 already in use | Kill Chrome's debugging instance |
| Auth lost after restart | Sign back into Figma (expected behavior) |
| `figma-use eval` returns empty | Use `--json` flag; ensure `return` in code |
| `figma.*` is undefined | You're using raw CDP, not `figma-use eval` |
| Async eval times out on many nodes | Batch to ~30 nodes per call (CDP 10s timeout) |
| `figma-use find --type COMPONENT` empty | Use `figma-use eval` with `findAll` instead |
