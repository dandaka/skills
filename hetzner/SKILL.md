---
name: hetzner
description: Use when managing Hetzner Cloud infrastructure — servers, firewalls, networks, volumes, floating IPs, DNS. Triggers on mentions of Hetzner, VPS management, cloud firewall rules, server provisioning, or IP allowlisting.
---

# Hetzner Cloud API

Manage Hetzner Cloud infrastructure via REST API.

## Authentication

Access via ni-gate:

```bash
ni-gate run HETZNER_API_KEY -- curl -s -H 'Authorization: Bearer $HETZNER_API_KEY' "https://api.hetzner.cloud/v1/servers"
```

**ni-gate rules:** `HETZNER_API_KEY` permitted for `curl` commands to `https://api.hetzner.cloud/*`

**In context-mode environments**, use `ctx_execute` with shell language (direct `curl` via Bash is blocked by hooks).

## API Base

`https://api.hetzner.cloud/v1`

All requests require header: `Authorization: Bearer $HETZNER_API_KEY`

## Quick Reference — Common API Calls

### List servers
```bash
curl -s -H '...' "https://api.hetzner.cloud/v1/servers"
```
Returns: `servers[].{id, name, public_net.ipv4.ip, private_net[].ip}`

### List firewalls
```bash
curl -s -H '...' "https://api.hetzner.cloud/v1/firewalls"
```
Returns: `firewalls[].{id, name, rules[], applied_to[].server.id}`

### Update firewall rules (full replacement)
```bash
curl -s -X POST -H '...' -H 'Content-Type: application/json' \
  "https://api.hetzner.cloud/v1/firewalls/{id}/actions/set_rules" \
  -d '{"rules": [{"direction": "in", "protocol": "tcp", "port": "443", "source_ips": ["0.0.0.0/0", "::/0"]}]}'
```

**Warning:** `set_rules` replaces ALL rules. Always include every rule you want to keep.

### List networks
```bash
curl -s -H '...' "https://api.hetzner.cloud/v1/networks"
```

### Create firewall
```bash
curl -s -X POST -H '...' -H 'Content-Type: application/json' \
  "https://api.hetzner.cloud/v1/firewalls" \
  -d '{"name": "my-firewall", "rules": [...], "apply_to": [{"type": "server", "server": {"id": SERVER_ID}}]}'
```

## Common Patterns

### Restrict a port to specific IPs
1. GET current firewall rules
2. Modify the rules array (keep all existing rules you want to preserve)
3. POST `set_rules` with full replacement array

### Check if port is publicly accessible
```bash
nc -z -w 3 <IP> <PORT> && echo "OPEN" || echo "CLOSED"
```

## Important Notes

- Hetzner auto-scans for open PostgreSQL on port 5432 and sends abuse reports. Use non-standard ports (e.g., 25432 via PgBouncer) for public-facing database access.
- Firewall rules are additive across multiple firewalls applied to the same server.
- Private network traffic is not filtered by Hetzner Cloud Firewalls.
- Always discover current state first (`GET /firewalls`, `GET /servers`) before making changes.
- API docs: https://docs.hetzner.cloud/reference/cloud
