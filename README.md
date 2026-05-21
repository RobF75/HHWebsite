# Factree Website (HHWebsite)

Public marketing site for Factree Nursery — served at **website.factree.com.au** (prod) and **website.factree.au** (dev) while we build it out, intended to eventually replace the legacy `factree.com.au` site.

Static React/Vite SPA. Reads live cultivar data from the existing `hh-backend` Cloud Run service via unauthenticated `/api/public/*` endpoints. **No new backend, no new Cloud Run service** — prod is served directly from a GCS bucket via the existing GCP load balancer.

## What it shows

- Dynamic home page with featured cultivars and species categories
- Per-species index pages (`/apples`, `/cherries`, …) generated automatically from any crop type that has at least one cultivar with `show_on_website = TRUE`
- Cultivar detail page (`/cultivar/:id`) with editorial copy, hero image, seasonal calendar chart (derived from public attribute values), spec table, gallery
- About + Contact

## Where the data comes from

| Site needs | Source on hh-backend |
| --- | --- |
| Species nav + counts | `GET /api/public/species` |
| Species listing | `GET /api/public/cultivars?species=<slug>` |
| Cultivar detail | `GET /api/public/cultivars/:id` |
| Hero / gallery images | `GET /api/public/media/:id/file` |

A cultivar is exposed only if its owner has flipped **Publish to website** on the cultivar edit page in `tech.factree.com.au`. Media uses `cultivar_media.visibility = 'public'`; attribute fields use `cultivar_attribute_definitions.visibility_default = 'public'`.

## Local development

```powershell
cd HHWebsite
npm install
cp .env.example .env.local      # then set VITE_API_BASE_URL=http://localhost:3000/api  (or leave blank to use the Vite proxy)
npm run dev                     # http://localhost:5174, proxies /api → http://localhost:3000
```

Make sure local `HHNodeServer` is running on port 3000 with the `20260522-02-cultivar-website-publish.sql` migration applied.

---

## Deployments

Two targets, same model as the other Factree apps.

| Environment | Trigger | Runner | Target | Workflow |
|---|---|---|---|---|
| **Dev** | push to `main` | self-hosted Windows | `C:/node/HHWebsite` + PM2 (vite dev, port 5175) | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) |
| **Production** | manual `workflow_dispatch` (type `deploy` to confirm) | GitHub-hosted Ubuntu | GCS bucket `gs://factree-prod-website` via existing GCP LB + Cloud CDN | [`.github/workflows/deploy-gcs.yml`](.github/workflows/deploy-gcs.yml) |

### Dev (self-hosted Windows + PM2)

The self-hosted runner pulls `main`, runs `npm install` + `npx tsc --noEmit` + `npx eslint .`, then resets `C:/node/HHWebsite` to `origin/main` and restarts PM2.

**One-time dev box setup (do this once on the dev server):**

#### Register the GitHub Actions runner

Each repo gets its own self-hosted runner (RobF75 is on a personal account, so org-level runners aren't available). Run as **Administrator** on the dev box:

```powershell
# 1. Get a one-time registration token from:
#    https://github.com/RobF75/HHWebsite/settings/actions/runners/new
#    (tokens expire after ~1 hour)

# 2. Run the installer (clones the runner into C:\actions-runner-hhwebsite\, registers it, installs the Windows service)
cd C:\HHNode\HHWebsite   # or wherever you've cloned this repo
.\scripts\install-runner.ps1 -Token <PASTE_TOKEN_HERE>

# 3. Verify the runner appears as "Idle":
#    https://github.com/RobF75/HHWebsite/settings/actions/runners
```

To reinstall later, pass `-Reconfigure` to wipe the existing install first. The installer is idempotent.

#### Set up the PM2 deploy target

```powershell
# 1. Clone the repo into the deploy target
cd C:\node
git clone https://github.com/RobF75/HHWebsite.git
cd HHWebsite

# 2. Local-only env file (gitignored, never committed)
copy .env.example .env.local
# Then edit .env.local and set:
#   VITE_API_BASE_URL=https://api.factree.au/api
# (api.factree.au is the dev backend; api.factree.com.au is prod.)

# 3. First install + PM2 register
npm install
pm2 start ecosystem.config.cjs
pm2 save
```

**DNS / reverse proxy:** add `website.factree.au` to your existing dev gateway (the same one fronting `hh3.factree.au` and `api.factree.au`) and proxy it to `http://127.0.0.1:5175`.

After that, every push to `main` triggers `deploy.yml` which restarts the PM2 process.

**Promote to prod:**

```powershell
gh workflow run deploy-gcs.yml --repo RobF75/HHWebsite -f confirm=deploy
gh run watch --repo RobF75/HHWebsite
```

### Production (GCS bucket + existing LB)

```
                 GCP HTTPS Load Balancer  (already exists)
                 ┌───────────────────────────────────────────────┐
host:            │   tech.factree.com.au       → hh-frontend     │  (existing Cloud Run)
                 │   api.factree.com.au        → hh-backend      │  (existing Cloud Run)
                 │   website.factree.com.au    → factree-prod-website (GCS, NEW)
                 └───────────────────────────────────────────────┘
```

Only one new piece of infra: a GCS bucket. The workflow uploads `dist/` to it on every prod deploy.

**One-time GCP setup** (run as a user with project-owner on `factree-prod`):

```bash
PROJECT=factree-prod
BUCKET=factree-prod-website
URL_MAP=hh-lb-url-map        # whatever the existing LB url-map is called

# 1. Create the bucket, make objects publicly readable, configure SPA fallback.
gsutil mb -p "$PROJECT" -l australia-southeast1 -b on "gs://$BUCKET"
gsutil iam ch allUsers:objectViewer "gs://$BUCKET"
gsutil web set -m index.html -e index.html "gs://$BUCKET"

# 2. Register the bucket as a backend on the existing LB.
gcloud compute backend-buckets create factree-website-backend \
  --gcs-bucket-name="$BUCKET" \
  --enable-cdn \
  --project="$PROJECT"

# 3. Add a host rule on the existing url-map for website.factree.com.au.
gcloud compute url-maps add-path-matcher "$URL_MAP" \
  --path-matcher-name=website \
  --default-backend-bucket=factree-website-backend \
  --new-hosts=website.factree.com.au \
  --project="$PROJECT"

# 4. DNS: add A/AAAA record for website.factree.com.au pointing at the LB's
#    public IP (the same IP serving tech.factree.com.au and api.factree.com.au).

# 5. Managed SSL: add website.factree.com.au to the existing managed cert,
#    or create a new managed cert and attach it to the LB's HTTPS proxy.

# 6. Grant the deploy service account write access to the bucket.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:github-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:github-deployer@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/compute.loadBalancerAdmin"   # for CDN invalidation
```

**Required GitHub secrets** (set on RobF75/HHWebsite — same conventions as the other repos):

| Secret | Value |
|---|---|
| `GCP_PROJECT_ID` | `factree-prod` |
| `GCP_REGION` | `australia-southeast1` |
| `GCP_SA_KEY` | Service-account JSON (storage objectAdmin + compute loadBalancerAdmin) |
| `GCS_WEBSITE_BUCKET` | `factree-prod-website` (no `gs://`) |
| `GCS_WEBSITE_URL_MAP` | The existing LB url-map name (e.g. `hh-lb-url-map`). Leave unset for the very first deploy if the LB isn't wired yet — the cache-invalidate step will skip. |
| `BACKEND_URL` | `https://api.factree.com.au` — same secret HHjsFrontEnd uses |

### CORS

The backend's `/api/public/*` router has wide-open CORS (`origin: true`). The prod frontend at `https://website.factree.com.au` can call `https://api.factree.com.au/api/public/*` without touching the `CORS_ORIGIN` secret on the backend.

---

## Roadmap (next iterations)

- Sign-in with `tech.factree.com.au` credentials (reuse JWT flow with a public client)
- Online ordering: cultivar + rootstock + tree-type matrix, volumes, planting window
- Regional pricing and availability driven by `cultivar_programs`
- Sitemap + structured data for SEO once the public domain flips over
