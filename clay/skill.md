---
name: clay
description: Use Clay for lead enrichment, prospecting, and GTM workflows. Use when finding leads, enriching companies or people, pushing data to Clay tables, or running outreach workflows. Clay is the primary enrichment platform for bracos.
metadata:
  author: dandaka
  version: "1.2"
allowed-tools: Bash(infisical*), Bash(agent-browser*), Bash(curl*), Bash(sleep*), Read, Write, Edit
---

# Clay Skill

Clay is the enrichment and GTM automation platform for bracos.

## How to use Clay (choose based on task)

| Approach | When | Env |
|----------|------|-----|
| **MCP (this session)** | Small batches, lookups, research (≤20 results) | Claude.ai web only |
| **Webhooks** | Push data into a table for bulk enrichment | Any (remote OK) |
| **Browser automation** | Create tables, export, configure workflows | Local only |

---

## 1. Clay MCP — use it directly in conversation

Clay is connected to this Claude.ai account. **Just ask naturally** — no special syntax needed. Clay is invoked automatically based on context.

### What MCP can do

**Find people at a company**
```
Find property managers at imovirtual.pt
Find cleaning company owners in Lisbon, Portugal
Find operations managers at real estate agencies in Porto
Find VP-level contacts at airbnb.com who work in Portugal
```

**Enrich a contact** (returns: email, phone, LinkedIn, work history, thought leadership)
```
Find the email and LinkedIn for João Silva at limpezaslisboa.pt
Enrich the top 3 results with verified email and work history
```

**Company research** (returns: hiring trends, funding, tech stack, headcount, recent news)
```
Research oscar.pt — what are they building, who are their key hires?
Compare hiring trends at fixando.pt and zaask.pt
What is fixando.pt's revenue model and headcount?
```

**Meeting prep / contact brief**
```
I have a call with Ana Pereira at cleaningco.pt tomorrow. Give me a brief with background and 3 talking points.
```

### Key limits for MCP

- Results capped at **20 per search** — designed for targeted batches, not bulk
- **1,000 credits/month** cap per user in MCP
- For >20 results or bulk enrichment, use Clay Tables (webhooks)

### Credit-saving pattern

Search broadly → filter → enrich only what matters:
```
1. Find operations managers at property management companies in Lisbon
2. Filter to decision-makers (manager level and above)
3. Enrich the top 5 with verified email and LinkedIn
```

---

## 2. Webhooks — push data into Clay tables (remote agents)

Every Clay table can expose a webhook. Use this for bulk enrichment from any environment.

**Setup (one-time, in browser):**
Table → Actions → View all sources → Webhook → copy URL

**Push rows:**
```bash
curl -s -X POST "https://api.clay.com/v3/sources/<webhook-id>/events" \
  -H "Content-Type: application/json" \
  -d '{"rows": [{"company": "Acme", "domain": "acme.pt"}, ...]}'
```

Clay enriches each row using pre-configured columns and consumes credits. Use an HTTP action column to push results back out (Postgres, CSV, etc.).

---

## 3. Browser automation — tables, export, configuration

Credentials:
```bash
infisical run --env=dev --path=/bracos -- bash -c '
  echo "Workspace: $CLAY_WORKSPACE_ID"
  echo "Starter table: $CLAY_TABLE_STARTER"
  echo "VC leads table: $CLAY_TABLE_VC_LEADS"
'
```

Chrome Beta on port 9223:
```bash
infisical run --env=dev --path=/bracos -- bash -c '
  SESSION=$(LC_ALL=C tr -dc "a-z0-9" < /dev/urandom | head -c 6)
  agent-browser --cdp 9223 --session "$SESSION" open "https://app.clay.com/workspaces/$CLAY_WORKSPACE_ID/home"
  sleep 3
  agent-browser --cdp 9223 --session "$SESSION" snapshot -i
'
```

**Sculptor (AI table builder):** Sidebar → Sculptor → describe in plain English what you need built.

**Export:** Open table → export button → CSV.

---

## Credit costs (approximate)

| Action | Credits |
|--------|---------|
| Enrich person (LinkedIn + work history) | ~2 |
| Find work email (waterfall) | ~3 |
| Validate email | ~1 |
| Enrich company | ~1–2 |
| MCP search (per search) | ~1–5 |

~400–500 fully enriched contacts per 2,000 credits in tables. MCP has a separate 1,000 credit/month cap.

---

## Priority target for bracos

**Property managers, Airbnb/VRBO hosts, cleaning company owners in Lisbon/Porto** — repeat buyers, high LTV.

Via MCP (quick lookup):
```
Find property management companies in Lisbon, Portugal.
Enrich the top 10 with decision-maker name, verified email, and company size.
```

Via tables (bulk, for full campaign):
1. Find Leads → "Property Manager" OR "Facilities Manager", location: Portugal
2. Enrich person + Find work email waterfall + Validate email
3. Export → outreach campaign
