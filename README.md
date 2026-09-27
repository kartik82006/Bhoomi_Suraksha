# Bhoomi Suraksha

**AI-GIS Hazard Red-Zone & Relocation Platform** — a continuously updated GIS decision-support
system for multi-hazard Red Zone identification, carrying-capacity assessment, and relocation
prioritization.

| | |
|---|---|
| **Event** | Smart India Hackathon 2026 |
| **Problem Statement** | 26191 — Intelligent Identification of Hazard-Based Red Zones, Carrying Capacity Assessment, and Immediate Relocation Needs for Vulnerable Habitations |
| **Organization** | Ministry of Home Affairs — National Disaster Response Force (NDRF), DM Division |
| **Category / Theme** | Software — Disaster Management |
| **Requirement** | An AI-GIS decision-support platform (dynamic mapping + scoring + prioritization) — **not framed as an autonomous agent** |

---

## 1. Project Overview

### The problem

Large parts of India's hill states, coastal belts, and flood plains contain habitations sitting on
terrain that is actively hazardous — unstable slopes, subsiding coastlines, chronic flood pockets,
and cloudburst-prone catchments. Today that risk picture is a **static map redrawn only after the
next disaster**: slow, fragmented across departments, and not refreshed as new satellite, terrain,
and rainfall data arrives. State Disaster Management Authorities need a single, continuously updated
view of **where the danger is**, **how many people are exposed**, **whether nearby land can actually
absorb a relocated population**, and **which habitations must be moved first**.

### What Bhoomi Suraksha does

Bhoomi Suraksha is an AI-driven GIS decision-support platform that gives the Ministry of Home Affairs
and State Disaster Management Authorities **one continuously updated picture of risk**, instead of a
static map.

It continuously fuses satellite and terrain data — slope, rainfall intensity, land use, historic
disaster records — into **multi-hazard Red Zones** covering four hazard types, refreshed as new data
comes in rather than fixed at initial survey time:

- **Landslide** susceptibility
- **Flood** inundation and flood-pocket risk
- **Coastal erosion** / shoreline retreat
- **Cloudburst** / extreme-rainfall catchment risk

Candidate relocation sites are scored for **real carrying capacity** — terrain, land use, water
availability, infrastructure access — so a habitation is never moved from one unsafe or unviable
location to another. Hazard severity, population exposure, and disaster history are then combined
into a **ranked list of immediate, short-term, and medium-term relocation priorities**, surfaced
through a map-based dashboard built for a disaster-management official, not a GIS specialist.

| Tier | Meaning |
|------|---------|
| **Immediate** | Relocation should begin now; hazard + exposure + history all critical |
| **Short-term** | Relocation needed within the planning cycle; high risk but some buffer |
| **Medium-term** | Monitor and plan; elevated risk that could escalate |

### Who it's for

- **NDRF / MHA (DM Division)** — national oversight, cross-state comparison, resource planning.
- **State Disaster Management Authorities** — operational prioritization and relocation decisions
  for habitations within their state; the primary day-to-day users.
- **Public / read-only viewers** — an aggregated Red Zone map with no habitation-level personal data.

### At a Glance

| Layer | Component |
|-------|-----------|
| **Hazard data** | ISRO Bhuvan / NRSC Landslide Atlas, SRTM/Cartosat DEM (via Bhoonidhi), GSI Bhukosh lithology, IMD rainfall data, NDEM historic disaster records. |
| **Scoring engine** | GIS multi-criteria model (AHP weighted overlay, blended with a trained XGBoost susceptibility classifier — see Section 5b) — a proven approach in India for site-suitability problems. |
| **Population layer** | Census/SECC habitation-level data, cross-checked against GHSL population grids so exposure isn't frozen at the 2011 census. |
| **Carrying capacity** | Suitability scoring of candidate relocation sites on slope, land use, water access, and infrastructure distance. |
| **Dashboard** | Map-first web dashboard showing Red Zones, ranked priorities, and suggested viable sites — no GIS expertise needed to read it. |

### What this is — and what it is not

Bhoomi Suraksha is a **GIS decision-support platform**: a deterministic pipeline of data ingestion,
multi-criteria scoring, ranking, and visualization. Human authorities make every relocation decision;
the platform gives them the evidence.

**This is deliberately not an autonomous agent.** There is no planner, no orchestration loop, no
tool-using or self-directed component anywhere in the system. The brief asks for dynamic hazard
modelling and prioritization, so the engineering effort goes into **getting the scoring right**
rather than into a tool-use framework the problem doesn't call for. Any machine-learning model used
(see Phase 2) is a conventional supervised susceptibility classifier that produces one input layer
to the scoring engine — nothing more.

### Impact

- **National scale** — roughly 12.6% of India's land area is landslide-prone and over 40 million
  hectares are flood-prone; this gives every State DM Authority one continuously updated risk picture.
- **Reactive to proactive** — moves relocation ahead of the disaster in exactly the remote Himalayan,
  Northeastern, and Western Ghats habitations NDRF already struggles to reach quickly once disaster
  strikes.
- **Defensible prioritization** — gives states an evidence-based basis to allocate scarce relocation
  budgets, instead of ad hoc sequencing.
- **Reusable nationally** — the same scoring architecture applies to any state or hazard type by
  swapping in local terrain, rainfall, and population layers.

### Why it stands out

- **No GPU or live model serving required** — the core is GIS plus multi-criteria scoring, runnable
  on a laptop CPU; a structurally lower risk profile than an LLM-serving stack that needs a GPU to
  even boot.
- **Built on real, accessible public data** — ISRO Bhuvan, the NRSC Landslide Atlas, open DEM data,
  and Census/SECC records already exist, so there is no hidden data-availability gap to work around.
- **Instantly readable demo** — a live map where clicking a district shows Red Zones and a ranked
  relocation list is an immediate, visual result that needs no technical briefing to understand.
- **Lower, well-trodden build risk** — GIS + AHP/ML scoring is a proven, testable pattern buildable
  in stages, with more predictable risk than a live agent stack.

---

## 2. Tech Stack Options

> **Decided for this repo: backend option (a) Express + TypeScript, frontend option (a) React + Vite +
> TypeScript, MapLibre GL JS for the map** — see Section 7 for the running Phase 0 implementation.
> The options below are kept for reference / rationale; everything downstream (ORM choice, CI config,
> Docker services) follows the Express/React path from here on.

### Backend — pick one

| Option | Stack | Best suited for |
|--------|-------|-----------------|
| **a** | **Express.js + TypeScript + Node.js** | Fastest to stand up; minimal ceremony; good if the team already lives in Node and wants maximum flexibility in structure. |
| **b** | **FastAPI + Python** | Best if the team is strongest in Python and wants the hazard-scoring / ML code and the API in one language (shared NumPy / GeoPandas / rasterio code paths). |
| **c** | **NestJS + TypeScript** | Structured, decorator-based, modular architecture out of the box; best if the team wants enforced conventions and expects the codebase to grow beyond the hackathon. |

### Frontend — pick one

| Option | Stack | Best suited for |
|--------|-------|-----------------|
| **a** | **React + Vite + TypeScript** | Fastest dev server and simplest mental model; best if the team knows React and wants a pure SPA dashboard. |
| **b** | **Next.js + TypeScript** | Best if server-side rendering, routing conventions, and a path to a public-facing site matter; slightly more setup. |
| **c** | **Vue 3 + Nuxt + TypeScript** | Best if the team's existing familiarity is with Vue; Nuxt gives structure and SSR comparable to Next. |

### Mapping / GIS frontend library (independent of the above)

Any of these work with all three frontend options — pick based on familiarity:

- **MapLibre GL JS** (recommended — open source, vector tiles, no API key)
- **Leaflet** (simplest, raster-first)
- **OpenLayers** (most powerful for projections and raster analysis, steeper curve)

---

## 3. Database & Geospatial Layer

### Primary datastore — PostgreSQL + PostGIS

This is a geospatial-heavy system. Hazard Red Zones are polygons, habitations are points,
candidate relocation sites are polygons/points, and almost every core query is spatial
(`ST_Intersects`, `ST_DWithin`, `ST_Area`, zonal overlays, nearest-neighbour to infrastructure).

**PostgreSQL 16+ with the PostGIS 3.4+ extension is the primary recommendation** and the default
assumed throughout this README. Enable `postgis` and `postgis_raster` on the database.

### ORM — depends on the chosen backend

| Backend | ORM / data layer |
|---------|------------------|
| Express + TS / NestJS + TS | **Prisma** (recommended for DX; use `prisma` with the PostGIS types via `Unsupported("geometry")` columns + raw SQL for spatial queries) **or TypeORM** (native `geometry` column support, better if you want spatial queries through the query builder) |
| FastAPI + Python | **SQLAlchemy 2.x + GeoAlchemy2** (first-class `Geometry` columns, integrates with Alembic migrations and Shapely) |

### Optional cache — Redis

**Redis** is an optional layer for caching repeated hazard-score lookups (e.g. the same
district/tile requested by many dashboard users, or precomputed prioritization results). The system
is fully functional without it; add it if load testing shows repeated identical spatial queries
dominating response time.

### Optional — tile server

For serving large hazard layers to the map efficiently, a vector-tile server (`pg_tileserv` or
`martin`) can sit in front of PostGIS. Optional for the hackathon; static GeoJSON is fine at demo
scale.

---

## 4. Authentication & Access Control

### Mechanism

- **JWT-based authentication** with short-lived **access tokens** and longer-lived **refresh
  tokens**. Refresh tokens are rotated on use and stored server-side (in PostgreSQL or Redis) so
  they can be revoked.
- **Password hashing** via **argon2** (preferred) or **bcrypt**. Never store plaintext.
- Standard protections: rate-limiting on the login endpoint, generic error messages on failed auth,
  HTTPS-only in any deployed environment, `HttpOnly` + `Secure` cookies if refresh tokens are
  delivered via cookie.

### Roles

| Role | Scope of access |
|------|-----------------|
| **NDRF / MHA Admin** | Full access — all states, all habitations, all prioritization data, user management, ingestion controls. |
| **State DM Authority Official** | Read access + prioritization actions (mark reviewed, adjust tier with justification, export plans) **scoped to their assigned state only**. Cannot see or act on other states' habitation-level data. |
| **Public / Read-only Viewer** | Aggregated Red Zone view only — hazard polygons and district-level summaries. **No habitation-level records, no personal or population-microdata, no prioritization lists.** |

### Enforcement

- Role and state-scope claims are embedded in the JWT and re-checked server-side on every request
  (never trust the client).
- Row-level scoping: State officials' queries are filtered by `state_code` in a middleware / policy
  layer, not just hidden in the UI.
- All prioritization-changing actions are written to an **audit log** (who, what, when, previous
  value, justification text).

---

## 5. Project Phases

> Phases are sequential but Phases 1–5 (the data & scoring pipeline) and Phases 6–8 (API, schema,
> auth) can be worked in parallel by two sub-teams once Phase 0 is done.

### Phase 0 — Project setup

- **Goal:** A running skeleton for the chosen stack.
- **Deliverable:** Monorepo (or two repos) with `backend/` and `frontend/` scaffolded from the
  chosen options; `.env.example`; Docker Compose file with `postgres` (PostGIS image) service;
  ESLint + Prettier (Node/TS) or Ruff + Black (Python); pre-commit hooks; a `README` for
  contributors; CI stub that lints and builds.

### Phase 1 — Data ingestion pipeline

- **Goal:** Pull the source datasets into a consistent local format the scoring engine can read.
- **Sources:**
  - **ISRO Bhuvan / NRSC Landslide Atlas** — landslide inventory and susceptibility polygons.
  - **SRTM / Cartosat DEM**, pulled via **Bhoonidhi** (ISRO's EO data hub, API available) — elevation,
    from which slope, aspect, curvature, flow accumulation are derived.
  - **GSI Bhukosh** — lithology and geomorphology shapefiles (free, NDSAP-licensed), the actual source
    for the lithology factor in the landslide AHP model.
  - **IMD rainfall data** — gridded daily/sub-daily rainfall, historical normals, extreme-event
    thresholds.
  - **Census / SECC population data** — village/ward-level population, household counts, and
    vulnerability indicators.
  - **GHSL (Global Human Settlement Layer)** — 100m population grid updated through 2030 projections
    (Copernicus/EC, via HDX); blended with Census/SECC so the population layer isn't stuck at the 2011
    census between decennial updates.
  - **NDEM (National Database for Emergency Management)** — ISRO/NDMA's disaster-event geodatabase;
    the concrete source for the disaster-history factor used in Phase 5, rather than an unnamed
    "historic records" placeholder.
  - Note: **CWC** publishes flood forecasts/advisories (ffs.india-water.gov.in) but raw hourly gauge
    data is not distributable — use their public forecast outputs or the NRSC/NDMA flood hazard atlas
    as the flood-model input, not raw gauge feeds.
- **Deliverable:** Idempotent ingestion scripts (one per source) that download/parse and write to a
  canonical local store — rasters as **Cloud-Optimized GeoTIFF** in a `data/raw/` and `data/processed/`
  tree, vectors loaded into PostGIS staging tables. A manifest file recording source, date fetched,
  spatial extent, and CRS (everything normalized to a single projected CRS, e.g. EPSG:7755 or an
  appropriate UTM zone). A `make ingest` target.

### Phase 2 — Hazard scoring engine

- **Goal:** Convert raw layers into per-hazard susceptibility scores over a common analysis grid.
- **Method:**
  - **AHP (Analytic Hierarchy Process) weighted overlay** as the core, deterministic method:
    normalize each factor (slope, rainfall intensity, distance to drainage, lithology, shoreline
    change rate, land cover, etc.) to a common scale, apply expert-derived pairwise-comparison
    weights per hazard, and sum to a 0–100 susceptibility score.
  - **Optional ML susceptibility model** — a conventional supervised classifier (XGBoost, selected
    over Random Forest and Logistic Regression via Stratified 5-Fold CV — see Section 5b) trained
    on the landslide/flood inventory vs. the same factor stack, used to produce an alternative
    susceptibility layer. This is a plain model-inference step producing one raster; it is not an
    agent and adds no autonomy. CPU-only, exported to ONNX (33 KB).
- **Deliverable:** A scored grid (raster) and/or vectorized polygon layer per hazard, plus a
  combined multi-hazard layer; weights and factor definitions stored in a versioned config file so
  runs are reproducible; a `make score` target. Re-running on new rainfall/imagery regenerates the
  layers — this is the "continuously updated" requirement.

### Phase 3 — Population vulnerability layer

- **Goal:** Turn hazard scores into human exposure.
- **Method:** Spatially join Census/SECC population to the habitation geometries, then overlay
  habitations on the multi-hazard score layer (zonal statistics — max and mean hazard score within
  each habitation footprint / buffer). Combine with vulnerability indicators (kutcha housing share,
  elderly/child share, connectivity) into an **exposure score** per habitation.
- **Deliverable:** A `habitation_exposure` table: one row per habitation with hazard scores by type,
  population, vulnerability sub-scores, and a composite exposure score.

### Phase 4 — Carrying capacity module

- **Goal:** Score candidate relocation sites on whether they can actually support a relocated
  population.
- **Method:** For each candidate site polygon, compute deterministic sub-scores:
  - **Slope** — from DEM; steep sites penalized.
  - **Land use / land cover** — buildable vs. forest/agriculture/wetland/protected.
  - **Water access** — distance to perennial water source / groundwater availability.
  - **Infrastructure distance** — proximity to existing roads, health facilities, schools, power.
  - **Own hazard exposure** — a candidate site must itself be outside Red Zones.
  - **Available area vs. required area** — can it hold the population being moved, at a target
    density?
  Combine via a weighted sum (same AHP-style approach) into a **carrying-capacity / suitability
  score** per site.
- **Deliverable:** A `relocation_site` table with per-factor scores and a composite suitability
  score and a capacity estimate (persons supportable).

### Phase 5 — Prioritization engine

- **Goal:** Produce the ranked immediate / short-term / medium-term relocation list.
- **Method:** Deterministic multi-criteria combination per habitation of:
  - **Hazard severity** (from Phase 2),
  - **Exposure** (from Phase 3),
  - **Disaster history** (past events affecting the habitation, weighted by recency and severity).
  Compute a composite priority score, then apply documented threshold rules to assign a tier.
  Attach the best-matching relocation site(s) from Phase 4 to each high-priority habitation.
- **Deliverable:** A `prioritization_result` table / API resource: ranked habitations with tier,
  component scores, contributing factors (for explainability), and suggested relocation site(s).
  Re-runnable whenever upstream layers change.

### Phase 6 — Backend API

- **Goal:** Expose everything over REST.
- **Deliverable:** Documented REST endpoints (OpenAPI/Swagger), e.g.:
  - `GET /api/hazards?bbox=&type=` — hazard polygons / tiles
  - `GET /api/habitations?state=&district=&tier=` — habitations with exposure
  - `GET /api/prioritization?state=&tier=` — ranked relocation results
  - `GET /api/sites?near=&minScore=` — relocation site suitability
  - `POST /api/prioritization/:id/review` — SDMA action (audited)
  - `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
  - `GET /api/summary?level=state|district` — aggregated stats for the public view
  Pagination, bbox filtering, and GeoJSON responses for spatial resources.

### Phase 7 — Database schema & migrations

- **Goal:** A versioned spatial schema.
- **Deliverable:** Migration files (Prisma Migrate / TypeORM migrations / Alembic) creating:
  spatial tables (`hazard_zone`, `habitation`, `habitation_exposure`, `relocation_site`,
  `prioritization_result`, `disaster_event`, `user`, `refresh_token`, `audit_log`); **GiST spatial
  indexes** on all geometry columns; B-tree indexes on `state_code`, `district_code`, `tier`;
  foreign keys; and a **seed script** loading a small real sample (one or two districts) so the app
  is demoable immediately.

### Phase 8 — Authentication & role-based access

- **Goal:** Implement Section 4.
- **Deliverable:** Registration (admin-created users), login with argon2/bcrypt verification, JWT
  issuance, refresh-token rotation + revocation, auth middleware, role guards, state-scoping policy
  layer, audit-log writes on prioritization actions, and tests for each role's allowed/denied
  routes.

### Phase 9 — Frontend dashboard

- **Goal:** The map-based decision-support UI.
- **Deliverable:**
  - Interactive map with toggleable **Red Zone layers** per hazard type and the combined layer,
    with a legend and opacity control.
  - **Ranked relocation list** panel (immediate / short-term / medium-term), each item linking to
    the habitation on the map and showing its component scores and suggested sites.
  - **Filters** by state / district / hazard type / tier.
  - Habitation detail view: exposure breakdown, disaster history, contributing factors.
  - Relocation site view: suitability sub-scores and capacity.
  - Role-aware UI: public viewer sees only aggregated layers and summaries.
  - Export (GeoJSON / CSV / PDF summary) of a filtered prioritization plan.

### Phase 10 — Testing

- **Goal:** Confidence in the scoring logic and the API.
- **Deliverable:**
  - **Unit tests** for scoring: AHP normalization and weighting, zonal statistics, carrying-capacity
    sub-scores, tier-threshold rules — with hand-computed expected values on tiny fixtures.
  - **Integration tests** for the API: each endpoint, auth flows, role/state scoping.
  - **Sample-data validation**: run the full pipeline on a known district and sanity-check outputs
    against published landslide/flood atlas polygons (do the Red Zones land where the atlas says?).
  - CI runs the full suite on every PR.

### Phase 11 — Deployment

- **Goal:** Reproducible deployment on ordinary infrastructure.
- **Deliverable:**
  - **Docker Compose** stack for local/dev: `postgres` (PostGIS), `backend`, `frontend`, optional
    `redis`, optional tile server.
  - **CI/CD via GitHub Actions**: lint → test → build images → push to registry → deploy.
  - **Containerized deployment to any standard CPU cloud VM** (e.g. a 4-vCPU / 8–16 GB instance on
    any provider, or NIC / state data centre infrastructure). Reverse proxy (Caddy/Nginx) for TLS.
  - **No GPU is required anywhere in this stack** — ingestion, AHP overlays, the optional
    tree-based ML susceptibility model, the API, and the frontend all run on CPU. This keeps the
    system deployable on government-standard hardware.

---

## 5a. Stretch Goals — Differentiators

> Not required for the core deliverable, but each of these builds directly on Phases 1–8 rather than
> adding a new subsystem, and each is aimed at a specific thing judges/officials care about: proof the
> scoring works, a visibly interactive demo, and a closed action loop instead of a static map.

| Idea | What it does | Why it matters |
|------|--------------|-----------------|
| **Retrodiction demo** | Run the pipeline on data *as it existed* before a known past disaster (e.g. pre-2023 Joshimath) and show the model would have flagged the habitation as "Immediate" months earlier. | Concrete proof the scoring works on a real, checkable event — not just a plausible-looking map. Highest-impact demo moment. |
| **What-if simulation** | Let an official nudge rainfall intensity or mark a new road/embankment and watch Red Zones and priority tiers recompute live. | Reuses the existing AHP recompute path; turns a static dashboard into something that visibly responds. |
| **Alerting loop** | When a data refresh pushes a habitation into the "Immediate" tier, fire an SMS/email to the assigned SDMA official. | Closes the "continuously updated" story into an actual action, not just a nicer map. |
| **Change / diff view** | Show what moved between this run and the last (new Red Zone, tier upgrade) with a timestamp. | Reuses the audit log from Phase 8; gives officials a sense of trend, not just a snapshot. |
| **Hindi / regional-language toggle** | UI toggle for Hindi and relevant regional languages. | The actual end users are district-level officials, not just English speakers — near-zero build cost, high real-deployment signal. |

---

## 5b. ML Susceptibility Pipeline — Model Calibration & Results

> The optional ML susceptibility layer (Phase 2) has been trained, benchmarked, and exported.
> It serves as a **secondary scoring input** to the AHP overlay — adding data-driven signal
> without replacing the deterministic, auditable scoring path.

### Dataset

| Property | Value |
|----------|-------|
| **Source** | 86 real Uttarakhand hazard zones (`backend/fixtures/raw/uttarakhand/`) |
| **Positive labels** | 23 zones within 10 km of a verified historical disaster event |
| **Negative labels** | 63 zones with no confirmed event nearby |
| **Imbalance ratio** | 1 : 2.7 (handled via `class_weight='balanced'` / `scale_pos_weight`) |
| **Features** | 14 (10 geophysical factors + 4 hazard-type one-hot encodings) |
| **Label strategy** | Spatial join: zone centroid within 10 km of a matching hazard-type event → positive |

### Three-Model Benchmark (Stratified 5-Fold Cross-Validation)

| Metric | Logistic Regression | Random Forest | **XGBoost ★ Winner** |
|--------|---------------------|---------------|----------------------|
| **AUC-ROC** | 0.733 ± 0.176 | 0.786 ± 0.140 | **0.817 ± 0.112** |
| **F1-Macro** | 0.599 ± 0.168 | 0.658 ± 0.200 | **0.720 ± 0.183** |
| **Cohen's κ** | 0.201 ± 0.335 | 0.352 ± 0.369 | **0.462 ± 0.336** |
| **Accuracy** | 69.7% | 74.2% | **75.5%** |
| **Precision** | 39.0% | 50.0% | **60.4%** |
| **Recall** | 42.0% | 55.0% | **68.0%** |

XGBoost was selected as the winner by highest mean AUC-ROC. It dominates all three metrics
that matter for a hazard-screening model: AUC-ROC (discrimination), Recall (don't miss real
hazards), and stability (lowest AUC standard deviation).

### Diagnostic Charts

#### ROC Curves

<p align="center">
  <img src="docs/ml/roc_curves.png" alt="Stratified 5-Fold ROC: LR vs RF vs XGBoost" width="600" />
</p>

#### Confusion Matrices (Aggregated Across 5 Folds)

<p align="center">
  <img src="docs/ml/confusion_matrices.png" alt="Confusion matrices for LR, RF, and XGBoost" width="750" />
</p>

XGBoost catches **16 of 23 positives** (69.6% recall) vs. 13 for RF and 10 for LR. For a hazard
screening system, catching real disaster-prone zones is more important than minimizing false
positives (which go to human review anyway).

#### Feature Importance

<p align="center">
  <img src="docs/ml/feature_importance.png" alt="Feature importance: RF vs XGBoost" width="650" />
</p>

Top features: `distance_to_drainage` (dominant for XGBoost), `elevation`, `slope`, and
`rainfall_intensity` — all physically interpretable and consistent with published Himalayan
landslide/flood susceptibility literature.

### Deployment

| Artifact | Path | Size |
|----------|------|------|
| ONNX model | `models/susceptibility.onnx` | 33.4 KB |
| Metadata | `models/model_meta.json` | feature list, metrics, training timestamp |
| Full report | `models/comparison_report.json` | per-fold metrics for all 3 models |

**Runtime:** CPU-only inference via `onnxruntime-node` in the Express backend — no Python
runtime or GPU required. Enable with `ENABLE_ML_SUSCEPTIBILITY=true` in `.env`.

```bash
# Retrain from scratch
cd ml && pip install -r requirements.txt
python3 train.py --repo-root .. --cv-folds 5

# Enable in backend
echo "ENABLE_ML_SUSCEPTIBILITY=true" >> ../.env
cd ../backend && npm run score
```

---

## 6. Environment Variables & Config

Copy `.env.example` to `.env` and fill in values. Template:

```env
# ── Runtime ────────────────────────────────────────────────
NODE_ENV=development                 # or: ENV=development for FastAPI
BACKEND_PORT=8000
FRONTEND_PORT=5173
CORS_ORIGIN=http://localhost:5173

# ── Database (PostgreSQL + PostGIS) ────────────────────────
DATABASE_URL=postgresql://bhoomi:bhoomi@localhost:5432/bhoomi_suraksha
POSTGIS_ENABLED=true

# ── Cache (optional) ──────────────────────────────────────
REDIS_URL=redis://localhost:6379/0
CACHE_ENABLED=false

# ── Auth ──────────────────────────────────────────────────
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
JWT_ACCESS_TTL=900                   # seconds (15 min)
JWT_REFRESH_TTL=1209600              # seconds (14 days)
PASSWORD_HASH_ALGO=argon2            # or: bcrypt

# ── Data sources (paths and/or API keys) ──────────────────
BHUVAN_API_KEY=                      # ISRO Bhuvan / NRSC services, if used
BHOONIDHI_API_KEY=                   # ISRO EO data hub, for SRTM/Cartosat DEM + imagery pulls
IMD_DATA_PATH=./data/raw/imd         # local path to IMD rainfall grids
DEM_DATA_PATH=./data/raw/dem         # SRTM / Cartosat DEM tiles
LANDSLIDE_ATLAS_PATH=./data/raw/nrsc_landslide_atlas
BHUKOSH_DATA_PATH=./data/raw/bhukosh # GSI lithology / geomorphology shapefiles
CENSUS_DATA_PATH=./data/raw/census   # Census / SECC population data
GHSL_DATA_PATH=./data/raw/ghsl       # Global Human Settlement Layer population grid
NDEM_DATA_PATH=./data/raw/ndem       # NDEM historic disaster-event geodatabase
PROCESSED_DATA_PATH=./data/processed
ANALYSIS_CRS=EPSG:7755               # projected CRS for all analysis

# ── Scoring config ────────────────────────────────────────
AHP_WEIGHTS_FILE=./config/ahp_weights.yaml
ENABLE_ML_SUSCEPTIBILITY=false       # optional tree-based model layer
ANALYSIS_GRID_RES_M=30               # analysis grid cell size in metres

# ── Map / tiles (optional) ────────────────────────────────
TILE_SERVER_URL=http://localhost:7800
BASEMAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

> Secrets in `.env` are for local development only. In deployment, inject them via GitHub Actions
> secrets / the cloud provider's secret store — never commit `.env`.

---

## 7. How to Run Locally

> **Status:** Phases 0–10 are implemented end to end on the chosen stack — **Express + TypeScript**
> (backend), **React + Vite + TypeScript** (frontend), **MapLibre GL JS** (map), **PostgreSQL 16 +
> PostGIS** (via Prisma + raw SQL for spatial queries). Ingestion (Phase 1), AHP hazard scoring
> (Phase 2), population exposure (Phase 3), carrying-capacity/suitability (Phase 4), and prioritization
> (Phase 5) run as real scripts over PostGIS — `ST_DWithin`, `ST_Distance`, and `ST_Area(geography)` —
> against a synthetic fixture dataset (a fictional "Demo District" in Uttarakhand, standing in for the
> real ISRO/IMD/GSI/Census/NDEM sources, which need per-user API credentials this environment doesn't
> have). Auth (Phase 8) is fully DB-backed with refresh-token rotation and revocation. Remaining work:
> real credentialed data sources (swap the fixtures), CI/CD deployment (Phase 11), and a live tile
> server for production scale.

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 16+ with PostGIS** — either `docker compose up -d postgres` (brings up the `postgis/postgis:16-3.4`
  image) or a local Postgres+PostGIS install

### Steps

```bash
# 1. Clone and enter the repo
git clone <repo-url> bhoomi-suraksha
cd bhoomi-suraksha

# 2. Start Postgres+PostGIS
docker compose up -d postgres
# (or point DATABASE_URL in .env at an existing local PostGIS instance)

# 3. Configure environment
cp .env.example .env
# edit .env if your DATABASE_URL / JWT secrets differ from the defaults

# 4. Install backend deps, apply migrations, run the data pipeline
cd backend && npm install
npx prisma migrate deploy   # creates schema + GiST spatial indexes
npm run ingest               # Phase 1 — reads fixtures/raw/, writes data/processed/ + manifest
npm run score                # Phase 2 — AHP weighted overlay -> hazard_zones.severityScore
npm run prioritize            # Phase 3-5 — exposure, site suitability/capacity, ranked tiers
npm run seed:users            # creates the 3 demo users below

# 5. Start the backend (http://localhost:8000, API docs at /api/docs)
npm run dev

# 6. Install and start the frontend (new terminal, http://localhost:5173)
cd ../frontend && npm install
npm run dev
```

Re-running `npm run ingest` is idempotent (skips sources whose fixture hash hasn't changed) — the
"continuously updated" requirement is `ingest && score && prioritize` re-run whenever new data lands.

#### Real-data path (Uttarakhand)

The synthetic Demo District above is the deterministic fixture used by the test suite and CI.
A **real-data pipeline for Uttarakhand** is also included, built from two credentialed public
sources (converted to CSV under `data/raw/`):

- **CWC flood-forecast station network** — 76 real Uttarakhand stations (real name, river, basin,
  lat/long) → real flood hazard zones + landslide/cloudburst zones at NRSC-Atlas hotspots.
- **Census of India 2011 Primary Census Abstract** — real population and demographic vulnerability
  (under-6, SC/ST, literacy) matched to real towns (Joshimath, Srinagar, Rudraprayag, …).
- Real documented disaster events (2013 Kedarnath, 2021 Chamoli, 2023 Joshimath subsidence).

```bash
cd backend
npm run data:build     # (dev-time) rebuild real fixtures from data/raw CSVs — needs python3 + pandas
npm run ingest:real    # ingest the real Uttarakhand fixtures -> data/processed
npm run score
npm run prioritize
```

With this dataset the prioritization engine ranks **Joshimath as "Immediate"**, driven by real
Census population and real disaster history — a concrete, checkable demo. Per-hazard AHP *factor*
scores remain regional proxies pending DEM/IMD/Bhukosh rasters (which need Bhuvan/Bhoonidhi
credentials); geometry, rivers, population, and disaster history are real. Provenance is recorded
per record in the generated fixtures and in `data/processed/manifest.json`.

### Running tests

```bash
cd backend && npm test   # unit tests (scoring math) + integration tests (supertest against the API)
```

Integration tests run against whatever Postgres the pipeline above populated — CI (`.github/workflows/ci.yml`)
spins up a fresh `postgis/postgis` service container and runs the full ingest → score → prioritize →
seed → test sequence on every PR.

### Default demo logins (real DB-backed users, created by `npm run seed:users`)

| Role | Email | Password |
|------|-------|----------|
| NDRF/MHA Admin | `admin@bhoomi.gov.in` | `changeme-admin` |
| State DM Official | `sdma-uk@bhoomi.gov.in` | `changeme-sdma` |
| Public Viewer | `viewer@bhoomi.gov.in` | `changeme-viewer` |

> Change or remove these before any non-local deployment. New users are created via
> `POST /api/auth/register` by an existing admin — there is no public self-registration.

### Verifying it works

1. Open `http://localhost:5173` and log in as the admin.
2. The map should render Red Zone layers, relocation-site polygons, and habitation markers for the
   seeded district; toggling a hazard-layer checkbox or the opacity slider should update the map live.
3. The prioritization panel should list habitations across the three tiers, computed by the real
   scoring pipeline (not hardcoded) — click a habitation for its component-score breakdown, or a site
   polygon for its suitability sub-scores.
4. Log in as the State DM official — only the assigned state's data should be visible, even if you
   edit the `state` query param directly.
5. Log in as the public viewer — only aggregated layers and district summaries, no habitation list.
6. Export CSV / GeoJSON from the prioritization panel to confirm the filtered plan downloads.

---

## Repository Structure

```
bhoomi-suraksha/
├── backend/                     # Express + TypeScript
│   ├── src/
│   │   ├── routes/              # hazards, habitations, sites, prioritization, summary, auth
│   │   ├── middleware/auth.ts   # JWT verification, role guard, state-scope enforcement
│   │   ├── scoring/             # AHP, exposure, carrying-capacity, prioritization math (unit-tested)
│   │   ├── ingest/               # generic ingestion runner + manifest/idempotency
│   │   ├── gis.ts               # bbox + pagination query-param helpers
│   │   └── db.ts                # Prisma client singleton
│   ├── scripts/                 # ingest.ts / score.ts / prioritize.ts / seedUsers.ts (the pipeline)
│   ├── fixtures/raw/            # synthetic Demo District data standing in for real credentialed sources
│   ├── prisma/                  # schema.prisma + migrations (incl. hand-added GiST spatial indexes)
│   └── tests/                   # supertest integration tests (auth flows, role/state scoping)
├── frontend/                    # React + Vite + TypeScript, MapLibre GL JS
│   └── src/
│       ├── components/          # MapView, Filters, PrioritizationPanel, SiteDetail, LoginScreen
│       └── lib/export.ts        # CSV / GeoJSON export of the filtered prioritization plan
├── ml/                          # ML susceptibility pipeline (Python)
│   ├── train.py                 # 3-model benchmark (LR vs RF vs XGBoost), ONNX export
│   ├── extract_features.py      # geospatial feature extraction (Open-Elevation + heuristics)
│   └── requirements.txt         # scikit-learn, xgboost, onnx, matplotlib, etc.
├── models/                      # ML model artifacts (generated by ml/train.py)
│   ├── susceptibility.onnx      # winning XGBoost model (33 KB, CPU inference)
│   ├── model_meta.json          # features, metrics, training timestamp
│   ├── comparison_report.json   # per-fold metrics for all 3 models
│   ├── roc_curves.png           # ROC diagnostic chart
│   ├── confusion_matrices.png   # confusion matrix chart
│   └── feature_importance.png   # RF vs XGBoost feature importance chart
├── docs/ml/                     # ML diagnostic charts (for README rendering)
├── config/
│   └── ahp_weights.yaml         # versioned AHP factor weights per hazard type
├── data/
│   ├── raw/                     # real downloaded source data goes here (gitignored) — not used yet
│   └── processed/               # ingest.ts output + manifest.json (gitignored, regenerated by `npm run ingest`)
├── docker-compose.yml            # Postgres+PostGIS (and optional Redis)
├── Makefile
├── .github/workflows/ci.yml     # fresh PostGIS container -> migrate -> ingest/score/prioritize -> test
├── .env.example
└── README.md
```

---

## License

To be decided by the team (suggest a permissive OSS license given the public-benefit purpose).

---

*Bhoomi Suraksha — evidence for the people who decide, not a decision-maker itself.*
