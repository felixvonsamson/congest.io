# Deploying Flux Control (congest.io)

Production runbook for **https://fluxcontrol.eu**.

> TL;DR — SSH to the box, pull, rebuild the frontend, fix ownership, restart the
> backend, verify. The whole thing is one copy-paste block: see
> [Deploy runbook](#3-deploy-runbook).

---

## 1. What's running where

Everything lives on a **single shared VPS** (`82.165.217.62`) that also hosts the
Energetica game backends. Don't touch the `energetica-*` services.

| Piece | Value |
|---|---|
| SSH alias | `fluxcontrol` (= `root@82.165.217.62`) — see `~/.ssh/config` |
| App directory | `/var/www/congest.io` |
| Git repo | `git@github.com:felixvonsamson/congest.io.git`, branch `main` |
| Owner (all files) | `www-data:www-data` |
| Backend service | `congestio.service` (systemd) |
| Backend process | `uvicorn backend.main:app --reload` on `127.0.0.1:8001` |
| Python venv | `/var/www/congest.io/.venv` |
| Frontend (served) | static build in `frontend/dist/` |
| Reverse proxy | **Apache2** (not nginx — nginx is installed but inactive) |
| Apache vhost | `/etc/apache2/sites-available/congestio.conf` |
| TLS | Let's Encrypt / certbot, `/etc/letsencrypt/live/fluxcontrol.eu/` |
| Database | SQLite `game.db` in the app root — **runtime state, never delete** |
| Node / npm | `v20` / `10` (system-wide) |

### Request flow

```
Browser ──► Apache :443 (fluxcontrol.eu)
              │
              ├─ static files ────────────► /var/www/congest.io/frontend/dist/
              │   (SPA: unknown paths fall back to /index.html)
              │
              └─ ProxyPass ──► uvicorn :8001 ──► backend/main.py (FastAPI)
                  for:  /api/*
                        /privacy
                        /.well-known/apple-app-site-association
```

The frontend calls the backend with **relative** paths (`/api/*`, `/static/*`),
so it always talks to whatever origin served it. No API base URL to configure.

---

## 2. Before you deploy

- **Make sure your change is pushed to `origin/main`.** The server deploys by
  pulling `main` from GitHub — it does not receive your local commits any other way.
- The pull on the server runs **as `root`**, because `www-data` has no GitHub SSH
  key. This is why step 3 (fix ownership) exists and is **not optional**.

---

## 3. Deploy runbook

Copy-paste this whole block after `ssh fluxcontrol`:

```bash
cd /var/www/congest.io

# 1. Pull latest main
git pull --ff-only

# 2. Rebuild the frontend (ONLY needed if frontend/ changed — harmless otherwise)
( cd frontend && npm run build )

# 3. Restore ownership — the root pull/build leaves root-owned files behind
chown -R www-data:www-data /var/www/congest.io

# 4. Restart the backend so it loads the new code
systemctl restart congestio.service

# 5. Confirm the service came back up
systemctl is-active congestio.service
```

### When can you skip steps?

- **Backend-only change** (`backend/*.py`): skip step 2. The service runs with
  `--reload`, so it even auto-reloads on file change — but still run step 4 for a
  clean, predictable restart.
- **Frontend-only change** (`frontend/*`): step 2 is **mandatory**. Apache serves
  the pre-built `frontend/dist/`; editing source without rebuilding changes nothing.
- **When unsure, just run all five steps.** They're all idempotent.

---

## 4. Verify (from your laptop)

```bash
# Homepage
curl -s -o /dev/null -w "home: %{http_code}\n" https://fluxcontrol.eu/

# The served HTML should reference the NEW hashed bundle produced by `npm run build`
curl -s https://fluxcontrol.eu/ | grep -oE 'assets/main-[A-Za-z0-9_-]+\.js'

# API is reachable through the proxy (422 = reached FastAPI, missing body — good)
curl -s -o /dev/null -w "api:  %{http_code}\n" -X POST https://fluxcontrol.eu/api/login

# Privacy page + Apple app-site-association (iOS app wrapper: mglst.Flux-Control)
curl -s -o /dev/null -w "priv: %{http_code}\n" https://fluxcontrol.eu/privacy
curl -s https://fluxcontrol.eu/.well-known/apple-app-site-association; echo
```

To confirm a **specific feature** shipped, hit its endpoint directly — e.g. after
"daily challenge for guests", `curl https://fluxcontrol.eu/api/daily_problem`
should return `200` **without** an auth header.

Server-side check of what's actually deployed:

```bash
ssh fluxcontrol 'cd /var/www/congest.io && git log -1 --oneline && \
  journalctl -u congestio.service -n 15 --no-pager'
```

---

## 5. Rollback

The app is a plain git checkout, so rollback = check out the previous commit and
redo the build/restart:

```bash
ssh fluxcontrol
cd /var/www/congest.io
git log --oneline -5            # find the last-good <sha>
git checkout <sha>             # detached HEAD is fine for a hotfix
( cd frontend && npm run build )
chown -R www-data:www-data /var/www/congest.io
systemctl restart congestio.service
# later, to return to normal tracking: git checkout main
```

`game.db` (player accounts, progress, scores) is untracked and untouched by
`git checkout`, so a rollback does not lose user data.

---

## 6. Gotchas & troubleshooting

- **Ownership drift (the big one).** `git pull` and `npm run build` run as `root`,
  so new/changed files become `root:root`. Always run
  `chown -R www-data:www-data /var/www/congest.io` afterwards, or the service
  (running as `www-data`) may fail to write `game.db` / read updated files.
- **`git pull` fails as `www-data`.** Expected — `www-data` has no GitHub key.
  Pull as `root` (the `fluxcontrol` alias already logs in as root).
- **Frontend change didn't show up.** You forgot `npm run build`, or you built but
  didn't `chown`, or your browser cached the old hashed bundle (hard-refresh).
- **`--reload` in production.** The unit runs uvicorn with `--reload`. It works but
  is not ideal (extra watcher process, higher memory). Leave it unless you're
  deliberately hardening; if you remove it, an explicit `systemctl restart` after
  every deploy becomes strictly required.
- **Runtime state that must survive deploys:** `game.db` and
  `generated_networks/daily/*.json` (one per day). They're gitignored/untracked;
  don't `git clean` them away.
- **Shared VPS.** `systemctl`, Apache reload, and disk are shared with
  `energetica-hertz`, `energetica-lobby`, `energetica-mar-27-2026`, etc. Scope every
  command to `congestio.service` / `congest.io`.
- **Apache, not nginx.** If you go looking for the vhost, it's under
  `/etc/apache2/`. Reload proxy/TLS changes with `systemctl reload apache2`
  (after `apache2ctl configtest`).

---

## 7. Service & proxy reference

Restart / inspect the backend:

```bash
systemctl restart congestio.service
systemctl status  congestio.service
journalctl -u congestio.service -f          # live logs
```

`congestio.service` (`/etc/systemd/system/congestio.service`):

```ini
[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/congest.io/
Environment="PATH=/var/www/congest.io/.venv/bin"
ExecStart=/var/www/congest.io/.venv/bin/uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001
Restart=always
RestartSec=10
```

Apache proxies these paths to `:8001` (see `congestio.conf`); everything else is
served statically from `frontend/dist/` with an SPA fallback to `/index.html`:
`/api`, `/privacy`, `/.well-known/apple-app-site-association`.

If you add a **new top-level backend route** (not under `/api`), you must add a
matching `ProxyPass`/`ProxyPassReverse` pair to `congestio.conf` and
`systemctl reload apache2` — otherwise Apache serves it as a static 404.
