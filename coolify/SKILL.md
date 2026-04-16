---
name: coolify
description: Use when managing Coolify deployments — creating services, databases, applications, managing environment variables, checking deployment status. Triggers on mentions of Coolify, Docker Compose deployments on VPS, self-hosted PaaS, or managing services on Hetzner servers.
---

# Coolify API

Manage self-hosted Coolify instance via REST API. Coolify is a self-hosted PaaS for deploying Docker containers, databases, and services.

## Authentication

Access via ni-gate:

```bash
ni-gate run COOLIFY_API_KEY -- curl -s -H 'Authorization: Bearer $COOLIFY_API_KEY' "https://app.coolify.io/api/v1/servers"
```

**ni-gate rules:** `COOLIFY_API_KEY` permitted for `curl` commands to `https://app.coolify.io/api/*`

**In context-mode environments**, use `ctx_execute` with shell language (direct `curl` via Bash is blocked by hooks).

## API Base

`https://app.coolify.io/api/v1`

All requests require header: `Authorization: Bearer $COOLIFY_API_KEY`

## Quick Reference — Common API Calls

### List servers
```bash
curl -s -H '...' "https://app.coolify.io/api/v1/servers"
```
Returns: `[].{uuid, name, ip}`

### List server resources
```bash
curl -s -H '...' "https://app.coolify.io/api/v1/servers/{server_uuid}/resources"
```
Returns: `[].{type, uuid, name, status}`

### List projects
```bash
curl -s -H '...' "https://app.coolify.io/api/v1/projects"
```
Returns: `[].{uuid, name, environments[]}`

### List services
```bash
curl -s -H '...' "https://app.coolify.io/api/v1/services"
```

### Get database details
```bash
curl -s -H '...' "https://app.coolify.io/api/v1/databases/{uuid}"
```
Returns: `{name, environment_id, destination_id, ports_mappings, internal_db_url}`

## Creating a Docker Compose Service

The `docker_compose_raw` field must be **base64 encoded**.

```bash
COMPOSE_B64=$(base64 <<'YAML'
services:
  myservice:
    image: myimage:latest
    restart: always
    ports:
      - "8080:80"
    environment:
      - MY_VAR=${MY_VAR}
    networks:
      - coolify
networks:
  coolify:
    external: true
YAML
)

curl -s -X POST -H '...' -H 'Content-Type: application/json' \
  "https://app.coolify.io/api/v1/services" \
  -d "{
    \"name\": \"my-service\",
    \"project_uuid\": \"PROJECT_UUID\",
    \"server_uuid\": \"SERVER_UUID\",
    \"environment_name\": \"production\",
    \"docker_compose_raw\": \"$COMPOSE_B64\"
  }"
```

**Important:** Do NOT pass `"type": "docker-compose"` together with `docker_compose_raw` — use one or the other.

## Managing Environment Variables

### List env vars
```bash
curl -s -H '...' "https://app.coolify.io/api/v1/services/{uuid}/envs"
```

### Set/update env var
```bash
curl -s -X PATCH -H '...' -H 'Content-Type: application/json' \
  "https://app.coolify.io/api/v1/services/{uuid}/envs" \
  -d '{"key": "DB_HOST", "value": "my-db-container"}'
```

Env vars defined in docker-compose as `${VAR}` are auto-created with empty values. Update them via PATCH before starting.

## Service Lifecycle

### Start
```bash
curl -s -X POST -H '...' "https://app.coolify.io/api/v1/services/{uuid}/start"
```

### Stop
```bash
curl -s -X POST -H '...' "https://app.coolify.io/api/v1/services/{uuid}/stop"
```

### Restart
```bash
curl -s -X POST -H '...' "https://app.coolify.io/api/v1/services/{uuid}/restart"
```

### Update service config
```bash
curl -s -X PATCH -H '...' -H 'Content-Type: application/json' \
  "https://app.coolify.io/api/v1/services/{uuid}" \
  -d '{"connect_to_docker_network": true}'
```

## Networking

- Coolify containers run on a Docker network named `coolify`
- Containers can reach each other by their Coolify UUID as hostname (e.g., `b4gcoog...` is a valid Docker hostname)
- To join the coolify network from a custom service, add in docker-compose:
  ```yaml
  networks:
    - coolify
  networks:
    coolify:
      external: true
  ```
- `connect_to_docker_network: true` on the service also enables this
- Database `internal_db_url` uses the container UUID as hostname

## Common Patterns

### Deploy PgBouncer alongside PostgreSQL
1. Create service with docker-compose (base64 encoded)
2. Join `coolify` network to reach DB by container UUID
3. Set `DB_HOST` to the PostgreSQL container's UUID
4. Expose on non-standard port (e.g., 25432) to avoid Hetzner abuse scans on 5432

### Check container logs (via SSH, not API)
```bash
ssh root@<SERVER_IP> "docker logs <CONTAINER_NAME> 2>&1 | tail -20"
```
Container names follow pattern: `{service}-{coolify_uuid}`

## Important Notes

- Service start/stop/restart are async — responses say "queued", check status after a delay
- Deployments for services don't appear in `/api/v1/deployments` (that's for applications only)
- If a service shows `exited` immediately, check container logs via SSH
- Coolify manages container lifecycle — prefer Coolify API over manual `docker run` for persistence across reboots
- The Coolify UI is available on port 8000 of the server running Coolify
