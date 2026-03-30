/**
 * Customer Management Module
 */

'use strict';

const CustomerModule = (() => {
  let allCustomers = [];

  async function loadList() {
    allCustomers = await DB.getCustomers();
    renderList(allCustomers);
  }

  function renderList(customers) {
    const el = document.getElementById('customer-list');
    if (!customers.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>No Customers Yet</h3>
        <p>Add your first customer</p>
        <button class="btn btn-primary" onclick="App.navigate('customer-new')">+ Add Customer</button>
      </div>`;
      return;
    }
    el.innerHTML = customers.map(c => `
      <div class="list-item" onclick="App.navigate('customer-edit', {id:${c.id}})">
        <div class="list-item-icon blue">👤</div>
        <div class="list-item-body">
          <div class="list-item-title">${App.escHtml(c.name)}</div>
          <div class="list-item-subtitle">${c.gstin ? 'GSTIN: ' + App.escHtml(c.gstin) : (c.phone || c.email || 'No GSTIN')}</div>
        </div>
        <span style="color:var(--text-muted)">›</span>
      </div>
    `).join('');
  }

  function onSearch(q) {
    if (!q.trim()) { renderList(allCustomers); return; }
    const lower = q.toLowerCase();
    const filtered = allCustomers.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      (c.gstin || '').toLowerCase().includes(lower) ||
      (c.phone || '').includes(lower)
    );
    renderList(filtered);
  }

  async function openForm(id) {
    document.getElementById('cust-id').value = '';
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-address').value = '';
    document.getElementById('cust-gstin').value = '';
    document.getElementById('cust-pan').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-email').value = '';
    document.getElementById('cust-delete-btn').style.display = 'none';
    populateStateDropdown(document.getElementById('cust-state'));

    if (id) {
      const c = await DB.getCustomer(id);
      if (!c) return;
      document.getElementById('cust-id').value = c.id;
      document.getElementById('cust-name').value = c.name || '';
      document.getElementById('cust-address').value = c.address || '';
      document.getElementById('cust-gstin').value = c.gstin || '';
      document.getElementById('cust-pan').value = c.pan || '';
      document.getElementById('cust-phone').value = c.phone || '';
      document.getElementById('cust-email').value = c.email || '';
      document.getElementById('cust-delete-btn').style.display = 'inline-flex';
      populateStateDropdown(document.getElementById('cust-state'), c.state_code || '');
    }
  }

  async function save() {
    const name = document.getElementById('cust-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    const stateEl = document.getElementById('cust-state');
    const stateCode = stateEl.value;

    const data = {
      name,
      address: document.getElementById('cust-address').value.trim(),
      gstin: document.getElementById('cust-gstin').value.trim().toUpperCase(),
      pan: document.getElementById('cust-pan').value.trim().toUpperCase(),
      state_code: stateCode,
      state_name: getStateName(stateCode),
      phone: document.getElementById('cust-phone').value.trim(),
      email: document.getElementById('cust-email').value.trim().toLowerCase(),
    };

    const idVal = document.getElementById('cust-id').value;
    if (idVal) data.id = parseInt(idVal);

    await DB.saveCustomer(data);
    showToast('Customer saved', 'success');
    App.navigate('customers');
    CustomerModule.loadList();
  }

  async function deleteCustomer() {
    const idVal = document.getElementById('cust-id').value;
    if (!idVal) return;
    if (!confirmAction('Delete this customer?')) return;
    await DB.deleteCustomer(parseInt(idVal));
    showToast('Customer deleted', 'success');
    App.navigate('customers');
    CustomerModule.loadList();
  }

  return { loadList, renderList, onSearch, openForm, save, delete: deleteCustomer };
})();
