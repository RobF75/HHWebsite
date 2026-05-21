#!/usr/bin/env bash
# =============================================================================
# One-time GCP infra setup for the HHWebsite static site.
#
# Creates:
#   - GCS bucket  factree-prod-website  (object-readable by allUsers)
#   - Backend bucket  factree-website-backend  (with Cloud CDN enabled)
#   - URL-map host rule for website.factree.com.au → backend bucket
#   - IAM binding so github-deployer SA can write to the bucket + invalidate CDN
#
# Safe to re-run — every step uses --quiet or pre-checks for existence.
# Run on a machine with gcloud authenticated as a project-owner on factree-prod.
#
#   bash scripts/gcp-setup.sh
# =============================================================================
set -euo pipefail

PROJECT="factree-prod"
REGION="australia-southeast1"
BUCKET="factree-prod-website"
BACKEND_BUCKET="factree-website-backend"
DEPLOY_SA="github-deployer@${PROJECT}.iam.gserviceaccount.com"

# Existing LB url-map name — confirm before running:
#   gcloud compute url-maps list --project="$PROJECT"
URL_MAP="${URL_MAP:-}"   # pass via env: URL_MAP=hh-lb-url-map bash gcp-setup.sh

echo "==> Project: $PROJECT"
echo "==> Region:  $REGION"
echo "==> Bucket:  gs://$BUCKET"

# -----------------------------------------------------------------------------
# 1. Create bucket (idempotent)
# -----------------------------------------------------------------------------
if gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  echo "==> Bucket already exists, skipping create."
else
  echo "==> Creating bucket gs://$BUCKET ..."
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT" \
    --location="$REGION" \
    --uniform-bucket-level-access
fi

# -----------------------------------------------------------------------------
# 2. Public read + SPA fallback (main page + 404 → index.html)
# -----------------------------------------------------------------------------
echo "==> Granting allUsers objectViewer (public read) ..."
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="allUsers" \
  --role="roles/storage.objectViewer" \
  --project="$PROJECT" \
  --quiet

echo "==> Setting website main/404 page to index.html (SPA fallback at bucket level) ..."
gcloud storage buckets update "gs://$BUCKET" \
  --web-main-page-suffix="index.html" \
  --web-error-page="index.html" \
  --project="$PROJECT"

# -----------------------------------------------------------------------------
# 3. Backend bucket with CDN
# -----------------------------------------------------------------------------
if gcloud compute backend-buckets describe "$BACKEND_BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  echo "==> Backend bucket $BACKEND_BUCKET already exists, ensuring CDN is on ..."
  gcloud compute backend-buckets update "$BACKEND_BUCKET" \
    --enable-cdn \
    --project="$PROJECT"
else
  echo "==> Creating backend bucket $BACKEND_BUCKET ..."
  gcloud compute backend-buckets create "$BACKEND_BUCKET" \
    --gcs-bucket-name="$BUCKET" \
    --enable-cdn \
    --project="$PROJECT"
fi

# -----------------------------------------------------------------------------
# 4. IAM for the deploy service account
# -----------------------------------------------------------------------------
echo "==> Granting $DEPLOY_SA storage.objectAdmin on gs://$BUCKET ..."
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/storage.objectAdmin" \
  --project="$PROJECT" \
  --quiet

# -----------------------------------------------------------------------------
# 5. LB host rule — only run if URL_MAP env var is set.
# -----------------------------------------------------------------------------
if [[ -z "$URL_MAP" ]]; then
  echo ""
  echo "==> URL_MAP not set — skipping LB host rule wiring."
  echo "    To add the host rule for website.factree.com.au, re-run:"
  echo "      URL_MAP=<your-url-map-name> bash scripts/gcp-setup.sh"
  echo "    Find your url-map names with:"
  echo "      gcloud compute url-maps list --project=$PROJECT"
  exit 0
fi

echo "==> Adding host rule for website.factree.com.au on url-map $URL_MAP ..."
# Create a dedicated path matcher for the website host so other host rules
# stay independent. add-path-matcher with --new-hosts is idempotent.
gcloud compute url-maps add-path-matcher "$URL_MAP" \
  --path-matcher-name="website-marketing" \
  --default-backend-bucket="$BACKEND_BUCKET" \
  --new-hosts="website.factree.com.au" \
  --project="$PROJECT" \
  --quiet || echo "    (path matcher may already exist — that's fine)"

echo ""
echo "==> Done. Remaining manual steps:"
echo "    1. DNS: add A/AAAA for website.factree.com.au → LB public IP"
echo "    2. Managed SSL: add website.factree.com.au to the existing managed cert"
echo "       (cert needs DNS in place before it provisions)"
echo "    3. Set GitHub secret GCS_WEBSITE_BUCKET=$BUCKET on RobF75/HHWebsite"
echo "    4. Set GitHub secret GCS_WEBSITE_URL_MAP=$URL_MAP on RobF75/HHWebsite"
echo "    5. First prod deploy:"
echo "         gh workflow run deploy-gcs.yml --repo RobF75/HHWebsite -f confirm=deploy"
