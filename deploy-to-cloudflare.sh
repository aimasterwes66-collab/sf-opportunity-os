#!/usr/bin/env bash
# SF Opportunity OS — Cloudflare Pages Deploy Script
# Usage: ./deploy-to-cloudflare.sh [project-name] [branch]
# Requires: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars

set -euo pipefail

PROJECT_NAME="${1:-sf-opportunity-os}"
BRANCH="${2:-main}"
CANONICAL_DIR="${HOME}/sf-opportunity-os-clone"

echo "========================================"
echo "  SF OPPORTUNITY OS — CLOUDFLARE PAGES DEPLOY"
echo "========================================"
echo ""
echo "Project:  ${PROJECT_NAME}"
echo "Branch:   ${BRANCH}"
echo "Dir:      ${CANONICAL_DIR}"
echo ""

# Verify canonical directory exists
if [ ! -d "${CANONICAL_DIR}" ]; then
    echo "ERROR: Canonical directory not found: ${CANONICAL_DIR}"
    echo "Expected the repo at ~/sf-opportunity-os-clone/"
    exit 1
fi

cd "${CANONICAL_DIR}"

# Verify required files exist
for f in index.html styles.css app.js data.json; do
    if [ ! -f "$f" ]; then
        echo "ERROR: Missing required file: $f"
        exit 1
    fi
done

echo "[✓] Canonical directory verified"
echo "[✓] Required files present (index.html, styles.css, app.js, data.json)"
echo ""

# Check for Cloudflare credentials
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN is not set."
    echo "Set it with: export CLOUDFLARE_API_TOKEN=your_token_here"
    exit 1
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    echo "ERROR: CLOUDFLARE_ACCOUNT_ID is not set."
    echo "Set it with: export CLOUDFLARE_ACCOUNT_ID=your_account_id_here"
    echo "Find it in the right sidebar of any domain in Cloudflare dashboard."
    exit 1
fi

echo "[✓] Cloudflare credentials found"
echo ""

# Optional: commit any uncommitted changes
git status --short > /dev/null 2>&1 || true
if [ -n "$(git status --short 2>/dev/null || true)" ]; then
    echo "WARNING: Uncommitted changes detected."
    read -rp "Commit and push before deploying? (y/N) " ans
    if [[ "$ans" =~ ^[Yy]$ ]]; then
        git add -A
        git commit -m "Auto-commit before deploy $(date -Iseconds)"
        git push origin "${BRANCH}"
        echo "[✓] Changes pushed"
    else
        echo "Proceeding with uncommitted changes..."
    fi
fi
echo ""

# Run deployment with npx wrangler
echo "Deploying to Cloudflare Pages..."
echo ""

npx wrangler pages deploy . \
    --project-name "${PROJECT_NAME}" \
    --branch "${BRANCH}" \
    --commit-directory "."

echo ""
echo "========================================"
echo "  DEPLOY COMPLETE"
echo "========================================"
echo ""
echo "Project: ${PROJECT_NAME}"
echo "Branch:  ${BRANCH}"
echo ""
echo "Visit your site at:"
echo "  https://${PROJECT_NAME}.pages.dev"
echo ""
echo "If you attached a custom domain, check:"
echo "  Workers & Pages → ${PROJECT_NAME} → Custom domains"
echo ""
