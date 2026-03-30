/**
 * Delivery Challan Module
 */

'use strict';

const ChallanModule = (() => {
  let allChallans = [];
  let editingId = null;
  let itemCount = 0;
  let products = [];
  let settings = null;

  // ── List ──────────────────────────────────────────────────────────────────
  async function loadList() {
    allChallans = await DB.getChallans();
    renderList(allChallans);
    App.setHeaderActions(`<button class="header-btn" onclick="App.navigate('challan-new')" title="New Challan">➕</button>`);
  }

  function renderList(challans) {
    const el = document.getElementById('challan-list');
    if (!challans.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>No Challans Yet</h3>
        <p>Create your first delivery challan</p>
        <button class="btn btn-primary" onclick="App.navigate('challan-new')">+ New Challan</button>
      </div>`;
      return;
    }
    el.innerHTML = challans.map(ch => `
      <div class="list-item" onclick="App.navigate('challan-view', {id:${ch.id}})">
        <div class="list-item-icon orange">📦</div>
        <div class="list-item-body">
          <div class="list-item-title">${App.escHtml(ch.challan_no || '')}</div>
          <div class="list-item-subtitle">${App.escHtml(ch.consignee_name || '')}${ch.invoice_no ? ' | Inv: ' + App.escHtml(ch.invoice_no) : ''}</div>
        </div>
        <div class="list-item-right">
          <div class="list-item-date">${formatDate(ch.date)}</div>
        </div>
      </div>
    `).join('');
  }

  function onSearch(q) {
    if (!q.trim()) { renderList(allChallans); return; }
    const lower = q.toLowerCase();
    const filtered = allChallans.filter(ch =>
      (ch.challan_no || '').toLowerCase().includes(lower) ||
      (ch.consignee_name || '').toLowerCase().includes(lower)
    );
    renderList(filtered);
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  async function openForm(id) {
    editingId = id || null;
    itemCount = 0;
    settings = await DB.getSettings();
    products = await DB.getProducts();

    // Reset
    document.getElementById('ch-no').value = '';
    document.getElementById('ch-date').value = todayISO();
    document.getElementById('ch-invoice-no').value = '';
    document.getElementById('ch-consignee-name').value = '';
    document.getElementById('ch-consignee-address').value = '';
    document.getElementById('ch-consignee-gstin').value = '';
    document.getElementById('ch-vehicle-no').value = '';
    document.getElementById('ch-dispatched-through').value = '';
    document.getElementById('ch-destination').value = '';
    document.getElementById('ch-notes').value = '';
    document.getElementById('challan-items-container').innerHTML = '';

    const customers = await DB.getCustomers();
    const custSelect = document.getElementById('ch-customer-select');
    custSelect.innerHTML = '<option value="">-- Select Customer --</option>';
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      opt.dataset.customer = JSON.stringify(c);
      custSelect.appendChild(opt);
    });

    populateStateDropdown(document.getElementById('ch-consignee-state'), '');

    if (id) {
      const ch = await DB.getChallan(id);
      if (!ch) return;
      document.getElementById('ch-no').value = ch.challan_no || '';
      document.getElementById('ch-date').value = ch.date || todayISO();
      document.getElementById('ch-invoice-no').value = ch.invoice_no || '';
      document.getElementById('ch-consignee-name').value = ch.consignee_name || '';
      document.getElementById('ch-consignee-address').value = ch.consignee_address || '';
      document.getElementById('ch-consignee-gstin').value = ch.consignee_gstin || '';
      document.getElementById('ch-vehicle-no').value = ch.motor_vehicle_no || '';
      document.getElementById('ch-dispatched-through').value = ch.dispatched_through || '';
      document.getElementById('ch-destination').value = ch.destination || '';
      document.getElementById('ch-notes').value = ch.notes || '';
      populateStateDropdown(document.getElementById('ch-consignee-state'), ch.consignee_state_code || '');
      (ch.items || []).forEach(item => addItem(item));
    } else {
      addItem();
    }
  }

  function onCustomerSelect(val) {
    if (!val) return;
    const sel = document.getElementById('ch-customer-select');
    const opt = sel.selectedOptions[0];
    if (!opt) return;
    try {
      const c = JSON.parse(opt.dataset.customer || '{}');
      document.getElementById('ch-consignee-name').value = c.name || '';
      document.getElementById('ch-consignee-address').value = c.address || '';
      document.getElementById('ch-consignee-gstin').value = c.gstin || '';
      populateStateDropdown(document.getElementById('ch-consignee-state'), c.state_code || '');
    } catch (e) {}
  }

  function addItem(data = {}) {
    itemCount++;
    const idx = itemCount;
    const container = document.getElementById('challan-items-container');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.id = `ch-item-row-${idx}`;

    const prodOpts = products.map(p =>
      `<option value="${p.id}" data-name="${App.escHtml(p.name)}" data-hsn="${App.escHtml(p.hsn_code || '')}" data-unit="${App.escHtml(p.unit || 'Nos')}">${App.escHtml(p.name)}</option>`
    ).join('');

    div.innerHTML = `
      <button class="remove-item" onclick="ChallanModule.removeItem(${idx})" title="Remove">✕</button>
      <div class="form-group">
        <label class="form-label">Product</label>
        <select class="form-control" id="ch-item-product-${idx}" onchange="ChallanModule.onProductSelect(${idx})">
          <option value="">-- Select or type below --</option>
          ${prodOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description *</label>
        <input class="form-control" id="ch-item-desc-${idx}" value="${App.escHtml(data.description || '')}" placeholder="Item description">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">HSN</label>
          <input class="form-control" id="ch-item-hsn-${idx}" value="${App.escHtml(data.hsn_code || '')}" placeholder="HSN code">
        </div>
        <div class="form-group">
          <label class="form-label">Catalogue No</label>
          <input class="form-control" id="ch-item-catalog-${idx}" value="${App.escHtml(data.catalog_no || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Qty *</label>
          <input class="form-control" id="ch-item-qty-${idx}" type="number" min="0" step="0.001" value="${data.quantity || 1}">
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <input class="form-control" id="ch-item-unit-${idx}" value="${App.escHtml(data.unit || 'Nos')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Lot No</label>
          <input class="form-control" id="ch-item-lot-${idx}" value="${App.escHtml(data.lot_no || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Mfg Date</label>
          <input class="form-control" id="ch-item-mfg-${idx}" type="date" value="${data.mfg_date || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Exp Date</label>
          <input class="form-control" id="ch-item-exp-${idx}" type="date" value="${data.exp_date || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Remarks</label>
          <input class="form-control" id="ch-item-remarks-${idx}" value="${App.escHtml(data.remarks || '')}">
        </div>
      </div>
    `;
    container.appendChild(div);
  }

  function onProductSelect(idx) {
    const sel = document.getElementById(`ch-item-product-${idx}`);
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) return;
    document.getElementById(`ch-item-desc-${idx}`).value = opt.dataset.name || '';
    document.getElementById(`ch-item-hsn-${idx}`).value = opt.dataset.hsn || '';
    document.getElementById(`ch-item-unit-${idx}`).value = opt.dataset.unit || 'Nos';
  }

  function removeItem(idx) {
    const row = document.getElementById(`ch-item-row-${idx}`);
    if (row) row.remove();
  }

  function getItems() {
    const items = [];
    const container = document.getElementById('challan-items-container');
    const rows = container.querySelectorAll('.item-row');
    rows.forEach(row => {
      const idx = row.id.replace('ch-item-row-', '');
      const desc = document.getElementById(`ch-item-desc-${idx}`)?.value?.trim();
      if (!desc) return;
      items.push({
        description: desc,
        hsn_code: document.getElementById(`ch-item-hsn-${idx}`)?.value?.trim() || '',
        catalog_no: document.getElementById(`ch-item-catalog-${idx}`)?.value?.trim() || '',
        quantity: parseFloat(document.getElementById(`ch-item-qty-${idx}`)?.value) || 0,
        unit: document.getElementById(`ch-item-unit-${idx}`)?.value || 'Nos',
        lot_no: document.getElementById(`ch-item-lot-${idx}`)?.value?.trim() || '',
        mfg_date: document.getElementById(`ch-item-mfg-${idx}`)?.value || '',
        exp_date: document.getElementById(`ch-item-exp-${idx}`)?.value || '',
        remarks: document.getElementById(`ch-item-remarks-${idx}`)?.value?.trim() || '',
      });
    });
    return items;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    const challanNo = document.getElementById('ch-no').value.trim();
    const date = document.getElementById('ch-date').value;
    const consigneeName = document.getElementById('ch-consignee-name').value.trim();

    if (!challanNo) { showToast('Challan number is required', 'error'); return; }
    if (!date) { showToast('Date is required', 'error'); return; }
    if (!consigneeName) { showToast('Consignee name is required', 'error'); return; }

    const items = getItems();
    if (!items.length) { showToast('Add at least one item', 'error'); return; }

    const stateEl = document.getElementById('ch-consignee-state');
    const stateCode = stateEl.value;

    const chData = {
      challan_no: challanNo,
      date,
      invoice_no: document.getElementById('ch-invoice-no').value.trim(),
      consignee_name: consigneeName,
      consignee_address: document.getElementById('ch-consignee-address').value.trim(),
      consignee_gstin: document.getElementById('ch-consignee-gstin').value.trim().toUpperCase(),
      consignee_state_code: stateCode,
      consignee_state_name: getStateName(stateCode),
      motor_vehicle_no: document.getElementById('ch-vehicle-no').value.trim(),
      dispatched_through: document.getElementById('ch-dispatched-through').value.trim(),
      destination: document.getElementById('ch-destination').value.trim(),
      notes: document.getElementById('ch-notes').value.trim(),
    };

    if (editingId) chData.id = editingId;

    const savedId = await DB.saveChallan(chData, items.map((item, i) => ({ ...item, sl_no: i + 1 })));
    showToast('Challan saved successfully', 'success');
    App.navigate('challan-view', { id: savedId });
  }

  // ── View ──────────────────────────────────────────────────────────────────
  async function viewChallan(id) {
    const ch = await DB.getChallan(id);
    if (!ch) { showToast('Challan not found', 'error'); return; }
    settings = settings || await DB.getSettings();

    App.setHeaderActions(`
      <button class="header-btn" onclick="App.navigate('challan-edit', {id:${id}})" title="Edit">✏️</button>
      <button class="header-btn" onclick="ChallanModule.printChallan(${id})" title="Print">🖨️</button>
      <button class="header-btn" onclick="ChallanModule.deleteChallan(${id})" title="Delete">🗑️</button>
    `);

    const copies = ['Original', 'Duplicate', 'Triplicate', 'Extra Copy'];
    let copiesHtml = copies.map((copyName, copyIdx) => {
      const itemsHtml = (ch.items || []).map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${App.escHtml(item.description || '')}</td>
          <td>${App.escHtml(item.catalog_no || '')}</td>
          <td>${App.escHtml(item.hsn_code || '')}</td>
          <td class="num">${formatCurrency(item.quantity)}</td>
          <td>${App.escHtml(item.unit || '')}</td>
          <td>${App.escHtml(item.lot_no || '')}</td>
          <td>${item.mfg_date ? formatDate(item.mfg_date) : ''}</td>
          <td>${item.exp_date ? formatDate(item.exp_date) : ''}</td>
        </tr>
      `).join('');

      return `
        <div class="card print-page" style="border:2px solid var(--primary);margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <div style="font-size:11px;color:var(--text-muted)">DELIVERY CHALLAN</div>
              <div style="font-weight:700;font-size:16px">${App.escHtml(ch.challan_no || '')}</div>
            </div>
            <span class="badge badge-info" style="font-size:13px">${copyName}</span>
          </div>
          <div class="form-row" style="font-size:12px;margin-bottom:8px">
            <div>
              <strong>Date:</strong> ${formatDate(ch.date)}<br>
              ${ch.invoice_no ? `<strong>Invoice:</strong> ${App.escHtml(ch.invoice_no)}<br>` : ''}
              ${ch.motor_vehicle_no ? `<strong>Vehicle:</strong> ${App.escHtml(ch.motor_vehicle_no)}<br>` : ''}
            </div>
            <div>
              ${ch.dispatched_through ? `<strong>Via:</strong> ${App.escHtml(ch.dispatched_through)}<br>` : ''}
              ${ch.destination ? `<strong>Destination:</strong> ${App.escHtml(ch.destination)}<br>` : ''}
            </div>
          </div>
          <div class="form-row" style="font-size:12px;margin-bottom:10px">
            <div>
              <div style="font-weight:700;font-size:11px;color:var(--text-muted);margin-bottom:3px">FROM</div>
              <div style="font-weight:700">${App.escHtml(settings.company_name || '')}</div>
              <div style="color:var(--text-muted)">${App.escHtml(settings.address || '')}</div>
              <div>GSTIN: ${App.escHtml(settings.gstin || '')}</div>
            </div>
            <div>
              <div style="font-weight:700;font-size:11px;color:var(--text-muted);margin-bottom:3px">TO (CONSIGNEE)</div>
              <div style="font-weight:700">${App.escHtml(ch.consignee_name || '')}</div>
              <div style="color:var(--text-muted)">${App.escHtml(ch.consignee_address || '')}</div>
              ${ch.consignee_gstin ? `<div>GSTIN: ${App.escHtml(ch.consignee_gstin)}</div>` : ''}
            </div>
          </div>
          <div style="overflow-x:auto">
          <table class="invoice-table" style="font-size:11px">
            <thead><tr>
              <th>#</th><th>Description</th><th>Cat.No</th><th>HSN</th>
              <th>Qty</th><th>Unit</th><th>Lot No</th><th>Mfg</th><th>Exp</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table></div>
          ${ch.notes ? `<div style="margin-top:8px;font-size:12px"><strong>Notes:</strong> ${App.escHtml(ch.notes)}</div>` : ''}
          <div style="display:flex;justify-content:space-between;margin-top:20px;font-size:12px">
            <div>Receiver's Signature:<br><br><br>________________</div>
            <div style="text-align:right">for ${App.escHtml(settings.company_name || '')}<br><br><br>________________<br>Authorised Signatory</div>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('challan-view-content').innerHTML = `
      ${copiesHtml}
      <div style="display:flex;gap:8px;padding-bottom:8px" class="no-print">
        <button class="btn btn-primary flex-1" onclick="ChallanModule.printChallan(${id})">🖨️ Print (4 copies)</button>
        <button class="btn btn-outline flex-1" onclick="App.navigate('challan-edit', {id:${id}})">✏️ Edit</button>
      </div>
    `;
  }

  function printChallan(id) {
    window.print();
  }

  async function deleteChallan(id) {
    if (!confirmAction('Delete this challan?')) return;
    await DB.deleteChallan(id);
    showToast('Challan deleted', 'success');
    App.navigate('challans');
    loadList();
  }

  return {
    loadList, renderList, onSearch,
    openForm, onCustomerSelect, addItem, onProductSelect, removeItem,
    save, viewChallan, printChallan, deleteChallan
  };
})();
