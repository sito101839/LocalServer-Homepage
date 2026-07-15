# LocalServer Homepage

Homepage dashboard configuration for monitoring the home server at `192.168.1.29`.

This project uses [Homepage](https://gethomepage.dev/) with Docker Compose. The default service path on the home server is `/srv/localserver-homepage`.

## What This Starts

- `localserver-homepage`: Homepage UI on `http://192.168.1.29:3000/` and Tailscale hosts such as `http://shito-diginnos-pc.tail81aab6.ts.net:3000/`
- `localserver-homepage-dockerproxy`: read-only Docker socket proxy used by Homepage for container status
- `localserver-homepage-glances`: Glances host metrics API on `http://192.168.1.29:61208/`, used by Homepage for CPU, memory, disk, and network widgets
- `localserver-homepage-gpu-status-api`: internal-only GPU status API backed by `nvidia-smi`
- `localserver-homepage-deepseek-balance-api`: internal-only proxy for DeepSeek API balance shown in Homepage
- `localserver-homepage-openai-cost-api`: internal-only proxy for OpenAI month-to-date organization costs shown in Homepage
- `localserver-homepage-xtcg-runtime-api`: internal-only summary of XTCG worker, queue, active jobs, and batch progress

Web service links follow the route used to open Homepage: a dashboard opened through the LAN IP links to LAN service URLs, while a dashboard opened through a Tailscale IP or MagicDNS name links to that same Tailscale host. Monitoring URLs remain internal and fixed.

Glances uses host networking and a read-only `/sys` mount so it can read host network-interface statistics where supported.
GPU status uses a small internal Node service with NVIDIA GPU access; it is not exposed on a host port.
The root disk widget uses Glances' `/etc/hosts` filesystem entry, which maps to the host `/dev/sdb2` root filesystem without mounting the whole host root into the container.
DeepSeek balance uses the server-side `DEEPSEEK_API_KEY` in `app.env`; do not put this key directly in Homepage YAML config.
OpenAI does not expose a supported prepaid-credit balance endpoint. The OpenAI card therefore shows month-to-date organization costs from the supported Costs API and uses the server-side `OPENAI_ADMIN_KEY` in `app.env`. A regular project API key cannot access this endpoint.
XTCG Runtime uses the private `xtcg-api` container through the existing `xtcg-engine_default` Docker network. The summary API exposes only card-ready runtime state and no host port.

The initial dashboard tracks these existing containers:

- `xtcg-web`
- `xtcg-api`
- `xtcg-worker`
- `rpchat-deepseek`
- `my-server-discord-bot`
- `localserver-homepage`
- `localserver-homepage-dockerproxy`
- `localserver-homepage-glances`
- `localserver-homepage-gpu-status-api`
- `localserver-homepage-deepseek-balance-api`
- `localserver-homepage-openai-cost-api`
- `localserver-homepage-xtcg-runtime-api`

XTCG services are tracked as Docker containers. The old `xtcg-backend.service` and `xtcg-training-worker.service` systemd units are expected to be inactive after Docker migration.

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
HOMEPAGE_ALLOWED_HOSTS=192.168.1.29:3000,localhost:3000,127.0.0.1:3000,100.76.107.23:3000,shito-diginnos-pc:3000,shito-diginnos-pc.tail81aab6.ts.net:3000,desktop-n4jnor6:3000,desktop-n4jnor6.tail81aab6.ts.net:3000
```

The home server currently advertises itself on Tailscale as `shito-diginnos-pc` with IP `100.76.107.23`. `desktop-n4jnor6` is also allowed because it may appear in browser Host headers when accessing through the desktop-side Tailscale path.

`DEEPSEEK_API_KEY` is required only for the internal balance API:

```dotenv
DEEPSEEK_API_KEY=your-deepseek-api-key
```

`OPENAI_ADMIN_KEY` is required only for the internal OpenAI costs API. Create an organization Admin API Key at <https://platform.openai.com/settings/organization/admin-keys>:

```dotenv
OPENAI_ADMIN_KEY=your-openai-admin-api-key
```
