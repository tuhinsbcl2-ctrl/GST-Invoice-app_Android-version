/**
 * Reports Module
 */

'use strict';

const ReportsModule = (() => {

  function init() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    document.getElementById('rep-from').value = firstDay;
    document.getElementById('rep-to').value = lastDay;
  }

  async function generate() {
    const from = document.getElementById('rep-from').value;
    const to = document.getElementById('rep-to').value;
    if (!from || !to) { showToast('Select date range', 'error'); return; }
    if (from > to) { showToast('From date must be before To date', 'error'); return; }

    const [invoices, expenses] = await Promise.all([
      DB.getInvoicesByDateRange(from, to),
      DB.getExpensesByDateRange(from, to)
    ]);

    // Invoice summary
    const totalInvoiced = invoices.reduce((s, inv) => s + (parseFloat(inv.grand_total) || 0), 0);
    const totalPaid = invoices.filter(i => i.payment_status === 'Paid').reduce((s, inv) => s + (parseFloat(inv.grand_total) || 0), 0);
    const totalUnpaid = invoices.filter(i => i.payment_status === 'Unpaid').reduce((s, inv) => s + (parseFloat(inv.grand_total) || 0), 0);
    const totalTax = invoices.reduce((s, inv) => s + (parseFloat(inv.cgst_total) || 0) + (parseFloat(inv.sgst_total) || 0) + (parseFloat(inv.igst_total) || 0), 0);

    // Expense summary
    const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const cashExp = expenses.filter(e => e.mode === 'Cash').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const bankExp = expenses.filter(e => e.mode === 'Bank').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    // Category breakdown for expenses
    const catMap = {};
    expenses.forEach(e => {
      const cat = e.category || 'General';
      catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    const catRows = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `
      <tr><td>${App.escHtml(cat)}</td><td class="num">₹${formatCurrency(amt)}</td></tr>
    `).join('');

    // Invoice list
    const invRows = invoices.map(inv => {
      const payBadge = inv.payment_status === 'Paid' ? 'badge-success' :
        inv.payment_status === 'Partial' ? 'badge-warning' : 'badge-danger';
      return `<tr>
        <td style="cursor:pointer;color:var(--primary)" onclick="App.navigate('invoice-view', {id:${inv.id}})">${App.escHtml(inv.invoice_no || '')}</td>
        <td>${formatDate(inv.date)}</td>
        <td>${App.escHtml(inv.buyer_name || '')}</td>
        <td class="num">₹${formatCurrency(inv.grand_total)}</td>
        <td><span class="badge ${payBadge}">${App.escHtml(inv.payment_status || '')}</span></td>
      </tr>`;
    }).join('');

    document.getElementById('reports-output').innerHTML = `
      <div class="card">
        <div class="card-title">Invoice Summary (${formatDate(from)} to ${formatDate(to)})</div>
        <div class="stats-grid">
          <div class="stat-card primary">
            <div class="stat-value">${invoices.length}</div>
            <div class="stat-label">Invoices</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-value">₹${Math.round(totalInvoiced).toLocaleString('en-IN')}</div>
            <div class="stat-label">Total Invoiced</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">₹${Math.round(totalPaid).toLocaleString('en-IN')}</div>
            <div class="stat-label">Paid</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">₹${Math.round(totalUnpaid).toLocaleString('en-IN')}</div>
            <div class="stat-label">Unpaid</div>
          </div>
        </div>
        <div class="small text-muted" style="margin-bottom:6px">Total Tax Collected: <strong>₹${formatCurrency(totalTax)}</strong></div>
        ${invoices.length > 0 ? `
          <div style="overflow-x:auto">
          <table class="invoice-table" style="font-size:12px">
            <thead><tr><th>Invoice No</th><th>Date</th><th>Buyer</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>${invRows}</tbody>
          </table></div>` : '<p class="text-muted small">No invoices in this period.</p>'}
      </div>

      <div class="card">
        <div class="card-title">Expense Summary</div>
        <div class="stats-grid">
          <div class="stat-card danger">
            <div class="stat-value">${expenses.length}</div>
            <div class="stat-label">Expenses</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">₹${Math.round(totalExpenses).toLocaleString('en-IN')}</div>
            <div class="stat-label">Total Spent</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">₹${Math.round(cashExp).toLocaleString('en-IN')}</div>
            <div class="stat-label">Cash</div>
          </div>
          <div class="stat-card primary">
            <div class="stat-value">₹${Math.round(bankExp).toLocaleString('en-IN')}</div>
            <div class="stat-label">Bank</div>
          </div>
        </div>
        ${catRows ? `
          <div class="section-title">By Category</div>
          <table class="invoice-table" style="font-size:12px">
            <thead><tr><th>Category</th><th>Amount</th></tr></thead>
            <tbody>${catRows}</tbody>
          </table>` : '<p class="text-muted small">No expenses in this period.</p>'}
      </div>

      <div class="card" style="text-align:center;font-size:12px;color:var(--text-muted)">
        <div style="font-weight:700;font-size:14px">Net Position</div>
        <div style="font-size:24px;font-weight:700;color:${totalInvoiced - totalExpenses >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ₹${Math.round(totalInvoiced - totalExpenses).toLocaleString('en-IN')}
        </div>
        <div>Invoiced (₹${Math.round(totalInvoiced).toLocaleString('en-IN')}) − Expenses (₹${Math.round(totalExpenses).toLocaleString('en-IN')})</div>
      </div>
    `;
  }

  return { init, generate };
})();
