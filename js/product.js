/**
 * Product Catalog Module
 */

'use strict';

const ProductModule = (() => {
  let allProducts = [];

  async function loadList() {
    allProducts = await DB.getProducts();
    renderList(allProducts);
  }

  function renderList(products) {
    const el = document.getElementById('product-list');
    if (!products.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>No Products Yet</h3>
        <p>Add products to your catalog</p>
        <button class="btn btn-primary" onclick="App.navigate('product-new')">+ Add Product</button>
      </div>`;
      return;
    }
    el.innerHTML = products.map(p => {
      const stock = parseFloat(p.stock_quantity) || 0;
      const lowStock = parseFloat(p.low_stock_threshold) || 0;
      const stockBadge = stock <= 0 ? '<span class="badge badge-danger">Out of Stock</span>' :
        (lowStock > 0 && stock <= lowStock) ? '<span class="badge badge-warning">Low Stock</span>' :
          `<span class="badge badge-success">${stock} ${p.unit || 'Nos'}</span>`;
      return `
        <div class="list-item" onclick="App.navigate('product-edit', {id:${p.id}})">
          <div class="list-item-icon orange">📦</div>
          <div class="list-item-body">
            <div class="list-item-title">${App.escHtml(p.name)}</div>
            <div class="list-item-subtitle">
              HSN: ${App.escHtml(p.hsn_code || '--')} | GST: ${p.default_gst_rate || 0}% | ₹${formatCurrency(p.default_unit_price)}
            </div>
          </div>
          <div class="list-item-right">
            ${stockBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  function onSearch(q) {
    if (!q.trim()) { renderList(allProducts); return; }
    const lower = q.toLowerCase();
    const filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      (p.catalog_no || '').toLowerCase().includes(lower) ||
      (p.hsn_code || '').includes(lower)
    );
    renderList(filtered);
  }

  async function openForm(id) {
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-catalog-no').value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-hsn').value = '';
    document.getElementById('prod-gst-rate').value = '12';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-low-stock').value = '';
    document.getElementById('prod-unit').value = 'Nos';
    document.getElementById('prod-delete-btn').style.display = 'none';

    if (id) {
      const p = await DB.getProduct(id);
      if (!p) return;
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-catalog-no').value = p.catalog_no || '';
      document.getElementById('prod-name').value = p.name || '';
      document.getElementById('prod-hsn').value = p.hsn_code || '';
      document.getElementById('prod-gst-rate').value = String(p.default_gst_rate || 12);
      document.getElementById('prod-price').value = p.default_unit_price || '';
      document.getElementById('prod-stock').value = p.stock_quantity || '';
      document.getElementById('prod-low-stock').value = p.low_stock_threshold || '';
      document.getElementById('prod-unit').value = p.unit || 'Nos';
      document.getElementById('prod-delete-btn').style.display = 'inline-flex';
    }
  }

  async function save() {
    const name = document.getElementById('prod-name').value.trim();
    if (!name) { showToast('Product name is required', 'error'); return; }

    const data = {
      catalog_no: document.getElementById('prod-catalog-no').value.trim(),
      name,
      hsn_code: document.getElementById('prod-hsn').value.trim(),
      default_gst_rate: parseFloat(document.getElementById('prod-gst-rate').value) || 0,
      default_unit_price: parseFloat(document.getElementById('prod-price').value) || 0,
      unit: document.getElementById('prod-unit').value,
      stock_quantity: parseFloat(document.getElementById('prod-stock').value) || 0,
      low_stock_threshold: parseFloat(document.getElementById('prod-low-stock').value) || 0,
    };

    const idVal = document.getElementById('prod-id').value;
    if (idVal) data.id = parseInt(idVal);

    await DB.saveProduct(data);
    showToast('Product saved', 'success');
    App.navigate('products');
    ProductModule.loadList();
  }

  async function deleteProduct() {
    const idVal = document.getElementById('prod-id').value;
    if (!idVal) return;
    if (!confirmAction('Delete this product?')) return;
    await DB.deleteProduct(parseInt(idVal));
    showToast('Product deleted', 'success');
    App.navigate('products');
    ProductModule.loadList();
  }

  return { loadList, renderList, onSearch, openForm, save, delete: deleteProduct, allProducts: () => allProducts };
})();
