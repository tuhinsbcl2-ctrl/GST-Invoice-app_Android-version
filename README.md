# Nibrity GST Invoice — Android PWA

A **fully offline** Progressive Web App (PWA) for **NIBRITY ENTERPRISE** — Tax Invoice and Delivery Challan management on Android phones.

## Features

| Feature | Details |
|---|---|
| **Tax Invoice** | Create/edit/view with auto-sequencing (NE/001/25-26), dynamic items, GST calculation |
| **Delivery Challan** | 4-copy format (Original, Duplicate, Triplicate, Extra) with lot/mfg/exp dates |
| **GST Calculation** | Auto CGST+SGST (intra-state) or IGST (inter-state) based on state codes |
| **HSN Breakup** | HSN-wise tax summary table on each invoice |
| **Amount in Words** | Indian numbering (Crore, Lakh, Thousand) |
| **Customers** | Full CRUD with GSTIN, state code, address |
| **Products** | Catalog with HSN, GST rate, stock management |
| **Expenses** | Track by category, Cash/Bank mode |
| **Reports** | Invoice & expense summaries by date range |
| **Offline** | IndexedDB — all data on-device, no internet needed after install |
| **PWA** | Installable to Android home screen |
| **Backup/Restore** | Manual ZIP backup — local download or Google Drive |

## Installation on Android

1. Open **Chrome** on your Android phone
2. Visit the app URL (e.g. your GitHub Pages URL)
3. Tap the **⋮ (3-dot menu) → "Add to Home screen"** or **"Install app"**
4. The app icon appears on your home screen and works fully **offline**

## Backup & Restore with Google Drive

All backup/restore options are at **More → Backup & Restore**.

### Backup filename format

```
NibrityGSTBackup_YYYY-MM-DD_HH-mm.zip
```

Example: `NibrityGSTBackup_2026-03-30_18-45.zip`

Each backup is a separate ZIP file (never overwritten). Backups are stored in a
Google Drive folder named **`NibrityGSTBackups`**.

### ZIP contents

| File | Description |
|---|---|
| `backup.json` | All app data (settings, customers, products, invoices, invoice items, challans, challan items, expenses, invoice sequences) |
| `meta.json` | App version, schema version, creation timestamp, device info, record counts |

### How to back up (Phone 1 → Google Drive)

1. Open the app → **More → Backup & Restore**
2. Tap **💾 Create & Download Backup** to save the ZIP locally, **OR**
3. Tap **🔑 Sign in with Google** and then **☁️ Upload Backup to Google Drive**
4. The backup is saved as `NibrityGSTBackup_YYYY-MM-DD_HH-mm.zip` in Drive

### How to restore (Phone 2 ← Google Drive)

1. Open the app on the second phone → **More → Backup & Restore**
2. Tap **🔑 Sign in with Google** (same Google account used for backup)
3. Tap **📋 List Backups in Drive**
4. Select the backup you want → tap **Restore**
5. Confirm the warning: *"This will overwrite all data on this phone"*
6. All data is imported; app reloads automatically

### Restore from local file

If you downloaded the ZIP locally (e.g. transferred via Bluetooth/USB):

1. **More → Backup & Restore → Select a .zip backup file**
2. Confirm the warning → data is imported

### What happens on Restore

- Existing IndexedDB is **completely wiped**
- Schema is recreated fresh
- All records (customers, products, invoices, invoice items, challans, expenses) are imported
- Invoice numbering sequence is restored so numbering continues correctly
- Record counts are verified after import

### Setting up Google OAuth (for Drive upload/download)

The Drive integration requires a Google OAuth 2.0 Client ID.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → **APIs & Services → Credentials**
3. Create an **OAuth 2.0 Client ID** (type: **Web application**)
4. Add your app's URL to **Authorised JavaScript origins**
5. Enable the **Google Drive API** for your project
6. Copy the Client ID and replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
   in `js/backup.js` (the `GOOGLE_CLIENT_ID` constant at the top of the file)

> **Note:** Without a valid Client ID, the local download backup still works fully offline.

## Security Note

- **On-device:** All app data is stored in the browser's IndexedDB on your phone.
  It is not accessible to other apps or websites.
- **Google Drive:** Backup ZIPs are uploaded to your own Google Drive account
  under the `NibrityGSTBackups` folder. Only you (and anyone with access to your
  Drive) can see these files.
- **OAuth tokens** are stored **in memory only** — never written to localStorage or
  IndexedDB. They expire after ~1 hour and must be refreshed via the Google sign-in popup.
- **No backend server** is involved at any point. All operations are client-side.

## Pre-Seeded Settings (NIBRITY ENTERPRISE)

- **Company**: NIBRITY ENTERPRISE
- **GSTIN**: 19CDOPM2160E1ZH
- **State**: West Bengal (Code: 19)
- **Bank**: Punjab National Bank, SONARGAON branch
- **Invoice Prefix**: NE → format: `NE/001/25-26`

## File Structure

```
GST-Invoice-app_Android-version/
├── index.html              # Main SPA entry point
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching
├── css/
│   └── style.css           # Mobile-optimized styles
├── js/
│   ├── app.js              # Main router/navigation
│   ├── db.js               # IndexedDB CRUD (via Dexie.js)
│   ├── backup.js           # Backup/Restore + Google Drive integration
│   ├── invoice.js          # Invoice create/edit/view/list
│   ├── challan.js          # Challan generation & viewing
│   ├── customer.js         # Customer CRUD
│   ├── product.js          # Product CRUD
│   ├── expense.js          # Expense CRUD
│   ├── settings.js         # Company settings
│   ├── reports.js          # Reports generation
│   ├── gst-calculator.js   # GST calculation (ported from Python)
│   ├── number-to-words.js  # Amount to words (ported from Python)
│   ├── invoice-numbering.js # Auto-sequence numbering
│   └── lib/
│       ├── dexie.min.js    # IndexedDB wrapper
│       └── jszip.min.js    # ZIP file creation/reading
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Technology Stack

- **Pure HTML5 + CSS3 + JavaScript** — no server required
- **Dexie.js** (IndexedDB wrapper) for offline storage
- **JSZip** for ZIP backup file creation and parsing
- **Google Identity Services** for OAuth 2.0 Drive access
- **Google Drive API v3** for upload/list/download
- **Service Worker** for full offline capability
- **Mobile-first** responsive UI (touch-friendly, 48px+ tap targets)
- Color scheme: Deep blue (`#1a237e`) primary, orange (`#ff6d00`) accent

## Running Locally

Simply open `index.html` in Chrome (no server needed), or serve with any static file server:

```bash
npx serve .
# or
python -m http.server 8080
```

