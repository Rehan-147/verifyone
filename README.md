# VerifyOne Monorepo

VerifyOne is the first application in this npm-workspaces monorepo. The Next.js app and its product-specific code, docs, scripts, Prisma schema, local environment files, and local `.data` state live in [`apps/verifyone`](apps/verifyone/README.md). Future products can be added as separate apps without mixing their code into VerifyOne.

## Workspace layout

- `apps/verifyone` — VerifyOne web app and API
- `docker-compose.yml` — shared local Postgres service
- `package.json` / `package-lock.json` — npm workspace root and dependency lockfile

## Run VerifyOne

From the repository root:

```bash
npm install
docker compose up -d db
npm run db:push
npm run dev
```

The app runs at `http://localhost:3000`. Its local environment template is [`apps/verifyone/.env.example`](apps/verifyone/.env.example). Configure local values in `apps/verifyone/.env` or `.env.local`; keep secrets out of Git.

See the [VerifyOne product and development guide](apps/verifyone/README.md) and [deployment guide](apps/verifyone/DEPLOY.md).