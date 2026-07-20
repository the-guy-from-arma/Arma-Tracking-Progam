# Enscript University

A Railway-first online university operated by Thunder Buddies Studios and Black Ridge Studios for structured Enfusion Workbench education, sponsored learning, and permanent academic records.

## Included

- Secure accounts with owner, admin, veteran, developer, and trainee roles
- Branded animated campus gateway, admissions experience, and authenticated university portal
- Student, faculty, admissions, funding, curriculum, policy, and owner operations workspaces
- 192 courses across 16 academies with 2,640 complete day-by-day Workbench lessons
- 144 stackable short, associate, and bachelor-level academic programs
- Enrollment, external-evidence submission, Gemini assessment, exception review, and appeals
- Rolling 120-day sponsored-learning terms, automatic renewal, just-in-time awards, and student ledgers
- Student Center with a 10-question Gemini course advisor, final enrollment confirmation, withdrawals, standing, and funding recovery
- Verifiable certificates with public credential pages
- PostgreSQL persistence, audit records, PWA installation, and automatic Railway migrations
- Institution student numbers and configurable internal academic login identities

## Credential status

Enscript University is an independent, non-accredited learning institution. Its credentials record learning and portfolio assessment; they are not accredited academic degrees or guaranteed transferable college credits. Public degree wording remains disabled unless appropriate legal authorization is documented.

## Railway deployment

1. Create a Railway project and add PostgreSQL.
2. Deploy this repository.
3. Set `DATABASE_URL` from Railway PostgreSQL.
4. Set `OWNER_EMAIL`, `OWNER_NAME`, and a unique `OWNER_PASSWORD` containing at least 12 characters.
5. Set `WIKI_SYNC_SECRET` to a long random value for authenticated curriculum synchronization.
6. Add the server-only Gemini and funding variables listed below.
7. Deploy. Startup applies migrations, seeds the complete curriculum, and creates or synchronizes the owner account.

`OWNER_EMAIL` and `OWNER_PASSWORD` are optional as a pair so a missing Railway variable cannot crash the service. Without them, the campus starts normally but owner-only controls remain unavailable. Never commit the production password.

Student identities such as `alex.morgan@enscriptuniversity.edu` are internal ESU login identifiers only. They do not create an internet mailbox or represent ownership of the matching `.edu` domain; the student’s verified personal email remains the recovery and contact address.

### Railway runtime variables

```text
GEMINI_API_KEY=<Google AI Studio authorization key>
GEMINI_MODEL=gemini-3.1-pro-preview
AI_GRADING_ENABLED=true
AI_GRADING_CONFIDENCE_THRESHOLD=0.85
AI_GRADING_MAX_RETRIES=3
AI_GRADING_WORKER_SECRET=<random value of at least 32 characters>
FUNDING_RENEWAL_SECRET=<different random value of at least 32 characters>
FUNDING_TERM_DAYS=120
FUNDING_RESERVE_PERCENT=15
DEGREE_WORDING_ENABLED=false
APP_ORIGIN=https://enfusion-edu.up.railway.app
MINOR_ADMISSIONS_ENABLED=true
GUARDIAN_VERIFICATION_ENABLED=true
GUARDIAN_CONSENT_TOKEN_SECRET=<different random value of at least 32 characters>
STRIPE_SECRET_KEY=<server-only Stripe secret key>
STRIPE_IDENTITY_WEBHOOK_SECRET=<Stripe webhook signing secret beginning whsec_>
```

For age-16/17 admissions, enable Stripe Identity in the Stripe account and add a webhook endpoint at `https://enfusion-edu.up.railway.app/api/webhooks/stripe-identity`. Subscribe it to `identity.verification_session.verified`, `identity.verification_session.processing`, `identity.verification_session.requires_input`, `identity.verification_session.canceled`, and `identity.verification_session.redacted`. Never use a `NEXT_PUBLIC_*` variable for these secrets. The university database stores consent and verification-result metadata, not guardian ID images, ID numbers, or selfies.

Create three Railway scheduled services:

- Nightly wiki synchronization: `pnpm run curriculum:sync`
- AI grading worker, scheduled every minute: `pnpm run grading:worker`
- Daily funding renewal and reminder processing: `pnpm run funding:renew`

The Gemini key is used only by the server worker. Sponsored-learning balances are internal, noncashable service credits; student responsibility remains `$0.00`.

### Student funding continuation policy

- A course withdrawal returns 30% of its internal sponsored service allocation to the student funding balance.
- Each withdrawal reduces the next term award by 5 percentage points, capped at a 25-point withdrawal adjustment.
- Only finalized Gemini grades count toward funding standing. Exceptions and active appeals are excluded.
- After two finalized grades, an average below 70% pauses new course funding for academic support; improving the finalized average to 70% or higher removes the grade adjustment.
- Total renewal support never falls below 60% of the scheduled internal award, and an owner or administrator may record a documented support override.

## Local Docker

Run `docker compose up --build`, then open `http://localhost:3000`.

The local Docker owner defaults to `owner@example.com` / `local-owner-password`. Change those values outside local development.
