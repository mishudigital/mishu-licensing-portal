# Setup guide — Business Licensing Consultant Portal

This guide takes the portal from code to a live, Microsoft-login-gated website. Most of it is one-time clicking. Anything technical is spelled out. Where it says **[IT]**, it's easier with whoever manages your Microsoft 365 / Azure; the rest you can do yourself.

Estimated time: 1–2 hours, mostly waiting for deployments.

---

## What you'll need first

1. A **GitHub account** (free) — github.com. The code lives here; Azure deploys from it.
2. An **Azure account** (free) — azure.microsoft.com/free. A card is required for verification; the tier we use is free, but set a spending alert (Step 7).
3. An **Anthropic Claude API account** with prepaid credit — console.anthropic.com. Create an **API key** and add credit (start with US$10–20). This is the only running cost.
4. **[IT]** Access to your **Microsoft Entra admin centre** (entra.microsoft.com) to register the sign-in and get your Tenant ID.

---

## Step 1 — Put the code on GitHub

1. Create a new **private** repository on GitHub (e.g. `mishu-licensing-portal`).
2. Upload the **contents of this `portal-app` folder** so that `frontend/`, `api/`, `scripts/`, and `staticwebapp.config.json` sit at the **root** of the repository.

(If you're comfortable with git, clone and push. If not, GitHub's "upload files" button in the browser works — drag the folders in.)

---

## Step 2 — Create the Azure Static Web App

1. Go to the Azure portal → **Create a resource** → search **Static Web App** → **Create**.
2. Plan type: **Free**.
3. Sign-in details: connect your **GitHub** account and pick the repo and branch (`main`).
4. Build presets: **Custom**. Set:
   - **App location:** `frontend`
   - **Api location:** `api`
   - **Output location:** *(leave blank)*
5. Click **Create**. Azure adds a deployment workflow to your repo and builds the site. Wait for it to finish (a few minutes), then note your site URL — it looks like `https://<random-name>.azurestaticapps.net`.

At this point the site is live but **not yet gated** — finish Steps 3–5 before sharing it.

---

## Step 3 — [IT] Register the Microsoft sign-in

1. In the **Entra admin centre** → **App registrations** → **New registration**.
2. Name: `MISHU Licensing Portal`.
3. **Supported account types:** *Accounts in this organisational directory only (MISHU only — Single tenant)*. This is what restricts access to MISHU staff.
4. **Redirect URI:** platform **Web**, value:
   `https://<your-site>.azurestaticapps.net/.auth/login/aad/callback`
   (use your real site URL from Step 2).
5. **Register.** From the **Overview** page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
6. → **Certificates & secrets** → **New client secret** → copy the **Value** immediately (you can't see it again).

---

## Step 4 — Tell the app about the sign-in

1. In the repo, open `staticwebapp.config.json` and replace `REPLACE_WITH_MISHU_TENANT_ID` with your **Tenant ID** from Step 3. Commit the change (this triggers a redeploy).
2. In the Azure portal → your Static Web App → **Settings → Environment variables** (Application settings), add:
   - `AAD_CLIENT_ID` = the Application (client) ID
   - `AAD_CLIENT_SECRET` = the client secret value
3. Save.

---

## Step 5 — Add the Claude API key

In the same **Environment variables** screen, add:

- `ANTHROPIC_API_KEY` = your Claude API key from console.anthropic.com
- *(optional)* `ANTHROPIC_MODEL` = `claude-haiku-4-5-20251001` (the cost-efficient default; leave unset to use it)

Save. The key stays server-side and is never exposed to the browser.

---

## Step 6 — (Optional) Restrict to a Sales group

By default, anyone in the MISHU tenant who signs in can use the portal. To limit it to a specific group:

1. **[IT]** Entra → **Enterprise applications** → open `MISHU Licensing Portal` → **Properties** → set **Assignment required?** to **Yes**.
2. → **Users and groups** → **Add** → assign your **Sales** (or Licensing) group.

Now only assigned members can get in.

---

## Step 7 — Set a spending alert (do this)

- **Anthropic:** in the console, set a monthly spend limit so usage can never exceed your budget. Because credit is prepaid, it stops when exhausted.
- **Azure:** Cost Management → Budgets → create a small budget with an email alert, so you're notified of any unexpected charge (there shouldn't be any on the free tier).

---

## Step 8 — Test

1. Open your site URL in a private browser window.
2. You should be redirected to **Microsoft sign-in**. Sign in with a MISHU account.
3. Ask: *"Café serving beer in Petaling Jaya — what licences, documents and fees?"*
4. You should get a structured, cited answer drawn from the knowledge base.

If sign-in loops or fails, the usual cause is a mismatch between the redirect URI (Step 3) and your real site URL, or the Tenant ID not yet committed (Step 4).

---

## Keeping the content fresh

The portal reads a snapshot of the wiki (`api/content/articles.json`). To refresh it after the knowledge base grows:

1. Copy the latest `KNOWLEDGE/business_licensing_kb/Wiki/*.md` into the repo's `content-source/wiki/` folder.
2. Run `node scripts/build-content.mjs` (regenerates `api/content/articles.json`).
3. Commit and push — the site redeploys automatically.

A weekly refresh is plenty. This can be automated later (a scheduled GitHub Action), and CoWork can help you set that up.

---

## Where the cost sits

- Hosting (Azure Static Web Apps Free), Microsoft sign-in, SSL, and content: **free**.
- **Claude API: the only running cost** — pay-as-you-go from your prepaid credit, capped by you. Typically low for internal team use.

---

## If something breaks

- **Sign-in loop / "need admin approval":** redirect URI mismatch, or the app needs admin consent — [IT] grant consent in the app registration.
- **"Server is not configured with an API key":** `ANTHROPIC_API_KEY` is missing or misspelt in Azure environment variables.
- **"AI service returned an error":** out of Claude credit, or the key is invalid — check the Anthropic console.
- Bring any error text back to CoWork and I can pinpoint it.
