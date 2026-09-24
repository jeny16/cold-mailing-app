# ✉️ JOB APPLICATION MAILER

> **Production-quality Local Node.js + Express + MongoDB + React (Ant Design) Application for Automated & Safe Cold Job Application Outreach.**

Designed specifically for AI-agent-assisted job searches: AI agents gather leads and produce normalized JSON files; **JOB APPLICATION MAILER** validates, normalizes, deduplicates, facilitates human review & approval, and safely dispatches personalized cold emails via SMTP with rate-limiting and daily send ceilings.

---

## 📋 Table of Contents
1. [Overview & Philosophy](#overview--philosophy)
2. [Architecture & Workflow](#architecture--workflow)
3. [Tech Stack](#tech-stack)
4. [Project Directory Layout](#project-directory-layout)
5. [Prerequisites & Installation](#prerequisites--installation)
6. [Configuration & Environment Variables](#configuration--environment-variables)
7. [Database Setup (MongoDB)](#database-setup-mongodb)
8. [JSON Input Specification](#json-input-specification)
9. [JSON Import Methods](#json-import-methods)
10. [Duplicate Detection & Contact Safety](#duplicate-detection--contact-safety)
11. [Email Template & Dynamic Personalization](#email-template--dynamic-personalization)
12. [Resume Attachment Configuration](#resume-attachment-configuration)
13. [Email Dispatch Queue & Rate Limiter](#email-dispatch-queue--rate-limiter)
14. [Dry Run Simulation Mode](#dry-run-simulation-mode)
15. [Automated Testing](#automated-testing)
16. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 1. Overview & Philosophy

### Core Safety Guarantee
- **AI agents NEVER send emails directly.**
- The Node.js application is the **ONLY** component authorized to transmit emails.
- **No Auto-Sending:** Newly imported jobs are never sent immediately. Every listing enters a `REVIEW` stage requiring your explicit approval.
- **Safety First:** Global "PAUSE SENDING", "Skip" actions, and dedicated "Send Test Email" features guarantee you are always in complete control.

---

## 2. Architecture & Workflow

```text
AI Agents / Web Research
        ↓
Normalized JSON files
        ↓
Job Application Mailer (Manual Upload OR data/incoming/ Watcher)
        ↓
Zod Validation & Normalization
        ↓
Duplicate Detection (HR Email & Job Key)
        ↓
MongoDB Persistence (Job, Contact, Import, EmailLog)
        ↓
Human Review UI (React + Ant Design)
        ↓
Select & Approve Listings
        ↓
Personalized Template Rendering & Resume PDF Attachment
        ↓
Persistent Queue (Sequential, Randomized Delay, Daily Quota)
        ↓
SMTP Dispatch (Nodemailer / Dry-Run Simulation)
        ↓
HR / Recruiter Inbox
```

---

## 3. Tech Stack

- **Backend:** Node.js (ESM), Express.js
- **Database & ODM:** MongoDB with Mongoose
- **Validation:** Zod
- **Email Delivery:** Nodemailer
- **File Watching:** Chokidar
- **File Uploads:** Multer
- **Logging:** Pino & Pino-Pretty
- **Frontend:** React 18, Vite, Ant Design (`antd` v5), `@ant-design/icons`, Axios
- **Testing:** Vitest

---

## 4. Project Directory Layout

```text
Cold-Mailing/
├── server/
│   ├── src/
│   │   ├── config/             # DB connection & Pino logger
│   │   ├── models/             # Mongoose schemas (Job, Contact, EmailLog, Import, Setting)
│   │   ├── controllers/        # REST route handlers
│   │   ├── routes/             # Express API endpoints
│   │   ├── services/
│   │   │   ├── duplicate/      # Normalized email & job key deduplication
│   │   │   ├── importer/       # JSON parser & data/incoming/ watcher
│   │   │   ├── mail/           # Nodemailer transport & PDF validation
│   │   │   ├── personalization/# {{variable}} template substitution engine
│   │   │   └── queue/          # Rate-limited sequential dispatcher
│   │   ├── validators/         # Zod schemas for jobs
│   │   └── app.js              # Express app entry & server startup
│   ├── tests/                  # Unit & integration test suites
│   ├── vitest.config.js
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── components/         # AntD Navbar, Modals (Detail, Preview, Edit, Test)
│   │   ├── pages/              # Dashboard, JobReview, EmailQueue, SentHistory, Import, Settings
│   │   ├── services/           # Axios REST API client
│   │   ├── App.jsx             # AntD ConfigProvider & layout
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js          # Vite config with backend proxy
│   ├── index.html
│   └── package.json
│
├── data/
│   ├── incoming/               # AI agents drop new JSON files here
│   ├── processed/              # Successfully ingested files
│   └── failed/                 # Malformed / invalid JSON files
│
├── attachments/
│   └── resume.pdf              # Your resume attached to applications
│
├── templates/
│   └── application.html        # Default HTML email template
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

## 5. Prerequisites & Installation

### Prerequisites
- **Node.js:** v18+ (tested on Node.js v24)
- **MongoDB:** Community Edition running locally (`mongod`) or MongoDB Atlas connection string.

### Quick Start (One-Command Setup)

1. Clone or open the repository:
   ```bash
   cd /path/to/Cold-Mailing
   ```

2. Install all dependencies across root, server, and client:
   ```bash
   npm run install:all
   ```

3. Ensure `.env` is configured (defaults to local MongoDB and `DRY_RUN=true`):
   ```bash
   cp .env.example .env
   ```

4. Start both backend and frontend concurrently:
   ```bash
   npm run dev
   ```

5. Open your browser:
   - **Frontend UI:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://127.0.0.1:5001/api/health](http://127.0.0.1:5001/api/health)

---

## 6. Configuration & Environment Variables

Variables are configured in `.env`:

```env
# Server Binding
PORT=5001
HOST=127.0.0.1
MONGODB_URI=mongodb://127.0.0.1:27017/job_mailer

# Dry Run Mode: when true, emails are simulated and logged without sending over SMTP
DRY_RUN=true

# SMTP Configuration (Stored in .env ONLY - never exposed via API)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Personal Information
SENDER_NAME=Jeny Pansuriya
SENDER_EMAIL=jeny.pansuriya@example.com
SENDER_PHONE=+91 9876543210
PORTFOLIO_URL=https://jenypansuriya.dev
GITHUB_URL=https://github.com/jenypansuriya

# Safety Limits
DAILY_EMAIL_LIMIT=20
MIN_DELAY_SECONDS=10
MAX_DELAY_SECONDS=30
MAX_EMAILS_PER_RUN=10
RESUME_PATH=attachments/resume.pdf
```

> [!IMPORTANT]
> Non-secret parameters (templates, daily limit, delay range, personal info) can be adjusted dynamically in real time from the **Settings** UI tab without restarting the server.

---

## 7. Database Setup (MongoDB)

The application uses MongoDB via Mongoose. The database name defaults to `job_mailer` on `mongodb://127.0.0.1:27017/job_mailer`.

To check MongoDB service status on macOS:
```bash
brew services list | grep mongodb
# Or start it:
brew services start mongodb-community
```

---

## 8. JSON Input Specification

Your AI agents must generate JSON adhering to the following schema:

```json
{
  "jobs": [
    {
      "company": "ABC Technologies",
      "role": "MERN Stack Developer",
      "hrName": "Rahul Sharma",
      "hrEmail": "rahul@abctech.com",
      "jobUrl": "https://example.com/job/123",
      "source": "LinkedIn",
      "location": "Ahmedabad",
      "remote": false,
      "description": "Building high-performance React and Node.js solutions.",
      "requirements": ["React", "Node.js", "Express.js", "MongoDB"],
      "notes": "Fast growing team"
    }
  ]
}
```

### Field Requirements
- **Required:** `company`, `role`, `hrEmail`
- **Optional:** `hrName`, `jobUrl`, `source`, `location`, `remote`, `description`, `requirements`, `notes`

---

## 9. JSON Import Methods

### A) Automated Folder Ingestion
- Drop any `.json` file into `data/incoming/`.
- The background watcher immediately detects, parses, validates, and deduplicates the records.
- Successful files are safely archived to `data/processed/`.
- Malformed files are relocated to `data/failed/` with an audit error recorded.

### B) Web Drag-and-Drop & Direct Paste
- Navigate to the **Import JSON** tab in the dashboard.
- Drag-and-drop a `.json` file or paste raw JSON.
- An **Import Summary** modal instantly displays the breakdown:
  - **Total Records**
  - **Valid Records**
  - **New Jobs**
  - **Duplicates Detected**
  - **Invalid Records**

---

## 10. Duplicate Detection & Contact Safety

AI agents frequently encounter the same recruiter or listing across LinkedIn, Naukri, or job portals.

1. **Email Normalization:** All emails are trimmed and converted to lowercase (e.g. `HR@ABC.COM`, `hr@abc.com`, and ` HR@abc.com ` are treated identically).
2. **Contact History Check:** If an HR contact has already been emailed previously, a warning alert is flagged with the exact count and date of prior outreach.
3. **Job Key Normalization:** `company + role + normalized URL` is checked against existing entries.
4. **Safety Rule:** No duplicate is automatically emailed without deliberate human review.

---

## 11. Email Template & Dynamic Personalization

Default Subject:
```text
Application for {{role}} – {{company}}
```

Default Body:
```text
Dear {{hrNameOrHiringTeam}},

I am writing to express my interest in the {{role}} position at {{company}}.

I have experience working with React.js, Node.js, Express.js, MongoDB, REST APIs and modern web development technologies. I would be glad to discuss how my experience could contribute to your team.

I have attached my resume for your consideration.

Thank you for your time.

Best regards,
{{senderName}}
Frontend / Full Stack Developer
Email: {{senderEmail}}
Phone: {{senderPhone}}
Portfolio: {{portfolioUrl}}
GitHub: {{githubUrl}}
```

### Available Template Variables:
- `{{company}}`: Company name
- `{{role}}`: Job title
- `{{hrName}}`: Recruiter name
- `{{hrNameOrHiringTeam}}`: Outputs recruiter name if available (e.g., `Dear Rahul,`), otherwise falls back to `Dear Hiring Team,`
- `{{location}}`: Job location
- `{{jobUrl}}`: Listing URL
- `{{senderName}}`: Configured in Settings
- `{{senderEmail}}`: Configured in Settings
- `{{senderPhone}}`: Configured in Settings
- `{{portfolioUrl}}`: Configured in Settings
- `{{githubUrl}}`: Configured in Settings

---

## 12. Resume Attachment Configuration

- **Default Location:** `attachments/resume.pdf`
- **Validation Rules:**
  - File must exist on disk.
  - File extension must strictly be `.pdf`.
  - File size must be under 10MB.
- You can upload a replacement resume at any time from the **Settings** tab.

---

## 13. Email Dispatch Queue & Rate Limiter

- **Start / Pause:** Toggle sending using the global header button or the Queue tab.
- **Randomized Delays:** Before dispatching each email, the queue pauses for a random interval between `MIN_DELAY_SECONDS` and `MAX_DELAY_SECONDS` to simulate authentic human behavior.
- **Daily Limit Enforcement:** Automatically tracks emails sent today; upon reaching `DAILY_EMAIL_LIMIT`, the queue halts automatically.
- **Crash Recovery:** If the application restarts while an email was in `SENDING` status, it safely rolls back to `QUEUED`.
- **Retry Mechanism:** Failed emails record the exact SMTP error and can be retried individually or in batch (up to 3 retries).

---

## 14. Dry Run Simulation Mode

When `DRY_RUN=true` (the default):
- Applications flow through the entire approval and queue pipeline.
- Nodemailer is bypassed and the full personalized email is logged:
  ```text
  [DRY RUN]
  Would send:
  To: rahul@abctech.com
  From: "Jeny Pansuriya" <jeny.pansuriya@example.com>
  Subject: Application for MERN Stack Developer – ABC Technologies
  Attachment: resume.pdf
  ```
- Toggle between **DRY RUN** and **LIVE SMTP** in Settings whenever you are ready.

---

## 15. Automated Testing

Run the Vitest test suite:
```bash
npm test
```
The test suite covers:
- Zod schema validation
- Email normalization & duplicate matching
- Personalization template substitution & fallbacks
- Resume PDF validation & mock transport
- Importer batch breakdown & error trapping
- Queue rate limiter, daily limits, and crash recovery

> [!NOTE]
> Tests run with mock/dry-run transports and **NEVER** transmit live emails.

---

## 16. Troubleshooting & FAQ

**Q: Where do I place JSON files generated by my AI agents?**  
A: Drop them into `data/incoming/`. The server watcher will process them within 2 seconds.

**Q: How do I test email delivery safely?**  
A: Open the **Settings** or **Job Review** tab and click **Send Test Email**. Provide your personal test email address. It will send a sample application with your resume attached directly to your test email without contacting recruiters.

**Q: MongoDB connection error on startup?**  
A: Ensure your MongoDB daemon is running:
```bash
brew services start mongodb-community
```
Or check with:
```bash
mongosh mongodb://127.0.0.1:27017/job_mailer
```

---

© 2026 Jeny Pansuriya – Local Job Application Mailer
