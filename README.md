# MISHU Business Licensing Consultant Portal

A private AI Q&A web app for the MISHU sales team. Consultants sign in with their Microsoft accounts and ask plain-language licensing questions; answers are drawn strictly from the `business_licensing_kb` knowledge base, with citations.

**To deploy, follow `SETUP-GUIDE.md`.** This README is the technical overview.

## How it works

1. **Azure Static Web Apps** hosts the static frontend and a serverless API, and gates the whole site behind **Microsoft Entra (Azure AD)** sign-in, restricted to the MISHU tenant.
2. A consultant's question goes to the `api/ask` function, which **retrieves** the most relevant wiki articles from a bundled snapshot and sends them to the **Claude API** with an instruction to answer only from those sources.
3. The answer (with citations) is returned to the browser. The Claude API key stays server-side.

## Structure

```
portal-app/
├── frontend/index.html          the web UI (single file)
├── api/
│   ├── ask/index.js             the Q&A function: retrieval + Claude call
│   ├── ask/function.json        HTTP trigger config
│   ├── content/articles.json    bundled wiki snapshot (generated)
│   ├── host.json
│   └── package.json
├── scripts/build-content.mjs    regenerates articles.json from wiki markdown
├── content-source/wiki/         committed copy of the wiki (refresh source)
├── staticwebapp.config.json     auth + route protection (Microsoft sign-in)
├── SETUP-GUIDE.md               step-by-step deployment
└── README.md
```

## Configuration (Azure environment variables)

| Setting | Purpose |
|---------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (required) |
| `ANTHROPIC_MODEL` | Model override; defaults to `claude-haiku-4-5-20251001` |
| `AAD_CLIENT_ID` | Entra app registration client ID |
| `AAD_CLIENT_SECRET` | Entra app registration client secret |
| `MAX_ARTICLES` | Articles passed per answer (default 4) |
| `MAX_BODY_CHARS` | Per-article context cap (default 6000) |

## Refreshing content

Copy the latest `KNOWLEDGE/business_licensing_kb/Wiki/*.md` into `content-source/wiki/`, run `node scripts/build-content.mjs`, then commit and push. See SETUP-GUIDE.md.

## Design notes

- **Grounded only:** the system prompt forbids outside knowledge and instructs the model to say when something isn't covered, and never to promise approvals or timelines.
- **Retrieval:** lightweight keyword scoring with a domain synonym layer (e.g. beer→liquor, café→F&B). For a much larger KB, swap in embeddings search (Phase 3).
- **Read-only:** the portal never writes to the knowledge base. Logging new learnings stays in CoWork.
