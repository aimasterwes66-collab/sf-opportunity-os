SF OPPORTUNITY OS — CLOUDFLARE PAGES DEPLOY GUIDE
=================================================

OVERVIEW
--------
This guide covers deploying the SF Opportunity OS static site to Cloudflare Pages.

CANONICAL REPOSITORY
--------------------
Local canonical directory: ~/sf-opportunity-os-clone/
Remote:                https://github.com/aimasterwes66-collab/sf-opportunity-os

The ~/sf-opportunity-os/ directory is an older copy (v2.1, 78 opportunities).
The ~/sf-opportunity-os-clone/ directory is the current repo (v2.2, 185 opportunities).
Always use the clone directory for deployments.

FILES IN REPO
-------------
- index.html    (main page)
- styles.css    (styling)
- app.js        (vanilla JS app logic)
- data.json     (opportunity dataset)
- README.md     (repo docs)
- deploy-to-cloudflare.sh  (deploy script)

OPTION A — GIT CONNECT (RECOMMENDED)
------------------------------------
Best for teams, CI/CD, and automatic deploys on push.

1. Ensure changes are committed and pushed:
   cd ~/sf-opportunity-os-clone
   git add -A
   git commit -m "your changes"
   git push origin main

2. In the Cloudflare Dashboard:
   a) Go to Workers & Pages → Create a project → Pages → Connect to Git
   b) Select GitHub → authorize → choose: aimasterwes66-collab/sf-opportunity-os
   c) Framework preset: None (static site)
   d) Build command: (leave empty)
   e) Build output directory: /
   f) Click "Save and Deploy"

3. Cloudflare will build and deploy automatically. Future git pushes will auto-deploy.

OPTION B — DIRECT UPLOAD (QUICK)
--------------------------------
Best for one-off deploys without CI/CD.

1. In the Cloudflare Dashboard:
   a) Go to Workers & Pages → Create a project → Pages → Direct upload
   b) Drag and drop the ENTIRE contents of ~/sf-opportunity-os-clone/ (not the folder itself)
   c) Name the project (e.g., sf-opportunity-os)
   d) Deploy

OPTION C — WRANGLER CLI (ADVANCED)
----------------------------------
Best for terminal-first workflows and scripted deploys.

PREREQUISITES:
- Node.js & npm installed (verified: v26.3.1 / 11.17.0)
- Cloudflare API Token with "Cloudflare Pages:Edit" permission
- Account ID from Cloudflare dashboard

SETUP:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with these permissions:
   - Zone:Read (for any zone)
   - Account:Cloudflare Pages:Edit (for your account)
3. Copy the token and export it:
   export CLOUDFLARE_API_TOKEN="your-token-here"
4. Find your Account ID on the right side of any domain overview page in Cloudflare:
   export CLOUDFLARE_ACCOUNT_ID="your-account-id"

DEPLOY:
   cd ~/sf-opportunity-os-clone
   ./deploy-to-cloudflare.sh

Or manually:
   npx wrangler pages deploy . --project-name sf-opportunity-os --branch main

NOTE: If the project does not exist yet, Wrangler will auto-create it.

POST-DEPLOY CHECKLIST
---------------------
- [ ] Visit the assigned *.pages.dev URL
- [ ] Verify search, filters, calendar, tracker all work
- [ ] Check data.json loads (open DevTools → Network → data.json)
- [ ] If using custom domain, add it in Pages settings

TROUBLESHOOTING
---------------
- "Project not found" with Wrangler: the project may need to be created manually
  in the dashboard first, or you may need to pass --project-name correctly.
- Old data showing: clear Cloudflare cache (Purge Cache in dashboard) or
  append ?v=2 to the URL.
- Build fails: this is a static site — there should be NO build command set.
