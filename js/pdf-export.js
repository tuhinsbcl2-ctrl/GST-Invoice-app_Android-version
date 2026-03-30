/**
 * PDF Export Module
 * Generates 4-copy printable Tax Invoice and Delivery Challan in a new window.
 * User can print or "Save as PDF" via browser print dialog (works on Android Chrome).
 *
 * Copy labels: Original / Duplicate / Triplicate / Extra
 */

'use strict';

const PDFExport = (() => {

  const COPY_LABELS = ['Original', 'Duplicate', 'Triplicate', 'Extra'];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (!d) return '';
    const parts = String(d).split('-');
    if (parts.length !== 3) return d;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function fmtNum(n, decimals) {
    n = parseFloat(n) || 0;
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals === undefined ? 2 : decimals,
      maximumFractionDigits: decimals === undefined ? 2 : decimals
    });
  }

  // ── Shared print-page CSS ─────────────────────────────────────────────────

  function printStyles() {
    return `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; background: #fff; color: #000; }

        .page {
          width: 210mm;
          min-height: 280mm;
          margin: 0 auto;
          padding: 8mm 10mm;
          page-break-after: always;
          position: relative;
        }
        .page:last-child { page-break-after: auto; }

        /* ── Header ── */
        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #000;
          padding-bottom: 6px;
          margin-bottom: 6px;
        }
        .company-name { font-size: 15px; font-weight: bold; }
        .company-sub  { font-size: 10px; color: #444; margin-top: 2px; }
        .doc-type-block { text-align: right; }
        .doc-type  { font-size: 13px; font-weight: bold; text-transform: uppercase; }
        .copy-badge {
          display: inline-block;
          border: 1px solid #000;
          padding: 2px 10px;
          font-size: 10px;
          font-weight: bold;
          margin-top: 4px;
          background: #f5f5f5;
        }

        /* ── Two-column party layout ── */
        .party-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid #000;
          margin-bottom: 5px;
        }
        .party-cell { padding: 5px 7px; }
        .party-cell + .party-cell { border-left: 1px solid #000; }
        .party-label { font-size: 9px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 3px; }
        .party-name  { font-size: 12px; font-weight: bold; }
        .party-line  { font-size: 10px; color: #222; line-height: 1.4; }

        /* ── Invoice meta info row ── */
        .meta-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid #000;
          border-top: none;
          margin-bottom: 5px;
          font-size: 10px;
        }
        .meta-cell { padding: 3px 6px; border-right: 1px solid #000; }
        .meta-cell:last-child { border-right: none; }
        .meta-lbl { font-weight: bold; color: #555; font-size: 9px; }

        /* ── Items table ── */
        table.items-tbl {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 5px;
          font-size: 10px;
        }
        table.items-tbl th {
          background: #efefef;
          border: 1px solid #000;
          padding: 4px 3px;
          text-align: center;
          font-size: 9px;
          font-weight: bold;
        }
        table.items-tbl td {
          border: 1px solid #000;
          padding: 3px 4px;
          vertical-align: top;
        }
        table.items-tbl .num { text-align: right; white-space: nowrap; }
        table.items-tbl .ctr { text-align: center; }

        /* ── Totals ── */
        .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 5px; }
        table.totals-tbl { border-collapse: collapse; min-width: 220px; font-size: 10px; }
        table.totals-tbl td { border: 1px solid #000; padding: 3px 8px; }
        table.totals-tbl .t-lbl { font-weight: bold; }
        table.totals-tbl .t-val { text-align: right; white-space: nowrap; }
        table.totals-tbl tr.grand td { font-weight: bold; background: #efefef; font-size: 11px; }

        /* ── Amount in words ── */
        .amt-words {
          border: 1px solid #000;
          padding: 4px 7px;
          margin-bottom: 5px;
          font-size: 10px;
          font-style: italic;
        }
        .amt-words span { font-weight: bold; font-style: normal; }

        /* ── Misc info row ── */
        .misc-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid #000;
          margin-bottom: 5px;
          font-size: 10px;
        }
        .misc-cell { padding: 4px 7px; }
        .misc-cell + .misc-cell { border-left: 1px solid #000; }
        .misc-lbl { font-size: 9px; font-weight: bold; color: #555; }

        /* ── HSN breakup ── */
        .hsn-section { margin-bottom: 5px; }
        .hsn-title { font-size: 10px; font-weight: bold; margin-bottom: 2px; }
        table.hsn-tbl { width: 100%; border-collapse: collapse; font-size: 9px; }
        table.hsn-tbl th {
          background: #efefef;
          border: 1px solid #000;
          padding: 3px 4px;
          text-align: center;
          font-weight: bold;
        }
        table.hsn-tbl td { border: 1px solid #000; padding: 2px 4px; }
        table.hsn-tbl .num { text-align: right; }

        /* ── Bank details ── */
        .bank-section {
          border: 1px solid #000;
          padding: 4px 7px;
          margin-bottom: 5px;
          font-size: 10px;
        }
        .bank-title { font-size: 9px; font-weight: bold; color: #555; margin-bottom: 2px; }

        /* ── Notes ── */
        .notes-section { font-size: 10px; margin-bottom: 5px; }

        /* ── Signatures ── */
        .sig-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 18px;
          font-size: 10px;
        }
        .sig-box { text-align: center; min-width: 130px; }
        .sig-line { border-top: 1px solid #000; margin-top: 36px; padding-top: 4px; }

        /* ── Print rules ── */
        @media print {
          body { background: #fff; }
          .page { width: 100%; padding: 6mm 8mm; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #bbb; }
          .page { background: #fff; margin: 12px auto; box-shadow: 0 2px 10px rgba(0,0,0,.35); }
          .print-hint {
            position: fixed; top: 0; left: 0; right: 0;
            background: #1a73e8; color: #fff;
            text-align: center; padding: 8px;
            font-size: 13px; font-family: Arial, sans-serif;
            z-index: 999;
          }
        }
      </style>
    `;
  }

  // ── Invoice ───────────────────────────────────────────────────────────────

  function buildInvoiceCopy(inv, settings, isIgst, hsnBreakup, copyLabel) {
    // ── Items rows ──
    const items = inv.items || [];
    const itemRows = items.map((item, i) => {
      const baseRow = `
        <td class="ctr">${i + 1}</td>
        <td>${esc(item.description)}</td>
        <td class="ctr">${esc(item.hsn_code)}</td>
        <td class="ctr">${esc(item.gst_rate || 0)}%</td>
        <td class="num">${fmtNum(item.quantity)}</td>
        <td class="ctr">${esc(item.unit)}</td>
        <td class="num">&#8377;${fmtNum(item.unit_price)}</td>
        <td class="num">&#8377;${fmtNum(item.amount)}</td>
      `;
      if (isIgst) {
        return `<tr>${baseRow}<td class="num">&#8377;${fmtNum(item.igst_amount)}</td></tr>`;
      } else {
        return `<tr>${baseRow}<td class="num">&#8377;${fmtNum(item.cgst_amount)}</td><td class="num">&#8377;${fmtNum(item.sgst_amount)}</td></tr>`;
      }
    }).join('');

    const taxColHeader = isIgst
      ? `<th>IGST (&#8377;)</th>`
      : `<th>CGST (&#8377;)</th><th>SGST (&#8377;)</th>`;

    // ── Totals ──
    const taxRows = isIgst
      ? `<tr><td class="t-lbl">IGST</td><td class="t-val">&#8377;${fmtNum(inv.igst_total)}</td></tr>`
      : `<tr><td class="t-lbl">CGST</td><td class="t-val">&#8377;${fmtNum(inv.cgst_total)}</td></tr>
         <tr><td class="t-lbl">SGST</td><td class="t-val">&#8377;${fmtNum(inv.sgst_total)}</td></tr>`;

    // ── HSN breakup ──
    let hsnHtml = '';
    if (hsnBreakup && hsnBreakup.length) {
      const hsnRows = hsnBreakup.map(h => {
        const taxCols = isIgst
          ? `<td class="num">&#8377;${fmtNum(h.igst_amount)}</td>`
          : `<td class="num">&#8377;${fmtNum(h.cgst_amount)}</td><td class="num">&#8377;${fmtNum(h.sgst_amount)}</td>`;
        return `<tr>
          <td>${esc(h.hsn_code)}</td>
          <td class="num">${h.gst_rate}%</td>
          <td class="num">&#8377;${fmtNum(h.taxable_value)}</td>
          ${taxCols}
          <td class="num">&#8377;${fmtNum(h.total_tax)}</td>
        </tr>`;
      }).join('');
      const hsnTaxHeader = isIgst
        ? `<th>IGST (&#8377;)</th>`
        : `<th>CGST (&#8377;)</th><th>SGST (&#8377;)</th>`;
      hsnHtml = `
        <div class="hsn-section">
          <div class="hsn-title">HSN-wise Tax Breakup</div>
          <table class="hsn-tbl">
            <thead><tr>
              <th>HSN/SAC</th><th>GST%</th><th>Taxable Value (&#8377;)</th>
              ${hsnTaxHeader}
              <th>Total Tax (&#8377;)</th>
            </tr></thead>
            <tbody>${hsnRows}</tbody>
          </table>
        </div>`;
    }

    // ── Bank details ──
    let bankHtml = '';
    if (settings.bank_name) {
      bankHtml = `
        <div class="bank-section">
          <div class="bank-title">Bank Details</div>
          ${esc(settings.bank_name)}${settings.bank_branch ? ' | Branch: ' + esc(settings.bank_branch) : ''}${settings.bank_account ? ' | A/c No: ' + esc(settings.bank_account) : ''}${settings.bank_ifsc ? ' | IFSC: ' + esc(settings.bank_ifsc) : ''}
        </div>`;
    }

    // ── Notes ──
    const notesHtml = inv.notes
      ? `<div class="notes-section"><strong>Notes:</strong> ${esc(inv.notes)}</div>`
      : '';

    // ── Meta info cells ──
    const metaCells = [
      `<div class="meta-lbl">Invoice No</div>${esc(inv.invoice_no)}`,
      `<div class="meta-lbl">Date</div>${esc(fmtDate(inv.date))}`,
      `<div class="meta-lbl">Place of Supply</div>${esc(inv.place_of_supply_code ? inv.place_of_supply_code + ' - ' + (inv.place_of_supply || '') : (inv.place_of_supply || ''))}`,
    ];
    if (inv.challan_no || inv.challan_date) {
      metaCells.push(`<div class="meta-lbl">Challan No / Date</div>${esc(inv.challan_no || '')}${inv.challan_date ? ' / ' + fmtDate(inv.challan_date) : ''}`);
    }
    if (inv.buyer_order_no || inv.buyer_order_date) {
      metaCells.push(`<div class="meta-lbl">Buyer Order No / Date</div>${esc(inv.buyer_order_no || '')}${inv.buyer_order_date ? ' / ' + fmtDate(inv.buyer_order_date) : ''}`);
    }
    if (inv.dispatched_through) {
      metaCells.push(`<div class="meta-lbl">Dispatched Through</div>${esc(inv.dispatched_through)}`);
    }
    if (inv.destination) {
      metaCells.push(`<div class="meta-lbl">Destination</div>${esc(inv.destination)}`);
    }
    if (inv.terms_of_delivery) {
      metaCells.push(`<div class="meta-lbl">Terms of Delivery</div>${esc(inv.terms_of_delivery)}`);
    }
    if (inv.payment_mode) {
      metaCells.push(`<div class="meta-lbl">Payment Mode</div>${esc(inv.payment_mode)}`);
    }

    // Make meta grid columns adapt to count
    const metaCount = Math.min(metaCells.length, 3);
    const metaCols = `repeat(${metaCount}, 1fr)`;
    const metaRowsHtml = [];
    for (let i = 0; i < metaCells.length; i += metaCount) {
      const rowCells = metaCells.slice(i, i + metaCount);
      metaRowsHtml.push(`<div class="meta-row" style="grid-template-columns:${metaCols}">${rowCells.map(c => `<div class="meta-cell">${c}</div>`).join('')}</div>`);
    }

    return `
      <div class="page">
        <!-- Header -->
        <div class="doc-header">
          <div>
            <div class="company-name">${esc(settings.company_name || 'Company')}</div>
            <div class="company-sub">${esc(settings.address || '')}</div>
            <div class="company-sub">GSTIN: ${esc(settings.gstin || '')}${settings.pan ? ' &nbsp;|&nbsp; PAN: ' + esc(settings.pan) : ''}${settings.udyam ? ' &nbsp;|&nbsp; UDYAM: ' + esc(settings.udyam) : ''}</div>
            <div class="company-sub">State: ${esc(settings.state_code || '')} - ${esc(settings.state_name || '')}</div>
          </div>
          <div class="doc-type-block">
            <div class="doc-type">Tax Invoice</div>
            <div class="copy-badge">${esc(copyLabel)}</div>
          </div>
        </div>

        <!-- Party details -->
        <div class="party-row">
          <div class="party-cell">
            <div class="party-label">Consignee / Buyer</div>
            <div class="party-name">${esc(inv.buyer_name || '')}</div>
            <div class="party-line">${esc(inv.buyer_address || '')}</div>
            ${inv.buyer_gstin ? `<div class="party-line">GSTIN: ${esc(inv.buyer_gstin)}</div>` : ''}
            ${inv.buyer_state_code ? `<div class="party-line">State: ${esc(inv.buyer_state_code)} - ${esc(inv.buyer_state_name || '')}</div>` : ''}
          </div>
          <div class="party-cell">
            <div class="party-label">Supplier / Seller</div>
            <div class="party-name">${esc(settings.company_name || '')}</div>
            <div class="party-line">${esc(settings.address || '')}</div>
            <div class="party-line">GSTIN: ${esc(settings.gstin || '')}</div>
            <div class="party-line">State: ${esc(settings.state_code || '')} - ${esc(settings.state_name || '')}</div>
          </div>
        </div>

        <!-- Meta info -->
        ${metaRowsHtml.join('')}

        <!-- Items table -->
        <table class="items-tbl">
          <thead>
            <tr>
              <th style="width:24px">#</th>
              <th>Description of Goods / Services</th>
              <th>HSN/SAC</th>
              <th>GST%</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate (&#8377;)</th>
              <th>Taxable Value (&#8377;)</th>
              ${taxColHeader}
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="10" style="text-align:center">No items</td></tr>'}</tbody>
        </table>

        <!-- Totals -->
        <div class="totals-wrap">
          <table class="totals-tbl">
            <tr><td class="t-lbl">Taxable Value</td><td class="t-val">&#8377;${fmtNum(inv.subtotal)}</td></tr>
            ${taxRows}
            ${inv.round_off !== 0 ? `<tr><td class="t-lbl">Round Off</td><td class="t-val">&#8377;${fmtNum(inv.round_off)}</td></tr>` : ''}
            <tr class="grand"><td class="t-lbl">Grand Total</td><td class="t-val">&#8377;${fmtNum(inv.grand_total)}</td></tr>
          </table>
        </div>

        <!-- Amount in words -->
        <div class="amt-words"><span>Amount in Words:</span> ${esc(inv.amount_in_words || '')}</div>

        ${hsnHtml}
        ${bankHtml}
        ${notesHtml}

        <!-- Signatures -->
        <div class="sig-row">
          <div class="sig-box">
            <div>Receiver's Signature</div>
            <div class="sig-line">Name &amp; Seal</div>
          </div>
          <div class="sig-box">
            <div>for ${esc(settings.company_name || '')}</div>
            <div class="sig-line">Authorised Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  async function exportInvoice(id) {
    try {
      const inv = await DB.getInvoice(id);
      if (!inv) { showToast('Invoice not found', 'error'); return; }
      const settings = await DB.getSettings();
      const isIgst = inv.is_igst;
      const hsnBreakup = inv.hsn_breakup
        ? JSON.parse(inv.hsn_breakup)
        : GSTCalculator.getHsnBreakup(inv.items || [], isIgst);

      const copiesHtml = COPY_LABELS
        .map(label => buildInvoiceCopy(inv, settings, isIgst, hsnBreakup, label))
        .join('');

      const title = esc('TAX INVOICE - ' + (inv.invoice_no || ''));
      openPrintWindow(title, copiesHtml);
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    }
  }

  // ── Challan ───────────────────────────────────────────────────────────────

  function buildChallanCopy(ch, settings, copyLabel) {
    const items = ch.items || [];
    const itemRows = items.map((item, i) => `
      <tr>
        <td class="ctr">${i + 1}</td>
        <td>${esc(item.description)}</td>
        <td class="ctr">${esc(item.catalog_no)}</td>
        <td class="ctr">${esc(item.hsn_code)}</td>
        <td class="num">${fmtNum(item.quantity)}</td>
        <td class="ctr">${esc(item.unit)}</td>
        <td>${esc(item.lot_no)}</td>
        <td class="ctr">${item.mfg_date ? fmtDate(item.mfg_date) : ''}</td>
        <td class="ctr">${item.exp_date ? fmtDate(item.exp_date) : ''}</td>
        <td>${esc(item.remarks)}</td>
      </tr>
    `).join('');

    const metaCells = [
      `<div class="meta-lbl">Challan No</div>${esc(ch.challan_no)}`,
      `<div class="meta-lbl">Date</div>${esc(fmtDate(ch.date))}`,
    ];
    if (ch.invoice_no) {
      metaCells.push(`<div class="meta-lbl">Invoice No</div>${esc(ch.invoice_no)}`);
    }
    if (ch.motor_vehicle_no) {
      metaCells.push(`<div class="meta-lbl">Vehicle No</div>${esc(ch.motor_vehicle_no)}`);
    }
    if (ch.dispatched_through) {
      metaCells.push(`<div class="meta-lbl">Dispatched Through</div>${esc(ch.dispatched_through)}`);
    }
    if (ch.destination) {
      metaCells.push(`<div class="meta-lbl">Destination</div>${esc(ch.destination)}`);
    }

    const metaCount = Math.min(metaCells.length, 3);
    const metaCols = `repeat(${metaCount}, 1fr)`;
    const metaRowsHtml = [];
    for (let i = 0; i < metaCells.length; i += metaCount) {
      const rowCells = metaCells.slice(i, i + metaCount);
      metaRowsHtml.push(`<div class="meta-row" style="grid-template-columns:${metaCols}">${rowCells.map(c => `<div class="meta-cell">${c}</div>`).join('')}</div>`);
    }

    const notesHtml = ch.notes
      ? `<div class="notes-section" style="margin-bottom:5px"><strong>Notes:</strong> ${esc(ch.notes)}</div>`
      : '';

    return `
      <div class="page">
        <!-- Header -->
        <div class="doc-header">
          <div>
            <div class="company-name">${esc(settings.company_name || 'Company')}</div>
            <div class="company-sub">${esc(settings.address || '')}</div>
            <div class="company-sub">GSTIN: ${esc(settings.gstin || '')}${settings.pan ? ' &nbsp;|&nbsp; PAN: ' + esc(settings.pan) : ''}</div>
            <div class="company-sub">State: ${esc(settings.state_code || '')} - ${esc(settings.state_name || '')}</div>
          </div>
          <div class="doc-type-block">
            <div class="doc-type">Delivery Challan</div>
            <div class="copy-badge">${esc(copyLabel)}</div>
          </div>
        </div>

        <!-- Party details -->
        <div class="party-row">
          <div class="party-cell">
            <div class="party-label">Consignee (To)</div>
            <div class="party-name">${esc(ch.consignee_name || '')}</div>
            <div class="party-line">${esc(ch.consignee_address || '')}</div>
            ${ch.consignee_gstin ? `<div class="party-line">GSTIN: ${esc(ch.consignee_gstin)}</div>` : ''}
            ${ch.consignee_state_code ? `<div class="party-line">State: ${esc(ch.consignee_state_code)} - ${esc(ch.consignee_state_name || '')}</div>` : ''}
          </div>
          <div class="party-cell">
            <div class="party-label">Consignor (From)</div>
            <div class="party-name">${esc(settings.company_name || '')}</div>
            <div class="party-line">${esc(settings.address || '')}</div>
            <div class="party-line">GSTIN: ${esc(settings.gstin || '')}</div>
            <div class="party-line">State: ${esc(settings.state_code || '')} - ${esc(settings.state_name || '')}</div>
          </div>
        </div>

        <!-- Meta info -->
        ${metaRowsHtml.join('')}

        <!-- Items table -->
        <table class="items-tbl">
          <thead>
            <tr>
              <th style="width:24px">#</th>
              <th>Description</th>
              <th>Cat. No</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Lot No</th>
              <th>Mfg Date</th>
              <th>Exp Date</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="10" style="text-align:center">No items</td></tr>'}</tbody>
        </table>

        ${notesHtml}

        <!-- Signatures -->
        <div class="sig-row">
          <div class="sig-box">
            <div>Receiver's Signature</div>
            <div class="sig-line">Name &amp; Seal</div>
          </div>
          <div class="sig-box">
            <div>for ${esc(settings.company_name || '')}</div>
            <div class="sig-line">Authorised Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  async function exportChallan(id) {
    try {
      const ch = await DB.getChallan(id);
      if (!ch) { showToast('Challan not found', 'error'); return; }
      const settings = await DB.getSettings();

      const copiesHtml = COPY_LABELS
        .map(label => buildChallanCopy(ch, settings, label))
        .join('');

      const title = esc('DELIVERY CHALLAN - ' + (ch.challan_no || ''));
      openPrintWindow(title, copiesHtml);
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    }
  }

  // ── Print window ─────────────────────────────────────────────────────────

  function openPrintWindow(title, copiesHtml) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  ${printStyles()}
</head>
<body>
  <div class="print-hint no-print">
    &#128247;&nbsp; Press <strong>Ctrl+P</strong> (or tap the menu → Print) and choose <strong>Save as PDF</strong>.
    &nbsp;&nbsp;
    <button onclick="window.print()" style="padding:4px 14px;font-size:13px;cursor:pointer">🖨️ Print / Save as PDF</button>
  </div>
  ${copiesHtml}
  <script>
    // Open print dialog after styles are fully applied
    if (document.readyState === 'complete') {
      window.print();
    } else {
      window.addEventListener('load', function () { window.print(); });
    }
  </script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) {
      showToast('Pop-up blocked. Please allow pop-ups for this site.', 'error');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return { exportInvoice, exportChallan };
})();
