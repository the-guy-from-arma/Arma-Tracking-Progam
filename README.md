# ForgeOps

A Railway-first iPhone PWA for Arma Reforger and Enfusion Workbench development teams.

## Included

- Real email/password accounts with secure database-backed sessions
- Owner, admin, veteran, developer, and trainee roles
- Owner-only role assignment
- Project requests available to every member
- Owner/admin approval workflow
- PostgreSQL persistence and audit records
- Training and veteran mentoring surface
- iPhone Add to Home Screen support
- Railway health checks and automatic migrations

## Railway deployment

1. Create a Railway project and add a PostgreSQL service.
2. Deploy this repository.
3. Set `DATABASE_URL` from Railway PostgreSQL.
4. Set `OWNER_EMAIL`, `OWNER_NAME`, and a strong `OWNER_PASSWORD` of at least 12 characters.
5. Deploy. The startup process applies migrations and creates or promotes the configured owner account.

`OWNER_EMAIL` and `OWNER_PASSWORD` are optional as a pair so a missing Railway variable cannot crash the web service. Without them, ForgeOps starts normally but owner-only role controls remain unavailable. If either variable is present, both must be valid. Updating the configured owner name or password and redeploying safely synchronizes that account.

### Railway owner startup error

If Railway reports `OWNER_EMAIL and an OWNER_PASSWORD of at least 12 characters are required`, add these service variables and redeploy:

- `OWNER_EMAIL`: the email you will use to sign in
- `OWNER_PASSWORD`: a unique password containing at least 12 characters
- `OWNER_NAME`: the display name for the owner account

Do not put the real password in this repository or commit it to an `.env` file.

## Local Docker

Run `docker compose up --build`, then open `http://localhost:3000`.

On iPhone, open the deployed site in Safari, tap Share, and choose **Add to Home Screen**.
