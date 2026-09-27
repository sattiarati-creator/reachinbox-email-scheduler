# 🚀 ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed email scheduling service and dashboard designed to reliably schedule, rate-limit, and deliver emails at scale with zero cron jobs. Built for the ReachInbox Software Development Intern Assignment.

---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Tech Stack](#-tech-stack)
- [Key Features Implemented](#-key-features-implemented)
- [Prerequisites & Infrastructure](#-prerequisites--infrastructure)
- [Environment Configuration](#-environment-configuration)
- [Step-by-Step Setup & Running](#-step-by-step-setup--running)
  - [1. Start Infrastructure (Docker)](#1-start-infrastructure-docker)
  - [2. Start Backend & BullMQ Worker](#2-start-backend--bullmq-worker)
  - [3. Start Frontend Dashboard](#3-start-frontend-dashboard)
- [Core Scheduler Mechanisms](#-core-scheduler-mechanisms)
  - [No Cron Jobs Guarantee](#1-no-cron-jobs-guarantee)
  - [Server Restart & Crash Persistence](#2-server-restart--crash-persistence)
  - [Idempotency & Duplicate Prevention](#3-idempotency--duplicate-prevention)
  - [Rate Limiting (Hourly per Sender)](#4-rate-limiting-hourly-per-sender)
  - [Slack Notification on Rate Limit Hit](#5-slack-notification-on-rate-limit-hit)
  - [Minimum Delay & Provider Throttling](#6-minimum-delay--provider-throttling)
  - [Elasticsearch Full-Text Search](#7-elasticsearch-full-text-search)
- [Live Queue Dashboard (Bull-Board)](#-live-queue-dashboard-bull-board)
- [Demo Video Walkthrough Guide](#-demo-video-walkthrough-guide)
- [Assumptions, Shortcuts & Trade-offs](#-assumptions-shortcuts--trade-offs)

---

## 🏛 Architectural Overview

```
                                  +-----------------------------+
                                  |    React 19 + Tailwind CSS   |
                                  |      Frontend Dashboard     |
                                  +--------------+--------------+
                                                 |
                                     HTTP / REST | (Proxied Vite)
                                                 v
                                  +-----------------------------+
                                  |   Express.js API (TypeScript)|
                                  |     + Bull-Board Admin UI   |
                                  +-------+--------------+------+
                                          |              |
                      +-------------------+              +-------------------+
                      |                                                      |
                      v                                                      v
      +-------------------------------+                      +-------------------------------+
      |       PostgreSQL 16           |                      |            Redis 7            |
      | - Emails & status states      |                      | - BullMQ delayed queue        |
      | - Hourly rate limit windows   |                      | - Atomic concurrency locks    |
      | - Slack workspace credentials |                      | - Cooldown tracking           |
      +-------------------------------+                      +---------------+---------------+
                      |                                                      |
                      |                                                      v
                      |                                      +-------------------------------+
                      |                                      |        BullMQ Worker          |
                      |                                      | - Configurable concurrency    |
                      |                                      | - Throttling delay (2000ms)   |
                      |                                      +---------------+---------------+
                      |                                                      |
                      |                                    +-----------------+-----------------+
                      |                                    |                                   |
                      v                                    v                                   v
      +-------------------------------+  +-------------------------------+   +-----------------------------+
      |        Elasticsearch 7        |  |     Ethereal Fake SMTP        |   |      Slack Incoming Webhook /|
      | - Full-text search (q=...)    |  | - Test email delivery         |   |         OAuth 2.0 Alerts     |
      | - Recipient & subject index   |  | - Web preview URL generation  |   | - Live rate-limit alerts     |
      +-------------------------------+  +-------------------------------+   +-----------------------------+
```

---

## 🛠 Tech Stack

### Backend
- **Runtime & Language**: Node.js v20+ / v24, TypeScript
- **Web Framework**: Express.js
- **Queue Engine**: [BullMQ](https://bullmq.io/) backed by Redis 7 (**strictly no cron jobs**)
- **Database**: PostgreSQL 16 (`pg` pool with atomic transactional queries)
- **Search Engine**: Elasticsearch 7.17 (full-text search, fuzzy matching, wildcard queries)
- **Queue Monitoring**: `@bull-board/express` & `@bull-board/api`
- **Email Delivery (Fake SMTP)**: Nodemailer + [Ethereal Email](https://ethereal.email/)
- **Notification**: Slack Webhooks & OAuth 2.0 API

### Frontend
- **Framework**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4, PostCSS, Lucide React icons
- **Authentication**: Google OAuth (`@react-oauth/google` + JWT decode) + Quick Reviewer Switcher
- **State & HTTP**: Axios, Context API, responsive dark-mode UI

### Infrastructure
- **Docker & Docker Compose**: Automated multi-container setup for PostgreSQL, Redis, and Elasticsearch.

---

## ✨ Key Features Implemented

| Category | Requirement | Implementation Details |
| :--- | :--- | :--- |
| **Backend** | **BullMQ Delayed Jobs** | Emails scheduled via native `delay: Math.max(0, targetTime - now)` in BullMQ. **Zero cron jobs**. |
| **Backend** | **Restart Persistence** | Jobs persisted in Redis and PostgreSQL. On server startup, `recoverScheduledEmails()` verifies queue state and reschedules pending emails. |
| **Backend** | **Idempotency** | Unique `job_id` (e.g. `email-<uuid>`), DB row status check (`if status === 'sent' skip`), preventing duplicate sends. |
| **Backend** | **Worker Concurrency** | Configurable via `WORKER_CONCURRENCY` env (default: 5 concurrent jobs). |
| **Backend** | **Throttling Delay** | Atomic Redis lock `email-scheduler:last-send-time:<sender>` enforces configurable delay (`EMAIL_DELAY_MS=2000`) between individual sends. |
| **Backend** | **Hourly Rate Limiting** | Configurable `MAX_EMAILS_PER_HOUR` per sender. Atomic SQL `ON CONFLICT DO UPDATE WHERE count < limit`. Exceeded jobs are automatically rescheduled to the next hour window via `job.moveToDelayed()` without dropping. |
| **Backend** | **Slack Rate-Limit Alert** | Live alerts dispatched immediately to user's Slack webhook/channel when sender exceeds hourly quota. Includes interactive test button and Redis cooldown. |
| **Backend** | **Elasticsearch Indexing** | Scheduled and sent emails are automatically indexed. Real-time full-text search with wildcard query support across recipient, sender, subject, and body. |
| **Backend** | **Live Queue Dashboard** | Bull-Board mounted at `/admin/queues` providing real-time visibility into active, waiting, delayed, and completed jobs. |
| **Frontend** | **Google Login** | Real Google OAuth popup with `@react-oauth/google`, avatar display, user name, email, and one-click demo login. |
| **Frontend** | **Figma-Inspired UI** | Dark theme (`#0B0F19`), responsive cards, animated status badges, stats bar. |
| **Frontend** | **Compose & Lead CSV** | Modal with file upload parsing CSV/text leads, counting valid emails, start time picker, delay between sends, and sender selection. |
| **Frontend** | **Scheduled Tab** | List/table of scheduled emails, Elasticsearch search bar, live countdowns, and cancel email option. |
| **Frontend** | **Sent Tab** | List/table of sent emails, sent timestamps, status badges, and clickable Ethereal Webmail preview URLs. |

---

## 📦 Prerequisites & Infrastructure

Make sure you have installed:
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory (or use `backend/.env.example` as a template):

```env
PORT=5000

# PostgreSQL (Port 5433 mapped from Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/reachinbox

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Scheduler & Worker Settings
WORKER_CONCURRENCY=5
EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=10

# Ethereal Fake SMTP credentials (generated at https://ethereal.email)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=maci.smith@ethereal.email
ETHEREAL_PASS=7hsk8t2SMJ5Xw6Rdn5

# Slack Integration (Optional for OAuth, Webhooks can be configured directly in UI)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/oauth/callback
```

> **Note on Ethereal credentials**: If `ETHEREAL_USER` and `ETHEREAL_PASS` are left empty, the worker will automatically generate a fresh test account on first send using `nodemailer.createTestAccount()`.

---

## 🚀 Step-by-Step Setup & Running

### 1. Start Infrastructure (Docker)

In the root directory, start PostgreSQL, Redis, and Elasticsearch containers:

```bash
docker compose up -d
```

Verify containers are running:
```bash
docker ps
```
You should see:
- `reachinbox-postgres` on port `5433`
- `reachinbox-redis` on port `6379`
- `reachinbox-elasticsearch` on port `9200`

### 2. Start Backend & BullMQ Worker

Navigate into the `backend/` directory:

```bash
cd backend
npm install
npm run db:init     # Initializes PostgreSQL tables
npm run dev         # Launches Express API, BullMQ worker & Bull-Board
```

The server will start at:
- **API Base**: `http://localhost:5000`
- **BullMQ Board**: `http://localhost:5000/admin/queues`
- **Health Check**: `http://localhost:5000/api/health`

### 3. Start Frontend Dashboard

In a new terminal window, navigate into `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## 🧠 Core Scheduler Mechanisms

### 1. No Cron Jobs Guarantee
- Traditional scheduling with cron polls the database every minute, which creates unnecessary database overhead, fails under high concurrency, and struggles with exact second-level delays.
- This scheduler uses **BullMQ delayed jobs** backed by Redis z-sets (`ZADD` with timestamps).
- When an email is scheduled for `scheduledAt`, the delay is calculated:
  $$\text{delay} = \max(0, \text{scheduledAt} - \text{now})$$
- BullMQ pushes the job with `{ delay }`. Redis natively wakes up the worker precisely when the delay expires without any polling interval.

### 2. Server Restart & Crash Persistence
- **Redis Persistence**: BullMQ retains delayed jobs in Redis storage (`redis_data` Docker volume).
- **PostgreSQL Database of Record**: All scheduled emails are inserted with `status = 'scheduled'` and unique `job_id`.
- **Startup Reconciliation**: On server restart, `recoverScheduledEmails()` queries pending emails from Postgres and checks `emailQueue.getJob(jobId)`. Any missing jobs are re-queued with their remaining delay.

### 3. Idempotency & Duplicate Prevention
- Each job has a deterministic ID format `email-<uuid>`.
- The BullMQ worker checks DB status prior to sending:
  ```ts
  if (email.status === 'sent') {
    return { skipped: true };
  }
  ```
- After successful send, the status is immediately updated to `sent` and saved with the Ethereal message ID and preview URL.

### 4. Rate Limiting (Hourly per Sender)
- Configured by `MAX_EMAILS_PER_HOUR` (e.g. 10 emails/hour).
- Uses an atomic PostgreSQL statement with hour truncation:
  ```sql
  INSERT INTO email_rate_limits (sender, window_start, email_count)
  VALUES ($1, date_trunc('hour', NOW()), 1)
  ON CONFLICT (sender, window_start)
  DO UPDATE SET email_count = email_rate_limits.email_count + 1, updated_at = NOW()
  WHERE email_rate_limits.email_count < $2
  RETURNING email_count;
  ```
- If the slot cannot be reserved (limit reached):
  1. The job is **not dropped or marked failed**.
  2. The remaining time until the next hour window is calculated.
  3. The job is rescheduled using `job.moveToDelayed(nextHourTimestamp, token)`.
  4. A **live Slack notification** is dispatched immediately.

### 5. Slack Notification on Rate Limit Hit
- Users can click **Slack Integration** in the dashboard header.
- Supports both:
  - **Direct Incoming Webhook URL** (e.g., `https://hooks.slack.com/services/...` for instant testing).
  - **Slack OAuth 2.0 authorize flow**.
- A **Send Test Notification** button allows immediate verification that Slack receives rich Block Kit messages.
- When any sender hits the hourly limit, a rich alert is posted to Slack with the sender name, limit, window start, and rescheduling notice.
- A 5-minute Redis cooldown key (`slack:cooldown:<sender>:<window>`) prevents spamming Slack on burst loads.

### 6. Minimum Delay & Provider Throttling
- When sending to real or fake SMTP providers, bursts can lead to IP bans or connection drops.
- A configurable `EMAIL_DELAY_MS` (default: 2000ms / 2 seconds) is enforced across all concurrent workers.
- Synchronization is handled using atomic Redis timestamps (`email-scheduler:last-send-time:<sender>`).

### 7. Elasticsearch Full-Text Search
- Whenever an email is scheduled or sent, it is indexed into Elasticsearch (`emails` index).
- Users can search in real time using the search bar on both the **Scheduled** and **Sent** tabs.
- Supports wildcard and token searching (`*keyword*`) across recipients, subjects, body content, and senders.
- Gracefully falls back to SQL queries if Elasticsearch is temporarily unavailable.

---

## 📊 Live Queue Dashboard (Bull-Board)

Visit `http://localhost:5000/admin/queues` while the backend is running to inspect:
- Active jobs
- Delayed jobs (with countdown timers)
- Completed jobs
- Failed jobs
- Job payload data, retries, and execution logs

---

## 📹 Demo Video Walkthrough Guide (Max 5 mins)

Here is a recommended script for recording the demo video:

1. **Dashboard Tour (0:00 - 1:00)**:
   - Show Google login (or Reviewer Demo login) in the top header.
   - Show the Stats Bar (Scheduled count, Sent count, Hourly Rate Limit progress bar).
   - Show the Slack Integration modal and click **Send Test Notification** to demonstrate a live Slack message delivery.

2. **Scheduling Emails & CSV Lead Upload (1:00 - 2:00)**:
   - Click **Compose New Email**.
   - Upload `sample_leads.csv` (or use the built-in lead parser) to demonstrate detection of multiple leads.
   - Set a start time 30 seconds into the future, and 2-second delay between sends.
   - Click **Schedule** and show the emails appearing in the **Scheduled Emails** tab.

3. **Live Sending & Ethereal Webmail (2:00 - 3:00)**:
   - Watch the BullMQ worker pick up the jobs in the terminal log.
   - Switch to the **Sent Emails** tab to show completed emails.
   - Click on the **View Ethereal Email** link to show the rendered email in Ethereal webmail.

4. **Server Restart Persistence (3:00 - 4:00)**:
   - Schedule an email 1-2 minutes in the future.
   - Stop the backend server in terminal (`Ctrl+C`).
   - Show that the frontend / database retains the scheduled email.
   - Start the backend server again (`npm run dev`).
   - Notice the terminal log: `[Queue Recovery] Recovered and synchronized scheduled emails into BullMQ`.
   - Wait until the scheduled time and verify that the email sends successfully without duplication.

5. **Rate Limiting & Rescheduling (4:00 - 5:00)**:
   - Set `MAX_EMAILS_PER_HOUR=2` or schedule emails exceeding the limit.
   - Observe worker log: `⚠️ Hourly rate limit reached for sender... Delaying job`.
   - Show that the job is moved to delayed rather than failed, and show the Slack rate-limit alert notification.

---

## ⚖️ Assumptions, Shortcuts & Trade-offs

1. **Ethereal Fake SMTP**:
   - Ethereal SMTP does not deliver to real inboxes, but provides a full RFC 5322 compliant SMTP server and generates real web preview URLs for manual visual inspection of delivered emails.

2. **Hourly Window Calculation**:
   - The hourly rate limiter aligns with clock-hour boundaries (`date_trunc('hour', NOW())`) rather than a rolling 60-minute sliding window. This simplifies multi-tenant accounting and guarantees deterministic resets.

3. **Slack OAuth vs Incoming Webhooks**:
   - Both Slack OAuth 2.0 and Direct Incoming Webhooks are supported. For quick local evaluation where creating a Slack App with public redirect URLs (e.g. ngrok) may be inconvenient, the Direct Webhook input allows instant live Slack alerting in under 30 seconds.

4. **Elasticsearch Sync**:
   - Elasticsearch indexing is performed asynchronously on email write/update. In the unlikely event Elasticsearch is down, search automatically falls back to PostgreSQL `ILIKE` queries, ensuring zero downtime.

---

## 👥 Submission Details

- **Candidate**: ReachInbox Intern Candidate
- **Repository**: [sattiarati-creator/reachinbox-email-scheduler](https://github.com/sattiarati-creator/reachinbox-email-scheduler)
- **Collaborator Access Granted**: `Mitrajit` and `Yadav036`
