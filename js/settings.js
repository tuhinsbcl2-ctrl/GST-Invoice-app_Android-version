/**
 * Company Settings Module
 */

'use strict';

const SettingsModule = (() => {

  async function load() {
    const s = await DB.getSettings();
    document.getElementById('set-company-name').value = s.company_name || '';
    document.getElementById('set-address').value = s.address || '';
    document.getElementById('set-gstin').value = s.gstin || '';
    document.getElementById('set-pan').value = s.pan || '';
    document.getElementById('set-udyam').value = s.udyam || '';
    document.getElementById('set-bank-name').value = s.bank_name || '';
    document.getElementById('set-bank-branch').value = s.bank_branch || '';
    document.getElementById('set-bank-account').value = s.bank_account || '';
    document.getElementById('set-bank-ifsc').value = s.bank_ifsc || '';
    document.getElementById('set-invoice-prefix').value = s.invoice_prefix || 'NE';
    populateStateDropdown(document.getElementById('set-state'), s.state_code || '19');
  }

  async function save() {
    const stateEl = document.getElementById('set-state');
    const stateCode = stateEl.value;
    const stateName = getStateName(stateCode);
    const data = {
      id: 1,
      company_name: document.getElementById('set-company-name').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      gstin: document.getElementById('set-gstin').value.trim().toUpperCase(),
      pan: document.getElementById('set-pan').value.trim().toUpperCase(),
      udyam: document.getElementById('set-udyam').value.trim(),
      state_code: stateCode,
      state_name: stateName,
      bank_name: document.getElementById('set-bank-name').value.trim(),
      bank_branch: document.getElementById('set-bank-branch').value.trim(),
      bank_account: document.getElementById('set-bank-account').value.trim(),
      bank_ifsc: document.getElementById('set-bank-ifsc').value.trim().toUpperCase(),
      invoice_prefix: document.getElementById('set-invoice-prefix').value.trim().toUpperCase() || 'NE',
    };

    if (!data.company_name) {
      showToast('Company name is required', 'error');
      return;
    }

    await DB.saveSettings(data);
    showToast('Settings saved successfully', 'success');
    App.navigate('more');
  }

  return { load, save };
})();
