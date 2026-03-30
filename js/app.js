/**
 * Main App Router & Navigation
 */

'use strict';

// Indian States list for dropdowns
const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Other Country' },
];

function populateStateDropdown(selectEl, selectedCode = '') {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">--Select State--</option>';
  for (const s of INDIAN_STATES) {
    const opt = document.createElement('option');
    opt.value = s.code;
    opt.textContent = `${s.code} - ${s.name}`;
    if (s.code === String(selectedCode)) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function getStateName(code) {
  const s = INDIAN_STATES.find(s => s.code === String(code));
  return s ? s.name : '';
}

// Toast notification system
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Format currency
function formatCurrency(val) {
  return parseFloat(val || 0).toFixed(2);
}

// Format date for display
function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

// Today's date in YYYY-MM-DD
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Confirmation dialog
function confirmAction(message) {
  return window.confirm(message);
}

const App = (() => {
  let currentPage = 'dashboard';
  let fabActionFn = null;
  let deferredInstallPrompt = null;

  // Page configuration
  const pages = {
    'dashboard': { title: 'NIBRITY ENTERPRISE', subtitle: 'GST Invoice', navId: 'nav-home', back: null },
    'invoices': { title: 'Invoices', subtitle: 'Tax Invoices', navId: 'nav-invoices', back: null, fab: true, fabLabel: '+', onEnter: () => InvoiceModule.loadList() },
    'invoice-new': { title: 'New Invoice', subtitle: 'Tax Invoice', back: 'invoices', onEnter: () => InvoiceModule.openForm(null) },
    'invoice-edit': { title: 'Edit Invoice', subtitle: 'Tax Invoice', back: 'invoices', onEnter: (ctx) => InvoiceModule.openForm(ctx.id) },
    'invoice-view': { title: 'Invoice', subtitle: 'View Details', back: 'invoices', onEnter: (ctx) => InvoiceModule.viewInvoice(ctx.id) },
    'challans': { title: 'Delivery Challans', subtitle: 'Challans', navId: 'nav-challans', back: null, fab: true, fabLabel: '+', onEnter: () => ChallanModule.loadList() },
    'challan-new': { title: 'New Challan', subtitle: 'Delivery Challan', back: 'challans', onEnter: () => ChallanModule.openForm(null) },
    'challan-edit': { title: 'Edit Challan', subtitle: 'Delivery Challan', back: 'challans', onEnter: (ctx) => ChallanModule.openForm(ctx.id) },
    'challan-view': { title: 'Challan', subtitle: 'View Details', back: 'challans', onEnter: (ctx) => ChallanModule.viewChallan(ctx.id) },
    'more': { title: 'More', subtitle: '', navId: 'nav-more', back: null },
    'customers': { title: 'Customers', subtitle: 'Customer Management', back: 'more', fab: true, fabLabel: '+', onEnter: () => CustomerModule.loadList() },
    'customer-new': { title: 'New Customer', subtitle: '', back: 'customers', onEnter: () => CustomerModule.openForm(null) },
    'customer-edit': { title: 'Edit Customer', subtitle: '', back: 'customers', onEnter: (ctx) => CustomerModule.openForm(ctx.id) },
    'products': { title: 'Products', subtitle: 'Product Catalog', back: 'more', fab: true, fabLabel: '+', onEnter: () => ProductModule.loadList() },
    'product-new': { title: 'New Product', subtitle: '', back: 'products', onEnter: () => ProductModule.openForm(null) },
    'product-edit': { title: 'Edit Product', subtitle: '', back: 'products', onEnter: (ctx) => ProductModule.openForm(ctx.id) },
    'expenses': { title: 'Expenses', subtitle: 'Expense Tracking', back: 'more', fab: true, fabLabel: '+', onEnter: () => ExpenseModule.loadList() },
    'expense-new': { title: 'New Expense', subtitle: '', back: 'expenses', onEnter: () => ExpenseModule.openForm(null) },
    'expense-edit': { title: 'Edit Expense', subtitle: '', back: 'expenses', onEnter: (ctx) => ExpenseModule.openForm(ctx.id) },
    'reports': { title: 'Reports', subtitle: 'Business Reports', back: 'more', onEnter: () => ReportsModule.init() },
    'settings': { title: 'Company Settings', subtitle: '', back: 'more', onEnter: () => SettingsModule.load() },
  };

  // Map page IDs to HTML element IDs
  const pageElementMap = {
    'dashboard': 'page-dashboard',
    'invoices': 'page-invoices',
    'invoice-new': 'page-invoice-form',
    'invoice-edit': 'page-invoice-form',
    'invoice-view': 'page-invoice-view',
    'challans': 'page-challans',
    'challan-new': 'page-challan-form',
    'challan-edit': 'page-challan-form',
    'challan-view': 'page-challan-view',
    'more': 'page-more',
    'customers': 'page-customers',
    'customer-new': 'page-customer-form',
    'customer-edit': 'page-customer-form',
    'products': 'page-products',
    'product-new': 'page-product-form',
    'product-edit': 'page-product-form',
    'expenses': 'page-expenses',
    'expense-new': 'page-expense-form',
    'expense-edit': 'page-expense-form',
    'reports': 'page-reports',
    'settings': 'page-settings',
  };

  function navigate(pageId, ctx = {}) {
    const config = pages[pageId];
    if (!config) return;

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show target page
    const elemId = pageElementMap[pageId];
    const elem = document.getElementById(elemId);
    if (elem) elem.classList.add('active');

    // Update header
    document.getElementById('app-title').textContent = config.title;
    document.getElementById('header-subtitle').textContent = config.subtitle || '';

    // Back button
    const backBtn = document.getElementById('back-btn');
    if (config.back !== null && config.back !== undefined) {
      backBtn.classList.add('visible');
      backBtn.onclick = () => navigate(config.back);
    } else {
      backBtn.classList.remove('visible');
    }

    // Nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (config.navId) {
      const navEl = document.getElementById(config.navId);
      if (navEl) navEl.classList.add('active');
    }

    // FAB
    const fab = document.getElementById('main-fab');
    if (config.fab) {
      fab.classList.remove('hidden');
      fab.textContent = config.fabLabel || '+';
      fabActionFn = () => {
        if (pageId === 'invoices') navigate('invoice-new');
        else if (pageId === 'challans') navigate('challan-new');
        else if (pageId === 'customers') navigate('customer-new');
        else if (pageId === 'products') navigate('product-new');
        else if (pageId === 'expenses') navigate('expense-new');
      };
    } else {
      fab.classList.add('hidden');
      fabActionFn = null;
    }

    // Reset header actions
    document.getElementById('header-actions').innerHTML = '';

    currentPage = pageId;

    // Scroll to top
    document.getElementById('page-content').scrollTop = 0;

    // Call page init
    if (config.onEnter) config.onEnter(ctx);
  }

  function fabAction() {
    if (fabActionFn) fabActionFn();
  }

  function setHeaderActions(html) {
    document.getElementById('header-actions').innerHTML = html;
  }

  function showInstallPrompt() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; });
    } else {
      showToast('Open in Chrome browser and use "Add to Home Screen" from the menu', 'info', 5000);
    }
  }

  async function initDashboard() {
    try {
      const stats = await DB.getDashboardStats();
      document.getElementById('stat-invoices').textContent = stats.invoiceCount;
      document.getElementById('stat-challans').textContent = stats.challanCount;
      document.getElementById('stat-customers').textContent = stats.customerCount;
      document.getElementById('stat-month').textContent = Math.round(stats.monthTotal).toLocaleString('en-IN');

      const recentInvEl = document.getElementById('recent-invoices');
      if (stats.recentInvoices.length) {
        recentInvEl.innerHTML = stats.recentInvoices.map(inv => `
          <div class="list-item" onclick="App.navigate('invoice-view', {id:${inv.id}})">
            <div class="list-item-icon blue">🧾</div>
            <div class="list-item-body">
              <div class="list-item-title">${escHtml(inv.invoice_no || '')}</div>
              <div class="list-item-subtitle">${escHtml(inv.buyer_name || '')}</div>
            </div>
            <div class="list-item-right">
              <div class="list-item-amount">₹${formatCurrency(inv.grand_total)}</div>
              <div class="list-item-date">${formatDate(inv.date)}</div>
            </div>
          </div>
        `).join('');
      } else {
        recentInvEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No invoices yet</p></div>';
      }

      const recentChEl = document.getElementById('recent-challans');
      if (stats.recentChallans.length) {
        recentChEl.innerHTML = stats.recentChallans.map(ch => `
          <div class="list-item" onclick="App.navigate('challan-view', {id:${ch.id}})">
            <div class="list-item-icon orange">📦</div>
            <div class="list-item-body">
              <div class="list-item-title">${escHtml(ch.challan_no || '')}</div>
              <div class="list-item-subtitle">${escHtml(ch.consignee_name || '')}</div>
            </div>
            <div class="list-item-right">
              <div class="list-item-date">${formatDate(ch.date)}</div>
            </div>
          </div>
        `).join('');
      } else {
        recentChEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No challans yet</p></div>';
      }
    } catch (e) {
      console.error('Dashboard error', e);
    }
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function init() {
    // Initialize DB (ensure settings seeded)
    await DB.getSettings();

    // Populate state dropdowns globally
    document.querySelectorAll('select[id$="-state"], select[id$="-buyer-state"], select[id$="-consignee-state"], select[id$="-place-supply"]').forEach(sel => {
      populateStateDropdown(sel);
    });

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });

    // Navigate to dashboard
    navigate('dashboard');
    initDashboard();
  }

  // Refresh dashboard when navigating back
  const origNavigate = navigate;

  return { navigate, fabAction, setHeaderActions, showInstallPrompt, initDashboard, escHtml, init };
})();

// Boot the app
window.addEventListener('DOMContentLoaded', () => App.init());
