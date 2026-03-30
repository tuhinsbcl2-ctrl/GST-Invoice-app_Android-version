/**
 * Backup & Restore Module
 *
 * - Creates ZIP backup: NibrityGSTBackup_YYYY-MM-DD_HH-mm.zip
 *   containing backup.json (all app data) and meta.json (metadata)
 * - Downloads ZIP locally
 * - Uploads ZIP to Google Drive (folder: NibrityGSTBackups)
 * - Lists backups from Google Drive
 * - Downloads a selected backup from Google Drive
 * - Restores: wipes local IndexedDB, recreates schema, imports all records
 *
 * Google Drive integration uses:
 *   - Google Identity Services (GSI) for OAuth 2.0 token popup
 *   - Google Drive REST API v3 (multipart upload / list / download)
 *
 * SETUP REQUIRED:
 *   Replace GOOGLE_CLIENT_ID below with your own OAuth 2.0 client ID
 *   created at https://console.cloud.google.com/
 *   Authorised JavaScript origins must include your app's URL.
 */

'use strict';

const BackupModule = (() => {
  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const APP_VERSION   = '1.0.0';
  const SCHEMA_VER    = 1;
  const DRIVE_FOLDER  = 'NibrityGSTBackups';
  const DB_NAME       = 'NibrityGSTInvoice';

  // Replace with your Google OAuth 2.0 Client ID.
  // If left as the placeholder the Drive features will show an error message;
  // all local backup/restore operations continue to work without a Client ID.
  const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';

  // In-memory token storage (never persisted to localStorage/IDB)
  let _accessToken = null;
  let _tokenExpiry  = 0;

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  /** Returns "YYYY-MM-DD_HH-mm" in local time (24-hour) */
  function _dateTimeStamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const y   = now.getFullYear();
    const mo  = pad(now.getMonth() + 1);
    const d   = pad(now.getDate());
    const h   = pad(now.getHours());
    const mi  = pad(now.getMinutes());
    return `${y}-${mo}-${d}_${h}-${mi}`;
  }

  /** Returns the backup ZIP filename */
  function _zipName() {
    return `NibrityGSTBackup_${_dateTimeStamp()}.zip`;
  }

  /** Returns device name if available */
  function _deviceName() {
    try { return navigator.userAgent || 'Unknown'; } catch { return 'Unknown'; }
  }

  // ─── DATA COLLECTION ───────────────────────────────────────────────────────

  /** Collects all data from IndexedDB and returns {backup, meta} objects */
  async function _collectData() {
    const [
      settings,
      customers,
      products,
      invoices,
      invoiceItems,
      challans,
      challanItems,
      expenses,
      sequences,
    ] = await Promise.all([
      DB.getSettings(),
      DB.getCustomers(),
      DB.getProducts(),
      DB.getInvoices(),
      _getAllInvoiceItems(),
      DB.getChallans(),
      _getAllChallanItems(),
      DB.getExpenses(),
      _getAllSequences(),
    ]);

    const backup = {
      settings,
      customers,
      products,
      invoices,
      invoice_items: invoiceItems,
      challans,
      challan_items: challanItems,
      expenses,
      invoice_sequences: sequences,
    };

    const meta = {
      app_version:    APP_VERSION,
      schema_version: SCHEMA_VER,
      created_at:     new Date().toISOString(),
      device_name:    _deviceName(),
      record_counts: {
        customers:         customers.length,
        products:          products.length,
        invoices:          invoices.length,
        invoice_items:     invoiceItems.length,
        challans:          challans.length,
        challan_items:     challanItems.length,
        expenses:          expenses.length,
        invoice_sequences: sequences.length,
      },
    };

    return { backup, meta };
  }

  async function _getAllInvoiceItems() {
    // Dexie table access via the internal db object – exposed through DB module
    const invoices = await DB.getInvoices();
    const items = [];
    for (const inv of invoices) {
      const full = await DB.getInvoice(inv.id);
      if (full && full.items) items.push(...full.items);
    }
    return items;
  }

  async function _getAllChallanItems() {
    const challans = await DB.getChallans();
    const items = [];
    for (const ch of challans) {
      const full = await DB.getChallan(ch.id);
      if (full && full.items) items.push(...full.items);
    }
    return items;
  }

  async function _getAllSequences() {
    // Access the raw Dexie table through a workaround:
    // DB module does not expose a bulk-get for sequences so we use
    // the global Dexie instance name to open a read-only transaction.
    try {
      const tmpDb = new Dexie(DB_NAME);
      tmpDb.version(SCHEMA_VER).stores({
        settings:          'id',
        customers:         '++id, name, gstin',
        products:          '++id, catalog_no, name, hsn_code',
        invoices:          '++id, invoice_no, date, buyer_name, payment_status',
        invoice_items:     '++id, invoice_id',
        challans:          '++id, challan_no, date, invoice_id',
        challan_items:     '++id, challan_id',
        expenses:          '++id, date, category',
        invoice_sequences: '[prefix+financial_year]',
      });
      await tmpDb.open();
      const seqs = await tmpDb.invoice_sequences.toArray();
      tmpDb.close();
      return seqs;
    } catch {
      return [];
    }
  }

  // ─── ZIP CREATION ──────────────────────────────────────────────────────────

  /**
   * Creates a JSZip blob containing backup.json + meta.json
   * @returns {Promise<{blob: Blob, filename: string}>}
   */
  async function createBackupZip() {
    const { backup, meta } = await _collectData();
    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify(backup, null, 2));
    zip.file('meta.json',   JSON.stringify(meta,   null, 2));
    const blob = await zip.generateAsync({
      type:               'blob',
      compression:        'DEFLATE',
      compressionOptions: { level: 6 },
    });
    return { blob, filename: _zipName() };
  }

  // ─── LOCAL DOWNLOAD ────────────────────────────────────────────────────────

  /** Creates a backup ZIP and triggers browser download */
  async function downloadBackupLocally() {
    _setStatus('Creating backup…');
    try {
      const { blob, filename } = await createBackupZip();
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      _setStatus(`✅ Backup saved: ${filename}`);
      showToast(`Backup downloaded: ${filename}`, 'success');
    } catch (err) {
      _setStatus(`❌ Backup failed: ${err.message}`);
      showToast('Backup failed: ' + err.message, 'error');
      throw err;
    }
  }

  // ─── GOOGLE OAUTH ──────────────────────────────────────────────────────────

  /** Returns true if we have a valid (not expired) token */
  function _hasToken() {
    return !!_accessToken && Date.now() < _tokenExpiry;
  }

  /**
   * Requests a new OAuth token using Google Identity Services popup flow.
   * Token is stored only in memory (never persisted).
   */
  function _requestToken() {
    return new Promise((resolve, reject) => {
      if (GOOGLE_CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
        reject(new Error(
          'Google Drive is not configured. ' +
          'Please set your OAuth 2.0 Client ID in js/backup.js (GOOGLE_CLIENT_ID). ' +
          'See README.md → "Setting up Google OAuth" for instructions.'
        ));
        return;
      }
      if (typeof google === 'undefined' || !google.accounts) {
        reject(new Error('Google Identity Services not loaded. Check your internet connection.'));
        return;
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope:     SCOPES,
        callback:  (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          _accessToken = response.access_token;
          // expires_in is in seconds; subtract 60s buffer
          _tokenExpiry = Date.now() + ((response.expires_in - 60) * 1000);
          resolve(response.access_token);
        },
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  /** Ensures a valid token is available, requesting one if needed */
  async function _ensureToken() {
    if (_hasToken()) return _accessToken;
    return _requestToken();
  }

  /** Sign out / revoke the current token */
  function signOut() {
    if (_accessToken && typeof google !== 'undefined' && google.accounts) {
      google.accounts.oauth2.revoke(_accessToken, () => {});
    }
    _accessToken = null;
    _tokenExpiry  = 0;
    _updateSignInUI(false);
    showToast('Signed out from Google', 'info');
  }

  // ─── GOOGLE DRIVE ──────────────────────────────────────────────────────────

  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  function _authHeader() {
    return { Authorization: `Bearer ${_accessToken}` };
  }

  /** Finds or creates the NibrityGSTBackups folder; returns folder ID */
  async function _ensureFolder() {
    // Search for existing folder
    const q    = `name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const resp = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      { headers: _authHeader() }
    );
    if (!resp.ok) throw new Error(`Drive API error: ${resp.status} ${resp.statusText}`);
    const data  = await resp.json();
    if (data.files && data.files.length > 0) return data.files[0].id;

    // Create folder
    const createResp = await fetch(`${DRIVE_API}/files`, {
      method:  'POST',
      headers: { ...(_authHeader()), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     DRIVE_FOLDER,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    if (!createResp.ok) throw new Error(`Failed to create Drive folder: ${createResp.status}`);
    const folder = await createResp.json();
    return folder.id;
  }

  /** Uploads a ZIP blob to Google Drive using multipart upload */
  async function _uploadToDrive(blob, filename, folderId) {
    const metadata = {
      name:    filename,
      parents: [folderId],
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file',     blob, filename);

    const resp = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime,size`, {
      method:  'POST',
      headers: _authHeader(),
      body:    form,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Upload failed: ${resp.status} — ${errText}`);
    }
    return resp.json();
  }

  /** Signs in and uploads a new backup to Google Drive */
  async function uploadToGoogleDrive() {
    _setStatus('Signing in to Google…');
    try {
      await _ensureToken();
      _updateSignInUI(true);
      _setStatus('Creating backup ZIP…');
      const { blob, filename } = await createBackupZip();
      _setStatus('Finding/creating Drive folder…');
      const folderId = await _ensureFolder();
      _setStatus(`Uploading ${filename}…`);
      const file = await _uploadToDrive(blob, filename, folderId);
      _setStatus(`✅ Uploaded: ${file.name}`);
      showToast(`Uploaded to Google Drive: ${file.name}`, 'success');
      return file;
    } catch (err) {
      _setStatus(`❌ Upload failed: ${err.message}`);
      showToast('Upload failed: ' + err.message, 'error');
      throw err;
    }
  }

  /** Lists backup files from Google Drive, sorted newest-first */
  async function listDriveBackups() {
    _setStatus('Loading backups from Drive…');
    try {
      await _ensureToken();
      _updateSignInUI(true);
      const folderId = await _ensureFolder();
      const q = `'${folderId}' in parents and trashed=false and name contains 'NibrityGSTBackup'`;
      const resp = await fetch(
        `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc&pageSize=50`,
        { headers: _authHeader() }
      );
      if (!resp.ok) throw new Error(`Drive list error: ${resp.status}`);
      const data = await resp.json();
      _setStatus(`Found ${(data.files || []).length} backup(s)`);
      return data.files || [];
    } catch (err) {
      _setStatus(`❌ ${err.message}`);
      showToast('Failed to list backups: ' + err.message, 'error');
      throw err;
    }
  }

  /** Downloads a backup file from Google Drive by file ID; returns Blob */
  async function _downloadDriveFile(fileId) {
    const resp = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: _authHeader(),
    });
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    return resp.blob();
  }

  // ─── RESTORE ───────────────────────────────────────────────────────────────

  /** Parses a ZIP blob and extracts backup.json content */
  async function _extractBackup(zipBlob) {
    const zip         = await JSZip.loadAsync(zipBlob);
    const backupFile  = zip.file('backup.json');
    if (!backupFile) throw new Error('Invalid backup: backup.json not found in ZIP');
    const jsonStr = await backupFile.async('string');
    return JSON.parse(jsonStr);
  }

  /**
   * Wipes the entire IndexedDB and re-creates it with fresh Dexie schema,
   * then imports all records from the backup object.
   */
  async function _wipeAndImport(backupData) {
    // Step 1: Delete the database entirely
    await Dexie.delete(DB_NAME);

    // Step 2: Re-create the schema (same as db.js)
    const db = new Dexie(DB_NAME);
    db.version(SCHEMA_VER).stores({
      settings:          'id',
      customers:         '++id, name, gstin',
      products:          '++id, catalog_no, name, hsn_code',
      invoices:          '++id, invoice_no, date, buyer_name, payment_status',
      invoice_items:     '++id, invoice_id',
      challans:          '++id, challan_no, date, invoice_id',
      challan_items:     '++id, challan_id',
      expenses:          '++id, date, category',
      invoice_sequences: '[prefix+financial_year]',
    });
    await db.open();

    // Step 3: Import all records
    const B = backupData;

    if (B.settings) {
      await db.settings.put({ ...B.settings, id: 1 });
    }
    if (B.customers      && B.customers.length)      await db.customers.bulkPut(B.customers);
    if (B.products       && B.products.length)       await db.products.bulkPut(B.products);
    if (B.invoices       && B.invoices.length)       await db.invoices.bulkPut(B.invoices);
    if (B.invoice_items  && B.invoice_items.length)  await db.invoice_items.bulkPut(B.invoice_items);
    if (B.challans       && B.challans.length)       await db.challans.bulkPut(B.challans);
    if (B.challan_items  && B.challan_items.length)  await db.challan_items.bulkPut(B.challan_items);
    if (B.expenses       && B.expenses.length)       await db.expenses.bulkPut(B.expenses);
    if (B.invoice_sequences && B.invoice_sequences.length) {
      await db.invoice_sequences.bulkPut(B.invoice_sequences);
    }

    // Step 4: Verify counts
    const counts = {
      customers:     await db.customers.count(),
      products:      await db.products.count(),
      invoices:      await db.invoices.count(),
      invoice_items: await db.invoice_items.count(),
      expenses:      await db.expenses.count(),
    };

    db.close();
    return counts;
  }

  /**
   * Restores from a ZIP blob.
   * Shows a confirmation dialog before wiping local data.
   */
  async function restoreFromZipBlob(zipBlob) {
    const confirmed = await _showRestoreConfirm();
    if (!confirmed) {
      _setStatus('Restore cancelled.');
      return;
    }
    _setStatus('Extracting backup…');
    try {
      const backupData = await _extractBackup(zipBlob);
      _setStatus('Wiping local data and importing…');
      const counts = await _wipeAndImport(backupData);
      _setStatus(
        `✅ Restore complete! ` +
        `Invoices: ${counts.invoices}, Customers: ${counts.customers}, ` +
        `Products: ${counts.products}, Expenses: ${counts.expenses}`
      );
      showToast('Restore successful! Please reload the app.', 'success', 6000);
      // Offer to reload
      setTimeout(() => {
        if (confirm('Restore complete. Reload the app now to see your data?')) {
          window.location.reload();
        }
      }, 800);
    } catch (err) {
      _setStatus(`❌ Restore failed: ${err.message}`);
      showToast('Restore failed: ' + err.message, 'error');
      throw err;
    }
  }

  /** Restores from a local file chosen by the user */
  async function restoreFromLocalFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      showToast('Please select a valid .zip backup file', 'error');
      return;
    }
    await restoreFromZipBlob(file);
  }

  /** Downloads selected Drive backup and restores */
  async function restoreFromDrive(fileId, fileName) {
    _setStatus(`Downloading ${fileName} from Drive…`);
    try {
      await _ensureToken();
      const blob = await _downloadDriveFile(fileId);
      await restoreFromZipBlob(blob);
    } catch (err) {
      _setStatus(`❌ ${err.message}`);
      showToast('Restore from Drive failed: ' + err.message, 'error');
      throw err;
    }
  }

  // ─── UI HELPERS ────────────────────────────────────────────────────────────

  function _setStatus(msg) {
    const el = document.getElementById('backup-status');
    if (el) el.textContent = msg;
  }

  function _updateSignInUI(signedIn) {
    const btnSignIn  = document.getElementById('btn-gdrive-signin');
    const btnSignOut = document.getElementById('btn-gdrive-signout');
    const driveOps   = document.getElementById('drive-operations');
    if (btnSignIn)  btnSignIn.style.display  = signedIn ? 'none'  : 'inline-flex';
    if (btnSignOut) btnSignOut.style.display = signedIn ? 'inline-flex' : 'none';
    if (driveOps)   driveOps.style.display   = signedIn ? 'block' : 'none';
  }

  /** Blocking confirmation dialog for restore */
  function _showRestoreConfirm() {
    return new Promise(resolve => {
      const overlay = document.getElementById('restore-confirm-overlay');
      if (!overlay) {
        // Fallback to native confirm
        resolve(confirm('⚠️ This will overwrite ALL data on this phone with the backup. Continue?'));
        return;
      }
      overlay.style.display = 'flex';
      document.getElementById('restore-confirm-yes').onclick = () => {
        overlay.style.display = 'none';
        resolve(true);
      };
      document.getElementById('restore-confirm-no').onclick = () => {
        overlay.style.display = 'none';
        resolve(false);
      };
    });
  }

  // ─── PAGE RENDER ───────────────────────────────────────────────────────────

  /** Renders the Backup & Restore page */
  function renderPage() {
    _setStatus('Ready');
    _updateSignInUI(_hasToken());
  }

  /** Handles "List Drive Backups" button: populates the drive backup list */
  async function loadDriveList() {
    const container = document.getElementById('drive-backup-list');
    if (!container) return;
    container.innerHTML = '<p style="color:#888;padding:12px;">Loading…</p>';
    try {
      const files = await listDriveBackups();
      if (files.length === 0) {
        container.innerHTML = '<p style="color:#888;padding:12px;">No backups found in Google Drive.</p>';
        return;
      }
      container.innerHTML = '';
      for (const f of files) {
        const sizeKB  = f.size ? Math.round(Number(f.size) / 1024) : '?';
        const created = f.createdTime ? new Date(f.createdTime).toLocaleString() : '';
        const item = document.createElement('div');
        item.className = 'backup-list-item';
        item.innerHTML = `
          <div class="backup-file-info">
            <div class="backup-file-name">📦 ${_escHtml(f.name)}</div>
            <div class="backup-file-meta">${created} · ${sizeKB} KB</div>
          </div>
          <button class="btn btn-sm btn-primary restore-from-drive-btn"
                  data-id="${_escHtml(f.id)}" data-name="${_escHtml(f.name)}">
            Restore
          </button>`;
        container.appendChild(item);
      }
      // Bind restore buttons
      container.querySelectorAll('.restore-from-drive-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          restoreFromDrive(btn.dataset.id, btn.dataset.name);
        });
      });
    } catch (_) {
      container.innerHTML = '<p style="color:red;padding:12px;">Failed to load backups.</p>';
    }
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  return {
    renderPage,
    downloadBackupLocally,
    uploadToGoogleDrive,
    loadDriveList,
    restoreFromLocalFile,
    restoreFromDrive,
    signOut,
    // expose for sign-in button
    signIn: async () => {
      try {
        await _ensureToken();
        _updateSignInUI(true);
        showToast('Signed in to Google!', 'success');
      } catch (err) {
        showToast('Sign-in failed: ' + err.message, 'error');
      }
    },
  };
})();
