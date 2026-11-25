# BillFlow — Complete Documentation, Backup, Maintenance & Change Guide

**BillFlow** is a centralized Client, Invoice & Payment Management System built with Node.js, Express 5, and SQLite (`node:sqlite`). This guide covers setup, multi-user access, daily backups, maintenance, and how to make common changes safely.

---

## Table of Contents
1. [Project Structure & Tech Stack](#1-project-structure--tech-stack)
2. [Installation & Transferring to Another PC](#2-installation--transferring-to-another-pc)
3. [Multi-User & Remote Access](#3-multi-user--remote-access)
4. [Backup & Disaster Recovery](#4-backup--disaster-recovery)
5. [Routine Maintenance Checklist](#5-routine-maintenance-checklist)
6. [How to Make Common Changes](#6-how-to-make-common-changes)
7. [Cloud Hosting (Pay-Per-Use VPS Option)](#7-cloud-hosting-pay-per-use-vps-option)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Project Structure & Tech Stack

| Folder / File | Purpose |
| :--- | :--- |
| `server/index.js` | Main Express 5 web server (default port `3000`). |
| `server/db.js` | SQLite (`node:sqlite`) initialization, schema, and seed data. Supports `DB_DIR` env variable. |
| `server/routes/` | REST APIs (`auth`, `clients`, `services`, `invoices`, `payments`, `reports`, `settings`, `backup`, `audit`). |
| `server/middleware/` | Authentication (`auth.js`) and compliance audit logging (`audit.js`). |
| `data/rsa_billing.db` | **Primary database file** storing all clients, services, invoices, payments, settings, and users. |
| `public/` | Frontend Single Page Application (`index.html`, `css/`, `js/`, `assets/`, `uploads/`). |
| `public/js/components/invoiceModal.js` | A4 invoice renderer, **Download PDF** (`html2pdf.bundle.min.js`), **Print / Browser PDF**, and **Offline HTML**. |
| `scripts/start-server.bat` | Starts the local server and opens `http://localhost:3000`. |
| `scripts/start-cloudflare-tunnel.bat` | Auto-downloads `cloudflared.exe` (into `tools/`) and opens a public HTTPS tunnel. |
| `scripts/start-all.bat` | Launches both the local server and Cloudflare tunnel together. |
| `scripts/daily-backup.bat` & `daily-backup.ps1` | Copies `data/rsa_billing.db` with timestamp and cleans backups older than 30 days. |

**Requirements:**
- **Node.js v22.5+ or v24 LTS** (required for built-in `node:sqlite`).

---

## 2. Installation & Transferring to Another PC

### Moving BillFlow to Your Brother's / Office PC
1. **Copy the folder:** Copy the entire `D:\bsm` folder to a USB drive and paste it on the target PC (e.g. `D:\bsm`). *(Your database `data\rsa_billing.db` is inside it, so all records move with it).*
2. **Install Node.js:** Download and install **Node.js LTS (v24)** from [https://nodejs.org](https://nodejs.org).
3. **First Run:** Double-click `scripts\start-server.bat`. If `node_modules` is missing, it runs `npm install` automatically and opens `http://localhost:3000`.
4. **Default Logins:**
   - **Admin / Owner:** `admin` / `admin123`
   - **Billing Staff:** `billing` / `billing123`
   *(Change these passwords immediately after first login!)*

### Auto-Start Every Morning (`shell:startup`)
1. Press `Win + R`, type `shell:startup`, and press **Enter**.
2. Copy `scripts\start-server.bat` (or `scripts\start-all.bat`) &rarr; right-click inside the Startup folder &rarr; **Paste shortcut**.
3. Go to **Windows Settings &rarr; System &rarr; Power & battery &rarr; Screen and sleep** and set **"When plugged in, put my device to sleep after"** to **Never**.

---

## 3. Multi-User & Remote Access

Only the host PC needs Node.js installed. Other users only need a browser (Chrome / Edge / Safari).

### Adding User Accounts
1. Log in as `admin`.
2. Go to **Settings & Compliance &rarr; User Accounts & Access Control**.
3. Click **Add New User** to create separate logins for each team member (`admin`, `billing`, or `viewer` role).

### Option A: Office Wi-Fi / LAN (Fastest, Works Offline)
1. On the host PC, open Command Prompt and run `ipconfig` to find its **IPv4 Address** (e.g., `192.168.1.25`).
2. Allow port `3000` in Windows Firewall (run once in PowerShell as Administrator):
   ```powershell
   netsh advfirewall firewall add rule name="BillFlow Server" dir=in action=allow protocol=TCP localport=3000
   ```
3. Other users open `http://192.168.1.25:3000` in Chrome.

### Option B: Remote Access from Anywhere (Cloudflare Tunnel — ₹0)
1. Double-click `scripts\start-cloudflare-tunnel.bat`.
2. Copy the generated `https://xxxx.trycloudflare.com` link from the terminal and share it with your team.
3. Keep the terminal window open while remote access is needed.

---

## 4. Backup & Disaster Recovery

> [!IMPORTANT]
> Never rely on a single copy on one laptop. Always keep an off-site copy in **Google Drive** or **OneDrive**.

### A. Manual Backup (From the Web UI)
1. Log in as `admin` &rarr; **Settings & Compliance &rarr; Backup & Recovery**.
2. Click either:
   - **Download Complete JSON Backup** (portable full snapshot), or
   - **Download Raw SQLite Database (.db)** (exact copy of `rsa_billing.db`).
3. Save the downloaded file into your Google Drive / OneDrive folder.

### B. Automated Daily Backup (6:00 PM Every Day)
1. Open `scripts\daily-backup.ps1` in Notepad.
2. Update `$BackupDir` (lines 8–12) to point to your synced cloud folder:
   ```powershell
   # $BackupDir = "D:\bsm_backups"
   $BackupDir = Join-Path $env:USERPROFILE "OneDrive\BSM_Backups"
   # OR for Google Drive:
   # $BackupDir = Join-Path $env:USERPROFILE "Google Drive\BSM_Backups"
   ```
3. Press `Win + R` &rarr; type `taskschd.msc` &rarr; **Enter**.
4. Click **Create Basic Task...**:
   - **Name:** `BillFlow Daily Backup`
   - **Trigger:** Daily at `6:00 PM`
   - **Action:** Start a program &rarr; `D:\bsm\scripts\daily-backup.bat`
   - **Start in:** `D:\bsm`

### C. How to Restore from a Backup
- **Method 1 (Via Web UI):** Go to **Settings &rarr; Backup & Recovery**, upload your `.json` backup file, and confirm restore.
- **Method 2 (Replacing the `.db` file directly — recommended for full recovery):**
  1. **Stop** the BillFlow server (close the terminal window / `Ctrl + C`).
  2. Rename the broken `data\rsa_billing.db` to `data\rsa_billing_old.db`.
  3. Copy your backup file (e.g. `rsa_billing_2026-11-25_1800.db`) into `data\` and rename it to `rsa_billing.db`.
  4. Start the server again with `scripts\start-server.bat`.

---

## 5. Routine Maintenance Checklist

| Frequency | Task | How |
| :--- | :--- | :--- |
| **Daily** | Automated backup runs | Verify `BSM_Backups` folder in OneDrive/Google Drive has today's `.db` file. |
| **Weekly** | Check disk space & server window | Ensure host PC is plugged in and Windows Updates haven't paused it. |
| **Monthly** | Restore test | Open a backup `.db` copy on a second PC (or check file size > 0 KB) to verify backups aren't corrupt. |
| **Yearly (April 1)** | New Financial Year check | Verify invoice prefix & sequence settings in **Settings & Compliance** for the new FY (`27-28`, etc.). |

---

## 6. How to Make Common Changes

### Changes Without Touching Code (Settings UI)
Log in as `admin` &rarr; **Settings & Compliance**:
- **Firm Name, Tagline, Address, PAN, GSTIN, Logo:** Edit in **Firm Profile & Letterhead** and click Save.
- **Bank Name, Account No, IFSC, UPI ID:** Edit in **Bank & UPI Remittance** (automatically updates the QR code on all new/viewed invoices).
- **Invoice Prefix (`BF/`), Terms & Declarations, Default GST %:** Edit in **Invoicing & Tax Rules**.
- **Add/Remove Staff or Reset Passwords:** Manage in **User Accounts & Access Control**.

### Code / Configuration Changes
- **Change Server Port (default `3000`):** Set the `PORT` environment variable before starting, or edit `const PORT = process.env.PORT || 3000;` in `server/index.js`.
- **Change Database Location:** Set `DB_DIR` environment variable (used by `server/db.js`).
- **Change Backup Retention (default `30` days):** Edit `AddDays(-30)` on line 32 of `scripts/daily-backup.ps1`.
- **Invoice PDF Layout / Styling:** Edit `public/js/components/invoiceModal.js` and `public/css/app.css` / `public/css/print.css`.

### Saving & Syncing Code Changes via GitHub
After making any code changes on your development PC:
```bash
git status
git add .
git commit -m "Describe your change"
git push origin main
```
To update the office/brother PC with the latest code (without overwriting `data/rsa_billing.db`, which is git-ignored):
```bash
git pull origin main
npm install
```
*(Then restart `start-server.bat`.)*

---

## 7. Cloud Hosting (Pay-Per-Use VPS Option)

If you ever outgrow hosting on an office PC and want 24/7 cloud access:
- **True Pay-Per-Use (Fly.io, ~₹50–₹120/mo):** Auto-sleeps when idle, wakes in ~1s on request, mounts a 1 GB persistent volume at `/app/data` with `DB_DIR=/app/data`.
- **Always-On Hourly VPS (Hetzner / DigitalOcean, ~₹300–₹350/mo):** Ubuntu 24.04 + Node.js 24 + `pm2` + `caddy` (automatic HTTPS).

---

## 8. Troubleshooting

| Issue | Cause & Quick Fix |
| :--- | :--- |
| **`node` is not recognized** | Node.js is not installed or terminal wasn't restarted after installing. Install Node.js 24 LTS from `nodejs.org`. |
| **`Cannot find module 'node:sqlite'`** | Node.js version is too old (e.g. v18 or v20). Upgrade to **Node.js 22.5+ or 24**. |
| **`EADDRINUSE: address already in use :::3000`** | BillFlow is already running in another window. Close the existing terminal or use the running instance. |
| **Colleague cannot open `http://<IP>:3000`** | 1) Host PC is asleep/off. 2) Different Wi-Fi network. 3) Windows Firewall blocking port `3000` (run the `netsh` rule in Section 3). |
| **Cloudflare link shows `502 Bad Gateway`** | The tunnel is running, but `start-server.bat` (Node server on port 3000) stopped or was closed. |
| **PDF looks unstyled / old data** | Press `Ctrl + F5` in the browser to hard-refresh cached JavaScript/CSS files. |
