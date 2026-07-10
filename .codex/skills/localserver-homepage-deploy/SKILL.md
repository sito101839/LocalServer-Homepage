---
name: localserver-homepage-deploy
description: Deploy, verify, update, or troubleshoot this repository's Homepage dashboard for the user's home server. Use when working in LocalServer-Homepage on docker compose settings, Homepage config files, /srv/localserver-homepage, http://192.168.1.29:3000/, or the deploy/verify scripts.
---

# LocalServer Homepage Deploy

## Overview

Use this skill for project-specific deployment and verification of the gethomepage.dev dashboard in this repository. The production service lives on the home server at `/srv/localserver-homepage` and is accessed at `http://192.168.1.29:3000/`.

Before touching the server, also obey the global `home-server-ssh` rules if available, especially the Docker Compose service standard and safety notes.

## Local Files

- Compose file: `compose.yml`
- Compose settings sample: `compose.env.example`
- App env sample: `app.env.example`
- Homepage config: `config/*.yaml`
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

Optional overrides:

```bash
REMOTE_HOST=shito@192.168.1.29 REMOTE_DIR=/srv/localserver-homepage REMOTE_URL=http://192.168.1.29:3000/ bash scripts/deploy.sh
```

The deploy script creates `/srv/localserver-homepage` with `sudo` on first deploy, changes ownership to `shito:shito`, backs up current config into `backups/`, syncs `compose.yml` and `config/`, creates missing env files from samples, pulls images, runs `docker compose up -d`, and checks the HTTP endpoint.

This project also starts `localserver-homepage-glances` for host CPU, memory, disk, uptime, and network metrics. It uses host networking plus a read-only `/sys` mount for host interface visibility; only add broader container privileges after explicit user approval.

The root disk card intentionally uses `fs:/etc/hosts` because Glances reports that bind-mounted path on the host `/dev/sdb2` filesystem. Prefer this narrow mount-point target over mounting the whole host root into the Glances container.

## Verify Production

Run these read-only checks after deploy:

```bash
ssh shito@192.168.1.29 docker compose --env-file /srv/localserver-homepage/compose.env -f /srv/localserver-homepage/compose.yml ps
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/ >/dev/null
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:61208/ >/dev/null
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-dockerproxy
ssh shito@192.168.1.29 docker inspect --format={{.HostConfig.RestartPolicy.Name}} localserver-homepage-glances
```

Expected state:

- `localserver-homepage`: `Up`, `healthy`, `0.0.0.0:3000->3000/tcp`
- `localserver-homepage-dockerproxy`: `Up`
- `localserver-homepage-glances`: `Up`, host network, serving on `http://192.168.1.29:61208/`
- restart policy for all three containers: `unless-stopped`

Verify Homepage config APIs:

```bash
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/services
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/widgets
```

Verify Docker integration with the path order `<container>/<server>`:

```bash
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/localserver-homepage-glances/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/rpchat-deepseek/local-docker
ssh shito@192.168.1.29 curl --fail --silent --show-error --max-time 10 http://192.168.1.29:3000/api/docker/status/my-server-discord-bot/local-docker
```

Expected status examples:

- `{"status":"running","health":"healthy"}` for `localserver-homepage`
- `{"status":"running"}` or `{"status":"running","health":"..."}` for `localserver-homepage-glances`
- `{"status":"running","health":"healthy"}` for `rpchat-deepseek`
- `{"status":"running"}` for `my-server-discord-bot`

## Troubleshooting

Check logs:

```bash
ssh shito@192.168.1.29 docker compose --env-file /srv/localserver-homepage/compose.env -f /srv/localserver-homepage/compose.yml logs --tail=100
```

If `HOMEPAGE_ALLOWED_HOSTS` errors appear, edit server-side `/srv/localserver-homepage/app.env` so it includes the exact browser host and port, then redeploy or restart.

If a Docker status API returns 500, first confirm the URL order is `/api/docker/status/<container>/<server>`. The inverse order can log `Cannot read properties of null (reading 'conn')`.

Do not stop or reuse port `8000`; it is reserved for `xtcg-backend.service`. Existing services `rpchat-deepseek` on `8001` and `my-server-discord-bot` should not be modified by this project deploy.
