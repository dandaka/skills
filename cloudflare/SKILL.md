---
name: cloudflare
description: Use when managing Cloudflare resources — DNS records, Pages projects, custom domains, Workers. Triggers on mentions of Cloudflare, DNS, Pages deployments, custom domains, or CDN configuration.
---

# Cloudflare API

Manage Cloudflare via REST API using the Accuraten account.

## Authentication

```bash
ni-gate run CLOUDFLARE_ACCURATEN_ACCOUNT_API_KEY -- curl -s -H 'Authorization: Bearer $CLOUDFLARE_ACCURATEN_ACCOUNT_API_KEY' "<url>"
```

**ni-gate rules:** `CLOUDFLARE_ACCURATEN_ACCOUNT_API_KEY` permitted for `curl` commands to `https://api.cloudflare.com/client/*`

## API Endpoints

**Important:** Cloudflare has two API styles. Use the **account-scoped** endpoints:

| Operation | Endpoint |
|-----------|----------|
| Verify token | `GET /client/v4/accounts/{account_id}/tokens/verify` |
| List zones | `GET /client/v4/zones` |
| DNS records | `POST/GET /client/v4/zones/{zone_id}/dns_records` |
| Pages projects | `GET /client/v4/accounts/{account_id}/pages/projects` |
| Pages domains | `POST /client/v4/accounts/{account_id}/pages/projects/{project}/domains` |

**Token verify gotcha:** Do NOT use `/client/v4/user/tokens/verify` — it returns "Invalid API Token" for account-scoped tokens. Use `/client/v4/accounts/{account_id}/tokens/verify` instead.

## Known Accounts & Zones

| Resource | ID |
|----------|-----|
| Accuraten account | `<ACCOUNT_ID>` |
| dandaka.com zone | `<ZONE_ID_DANDAKA>` |
| accuraten.com zone | `<ZONE_ID_ACCURATEN>` |
| method.education zone | `<ZONE_ID_METHOD>` |
| padpad.app zone | `<ZONE_ID_PADPAD>` |

## Common Recipes

### Add custom domain to Pages project

Two steps — create CNAME + register domain:

```bash
# 1. Add CNAME record (proxied)
curl -s -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
  -d '{"type":"CNAME","name":"sub","content":"project.pages.dev","proxied":true}'

# 2. Register domain on Pages project
curl -s -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{project}/domains" \
  -d '{"name":"sub.example.com"}'
```

SSL certificate provisions automatically (Google CA, takes ~1-2 min).

### Deploy to Pages (via wrangler)

```bash
cd packages/landing && bun run build && \
  CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID> \
  wrangler pages deploy dist --project-name=allefree --commit-dirty=true
```

Wrangler uses OAuth (`wrangler login`). If expired: `! wrangler login`

## Pages Projects

| Project | Domain |
|---------|--------|
| allefree | allefree.pages.dev, af.dandaka.com |
| dandaka-com | dandaka-com.pages.dev, dandaka.com, www.dandaka.com |
