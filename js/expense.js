/**
 * Expense Tracking Module
 */

'use strict';

const ExpenseModule = (() => {

  async function loadList() {
    const expenses = await DB.getExpenses();
    const el = document.getElementById('expense-list');
    if (!expenses.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💸</div>
        <h3>No Expenses Yet</h3>
        <p>Track your business expenses</p>
        <button class="btn btn-primary" onclick="App.navigate('expense-new')">+ Add Expense</button>
      </div>`;
      return;
    }

    // Group by month
    const grouped = {};
    expenses.forEach(e => {
      const month = e.date ? e.date.slice(0, 7) : 'Unknown';
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(e);
    });

    let html = '';
    for (const [month, items] of Object.entries(grouped)) {
      const monthTotal = items.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      const [yr, mo] = month.split('-');
      const monthName = mo ? new Date(yr, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : month;
      html += `<div class="section-title">${monthName} — ₹${formatCurrency(monthTotal)}</div>`;
      html += items.map(e => {
        const modeBadge = e.mode === 'Bank' ? 'badge-info' : 'badge-secondary';
        return `
          <div class="list-item" onclick="App.navigate('expense-edit', {id:${e.id}})">
            <div class="list-item-icon red">💸</div>
            <div class="list-item-body">
              <div class="list-item-title">${App.escHtml(e.description || '')}</div>
              <div class="list-item-subtitle">
                <span class="badge badge-secondary">${App.escHtml(e.category || 'General')}</span>
                <span class="badge ${modeBadge}" style="margin-left:4px">${App.escHtml(e.mode || 'Cash')}</span>
              </div>
            </div>
            <div class="list-item-right">
              <div class="list-item-amount">₹${formatCurrency(e.amount)}</div>
              <div class="list-item-date">${formatDate(e.date)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    el.innerHTML = html;

    App.setHeaderActions(`<button class="header-btn" onclick="App.navigate('expense-new')" title="New Expense">➕</button>`);
  }

  function openForm(id) {
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = todayISO();
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-description').value = '';
    document.getElementById('exp-category').value = 'General';
    document.getElementById('exp-mode').value = 'Cash';
    document.getElementById('exp-bank-name').value = '';
    document.getElementById('exp-delete-btn').style.display = 'none';

    if (id) {
      DB.getExpense(id).then(e => {
        if (!e) return;
        document.getElementById('exp-id').value = e.id;
        document.getElementById('exp-date').value = e.date || todayISO();
        document.getElementById('exp-amount').value = e.amount || '';
        document.getElementById('exp-description').value = e.description || '';
        document.getElementById('exp-category').value = e.category || 'General';
        document.getElementById('exp-mode').value = e.mode || 'Cash';
        document.getElementById('exp-bank-name').value = e.bank_name || '';
        document.getElementById('exp-delete-btn').style.display = 'inline-flex';
      });
    }
  }

  async function save() {
    const date = document.getElementById('exp-date').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const description = document.getElementById('exp-description').value.trim();

    if (!date) { showToast('Date is required', 'error'); return; }
    if (!description) { showToast('Description is required', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

    const data = {
      date, amount, description,
      category: document.getElementById('exp-category').value,
      mode: document.getElementById('exp-mode').value,
      bank_name: document.getElementById('exp-bank-name').value.trim(),
    };

    const idVal = document.getElementById('exp-id').value;
    if (idVal) data.id = parseInt(idVal);

    await DB.saveExpense(data);
    showToast('Expense saved', 'success');
    App.navigate('expenses');
    loadList();
  }

  async function deleteExpense() {
    const idVal = document.getElementById('exp-id').value;
    if (!idVal) return;
    if (!confirmAction('Delete this expense?')) return;
    await DB.deleteExpense(parseInt(idVal));
    showToast('Expense deleted', 'success');
    App.navigate('expenses');
    loadList();
  }

  return { loadList, openForm, save, delete: deleteExpense };
})();
