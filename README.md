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

## Installation on Android

1. Open Chrome on your Android phone
2. Visit the app URL
3. Tap the **☰ menu → "Add to Home screen"**
4. The app installs and works fully offline

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
│   ├── invoice.js          # Invoice create/edit/view/list
│   ├── challan.js          # Challan generation & viewing
│   ├── customer.js         # Customer CRUD
│   ├── product.js          # Product CRUD
│   ├── expense.js          # Expense CRUD
│   ├── settings.js         # Company settings
│   ├── reports.js          # Reports generation
│   ├── gst-calculator.js   # GST calculation (ported from Python)
│   ├── number-to-words.js  # Amount to words (ported from Python)
│   └── invoice-numbering.js # Auto-sequence numbering
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Technology Stack

- **Pure HTML5 + CSS3 + JavaScript** — no server required
- **Dexie.js** (IndexedDB wrapper) for offline storage
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
