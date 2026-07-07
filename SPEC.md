# spicy Kunstraum — Feedback Tool

**Technical Specification & Implementation Brief**

---

## 1. Project Overview

This document specifies a feedback collection tool for **spicy Kunstraum**, a small independent contemporary-art space located in the historic gardener's house in the park of Villa Schnell, Burgdorf. spicy is a project of the **c.A.R.T.** association, curated by Simon Kübli and Manuela Brügger.

Visitors give feedback about the current exhibition and about spicy itself. Because the existing website is hosted on **Squarespace** — which cannot host this kind of custom, data-driven application — the tool is built as a fully independent application served from its own subdomain (e.g. `feedback.spicy-kunstraum.ch`).

**Scale of the project (important for all sizing decisions):**

- Roughly **4 exhibitions per year**.
- Roughly **100 visitors per exhibition**.
- Very low traffic — all infrastructure stays comfortably within free tiers.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Angular (SPA) | Static build, deployed to GitHub Pages |
| Backend | AWS Lambda + API Gateway HTTP API (v2) | Serverless; HTTP API chosen over REST API for lower cost and simpler routing |
| Database | AWS DynamoDB | On-demand; free tier covers this volume |
| Auth | Custom JWT | bcrypt password hashing; validated by a Lambda Authorizer |
| IaC | Terraform | `terraform/` at repo root; no SAM/CloudFormation |
| Charts | Chart.js (via ng2-charts) | Dashboard visualisations |
| Hosting (FE) | GitHub Pages | Custom subdomain via CNAME |

> All accounts (AWS, GitHub, domain) should be created under the **c.A.R.T. association** rather than the developer's personal accounts, so the project remains owned by the client after handoff.

---

## 3. Architecture Overview

- The Angular SPA is built to static files and served by GitHub Pages on the project subdomain.
- The SPA talks to an **HTTP API (API Gateway v2)** exposed through API Gateway.
- Public endpoints are open; admin endpoints sit behind a **Lambda Authorizer** that validates the JWT.
- Lambda functions read from and write to DynamoDB.
- The JWT signing secret is stored in **AWS SSM Parameter Store** (`/spicy/jwt-secret`) and injected as a Lambda environment variable at deploy time (NOT hardcoded in source, NOT committed to the repository).

**Request flow (admin):** SPA → API Gateway → Lambda Authorizer (verify JWT) → target Lambda → DynamoDB

**Request flow (public):** SPA → API Gateway → Lambda → DynamoDB

---

## 4. Data Model (DynamoDB)

Three tables. DynamoDB is schema-on-read; only key attributes are fixed. Variable questions are embedded inside each exhibition item (they are always read together with the exhibition).

### Table: `Exhibitions`

| Attribute | Type | Notes |
|---|---|---|
| `exhibitionId` | String (PK) | e.g. `exhibition_2026_01` |
| `name` | String | Exhibition title |
| `startDate` | String (ISO) | Exhibition start date |
| `endDate` | String (ISO) | Exhibition end date |
| `variableQuestions` | List\<Map\> | Each: `{ id, text, type, options? }` |
| `createdAt` | String (ISO) | Creation timestamp |

### Table: `Responses`

| Attribute | Type | Notes |
|---|---|---|
| `exhibitionId` | String (PK) | Enables Query of all responses per exhibition |
| `responseId` | String (SK) | Timestamp + short uuid |
| `fixedAnswers` | Map | Answers to the fixed questions (typed per field) |
| `variableAnswers` | Map | Answers to variable questions, keyed by question id |
| `submittedAt` | String (ISO) | Submission timestamp |

### Table: `Admins`

| Attribute | Type | Notes |
|---|---|---|
| `username` | String (PK) | Simple username (no email) |
| `passwordHash` | String | bcrypt hash |

**Field typing inside `fixedAnswers`** (so the dashboard can aggregate without parsing):

```js
fixedAnswers: {
  emotionExhibition: number,      // scale
  noteToArtist: string,           // free text
  whatYouValue: string,           // free text
  chiliRating: number,            // scale (1-6)
  whatConvinces: string[],        // checkbox multi-select
  visitorType: string[],          // checkbox multi-select
  distanceTravelled: number,      // scale
  websiteEase: number,            // scale
  howToImprove: string            // free text
}
```

---

## 5. API Endpoints

All routes are in English. Public routes need no authentication; admin routes require a valid JWT (checked by the Lambda Authorizer).

### Public endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/exhibitions/active` | Return the currently active exhibition with its questions. 404 if none active. |
| `POST` | `/responses` | Store a new response (`exhibitionId` + answers). |
| `POST` | `/auth/login` | `username` + `password`, returns JWT. No token required to call this. |

### Admin endpoints (JWT required)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/admin/exhibitions` | List all exhibitions |
| `POST` | `/admin/exhibitions` | Create an exhibition (with variable questions) |
| `PUT` | `/admin/exhibitions/{exhibitionId}` | Edit an exhibition (name, dates, variable questions) |
| `GET` | `/admin/exhibitions/{exhibitionId}/responses` | List all responses for an exhibition |
| `GET` | `/admin/exhibitions/{exhibitionId}/responses/csv` | Export responses as CSV |

---

## 6. Fixed Questions

These come from the original client document. They are the **same for every exhibition** and are **NOT editable** from the admin panel — they live in the frontend. Question wording is kept in **German** (the language of the audience).

### Section 1 — Zur Ausstellung (about the exhibition)

- **Scale:** how much the exhibition moved you (Null und nichts → Volltreffer).
- **Free text:** a note for the artist / for spicy.
- **Free text:** what you value / love about this exhibition.

### Section 2 — zu spicy (about spicy)

- **Scale:** chili rating, 1–6 🌶.
- **Checkbox (multi-select):** what convinces you about spicy — 8 options (24/7 access, low-threshold access to art, current art selection, digital exhibition information, participatory impulses, inclusion of people on site, connection of art and nature, location in the villa park).

### Section 3 — Zur Person (about you)

- **Checkbox (multi-select):** who are you — 6 options (park flâneur, chance guest, inspiration seeker, art nerd, someone lost, regular).
- **Scale:** how far did you travel for spicy (20 m → 200 km).

### Section 4 — zur homepage (about the website)

- **Scale:** how easy is the spicy website to understand (extremely easy → not easy at all).
- **Free text:** how could we improve spicy and the website.

---

## 7. Question Types

The whole tool supports exactly **three** question types. The admin can choose among these same three when creating variable questions.

| Type | Stored as | UI component |
|---|---|---|
| Scale | `number` | Row of numbered boxes; labels at both ends |
| Checkbox multi-select | `string[]` | Full-width stacked cards, multiple selectable |
| Free text | `string` | Full-width textarea |

---

## 8. Public Form — Visual Design

The form must look **identical to the existing spicy website** so the subdomain feels like part of the same site. **Mobile-first is mandatory:** ~95% of visitors open the survey on a phone via QR code.

### Colour

- Background: white.
- Text and interactive elements: black / greyscale.
- **NO accent colour.** Selected state = solid black fill; unselected = grey/white outline (same pattern as the reference survey, just black instead of blue).

### Typography (both Google Fonts)

- **Comfortaa** — brand/logo and section/page titles.
- **Work Sans** — question text, options, comments, buttons, body.

### Structure

- Hybrid paged layout (not one long scroll, not one-question-per-screen).
- **Four pages**, one per section of the questionnaire.
- A **"Weiter"** (Next) button between pages; **"Absenden"** (Submit) on the final page.
- A thin **progress bar** at the top (black/grey).
- Scale questions: range is configurable per question. All fixed scale questions (chili rating, emotion, website ease) use a 1–6 range. Boxes flex-fill the row so any step count fits in a single row on a ~400px phone — no horizontal scroll or range reduction needed.

### Thank-you screen

Shown after submitting. Warm, slightly playful tone matching spicy's voice. Draft (to be refined by the client):

```
Danke für dein Feedback!
Deine Worte helfen spicy zu wachsen —
bis bald im Park der Villa Schnell. 🌶
```

### No active exhibition screen

If no exhibition is currently active, the visitor still sees a friendly message rather than an empty form — ideally naming the most recent exhibition (e.g. "The last exhibition was X, but feedback is now closed"). If no exhibition exists at all, show a neutral generic message.

---

## 9. Admin Panel — Screens

Used by Simon / Manuela only a few times per year, so it must be **simple and hard to misuse** rather than feature-rich.

### 9.1 Login

- Fields: username, password.
- `POST /auth/login` → store JWT (sessionStorage is fine; long persistence not needed).
- No email, no password recovery, no verification. The developer creates the admin user directly in DynamoDB at handoff and shares the credentials with Simon.

### 9.2 Exhibitions list (landing screen after login)

- Table of all exhibitions: name, dates, status (active / upcoming / finished), number of responses.
- Active exhibition visually highlighted.
- Per-row actions: Edit, View results.
- "+ New exhibition" button.
- Empty state for first use ("No exhibitions yet — create the first one").

### 9.3 Create / Edit exhibition

- Field: exhibition name.
- Start date and end date pickers (active status is derived from these dates — see Business Logic).
- Variable questions: an editable list. Each question has text, a type (Scale / Checkbox multi-select / Free text), and type-specific config (range for scale, option list for checkbox).
- Add / remove questions dynamically.
- Fixed questions do **NOT** appear here (they live in the frontend and are not editable).
- Save button.

### 9.4 Results dashboard (per exhibition)

- Total response counter at the top.
- Scale questions → bar or line chart with the average highlighted.
- Checkbox multi-select → horizontal bar chart with count and percentage per option.
- Free-text questions → simple list of responses (no chart).
- Export CSV button (useful for the client's reporting to the Canton).

---

## 10. Business Logic — Active vs Finished

Active state is **derived from dates**, not a manual toggle. This avoids the failure mode of someone forgetting to switch an exhibition off.

- **Active exhibition** = the one where `startDate ≤ today ≤ endDate`.
- **Last finished exhibition** = among those with `endDate < today`, the one with the most recent `endDate`.

**Public endpoint behaviour:**

1. If an exhibition is active → serve the normal form.
2. If none is active but a finished one exists → show the "last exhibition was X, feedback closed" screen.
3. If no exhibition exists at all → show a neutral generic message.

The Lambda compares dates against the current date at request time, so no manual intervention is ever required to open or close the form.

---

## 11. Suggested Project Structure

A monorepo with two top-level folders keeps the Angular app and the AWS backend together while staying clearly separated.

```
spicy-feedback/
├── frontend/                 # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/         # services, http, guards, JWT interceptor
│   │   │   ├── shared/       # reusable question components
│   │   │   │   ├── scale-question/
│   │   │   │   ├── checkbox-question/
│   │   │   │   └── text-question/
│   │   │   ├── public/       # public survey feature
│   │   │   │   ├── survey/
│   │   │   │   ├── thank-you/
│   │   │   │   └── closed/   # no-active-exhibition screen
│   │   │   └── admin/        # admin feature (lazy-loaded)
│   │   │       ├── login/
│   │   │       ├── exhibitions-list/
│   │   │       ├── exhibition-edit/
│   │   │       └── dashboard/
│   │   ├── assets/
│   │   └── styles/           # fonts (Comfortaa, Work Sans), global styles
│   └── angular.json
│
├── backend/                  # AWS Lambda functions
│   ├── src/
│   │   ├── handlers/         # one file per endpoint
│   │   │   ├── login.mjs
│   │   │   ├── getActiveExhibition.mjs
│   │   │   ├── postResponse.mjs
│   │   │   ├── listExhibitions.mjs
│   │   │   ├── createExhibition.mjs
│   │   │   ├── updateExhibition.mjs
│   │   │   ├── listResponses.mjs
│   │   │   └── exportResponsesCsv.mjs
│   │   ├── authorizer/       # Lambda Authorizer (JWT verification)
│   │   │   └── index.mjs
│   │   └── lib/              # shared: dynamo client, jwt utils, validation
│   └── package.json
│
├── terraform/                # Infrastructure as Code (Terraform)
│   ├── providers.tf          # AWS + archive providers, required versions
│   ├── variables.tf          # region, environment, CORS origin, SSM path, log retention
│   ├── main.tf               # DynamoDB, Lambda, IAM, API Gateway, CloudWatch
│   └── outputs.tf            # api_url, table names
│
└── README.md
```

---

## 12. Implementation Notes & Best Practices

### Security

- Store the JWT secret in **AWS SSM Parameter Store** at `/spicy/jwt-secret` (SecureString); inject it as a Lambda environment variable at deploy time. Never hardcode it or commit it to the repo.
- Hash admin passwords with **bcrypt**; never store plaintext.
- Use a reasonable token expiry (e.g. 7 days — admins log in rarely).
- Validate every admin route through the **Lambda Authorizer**; do not duplicate JWT checks inside each handler.
- Configure **CORS** on API Gateway to allow only the production subdomain.

### Infrastructure

- All AWS resources are managed with **Terraform** (`terraform/`). Do not use the AWS console to create or modify resources that Terraform owns.
- The API is an **HTTP API (API Gateway v2)**; routes use `AWS_PROXY` integrations with payload format version `2.0`.
- Each Lambda function has a dedicated **CloudWatch log group** with **14-day retention**, declared in Terraform so the retention policy is set before the first invocation.
- The JWT Lambda Authorizer uses `REQUEST` type, payload format `2.0`, and simple responses (`{ isAuthorized: true/false }`); result TTL is 300 s.

### Data & privacy (GDPR / DSGVO)

- Responses are **anonymous by default** — do not collect names, emails or IP addresses unless explicitly required.
- Keep the data region in the **EU/Switzerland** where possible.

### Frontend

- Build the question rendering **generically** (driven by question type + config) so fixed and variable questions reuse the same three components.
- Design and test on a **~400px viewport first**, then scale up.
- Import **Comfortaa** and **Work Sans** from Google Fonts.
- Angular routing uses **hash routing** (`/#/route`, `withHashLocation()`). Visitors always arrive via QR code at the root URL, so deep-link 404s are not a concern; hash routing requires zero GitHub Pages configuration.

### Suggested build order

1. Backend foundation: DynamoDB tables, shared lib, Lambda Authorizer.
2. Public endpoints (`getActiveExhibition`, `postResponse`).
3. Public survey frontend (the three question components + the 4-page flow).
4. Admin auth + admin endpoints.
5. Admin panel screens.
6. Dashboard + CSV export.
7. Wire up subdomain, fonts, final styling.

---

## 13. Out of Scope (handled by the client)

- **QR code generation** — produced by Simon.
- **Linking the "your feedback" button** in the Squarespace navigation to the subdomain — done by Simon in Squarespace (it supports external links).
- **Ongoing hosting/maintenance contract** — none; the developer assists informally as needed.

---

## 14. Project Conditions

- Billed **hourly** (funded by a cantonal budget).
- **No formal support contract** after delivery.
- All cloud/domain accounts owned by the **c.A.R.T. association**.
- Low volume: ~4 exhibitions/year, ~100 visitors each.

---

*End of specification.*
