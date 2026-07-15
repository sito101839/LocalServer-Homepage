---
name: localserver-homepage-deploy
description: Deploy, verify, update, or troubleshoot this repository's Homepage dashboard for the user's home server. Use when working in LocalServer-Homepage on docker compose settings, Homepage config files, /srv/localserver-homepage, http://192.168.1.29:3000/, or the deploy/verify scripts.
---

# LocalServer Homepage Deploy

## Overview

Use this skill for project-specific deployment and verification of the gethomepage.dev dashboard in this repository. The production service lives on the home server at `/srv/localserver-homepage` and is accessed at `http://192.168.1.29:3000/` or Tailscale URLs such as `http://shito-diginnos-pc.tail81aab6.ts.net:3000/`.

Before touching the server, also obey the global `home-server-ssh` rules if available, especially the Docker Compose service standard and safety notes.

## Local Files

- Compose file: `compose.yml`
- Compose settings sample: `compose.env.example`
- App env sample: `app.env.example`
- Internal DeepSeek balance API: `balance-api/server.js`
- Internal OpenAI costs API: `openai-cost-api/server.js`
- Internal GPU status API: `gpu-api/server.js`
- Internal XTCG Runtime API: `xtcg-runtime-api/server.js`
- Homepage config: `config/*.yaml`
- Browser-side route-aware service links: `config/custom.js`
- Local verification script: `scripts/verify.sh`
- Deploy script: `scripts/deploy.sh`

Do not commit real `compose.env` or `app.env`. They are generated on the server from the samples on first deploy.

## Validate Locally

Run these before deploying or after editing config:

```bash
bash scripts/verify.sh
python3 -c 'import sys, yaml
for f in sys.argv[1:]:
    yaml.safe_load(open(f, encoding="utf-8"))
    print(f"YAML_OK {f}")' config/settings.yaml config/widgets.yaml config/services.yaml config/bookmarks.yaml config/docker.yaml config/kubernetes.yaml
git diff --check
```

Expected markers:

- `VERIFY_PASS homepage_compose_config`
- `YAML_OK ...` for each config file

## Deploy

Deploy from the repository root:

```bash
bash scripts/deploy.sh
```

Default deploy target:

- SSH host: `shito@192.168.1.29`
- Remote directory: `/srv/localserver-homepage`
- Remote URL: `http://192.168.1.29:3000/`
- Tailscale URL: `http://shito-diginnos-pc.tail81aab6.ts.net:3000/`

Optional overrides:

```bash
REMOTE_HOST=shito@192.168.1.29 REMOTE_DIR=/srv/localserver-homepage REMOTE_URL=http://192.168.1.29:3000/ bash scripts/deploy.sh
```

The deploy script creates `/srv/localserver-homepage` with `sudo` on first deploy, changes ownership to `shito:shito`, backs up current config into `backups/`, syncs `compose.yml` and `config/`, creates missing env files from samples, pulls images, runs `docker compose up -d`, and checks the HTTP endpoint.

This project also starts `localserver-homepage-glances` for host CPU, memory, disk, uptime, and network metrics. It uses host networking plus a read-only `/sys` mount for host interface visibility; only add broader container privileges after explicit user approval.

This project also starts `localserver-homepage-gpu-status-api`, an internal-only Node service that runs `nvidia-smi` with NVIDIA GPU access and exposes sanitized GPU data to Homepage at `http://gpu-status-api:8788/gpu`.

The root disk card intentionally uses `fs:/etc/hosts` because Glances reports that bind-mounted path on the host `/dev/sdb2` filesystem. Prefer this narrow mount-point target over mounting the whole host root into the Glances container.

This project also starts `localserver-homepage-deepseek-balance-api`, an internal-only Node service that reads `DEEPSEEK_API_KEY` from server-side `app.env` and exposes sanitized balance data to Homepage at `http://deepseek-balance-api:8787/balance`. Never put the real DeepSeek API key in Homepage YAML.

This project also starts `localserver-homepage-openai-cost-api`, an internal-only Node service that reads an organization Admin API Key from `OPENAI_ADMIN_KEY` in server-side `app.env` and exposes sanitized month-to-date cost data at `http://openai-cost-api:8790/costs`. OpenAI does not expose a supported prepaid-credit balance endpoint, so label this metric as spend rather than balance. Never put the Admin API Key in Homepage YAML.

This project also starts `localserver-homepage-xtcg-runtime-api`, an internal-only Node service that joins the existing `xtcg-engine_default` Docker network to read `xtcg-api` Runtime Status and expose sanitized card data to Homepage at `http://xtcg-runtime-api:8789/`. The XTCG API remains private and is not given a host port.

## Verify Production

Run these read-only checks after deploy:

```bash
ssh shito@192.168.1.29 docker compose --env-file /srv/localserver-homepage/compose.env -f /srv/localserver-homepage/compose.yml ps
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/ >/dev/null
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:61208/ >/dev/null
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-dockerproxy
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-glances
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-gpu-status-api
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-deepseek-balance-api
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-openai-cost-api
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-xtcg-runtime-api
```

Expected state:

- `localserver-homepage`: `Up`, `healthy`, `0.0.0.0:3000->3000/tcp`
- `localserver-homepage-dockerproxy`: `Up`
- `localserver-homepage-glances`: `Up`, host network, serving on `http://192.168.1.29:61208/`
- `localserver-homepage-gpu-status-api`: `Up`, internal-only, serving on Docker network port `8788`
- `localserver-homepage-deepseek-balance-api`: `Up`, internal-only, serving on Docker network port `8787`
- `localserver-homepage-openai-cost-api`: `Up`, internal-only, serving on Docker network port `8790`
- `localserver-homepage-xtcg-runtime-api`: `Up`, internal-only, serving on Docker network port `8789`
- restart policy for all containers: `unless-stopped`

Verify Homepage config APIs:

```bash
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/services
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/widgets
```

Verify GPU status from inside the Homepage Docker network:

```bash
ssh shito@192.168.1.29 docker exec localserver-homepage node -e "fetch('http://gpu-status-api:8788/gpu').then(async r => { const j = await r.json(); console.log(r.status, j.name, j.utilization_gpu, j.memory_used, j.memory_total, j.temperature); })"
```

Verify Tailscale access from the server without depending on external DNS:

```bash
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 --resolve shito-diginnos-pc.tail81aab6.ts.net:3000:100.76.107.23 http://shito-diginnos-pc.tail81aab6.ts.net:3000/ >/dev/null
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://100.76.107.23:3000/ >/dev/null
```

Verify Docker integration with the path order `<container>/<server>`:

```bash
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage-glances/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage-gpu-status-api/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage-deepseek-balance-api/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage-openai-cost-api/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/xtcg-web/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/xtcg-api/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/xtcg-worker/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/rpchat-deepseek/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/my-server-discord-bot/local-docker
```

Expected status examples:

- `{"status":"running","health":"healthy"}` for `localserver-homepage`
- `{"status":"running"}` or `{"status":"running","health":"..."}` for `localserver-homepage-glances`
- `{"status":"running"}` for `localserver-homepage-gpu-status-api`
- `{"status":"running"}` for `localserver-homepage-deepseek-balance-api`
- `{"status":"running"}` for `localserver-homepage-openai-cost-api`
- `{"status":"running","health":"healthy"}` for `xtcg-web`
- `{"status":"running","health":"healthy"}` for `xtcg-api`
- `{"status":"running","health":"healthy"}` for `xtcg-worker`
- `{"status":"running","health":"healthy"}` for `rpchat-deepseek`
- `{"status":"running"}` for `my-server-discord-bot`

Verify DeepSeek balance API from inside the Homepage Docker network without printing secrets:

```bash
ssh shito@192.168.1.29 docker exec localserver-homepage node -e "fetch('http://deepseek-balance-api:8787/balance').then(async r => { const j = await r.json(); console.log(r.status, j.service, j.currency, j.is_available); })"
```

Verify OpenAI month-to-date costs from inside the Homepage Docker network without printing secrets:

```bash
ssh shito@192.168.1.29 docker exec localserver-homepage node -e "fetch('http://openai-cost-api:8790/costs').then(async r => { const j = await r.json(); console.log(r.status, j.service, j.currency, j.period, j.is_available); })"
```

Verify XTCG Runtime data from inside the Homepage Docker network:

```bash
ssh shito@192.168.1.29 docker exec localserver-homepage node -e "fetch('http://xtcg-runtime-api:8789/runtime').then(async r => { const j = await r.json(); console.log(r.status, j.status, j.worker_label, j.queue_label); })"
ssh shito@192.168.1.29 docker exec localserver-homepage node -e "fetch('http://xtcg-runtime-api:8789/current-work').then(async r => { const j = await r.json(); console.log(r.status, j.work_label, j.current_label, j.batch_label); })"
```

## Troubleshooting

Check logs:

```bash
ssh shito@192.168.1.29 docker compose --env-file /srv/localserver-homepage/compose.env -f /srv/localserver-homepage/compose.yml logs --tail=100
```

If `HOMEPAGE_ALLOWED_HOSTS` errors appear, edit server-side `/srv/localserver-homepage/app.env` so it includes the exact browser host and port, then redeploy or restart. Current known allowed hosts should include `192.168.1.29:3000`, `100.76.107.23:3000`, `shito-diginnos-pc:3000`, `shito-diginnos-pc.tail81aab6.ts.net:3000`, `desktop-n4jnor6:3000`, and `desktop-n4jnor6.tail81aab6.ts.net:3000`.

If a Docker status API returns 500, first confirm the URL order is `/api/docker/status/<container>/<server>`. The inverse order can log `Cannot read properties of null (reading 'conn')`.

XTCG is expected to run from `/srv/xtcg-engine` as Docker containers `xtcg-web`, `xtcg-api`, and `xtcg-worker`; the old `xtcg-backend.service` and `xtcg-training-worker.service` units should normally be inactive after migration. Existing services `rpchat-deepseek` on `8001` and `my-server-discord-bot` should not be modified by this project deploy.
