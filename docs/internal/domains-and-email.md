# Domains and email vars (detail)

> Moved out of the public self-hosting docs, where the essential action (set `APP_DOMAINS` and `EMAIL_FROM` in the tenant env block) is all a self-hoster needs. This page keeps the finer nuance for maintainers.

Two per-tenant vars (in the tenant's `[env.*.vars]`, see `api/wrangler.example.toml`) make a deployment domain-agnostic:

- **`APP_DOMAINS`** — comma-separated registrable domains this deployment serves. Drives cross-subdomain CORS and the superadmin SSO cookie scope.
  - Set **one** domain for a normal single-host deployment.
  - **Leave it unset** if you serve a single host or a bare `*.workers.dev` URL — that yields same-origin-only CORS and a host-only login cookie, which is correct for one host.
  - List **two** domains (comma-separated) only while migrating from an old domain to a new one: serving both lets existing sessions keep working (session cookies are host-only, so a redirect would otherwise force re-login). Drop back to one after the cutover.
- **`EMAIL_FROM`** — the full sender address for magic-link and notification email, e.g. `notifications@example.org`. Sending always requires a **verified** domain (a `*.workers.dev` host cannot send), independent of where the app is served. Unset falls back to a default sender address. Optional `EMAIL_REPLY_TO` defaults to `EMAIL_FROM`.

## Bare apex (root Worker)

`root/` is a dependency-free Worker for the host's bare apex (e.g. `floor.vote`). Tenants live on subdomains; this Worker only points people at them and keeps no directory. The apex is whatever hostname the request arrived on.

| Request | Response |
|---|---|
| `SINGLE_TENANT_URL` set, any path | 302 to that URL, same path and query |
| `/<slug>[/rest]`, `https://<slug>.<apex>/api/health` is `{ ok: true }` | 302 to that instance, keeping the rest and query |
| `/<slug>[/rest]`, health check fails or times out (3s) | 302 to `/` |
| `/go?host=<h>`, `h` remembered and on this apex | 302 to `https://<h>/` (otherwise `/`) |
| Any other non-slug path | 404 |
| `/`, 0 / 1 / 2+ remembered instances | Welcome page / 302 to it / picker page |

- **Cookie:** `fv_instances` is written by tenants on the parent domain at login and `/auth/me`, removed on logout, and lives one year. It holds only `{ host, name }` pairs (no secret); the Worker ignores any host that isn't a direct subdomain of its own apex.
- **Tenants must be on Custom Domains** (`custom_domain = true`), not `routes`: the apex's same-zone `/api/health` probe only reaches Custom Domain Workers.
- **`/<slug>`** works for any subdomain serving `/api/health` (e.g. central) and reveals whether a slug exists. That is accepted, since subdomain names are public in certificate-transparency logs.
- **`go` is reserved** as a slug: `/go` is the picker endpoint.
- **`SINGLE_TENANT_URL`** uses its origin only; any path in it is ignored.
- **Tenants need `APP_DOMAINS` set to the apex**, or they never write the cookie.
- **Deploy:** copy `root/wrangler.example.toml` to `root/wrangler.toml` (gitignored), set the domain, then `npx wrangler deploy -c root/wrangler.toml`.
