# Validation

Verified in the cloud development environment:

- Frozen install: `npm ci`.
- Production build: `npm run build`.
- Four HTTP integration tests: `npm test`. They cover record CRUD, input validation, account creation/login/logout, persistence across process restart, demo upgrades, account isolation, sharing/revocation, and mutation/security headers.
- Chromium browser flow: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`, with a running app server. Covers creation, editing, export download, anonymous view-only sharing, revocation, deletion, mobile navigation, no viewport overflow, and absence of browser application errors.
- Desktop (1440px) and mobile (390px) screenshots inspected.
- `npm audit`: no known dependency vulnerabilities reported at validation time. This is not a security certification.

## Reproduce browser checks

Start the built application first, then:

```sh
npx playwright install chromium
npm run test:e2e
```

Alternatively, set `CHROMIUM_PATH` to an installed Chromium binary. Set `TEST_BASE_URL` for a different local test server. The test creates isolated demo workspaces, so use a development instance with demos enabled. Screenshots are written to ignored `.playwright/`.

The cloud environment blocks Playwright's browser download host; the installed system Chromium was used successfully instead. No TLS or artifact verification was disabled.

GitHub Actions is configured to run install, API tests, and the build. A local pass does not establish that a hosted workflow has run. Container and public-host deployment status are recorded separately in the delivery report.

## Container limitation

The Docker base image downloaded with digest verification, but container requests to `registry.npmjs.org` failed with `EAI_AGAIN`, including a diagnostic with host networking. The optional Docker build was stopped while waiting for dependency installation. The Dockerfile is provided but its build/run cycle is not validated in this environment. The host Node installation, production build, API tests, and Chromium workflow all passed.
