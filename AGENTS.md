# Monorepo agent instructions

Read this workspace overview and the instructions for the app you are changing. VerifyOne lives in `apps/verifyone`; its product context and fail-closed rules are in `apps/verifyone/AGENTS.md` and `apps/verifyone/README.md`.

- Use npm workspaces from the repository root; keep app-specific dependencies and scripts in the app package.
- Do not mix another product into VerifyOne. Add future products under `apps/` and extract genuinely shared code into `packages/` only when at least two apps need it.
- Preserve existing user changes and local state. Do not commit unless asked.