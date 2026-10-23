# GitHub source checkout

## Imported source

Eduo v21 was imported from source commit `195e51e20dc96355b87c73184387e60c31d4b32b`, published on 18 October 2026. The initial GitHub import is a clean source snapshot. Subsequent features are recorded in this repository and the product release history. Earlier Sites commit history is not migrated. Source files are preserved except the local TypeScript cache; the import adds these setup notes, README instructions and a cache ignore rule.

The repository includes the frontend, server routes, school membership and authorization logic, encrypted storage helpers, D1 schema/migrations, bundled assets/fonts and licences, feature specifications and workflow checks. No school database, user uploads, runtime secrets, local tool state, dependencies or generated application builds are imported.

## Install and run

Use Node.js 22.13 or newer; Node.js 24 is suitable for the SQLite-based checks. Use the package manager version pinned by `package.json` and the committed lockfile:

```sh
npx pnpm@11.25.0 install --frozen-lockfile
npx pnpm@11.25.0 dev
```

Open the local URL printed by the development server (port 5173). A clean clone uses the portable execution profile; it does not need the original workstation's plugin directory.

## Validate and build

```sh
npx pnpm@11.25.0 exec tsc --noEmit --incremental false
node scripts/check-workflows.mjs
npx pnpm@11.25.0 build
```

The v21 release passed 1,599 isolated workflow checks, TypeScript and the production Worker build. These are historical release results, not a claim that GitHub Actions or a fresh machine has already run them. Tests use fictional identities, Node SQLite and an in-memory R2 adapter; they do not send real parent requests or call national systems. Browser/touch and provider integration verification remain pending. See [validation](VALIDATION.md).

## Storage and secrets

The application targets Cloudflare Workers with D1 and R2; a GitHub repository alone does not provide those services. The existing Sites deployment is recorded in `.openai/hosting.json`. Keep that identity when maintaining the same Site; use the Sites workflow for an actual publish.

For database-backed local preview, build and apply the committed migration as described in the main README. Actual deployments need configured D1/R2 bindings and `SCHOOL_ENCRYPTION_KEY` as a server-side secret (64 hexadecimal characters). The optional live tutor also needs server-side `OPENAI_API_KEY` and `OPENAI_MODEL`. `.env.example` contains names and empty values only. Do not commit secrets or production data.

## Authentication

The current implementation uses Sites-provided ChatGPT request identity for saved records and school membership. The public preview uses fictional data. Copying the code to GitHub does not change that identity system or enable independent email, Google or Microsoft sign-in. The requirement for visitors to use Eduo without ChatGPT accounts still needs a supported authentication and deployment design, with existing per-school and per-pupil access rules preserved.

## Development and synchronization

Work on a feature branch and review changes before merging. The live Sites source and this GitHub snapshot are separate remotes; there is no automatic synchronization or deployment. The v22 update explicitly synchronizes its source to both repositories. Future synchronization should be explicit and preserve both repositories' work.
