/**
 * IndexedDB setup and CRUD operations using Dexie.js
 * Stores: settings, customers, products, invoices, challans, expenses, invoice_sequences
 */

'use strict';

const DB = (() => {
  const db = new Dexie('NibrityGSTInvoice');

  db.version(1).stores({
    settings: 'id',
    customers: '++id, name, gstin',
    products: '++id, catalog_no, name, hsn_code',
    invoices: '++id, invoice_no, date, buyer_name, payment_status',
    invoice_items: '++id, invoice_id',
    challans: '++id, challan_no, date, invoice_id',
    challan_items: '++id, challan_id',
    expenses: '++id, date, category',
    invoice_sequences: '[prefix+financial_year]'
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  const DEFAULT_SETTINGS = {
    id: 1,
    company_name: 'NIBRITY ENTERPRISE',
    address: 'Vill: Simulia, P.O: Kultali, P.S: Kultali, Dist: South 24 Parganas, West Bengal - 743387',
    gstin: '19CDOPM2160E1ZH',
    pan: 'CDOPM2160E',
    udyam: '',
    state_name: 'West Bengal',
    state_code: '19',
    bank_name: 'Punjab National Bank',
    bank_account: '',
    bank_ifsc: '',
    bank_branch: 'SONARGAON',
    invoice_prefix: 'NE',
    logo_path: ''
  };

  async function getSettings() {
    let s = await db.settings.get(1);
    if (!s) {
      await db.settings.put(DEFAULT_SETTINGS);
      s = DEFAULT_SETTINGS;
    }
    return s;
  }

  async function saveSettings(data) {
    await db.settings.put({ ...data, id: 1 });
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  async function getCustomers() {
    return db.customers.orderBy('name').toArray();
  }

  async function getCustomer(id) {
    return db.customers.get(id);
  }

  async function saveCustomer(data) {
    if (data.id) {
      await db.customers.put(data);
      return data.id;
    } else {
      return db.customers.add(data);
    }
  }

  async function deleteCustomer(id) {
    return db.customers.delete(id);
  }

  async function searchCustomers(query) {
    const q = query.toLowerCase();
    return db.customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    ).toArray();
  }

  // ── Products ──────────────────────────────────────────────────────────────
  async function getProducts() {
    return db.products.orderBy('name').toArray();
  }

  async function getProduct(id) {
    return db.products.get(id);
  }

  async function saveProduct(data) {
    if (data.id) {
      await db.products.put(data);
      return data.id;
    } else {
      return db.products.add(data);
    }
  }

  async function deleteProduct(id) {
    return db.products.delete(id);
  }

  async function searchProducts(query) {
    const q = query.toLowerCase();
    return db.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.catalog_no || '').toLowerCase().includes(q) ||
      (p.hsn_code || '').includes(q)
    ).toArray();
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  async function getInvoices(limit = null) {
    let q = db.invoices.orderBy('id').reverse();
    if (limit) q = q.limit(limit);
    return q.toArray();
  }

  async function getInvoice(id) {
    const inv = await db.invoices.get(id);
    if (!inv) return null;
    inv.items = await db.invoice_items.where('invoice_id').equals(id).toArray();
    return inv;
  }

  async function saveInvoice(data, items) {
    return db.transaction('rw', db.invoices, db.invoice_items, async () => {
      let invId;
      if (data.id) {
        await db.invoices.put(data);
        invId = data.id;
        await db.invoice_items.where('invoice_id').equals(invId).delete();
      } else {
        const { id, ...rest } = data;
        invId = await db.invoices.add(rest);
      }
      for (const item of items) {
        const { id: _, ...itemRest } = item;
        await db.invoice_items.add({ ...itemRest, invoice_id: invId });
      }
      return invId;
    });
  }

  async function deleteInvoice(id) {
    return db.transaction('rw', db.invoices, db.invoice_items, async () => {
      await db.invoice_items.where('invoice_id').equals(id).delete();
      await db.invoices.delete(id);
    });
  }

  async function getInvoicesByDateRange(from, to) {
    return db.invoices.filter(inv => inv.date >= from && inv.date <= to).toArray();
  }

  // ── Challans ──────────────────────────────────────────────────────────────
  async function getChallans(limit = null) {
    let q = db.challans.orderBy('id').reverse();
    if (limit) q = q.limit(limit);
    return q.toArray();
  }

  async function getChallan(id) {
    const ch = await db.challans.get(id);
    if (!ch) return null;
    ch.items = await db.challan_items.where('challan_id').equals(id).toArray();
    return ch;
  }

  async function getChallanByNo(challanNo) {
    const ch = await db.challans.where('challan_no').equals(challanNo).first();
    if (!ch) return null;
    ch.items = await db.challan_items.where('challan_id').equals(ch.id).toArray();
    return ch;
  }

  async function saveChallan(data, items) {
    return db.transaction('rw', db.challans, db.challan_items, async () => {
      let chId;
      if (data.id) {
        await db.challans.put(data);
        chId = data.id;
        await db.challan_items.where('challan_id').equals(chId).delete();
      } else {
        const { id, ...rest } = data;
        chId = await db.challans.add(rest);
      }
      for (const item of items) {
        const { id: _, ...itemRest } = item;
        await db.challan_items.add({ ...itemRest, challan_id: chId });
      }
      return chId;
    });
  }

  async function deleteChallan(id) {
    return db.transaction('rw', db.challans, db.challan_items, async () => {
      await db.challan_items.where('challan_id').equals(id).delete();
      await db.challans.delete(id);
    });
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  async function getExpenses(limit = null) {
    let q = db.expenses.orderBy('id').reverse();
    if (limit) q = q.limit(limit);
    return q.toArray();
  }

  async function getExpense(id) {
    return db.expenses.get(id);
  }

  async function saveExpense(data) {
    if (data.id) {
      await db.expenses.put(data);
      return data.id;
    } else {
      const { id, ...rest } = data;
      return db.expenses.add(rest);
    }
  }

  async function deleteExpense(id) {
    return db.expenses.delete(id);
  }

  async function getExpensesByDateRange(from, to) {
    return db.expenses.filter(e => e.date >= from && e.date <= to).toArray();
  }

  // ── Invoice Sequences ─────────────────────────────────────────────────────
  async function getInvoiceSequence(prefix, fy) {
    return db.invoice_sequences.get([prefix, fy]);
  }

  async function saveInvoiceSequence(prefix, fy, lastSerial) {
    return db.invoice_sequences.put({ prefix, financial_year: fy, last_serial: lastSerial });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async function getDashboardStats() {
    const [invoiceCount, challanCount, customerCount, productCount] = await Promise.all([
      db.invoices.count(),
      db.challans.count(),
      db.customers.count(),
      db.products.count()
    ]);
    const recentInvoices = await getInvoices(5);
    const recentChallans = await getChallans(5);

    // Current month totals
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
    const monthInvoices = await getInvoicesByDateRange(monthStart, monthEnd);
    const monthTotal = monthInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);

    return { invoiceCount, challanCount, customerCount, productCount, recentInvoices, recentChallans, monthTotal };
  }

  return {
    // Settings
    getSettings, saveSettings,
    // Customers
    getCustomers, getCustomer, saveCustomer, deleteCustomer, searchCustomers,
    // Products
    getProducts, getProduct, saveProduct, deleteProduct, searchProducts,
    // Invoices
    getInvoices, getInvoice, saveInvoice, deleteInvoice, getInvoicesByDateRange,
    // Challans
    getChallans, getChallan, getChallanByNo, saveChallan, deleteChallan,
    // Expenses
    getExpenses, getExpense, saveExpense, deleteExpense, getExpensesByDateRange,
    // Invoice Sequences
    getInvoiceSequence, saveInvoiceSequence,
    // Stats
    getDashboardStats
  };
})();
