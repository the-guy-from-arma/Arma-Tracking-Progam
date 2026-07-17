# Project VALORIS

A Railway-first two-portal PWA operated by Thunder Buddies Studios and Black Ridge Studios: Project VALORIS for professional Arma Reforger development knowledge and Enfusion University for structured online education.

## Included

- Secure accounts with owner, admin, veteran, developer, and trainee roles
- Project intake and owner/admin approval workflows
- Studio-authored development courses with assessed mod deliverables
- Course enrollment, repository submission, feedback, and review queues
- Verifiable certificates with public credential pages
- Community learning credits and certificate, diploma, and degree-style pathways
- PostgreSQL persistence, audit records, PWA installation, and automatic Railway migrations
- Separate Project VALORIS and Enfusion University entry points behind one secure account
- Institution student numbers and configurable academic email identities

## Credential status

Enfusion University credentials record learning and portfolio assessment. They are not accredited academic degrees or college credits unless a recognized institution separately approves the program or accepts a credential for transfer. All public credential pages display this distinction.

## Railway deployment

1. Create a Railway project and add PostgreSQL.
2. Deploy this repository.
3. Set `DATABASE_URL` from Railway PostgreSQL.
4. Set `OWNER_EMAIL`, `OWNER_NAME`, and a unique `OWNER_PASSWORD` containing at least 12 characters.
5. Optionally set `UNIVERSITY_IDENTITY_DOMAIN`; it defaults to `enfusionuniversity.edu`.
6. Set `WIKI_SYNC_SECRET` to a long random value for authenticated curriculum synchronization.
6. Deploy. Startup applies migrations and creates or synchronizes the owner account.

`OWNER_EMAIL` and `OWNER_PASSWORD` are optional as a pair so a missing Railway variable cannot crash the service. Without them, Project VALORIS starts normally but owner-only controls remain unavailable. Never commit the production password.

Student identities such as `alex.morgan@enfusionuniversity.edu` are internal EFU login identifiers only. They do not create an internet mailbox or represent ownership of the matching `.edu` domain; the student’s verified personal email remains the recovery and contact address. A public `.edu` identity must not be represented as registered or deliverable unless the institution becomes eligible and secures the domain through EDUCAUSE.

The startup workflow applies migrations and idempotently seeds 64 courses across 16 Enfusion academies. For nightly source updates, create a Railway cron service with `pnpm run curriculum:sync`; it uses `APP_URL` (or Railway’s public domain) and `WIKI_SYNC_SECRET` to call the protected synchronization endpoint. Wiki failures preserve the last successful instructional source record.

## Local Docker

Run `docker compose up --build`, then open `http://localhost:3000`.

The local Docker owner defaults to `owner@example.com` / `local-owner-password`. Change those values outside local development.
