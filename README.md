# Medication Tracker

A Georgian-language, single-user medication tracking app for managing a daily medicine schedule, dose history, important dates, and email reminders. The project is built for Vercel and stores shared data in Vercel KV while keeping browser-only notes local to each device.

## Overview

This app helps a person track:

- medication names, doses, times, and notes
- whether each scheduled dose was taken, skipped, or snoozed
- date-based history for recent medication activity
- important life or treatment dates (for example fertility tracking milestones)
- automatic reminder emails based on the configured medication schedule

There is no login, no user accounts, and no access control built into the app itself.

## Features

- Shared medication schedule and important dates saved in Vercel KV
- Per-dose tracking with `taken`, `skipped`, and `snoozed` statuses
- Daily dashboard with a monthly calendar and upcoming/due dose view
- Undo for the last dose change and clear-day history support
- Optional medication start/end dates and editable important dates
- Local notes saved in browser storage only
- JSON export of the full medication schedule and important dates
- Server-side reminder emails triggered by an external scheduler, compatible with Vercel Hobby
- Responsive UI designed for mobile and desktop use
- Georgian date formatting and 24-hour time selection

## Tech stack

- Frontend: TypeScript + static HTML/CSS in `public/index.html` and `src/app.ts`
- Serverless API: Vercel functions under `api/`
- Shared models: `lib/models.ts`
- Storage: Vercel KV
- Email: Nodemailer with Gmail SMTP
- Hosting: Vercel

## Project structure

- `public/index.html` - app UI and styling
- `src/app.ts` - browser logic for calendar, dose tracking, notes, and schedule editing
- `lib/models.ts` - shared TypeScript interfaces for medications and dose records
- `api/meds.ts` - medication and important-date API
- `api/history.ts` - daily dose history API
- `api/cron.ts` - scheduled reminder worker
- `api/send-reminder.ts` - test reminder endpoint protected by the same secret
- `vercel.json` - Vercel build and output configuration

## Deployment

1. Create a Vercel project for this repository.
2. Connect a Vercel KV database.
3. Add the required environment variables in the Vercel project settings:

   - `CRON_SECRET` - a separate, random secret used to protect reminder endpoints
   - `GMAIL_USER` - Gmail account used to send reminders
   - `GMAIL_PASS` - Gmail App Password for the account
   - `TO_EMAIL` - recipient address for reminder emails

   You can generate a strong secret locally with PowerShell:

   ```powershell
   $bytes = New-Object byte[] 48
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

4. Redeploy the app after changing environment variables.
5. Open the deployed site. The app loads default medication data on first use and then persists edits after saving the schedule.
6. Set up the external reminder scheduler described below. Vercel Hobby only supports Cron Jobs that run once per day, which is not frequent enough for dose reminders.

## Local development

Install dependencies:

```bash
npm install
```

Run type checking:

```bash
npm run typecheck
```

Build the browser bundle:

```bash
npm run build
```

For a full local Vercel-style environment, run:

```bash
npx vercel dev
```

This is useful for testing the serverless API routes and the reminder endpoints locally.

## API behavior

### `GET /api/meds`
Returns the current medication list and important dates, seeding defaults if none are stored.

### `POST /api/meds`
Accepts a medication list and important-dates list, validates them, and stores them in KV.

### `GET /api/history?date=YYYY-MM-DD`
Returns the recorded dose history for the given day.

### `POST /api/history`
Stores one or more dose records for a day. Supported statuses are `taken`, `skipped`, and `snoozed`.

### `DELETE /api/history?date=YYYY-MM-DD`
Removes a day’s history or a single medication/time entry.

### `GET /api/cron` and `POST /api/send-reminder`
Require `CRON_SECRET` or a matching bearer token. The cron worker checks due doses in Tbilisi time and sends reminder emails when a scheduled dose is within 20 minutes of the current time.

## Configure reminders on Vercel Hobby

Vercel Hobby Cron Jobs can run only once per day, so this project does not define a Vercel Cron Job. Use an external scheduler to call the protected `/api/cron` endpoint every 10 minutes instead. For example, [cron-job.org](https://cron-job.org/) supports recurring schedules and custom HTTP headers:

1. Deploy the app to Vercel and set `CRON_SECRET`, `GMAIL_USER`, `GMAIL_PASS`, and `TO_EMAIL` in the Vercel project's environment variables. Redeploy after adding them.
2. Sign in to cron-job.org and create a new cron job.
3. Set the URL to `https://YOUR-VERCEL-DOMAIN/api/cron`, replacing `YOUR-VERCEL-DOMAIN` with the app's real Vercel domain.
4. Set the schedule to run every 10 minutes.
5. Configure the HTTP request method as `GET`.
6. Add this request header:

   ```text
   Authorization: Bearer YOUR_CRON_SECRET
   ```

   Replace `YOUR_CRON_SECRET` with the exact value configured in Vercel. Store it only in the scheduler's private header settings; do not put it in the URL or commit it to the repository.
7. Save the job and use the scheduler's test/run-now feature. A successful call returns JSON with `ok: true` and a `sent` count. Check the scheduler execution history and Vercel function logs if it reports an error.

The external scheduler calls a Vercel Function, so its executions still count toward Vercel's function usage limits. The reminder worker only sends a scheduled dose reminder within 20 minutes after its scheduled time; taken and skipped doses are ignored. A 10-minute schedule is intended to catch that window, though external scheduler timing is not guaranteed to be exact.

## Reminder behavior

- The app uses Tbilisi time (`Asia/Tbilisi`) for scheduling.
- Reminders are sent only if the dose is not already marked as `taken` or `skipped`.
- A snoozed dose can trigger a reminder at the snoozed time.
- An external scheduler should call `/api/cron` every 10 minutes on Vercel Hobby.

## Data and privacy

- Medication schedule, important dates, and dose history are stored in Vercel KV and are visible to anyone who can open the deployed app URL.
- Notes are stored only in the current browser’s `localStorage` and do not sync across devices.
- JSON exports contain sensitive medication data and should be protected.
- This app is not a clinical decision tool. Always confirm medication instructions and treatment dates with a qualified healthcare professional.
- Use HTTPS in production and never expose `CRON_SECRET`, Gmail credentials, or reminder recipient details in public repositories.
- Keep the repository private if it contains real health information.

## Security note

This version intentionally has no authentication or access control. Anyone who can reach the URL can view or modify medication data and history. If you are using this app with real medical data, deploy it behind private networking, a Vercel access-protection layer, or another authentication boundary.

## Validation

Use:

```bash
npm run typecheck
```

or:

```bash
npm run build
```

to validate the TypeScript code and bundle the browser app before deployment.
