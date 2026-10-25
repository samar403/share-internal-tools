# Deployment

Parcel is ready to run as a single Node process with persistent local storage. Publishing code to GitHub does not deploy a live service.

## Container

```sh
docker build -t parcel .
docker run --rm -p 3000:3000 -v parcel-data:/app/data parcel
```

For a public installation, terminate HTTPS at a trusted reverse proxy and set `COOKIE_SECURE=1`. Set `TRUST_PROXY=1` only when exactly one trusted proxy sits in front of the process. Set `DEMO_ENABLED=0` if anonymous demo creation is inappropriate. The health endpoint is `/api/health`.

Mount persistent storage at `/app/data`. SQLite suits a single application instance on local disk; do not run multiple independent replicas against copied volumes or a network filesystem. Set up database backups using SQLite's online backup tooling or a stopped-process copy of the database and WAL state. Test restoration before storing important data. Deployment and backup automation are operator responsibilities in this release.

## Hosting checklist

- Build with `npm ci && npm run build`; run `npm start` on Node 24.
- Provide a persistent `DATA_DIR`, HTTPS ingress, and secure cookies.
- Add request limits at the ingress; current auth rate limiting is in-memory and resets on restart.
- Decide registration policy; email verification, password reset, invitation-only access, and organization roles are not yet implemented.
- Establish backups, alerting, and demo/session retention policies. Demo accounts and expired sessions are not automatically removed in this release.
- Check `/api/health`, then validate an account and the create/share/revoke flow.

No hosting account, production domain, TLS endpoint, or external infrastructure has been provisioned by the repository itself.
