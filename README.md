# Medication Tracker

A Georgian language, single-user medication schedule and dose-history web app. It provides a daily dashboard, an editable medication schedule, important dates, dose tracking, browser-local notes, JSON schedule export, and optional server-side email reminders.

The app is designed for deployment to Vercel. Its serverless API stores shared schedules and dose history in a Redis-compatible database. It does not include user accounts or authentication.

**Author:** [MIkheil Kakabadze](https://www.linkedin.com/in/mikheil-kakabadze)

> **Health-data and access warning:** The app has no built-in access control. Anyone who can reach its URL can view or change its schedule, important dates, and dose history. Do not use it with real health information unless you add a suitable access-control layer and understand the privacy implications.

## Contents

- [Features](#features)
- [Technology and project structure](#technology-and-project-structure)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Deploy to GitHub and Vercel](#deploy-to-github-and-vercel)
- [Configure Redis storage](#configure-redis-storage)
- [Configure email reminders on Vercel Hobby](#configure-email-reminders-on-vercel-hobby)
- [API reference](#api-reference)
- [Data, privacy, and security](#data-privacy-and-security)
- [Build and type-check](#build-and-type-check)
- [Medical disclaimer](#medical-disclaimer)

## Features

- Daily dashboard with dose progress, next-dose summary, and a Georgian monthly calendar
- Editable medications with dose descriptions, multiple 24-hour schedule times, notes, and optional start/end dates
- Dose status tracking: `taken`, `skipped`, or `snoozed`
- Ten-minute snooze action, undo for recent dose changes, and history clearing
- History browsing by date; dose history records expire from Redis after 400 days
- Editable important dates
- Local notes stored only in the current browser
- JSON export of the current medication schedule and important dates
- Optional email reminders sent by a serverless worker
- Responsive interface with keyboard focus styling and reduced-motion support

The app interface and date labels are in Georgian. Reminder scheduling uses Tbilisi time (`Asia/Tbilisi`); the dashboard clock and some date interactions use the browser's local time.

## Technology and project structure

- **Frontend:** HTML/CSS and TypeScript, bundled with esbuild
- **API:** Vercel serverless functions written in TypeScript
- **Database:** Redis-compatible REST API through `@vercel/kv`
- **Email:** Nodemailer with Gmail SMTP
- **Hosting:** Vercel

```text
api/
  cron.ts            Scheduled reminder worker
  history.ts         Dose history API
  meds.ts            Medication schedule and important-dates API
  send-reminder.ts   Secret-protected test-email API
lib/
  models.ts          Shared TypeScript data models
public/
  index.html         App markup and styles
  app.js             Generated browser bundle (not committed)
src/
  app.ts             Frontend application logic
package.json         Scripts and dependencies
package-lock.json    Locked npm dependency versions
tsconfig.json        TypeScript compiler settings
vercel.json          Vercel build configuration
```

## Requirements

- Node.js and npm
- A Vercel account for deployment and `npx vercel dev`
- A Redis REST database connected to the Vercel project for server-backed features
- Gmail credentials and an external scheduler only if you want reminder emails

## Run locally

Install dependencies and build the browser bundle:

```powershell
npm install
npm run build
```

To run the app and API locally using Vercel's development server:

```powershell
npx vercel dev
```

Open the local address printed by the CLI, usually `http://localhost:3000`. If asked to confirm running the command, accept it. The frontend can load without reminder email settings, but API operations require working Redis credentials.

To use the Vercel project's environment variables locally, link the local folder to the Vercel project and pull its Development variables:

```powershell
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

The `.env.local` file contains credentials. Do not commit it or share its contents. Local reminders also require valid Gmail settings; avoid calling the reminder endpoint during testing unless sending a real email is intended.

## Deploy to GitHub and Vercel

### 1. Push the source to GitHub

Commit the project source, including `api/`, `lib/`, `src/`, `public/index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vercel.json`, `.gitignore`, and this README.

Do not commit:

- `node_modules/`
- `.vercel/`
- generated `public/app.js`
- `.env`, `.env.local`, or other files containing credentials

The repository `.gitignore` excludes these local dependencies, generated output, Vercel metadata, and environment files.

**Check the defaults before publishing.** `api/meds.ts` contains initial medication and important-date data that is returned when the database is empty. Keep the repository private if those defaults contain personal information, or replace them with generic sample values before making the repository public. The app's lack of authentication also makes a public deployment unsuitable for real health information without an additional protection layer.

### 2. Import the repository into Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Keep the Root Directory set to the repository root.
3. Use the project's build configuration from `vercel.json`:
   - Build command: `npm run build`
   - Output directory: `public`
4. Deploy the project.

The build runs TypeScript type-checking and bundles `src/app.ts` into `public/app.js`.

### 3. Configure environment variables

Add the database and, if needed, email variables in the Vercel project's **Settings → Environment Variables**. See the following setup sections. Select **Production** for the live deployment. Add **Preview** or **Development** only if you intend to use those environments.

After creating or changing environment variables, redeploy so the deployment receives them.

## Configure Redis storage

The app imports `@vercel/kv` and expects these environment variable names:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

Vercel KV is no longer offered for new stores. Create or connect a Redis database through a Vercel Marketplace provider such as [Upstash Redis](https://vercel.com/marketplace/upstash).

1. Open the Vercel Marketplace and install/connect the Redis integration to this Vercel project.
2. Create or select a database in the integration flow.
3. Open **Project → Settings → Environment Variables** and confirm that `KV_REST_API_URL` and `KV_REST_API_TOKEN` exist for Production.
4. If the integration supplies different names (for example, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`), add variables with the `KV_REST_API_...` names that the app expects. Use the matching database REST URL and REST token from the provider dashboard. Do not use a raw Redis connection string in place of the REST URL.
5. Save the variables and redeploy.

Keep the REST token private. Do not put it in browser code, GitHub, or this README.

On the first successful `GET /api/meds`, the API initializes the database with the app's defaults if a schedule or important-date list is missing or invalid. Once initialized, changes saved from the app are shared through the connected database. Use separate databases or carefully isolated environments if you need to keep Preview and Production data separate.

## Configure email reminders on Vercel Hobby

Reminder emails are optional. The app does not send email directly from the browser. An external scheduler must call the protected `/api/cron` API, which reads the saved schedule and sends email through Gmail.

Vercel Hobby Cron Jobs are limited to once-daily schedules, so the project intentionally has no Vercel Cron entry. For more frequent checks, configure an external HTTP scheduler. For example, [cron-job.org](https://cron-job.org/) advertises recurring jobs and custom request headers; check the provider's current limits and terms when setting it up.

### Add the Vercel email variables

In **Project → Settings → Environment Variables**, add these for Production:

| Name | Value |
| --- | --- |
| `CRON_SECRET` | A long, random secret used to authorize scheduler requests |
| `GMAIL_USER` | The Gmail account that sends reminder emails |
| `GMAIL_PASS` | A Gmail App Password for that account, not its normal sign-in password |
| `TO_EMAIL` | The email address that receives reminders |

Generate a strong secret locally in PowerShell:

```powershell
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Store the generated value as `CRON_SECRET` in Vercel and in the scheduler's private request-header configuration. Never commit or publish it. Redeploy after setting the variables.

### Create the external scheduler job

Create a job with these settings (labels vary by provider):

- **URL:** `https://YOUR-PRODUCTION-DOMAIN/api/cron`
- **Method:** `GET`
- **Frequency:** Every 10 minutes, or another interval your scheduler supports
- **Request header:** Set the header name to `Authorization`. For its value, enter the literal prefix `Bearer ` (including one trailing space), followed immediately by the exact value of `CRON_SECRET`.

Replace the domain and secret with your own values. Keep the secret in the header, not the URL. Use the Production Vercel domain, not `localhost` or an expiring preview URL.

Run the scheduler's test/run-now option once and inspect its response. A successful worker call returns JSON containing `ok: true` and a `sent` count. A count of zero is normal when no dose is eligible at that moment. A test call can send a real email if a dose is due.

### Reminder timing and behavior

- The worker checks medication times using Tbilisi time.
- It sends a reminder when a scheduled time has passed by no more than 20 minutes.
- The worker runs only when the external scheduler calls it; it does not run continuously.
- Taken and skipped doses are not emailed.
- Snoozed doses are checked at their snooze time, including a snooze that carries over to the next day.
- A Redis key records sent reminder slots to avoid sending the same reminder repeatedly.
- A 10-minute schedule should check within the 20-minute reminder window, but neither an external scheduler nor email delivery guarantees exact-time arrival.
- Calls to `/api/cron` invoke Vercel Functions and count toward Vercel usage limits.

The front page's schedule must be saved to the server before the worker can use it. Changes left only as local drafts are not visible to reminders.

## API reference

All endpoints are served by Vercel Functions. Medication and history endpoints are not authenticated by this app; protect the deployment with a separate access-control layer before storing personal data.

### `GET /api/meds`

Returns the stored medication list, important dates, and medication defaults. Initializes missing or invalid data with the defaults in `api/meds.ts`.

### `POST /api/meds`

Stores the medication list and important dates. JSON request body:

```json
{
  "medications": [
    {
      "id": "example-medication",
      "name": "Example medication",
      "dose": "1 tablet",
      "times": ["08:00"],
      "note": "Optional directions",
      "continuous": true,
      "startDate": "2026-01-01",
      "endDate": "2026-01-31"
    }
  ],
  "dates": [
    {
      "label": "Example date",
      "date": "2026-01-15",
      "time": "13:00"
    }
  ]
}
```

`note`, `continuous`, `startDate`, and `endDate` are optional. Each important date must include a `time` field; use an empty string if no time applies. Times use 24-hour `HH:mm`; dates use `YYYY-MM-DD`.

### `GET /api/history?date=YYYY-MM-DD`

Returns dose records for the requested date.

### `POST /api/history`

Creates or updates one dose record, or a batch of records, for a date. The record fields are `medicationId`, `time`, and `status`; supported statuses are `taken`, `skipped`, and `snoozed`. A snoozed record also uses `snoozeUntil` and may include `snoozeDate`. History entries expire after 400 days.

### `DELETE /api/history?date=YYYY-MM-DD`

Deletes all history for the specified day. Add both `medicationId` and `time` query parameters to delete only one dose entry.

### `GET /api/cron`

Runs the reminder worker. Requires `CRON_SECRET` (or the legacy `REMINDER_SECRET`). Send the secret in the `Authorization` header using the Bearer authentication scheme; the worker also accepts an `x-cron-secret` header. Do not use a query-string secret because URLs may be recorded in logs.

### `POST /api/send-reminder`

Sends a test reminder email and requires the same secret using a bearer authorization header. JSON body:

```json
{
  "medicationName": "Example medication",
  "dose": "1 tablet",
  "time": "08:00",
  "note": "Optional note"
}
```

This endpoint sends an actual email to `TO_EMAIL`; only use it when that is intended.

## Data, privacy, and security

- Medication schedules and important dates are stored in the connected Redis database.
- Dose history is stored in Redis under date-specific records and expires after 400 days.
- Reminder de-duplication markers are stored in Redis and expire after about 48 hours.
- Personal notes are stored in the current browser's `localStorage`. They do not sync, and are not included in the schedule export.
- The JSON export contains the current medication schedule and important dates, but not dose history or local notes. Treat the exported file as sensitive.
- `CRON_SECRET`, `GMAIL_PASS`, and `KV_REST_API_TOKEN` are credentials. Store them only in Vercel's environment variables and the scheduler's private header settings where applicable.
- Keep `.env.local` private. The `.gitignore` excludes `.env*` files, but check GitHub's pending changes before every push.
- HTTPS should be used in production.
- No app-level user login or authorization protects the schedule, history, or medication APIs. Vercel environment variables secure the reminder endpoints but do not secure the app's other APIs.
- Protect access using an appropriate authentication/access-control layer before entering real health information. Do not rely on an unlisted or hard-to-guess URL as security.

## Build and type-check

Run TypeScript validation:

```powershell
npm run typecheck
```

Run the production build (type-checks and bundles the frontend):

```powershell
npm run build
```

Vercel runs `npm run build` during deployment and serves the `public` output directory.

## Medical disclaimer

This app is a personal organization aid, not a clinical decision tool, medication instruction source, or substitute for professional care. Confirm all medication names, doses, schedules, and course dates with a qualified healthcare professional.

---

Maintained by Mikheil Kakabadze.