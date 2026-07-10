# LocalServer Homepage

Homepage dashboard configuration for monitoring the home server at `192.168.1.29`.

This project uses [Homepage](https://gethomepage.dev/) with Docker Compose. The default service path on the home server is `/srv/localserver-homepage`.

## What This Starts

- `localserver-homepage`: Homepage UI on `http://192.168.1.29:3000/`
- `localserver-homepage-dockerproxy`: read-only Docker socket proxy used by Homepage for container status
- `localserver-homepage-glances`: Glances host metrics API on `http://192.168.1.29:61208/`, used by Homepage for CPU, memory, disk, and network widgets

Glances uses host networking and a read-only `/sys` mount so it can read host network-interface statistics where supported.
The root disk widget uses Glances' `/etc/hosts` filesystem entry, which maps to the host `/dev/sdb2` root filesystem without mounting the whole host root into the container.

The initial dashboard tracks these existing containers:

- `rpchat-deepseek`
- `my-server-discord-bot`
- `localserver-homepage`
- `localserver-homepage-dockerproxy`
- `localserver-homepage-glances`

Systemd services such as `xtcg-backend.service` and `xtcg-training-worker.service` are listed as reference cards only. Add a dedicated exporter or service health endpoint before treating them as monitored.

## Local Check

```bash
bash scripts/verify.sh
```

For a local run, create real env files from the samples:

```bash
cp compose.env.example compose.env
cp app.env.example app.env
docker compose --env-file compose.env -f compose.yml up -d
```

## Deploy To Home Server

The deployment script follows the home-server service standard:

- service directory: `/srv/localserver-homepage`
- compose settings: `compose.env`
- app settings: `app.env`
- backups: `/srv/localserver-homepage/backups`
- restart policy: `unless-stopped`

Run:

```bash
bash scripts/deploy.sh
```

Project-specific Codex deployment guidance lives in `.codex/skills/localserver-homepage-deploy/SKILL.md`.

Optional overrides:

```bash
REMOTE_HOST=shito@192.168.1.29 REMOTE_DIR=/srv/localserver-homepage REMOTE_URL=http://192.168.1.29:3000/ bash scripts/deploy.sh
```

After deployment:

```bash
ssh shito@192.168.1.29 'cd /srv/localserver-homepage && docker compose --env-file compose.env -f compose.yml ps'
ssh shito@192.168.1.29 'cd /srv/localserver-homepage && docker compose --env-file compose.env -f compose.yml logs --tail=100'
```

## Runtime Settings

Do not commit real `compose.env` or `app.env` files. Edit the server-side files when local ports, bind addresses, or allowed hosts need to change.

`HOMEPAGE_ALLOWED_HOSTS` must include the exact host and port used in the browser, for example:

```dotenv
HOMEPAGE_ALLOWED_HOSTS=192.168.1.29:3000,localhost:3000,127.0.0.1:3000
```
