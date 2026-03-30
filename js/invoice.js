/**
 * Invoice Module - Create, Edit, View, List Tax Invoices
 */

'use strict';

const InvoiceModule = (() => {
  let allInvoices = [];
  let editingId = null;
  let itemCount = 0;
  let products = [];
  let settings = null;

  // ── List ──────────────────────────────────────────────────────────────────
  async function loadList() {
    allInvoices = await DB.getInvoices();
    renderList(allInvoices);
    App.setHeaderActions(`<button class="header-btn" onclick="App.navigate('invoice-new')" title="New Invoice">➕</button>`);
  }

  function renderList(invoices) {
    const el = document.getElementById('invoice-list');
    if (!invoices.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🧾</div>
        <h3>No Invoices Yet</h3>
        <p>Create your first tax invoice</p>
        <button class="btn btn-primary" onclick="App.navigate('invoice-new')">+ New Invoice</button>
      </div>`;
      return;
    }
    el.innerHTML = invoices.map(inv => {
      const badge = inv.payment_status === 'Paid' ? 'badge-success' :
        inv.payment_status === 'Partial' ? 'badge-warning' : 'badge-danger';
      return `
        <div class="list-item" onclick="App.navigate('invoice-view', {id:${inv.id}})">
          <div class="list-item-icon blue">🧾</div>
          <div class="list-item-body">
            <div class="list-item-title">${App.escHtml(inv.invoice_no || '')}</div>
            <div class="list-item-subtitle">${App.escHtml(inv.buyer_name || '')}</div>
          </div>
          <div class="list-item-right">
            <div class="list-item-amount">₹${formatCurrency(inv.grand_total)}</div>
            <div><span class="badge ${badge}">${App.escHtml(inv.payment_status || 'Unpaid')}</span></div>
            <div class="list-item-date">${formatDate(inv.date)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function onSearch(q) {
    if (!q.trim()) { renderList(allInvoices); return; }
    const lower = q.toLowerCase();
    const filtered = allInvoices.filter(inv =>
      (inv.invoice_no || '').toLowerCase().includes(lower) ||
      (inv.buyer_name || '').toLowerCase().includes(lower)
    );
    renderList(filtered);
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  async function openForm(id) {
    editingId = id || null;
    itemCount = 0;
    settings = await DB.getSettings();
    products = await DB.getProducts();

    // Reset form
    document.getElementById('inv-date').value = todayISO();
    document.getElementById('inv-challan-no').value = '';
    document.getElementById('inv-challan-date').value = '';
    document.getElementById('inv-buyer-name').value = '';
    document.getElementById('inv-buyer-address').value = '';
    document.getElementById('inv-buyer-gstin').value = '';
    document.getElementById('inv-dispatched-through').value = '';
    document.getElementById('inv-destination').value = '';
    document.getElementById('inv-buyer-order-no').value = '';
    document.getElementById('inv-buyer-order-date').value = '';
    document.getElementById('inv-terms-delivery').value = '';
    document.getElementById('inv-payment-mode').value = 'Bank';
    document.getElementById('inv-payment-status').value = 'Unpaid';
    document.getElementById('inv-notes').value = '';
    document.getElementById('invoice-items-container').innerHTML = '';

    // Populate customer dropdown
    const customers = await DB.getCustomers();
    const custSelect = document.getElementById('inv-customer-select');
    custSelect.innerHTML = '<option value="">-- Select Customer --</option>';
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      opt.dataset.customer = JSON.stringify(c);
      custSelect.appendChild(opt);
    });

    // State dropdowns
    populateStateDropdown(document.getElementById('inv-buyer-state'), '');
    populateStateDropdown(document.getElementById('inv-place-supply'), settings.state_code || '19');

    if (id) {
      // Edit mode
      const inv = await DB.getInvoice(id);
      if (!inv) return;
      document.getElementById('inv-no').value = inv.invoice_no || '';
      document.getElementById('inv-date').value = inv.date || todayISO();
      document.getElementById('inv-challan-no').value = inv.challan_no || '';
      document.getElementById('inv-challan-date').value = inv.challan_date || '';
      document.getElementById('inv-buyer-name').value = inv.buyer_name || '';
      document.getElementById('inv-buyer-address').value = inv.buyer_address || '';
      document.getElementById('inv-buyer-gstin').value = inv.buyer_gstin || '';
      document.getElementById('inv-dispatched-through').value = inv.dispatched_through || '';
      document.getElementById('inv-destination').value = inv.destination || '';
      document.getElementById('inv-buyer-order-no').value = inv.buyer_order_no || '';
      document.getElementById('inv-buyer-order-date').value = inv.buyer_order_date || '';
      document.getElementById('inv-terms-delivery').value = inv.terms_of_delivery || '';
      document.getElementById('inv-payment-mode').value = inv.payment_mode || 'Bank';
      document.getElementById('inv-payment-status').value = inv.payment_status || 'Unpaid';
      document.getElementById('inv-notes').value = inv.notes || '';
      populateStateDropdown(document.getElementById('inv-buyer-state'), inv.buyer_state_code || '');
      populateStateDropdown(document.getElementById('inv-place-supply'), inv.place_of_supply_code || settings.state_code || '19');

      // Load items
      (inv.items || []).forEach(item => addItem(item));
    } else {
      // New invoice
      const nextNo = await InvoiceNumbering.peekNextInvoiceNumber(settings.invoice_prefix || 'NE');
      document.getElementById('inv-no').value = nextNo;
      addItem();
    }

    recalculate();
    App.setHeaderActions(id ? `<button class="header-btn" onclick="InvoiceModule.viewInvoice(${id})" title="View">👁️</button>` : '');
  }

  function addItem(data = {}) {
    itemCount++;
    const idx = itemCount;
    const container = document.getElementById('invoice-items-container');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.id = `item-row-${idx}`;

    // Build product options
    const prodOpts = products.map(p =>
      `<option value="${p.id}" data-name="${App.escHtml(p.name)}" data-hsn="${App.escHtml(p.hsn_code || '')}" data-gst="${p.default_gst_rate || 0}" data-price="${p.default_unit_price || 0}" data-unit="${App.escHtml(p.unit || 'Nos')}">${App.escHtml(p.name)}</option>`
    ).join('');

    div.innerHTML = `
      <button class="remove-item" onclick="InvoiceModule.removeItem(${idx})" title="Remove">✕</button>
      <div class="form-group">
        <label class="form-label">Product</label>
        <select class="form-control" id="item-product-${idx}" onchange="InvoiceModule.onProductSelect(${idx})">
          <option value="">-- Select or type below --</option>
          ${prodOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description *</label>
        <input class="form-control" id="item-desc-${idx}" placeholder="Product/Service description" value="${App.escHtml(data.description || '')}" oninput="InvoiceModule.recalculate()">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">HSN Code</label>
          <input class="form-control" id="item-hsn-${idx}" placeholder="HSN" value="${App.escHtml(data.hsn_code || '')}" oninput="InvoiceModule.recalculate()">
        </div>
        <div class="form-group">
          <label class="form-label">GST Rate (%)</label>
          <select class="form-control" id="item-gst-${idx}" onchange="InvoiceModule.recalculate()">
            ${[0,5,12,18,28].map(r => `<option value="${r}" ${parseFloat(data.gst_rate) === r ? 'selected' : ''}>${r}%</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Qty *</label>
          <input class="form-control" id="item-qty-${idx}" type="number" min="0" step="0.001" value="${data.quantity || 1}" oninput="InvoiceModule.recalculate()">
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <input class="form-control" id="item-unit-${idx}" value="${App.escHtml(data.unit || 'Nos')}">
        </div>
        <div class="form-group">
          <label class="form-label">Price (₹) *</label>
          <input class="form-control" id="item-price-${idx}" type="number" min="0" step="0.01" value="${data.unit_price || ''}" oninput="InvoiceModule.recalculate()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input class="form-control" id="item-amount-${idx}" readonly style="background:#f5f6fa">
        </div>
        <div class="form-group">
          <label class="form-label">Lot No</label>
          <input class="form-control" id="item-lot-${idx}" value="${App.escHtml(data.lot_no || '')}">
        </div>
      </div>
    `;
    container.appendChild(div);

    // Set product select if editing
    if (data.description) {
      // Try to match by description
    }
    if (data.gst_rate !== undefined) {
      document.getElementById(`item-gst-${idx}`).value = String(data.gst_rate);
    }
  }

  function onProductSelect(idx) {
    const sel = document.getElementById(`item-product-${idx}`);
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) return;
    document.getElementById(`item-desc-${idx}`).value = opt.dataset.name || '';
    document.getElementById(`item-hsn-${idx}`).value = opt.dataset.hsn || '';
    document.getElementById(`item-gst-${idx}`).value = opt.dataset.gst || '0';
    document.getElementById(`item-unit-${idx}`).value = opt.dataset.unit || 'Nos';
    if (!document.getElementById(`item-price-${idx}`).value) {
      document.getElementById(`item-price-${idx}`).value = opt.dataset.price || '';
    }
    recalculate();
  }

  function removeItem(idx) {
    const row = document.getElementById(`item-row-${idx}`);
    if (row) row.remove();
    recalculate();
  }

  function getItems() {
    const items = [];
    const container = document.getElementById('invoice-items-container');
    const rows = container.querySelectorAll('.item-row');
    rows.forEach(row => {
      const idx = row.id.replace('item-row-', '');
      const desc = document.getElementById(`item-desc-${idx}`)?.value?.trim();
      if (!desc) return;
      items.push({
        description: desc,
        hsn_code: document.getElementById(`item-hsn-${idx}`)?.value?.trim() || '',
        gst_rate: parseFloat(document.getElementById(`item-gst-${idx}`)?.value) || 0,
        quantity: parseFloat(document.getElementById(`item-qty-${idx}`)?.value) || 0,
        unit: document.getElementById(`item-unit-${idx}`)?.value || 'Nos',
        unit_price: parseFloat(document.getElementById(`item-price-${idx}`)?.value) || 0,
        lot_no: document.getElementById(`item-lot-${idx}`)?.value?.trim() || '',
      });
    });
    return items;
  }

  function onCustomerSelect(val) {
    if (!val) return;
    const sel = document.getElementById('inv-customer-select');
    const opt = sel.selectedOptions[0];
    if (!opt) return;
    try {
      const c = JSON.parse(opt.dataset.customer || '{}');
      document.getElementById('inv-buyer-name').value = c.name || '';
      document.getElementById('inv-buyer-address').value = c.address || '';
      document.getElementById('inv-buyer-gstin').value = c.gstin || '';
      populateStateDropdown(document.getElementById('inv-buyer-state'), c.state_code || '');
      onBuyerStateChange();
    } catch (e) {}
  }

  function onBuyerStateChange() {
    recalculate();
  }

  function recalculate() {
    const items = getItems();
    const buyerStateCode = document.getElementById('inv-buyer-state')?.value || '';
    const sellerStateCode = settings?.state_code || '19';
    const isIgst = buyerStateCode ? GSTCalculator.isIgstApplicable(sellerStateCode, buyerStateCode) : false;

    const { items: processedItems, totals } = GSTCalculator.calculateInvoiceTotals(items, isIgst);

    // Update amount fields in form
    const container = document.getElementById('invoice-items-container');
    const rows = container.querySelectorAll('.item-row');
    let itemIdx = 0;
    rows.forEach(row => {
      const idx = row.id.replace('item-row-', '');
      const desc = document.getElementById(`item-desc-${idx}`)?.value?.trim();
      if (!desc) return;
      const pi = processedItems[itemIdx++];
      if (pi) {
        const amtEl = document.getElementById(`item-amount-${idx}`);
        if (amtEl) amtEl.value = formatCurrency(pi.amount);
      }
    });

    // Update totals
    document.getElementById('inv-subtotal').textContent = formatCurrency(totals.subtotal);
    document.getElementById('inv-roundoff').textContent = formatCurrency(totals.round_off);
    document.getElementById('inv-grand-total').textContent = formatCurrency(totals.grand_total);

    if (isIgst) {
      document.getElementById('inv-cgst-row').classList.add('hidden');
      document.getElementById('inv-sgst-row').classList.add('hidden');
      document.getElementById('inv-igst-row').classList.remove('hidden');
      document.getElementById('inv-igst').textContent = formatCurrency(totals.igst_total);
      document.getElementById('inv-gst-type').textContent = '⚡ IGST (Inter-State)';
    } else {
      document.getElementById('inv-cgst-row').classList.remove('hidden');
      document.getElementById('inv-sgst-row').classList.remove('hidden');
      document.getElementById('inv-igst-row').classList.add('hidden');
      document.getElementById('inv-cgst').textContent = formatCurrency(totals.cgst_total);
      document.getElementById('inv-sgst').textContent = formatCurrency(totals.sgst_total);
      document.getElementById('inv-gst-type').textContent = buyerStateCode ? '🏠 CGST + SGST (Intra-State)' : '📍 CGST + SGST (default)';
    }

    const words = NumberToWords.amountToWords(totals.grand_total);
    document.getElementById('inv-amount-words').textContent = words;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    const invoiceNo = document.getElementById('inv-no').value.trim();
    const date = document.getElementById('inv-date').value;
    const buyerName = document.getElementById('inv-buyer-name').value.trim();

    if (!date) { showToast('Invoice date is required', 'error'); return; }
    if (!buyerName) { showToast('Buyer name is required', 'error'); return; }

    const items = getItems();
    if (!items.length) { showToast('Add at least one item', 'error'); return; }

    settings = settings || await DB.getSettings();
    const buyerStateCode = document.getElementById('inv-buyer-state').value;
    const placeCode = document.getElementById('inv-place-supply').value;
    const isIgst = buyerStateCode ? GSTCalculator.isIgstApplicable(settings.state_code || '19', buyerStateCode) : false;
    const { items: processedItems, totals } = GSTCalculator.calculateInvoiceTotals(items, isIgst);

    let finalInvoiceNo = invoiceNo;
    if (!editingId && !finalInvoiceNo) {
      finalInvoiceNo = await InvoiceNumbering.getNextInvoiceNumber(settings.invoice_prefix || 'NE');
    } else if (!editingId) {
      // Consume the sequence
      await InvoiceNumbering.getNextInvoiceNumber(settings.invoice_prefix || 'NE');
    }

    const hsnBreakup = GSTCalculator.getHsnBreakup(processedItems, isIgst);

    const invData = {
      invoice_no: finalInvoiceNo,
      date,
      challan_no: document.getElementById('inv-challan-no').value.trim(),
      challan_date: document.getElementById('inv-challan-date').value,
      buyer_name: buyerName,
      buyer_address: document.getElementById('inv-buyer-address').value.trim(),
      buyer_gstin: document.getElementById('inv-buyer-gstin').value.trim().toUpperCase(),
      buyer_state_code: buyerStateCode,
      buyer_state_name: getStateName(buyerStateCode),
      place_of_supply_code: placeCode,
      place_of_supply: getStateName(placeCode),
      is_igst: isIgst,
      dispatched_through: document.getElementById('inv-dispatched-through').value.trim(),
      destination: document.getElementById('inv-destination').value.trim(),
      buyer_order_no: document.getElementById('inv-buyer-order-no').value.trim(),
      buyer_order_date: document.getElementById('inv-buyer-order-date').value,
      terms_of_delivery: document.getElementById('inv-terms-delivery').value.trim(),
      payment_mode: document.getElementById('inv-payment-mode').value,
      payment_status: document.getElementById('inv-payment-status').value,
      notes: document.getElementById('inv-notes').value.trim(),
      ...totals,
      amount_in_words: NumberToWords.amountToWords(totals.grand_total),
      tax_amount_in_words: NumberToWords.amountToWords(totals.cgst_total + totals.sgst_total + totals.igst_total),
      hsn_breakup: JSON.stringify(hsnBreakup),
    };

    if (editingId) invData.id = editingId;

    const savedId = await DB.saveInvoice(invData, processedItems);
    showToast('Invoice saved successfully', 'success');
    App.navigate('invoice-view', { id: savedId });
  }

  // ── View ──────────────────────────────────────────────────────────────────
  async function viewInvoice(id) {
    const inv = await DB.getInvoice(id);
    if (!inv) { showToast('Invoice not found', 'error'); return; }

    settings = settings || await DB.getSettings();
    const isIgst = inv.is_igst;

    App.setHeaderActions(`
      <button class="header-btn" onclick="App.navigate('invoice-edit', {id:${id}})" title="Edit">✏️</button>
      <button class="header-btn" onclick="InvoiceModule.printInvoice(${id})" title="Print">🖨️</button>
      <button class="header-btn" onclick="InvoiceModule.deleteInvoice(${id})" title="Delete">🗑️</button>
    `);

    const hsnBreakup = inv.hsn_breakup ? JSON.parse(inv.hsn_breakup) : GSTCalculator.getHsnBreakup(inv.items || [], isIgst);

    let itemsHtml = (inv.items || []).map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${App.escHtml(item.description || '')}</td>
        <td>${App.escHtml(item.hsn_code || '')}</td>
        <td class="num">${item.gst_rate || 0}%</td>
        <td class="num">${formatCurrency(item.quantity)}</td>
        <td>${App.escHtml(item.unit || '')}</td>
        <td class="num">₹${formatCurrency(item.unit_price)}</td>
        <td class="num">₹${formatCurrency(item.amount)}</td>
      </tr>
    `).join('');

    let taxHtml = '';
    if (isIgst) {
      taxHtml = `<tr><td class="label">IGST</td><td class="value">₹${formatCurrency(inv.igst_total)}</td></tr>`;
    } else {
      taxHtml = `
        <tr><td class="label">CGST</td><td class="value">₹${formatCurrency(inv.cgst_total)}</td></tr>
        <tr><td class="label">SGST</td><td class="value">₹${formatCurrency(inv.sgst_total)}</td></tr>
      `;
    }

    let hsnHtml = '';
    if (hsnBreakup.length) {
      const hsnRows = hsnBreakup.map(h => `
        <tr>
          <td>${App.escHtml(h.hsn_code || '')}</td>
          <td class="num">${h.gst_rate}%</td>
          <td class="num">₹${formatCurrency(h.taxable_value)}</td>
          ${isIgst ? `<td class="num">₹${formatCurrency(h.igst_amount)}</td>` : `<td class="num">₹${formatCurrency(h.cgst_amount)}</td><td class="num">₹${formatCurrency(h.sgst_amount)}</td>`}
          <td class="num">₹${formatCurrency(h.total_tax)}</td>
        </tr>
      `).join('');
      hsnHtml = `
        <div class="card mt-3">
          <div class="card-title">HSN-wise Tax Breakup</div>
          <div style="overflow-x:auto">
          <table class="invoice-table">
            <thead><tr>
              <th>HSN</th><th>GST%</th><th>Taxable</th>
              ${isIgst ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>'}
              <th>Total Tax</th>
            </tr></thead>
            <tbody>${hsnRows}</tbody>
          </table></div>
        </div>
      `;
    }

    const payBadge = inv.payment_status === 'Paid' ? 'badge-success' :
      inv.payment_status === 'Partial' ? 'badge-warning' : 'badge-danger';

    document.getElementById('invoice-view-content').innerHTML = `
      <div class="card">
        <div class="invoice-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:13px;opacity:.8;margin-bottom:2px">${App.escHtml(settings.company_name || '')}</div>
              <div class="invoice-no">TAX INVOICE</div>
              <div class="invoice-no" style="font-size:14px">${App.escHtml(inv.invoice_no || '')}</div>
            </div>
            <span class="badge ${payBadge}" style="font-size:12px">${App.escHtml(inv.payment_status || '')}</span>
          </div>
          <div class="invoice-date" style="margin-top:6px">Date: ${formatDate(inv.date)} ${inv.challan_no ? '| Challan: ' + App.escHtml(inv.challan_no) : ''}</div>
        </div>

        <div class="form-row" style="margin-bottom:10px">
          <div>
            <div class="small text-muted" style="font-weight:600;margin-bottom:3px">SELLER</div>
            <div style="font-size:13px;font-weight:700">${App.escHtml(settings.company_name || '')}</div>
            <div style="font-size:11px;color:var(--text-muted)">${App.escHtml(settings.address || '')}</div>
            <div style="font-size:11px">GSTIN: ${App.escHtml(settings.gstin || '')}</div>
            <div style="font-size:11px">State: ${App.escHtml(settings.state_code || '')} - ${App.escHtml(settings.state_name || '')}</div>
          </div>
          <div>
            <div class="small text-muted" style="font-weight:600;margin-bottom:3px">BUYER</div>
            <div style="font-size:13px;font-weight:700">${App.escHtml(inv.buyer_name || '')}</div>
            <div style="font-size:11px;color:var(--text-muted)">${App.escHtml(inv.buyer_address || '')}</div>
            ${inv.buyer_gstin ? `<div style="font-size:11px">GSTIN: ${App.escHtml(inv.buyer_gstin)}</div>` : ''}
            ${inv.buyer_state_code ? `<div style="font-size:11px">State: ${App.escHtml(inv.buyer_state_code)} - ${App.escHtml(inv.buyer_state_name || '')}</div>` : ''}
          </div>
        </div>

        ${inv.dispatched_through || inv.destination ? `
          <div class="divider"></div>
          <div class="form-row" style="margin-bottom:8px">
            ${inv.dispatched_through ? `<div><span class="small text-muted">Via:</span> <span style="font-size:12px">${App.escHtml(inv.dispatched_through)}</span></div>` : '<div></div>'}
            ${inv.destination ? `<div><span class="small text-muted">To:</span> <span style="font-size:12px">${App.escHtml(inv.destination)}</span></div>` : '<div></div>'}
          </div>
        ` : ''}

        <div style="overflow-x:auto">
        <table class="invoice-table">
          <thead><tr>
            <th>#</th><th>Description</th><th>HSN</th><th>GST</th>
            <th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table></div>

        <div class="divider"></div>
        <table class="totals-table">
          <tr><td class="label">Subtotal</td><td class="value">₹${formatCurrency(inv.subtotal)}</td></tr>
          ${taxHtml}
          <tr><td class="label">Round Off</td><td class="value">₹${formatCurrency(inv.round_off)}</td></tr>
          <tr class="grand-total"><td class="label">Grand Total</td><td class="value">₹${formatCurrency(inv.grand_total)}</td></tr>
        </table>

        <div class="divider"></div>
        <div style="font-size:12px;color:var(--text-muted);font-style:italic">${App.escHtml(inv.amount_in_words || '')}</div>

        ${inv.place_of_supply ? `<div class="mt-2 small">Place of Supply: ${App.escHtml(inv.place_of_supply_code || '')} - ${App.escHtml(inv.place_of_supply || '')}</div>` : ''}
        ${inv.payment_mode ? `<div class="small">Payment Mode: ${App.escHtml(inv.payment_mode)}</div>` : ''}
        ${inv.notes ? `<div class="mt-2 small">${App.escHtml(inv.notes)}</div>` : ''}

        ${settings.bank_name ? `
          <div class="divider"></div>
          <div class="small text-muted" style="font-weight:600">Bank Details</div>
          <div class="small">${App.escHtml(settings.bank_name)} | Branch: ${App.escHtml(settings.bank_branch || '')}${settings.bank_account ? ' | A/c: ' + App.escHtml(settings.bank_account) : ''}${settings.bank_ifsc ? ' | IFSC: ' + App.escHtml(settings.bank_ifsc) : ''}</div>
        ` : ''}
      </div>

      ${hsnHtml}

      <div class="card" style="text-align:center;color:var(--text-muted);font-size:12px">
        <div>for ${App.escHtml(settings.company_name || '')}</div>
        <div style="margin-top:32px;border-top:1px solid var(--border);padding-top:6px">Authorised Signatory</div>
      </div>

      <div style="display:flex;gap:8px;padding-bottom:8px" class="no-print">
        <button class="btn btn-primary flex-1" onclick="InvoiceModule.printInvoice(${id})">🖨️ Print</button>
        <button class="btn btn-outline flex-1" onclick="App.navigate('invoice-edit', {id:${id}})">✏️ Edit</button>
      </div>
    `;
  }

  async function printInvoice(id) {
    // Open print view
    window.print();
  }

  async function deleteInvoice(id) {
    if (!confirmAction('Delete this invoice? This cannot be undone.')) return;
    await DB.deleteInvoice(id);
    showToast('Invoice deleted', 'success');
    App.navigate('invoices');
    loadList();
  }

  return {
    loadList, renderList, onSearch,
    openForm, addItem, onCustomerSelect, onProductSelect, removeItem,
    onBuyerStateChange, recalculate,
    save, viewInvoice, printInvoice, deleteInvoice
  };
})();
