/**
 * Print / PDF Export Module
 * Generates 4-copy Tax Invoice and 4-copy Delivery Challan printable pages.
 * Uses window.open + document.write so Android Chrome "Save as PDF" captures
 * all copies with proper A4 page-breaks.
 *
 * Copy labels (matching desktop version):
 *   1. Original for Recipient
 *   2. Duplicate for Transporter
 *   3. Triplicate for Supplier
 *   4. Office Copy
 */

'use strict';

const PrintModule = (() => {

  const COPY_LABELS = [
    'Original for Recipient',
    'Duplicate for Transporter',
    'Triplicate for Supplier',
    'Office Copy'
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(n) {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtQty(n) {
    const v = parseFloat(n) || 0;
    return v % 1 === 0 ? String(Math.floor(v)) : fmt(v);
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Shared print-window CSS ───────────────────────────────────────────────

  function baseStyles() {
    return `
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; margin: 0; padding: 0; background: #fff; }
        h1, h2, h3 { margin: 0; }

        /* Copy wrapper – each copy fills roughly one A4 page */
        .copy-page { page-break-after: always; border: 1px solid #000; padding: 4mm; margin-bottom: 4mm; }
        .copy-page:last-child { page-break-after: avoid; }

        /* Header */
        .doc-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 3mm; }
        .doc-header .company-name { font-size: 13pt; font-weight: bold; text-transform: uppercase; }
        .doc-header .company-address { font-size: 7.5pt; color: #333; margin-top: 1mm; }
        .doc-header .doc-title { font-size: 10pt; font-weight: bold; letter-spacing: 1px; margin-top: 2mm; border: 1px solid #000; display: inline-block; padding: 1mm 4mm; }

        /* Copy label – top right */
        .copy-label { font-size: 9pt; font-weight: bold; font-style: italic; color: #333; border: 1px solid #666; padding: 2px 8px; white-space: nowrap; }

        /* Party row */
        .party-row { display: table; width: 100%; border: 1px solid #000; margin: 2mm 0; }
        .party-cell { display: table-cell; width: 50%; padding: 2mm; vertical-align: top; border-right: 1px solid #000; }
        .party-cell:last-child { border-right: none; }
        .party-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 1mm; }
        .party-name { font-size: 9pt; font-weight: bold; }
        .party-detail { font-size: 7.5pt; color: #333; margin-top: 0.5mm; }

        /* Meta row (invoice no, date, etc.) */
        .meta-row { display: table; width: 100%; border: 1px solid #000; border-top: none; }
        .meta-cell { display: table-cell; padding: 1.5mm 2mm; vertical-align: middle; border-right: 1px solid #000; font-size: 7.5pt; }
        .meta-cell:last-child { border-right: none; }
        .meta-cell strong { font-size: 8pt; }

        /* Items table */
        .items-table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
        .items-table th { background: #f5f5f5; font-size: 7pt; font-weight: bold; padding: 2px 3px; border: 1px solid #000; text-align: center; }
        .items-table td { border: 1px solid #000; padding: 2px 3px; font-size: 7.5pt; vertical-align: top; }
        .items-table td.num { text-align: right; }
        .items-table td.ctr { text-align: center; }
        .items-table tfoot td { font-weight: bold; background: #f5f5f5; }

        /* Totals table */
        .totals-table { width: 50%; margin-left: auto; border-collapse: collapse; margin-top: 1mm; }
        .totals-table td { border: 1px solid #000; padding: 2px 4px; font-size: 7.5pt; }
        .totals-table td.lbl { font-weight: normal; }
        .totals-table td.val { text-align: right; font-weight: bold; width: 35%; }
        .totals-table tr.grand td { background: #f0f0f0; font-size: 9pt; font-weight: bold; }

        /* Amount in words */
        .amount-words { border: 1px solid #000; padding: 2mm; font-size: 7.5pt; margin: 2mm 0; }
        .amount-words strong { font-size: 8pt; }

        /* HSN breakup */
        .hsn-table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
        .hsn-table th { background: #f5f5f5; font-size: 7pt; font-weight: bold; border: 1px solid #000; padding: 2px 3px; text-align: center; }
        .hsn-table td { border: 1px solid #000; padding: 2px 3px; font-size: 7.5pt; }
        .hsn-table td.num { text-align: right; }

        /* Footer */
        .footer-row { display: table; width: 100%; border-top: 1px solid #000; margin-top: 3mm; }
        .footer-left { display: table-cell; width: 60%; vertical-align: top; padding-right: 2mm; font-size: 7pt; }
        .footer-right { display: table-cell; width: 40%; vertical-align: top; text-align: right; font-size: 7.5pt; }
        .footer-right .sig-space { height: 25px; }
        .declaration { font-size: 6.5pt; color: #333; font-style: italic; margin-top: 2mm; }
        .jurisdiction { text-align: center; font-size: 6.5pt; border-top: 1px solid #000; margin-top: 2mm; padding-top: 1mm; }

        /* Bank details */
        .bank-details { font-size: 7pt; margin-top: 2mm; }
        .bank-details strong { font-size: 7.5pt; }

        /* Screen-only: print button bar */
        @media screen {
          .print-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1976d2; padding: 10px; display: flex; gap: 8px; z-index: 9999; }
          .print-bar button { flex: 1; padding: 10px; font-size: 14px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; }
          .print-bar .btn-print { background: #fff; color: #1976d2; }
          .print-bar .btn-close { background: rgba(255,255,255,0.2); color: #fff; }
          body { padding-bottom: 60px; }
        }
        @media print {
          .print-bar { display: none !important; }
          body { padding-bottom: 0; }
        }
      </style>
    `;
  }

  function printBar() {
    return `
      <div class="print-bar">
        <button class="btn-print" onclick="window.print()">🖨️ Save as PDF / Print</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
    `;
  }

  // ── Invoice HTML builder ──────────────────────────────────────────────────

  function buildInvoiceCopy(inv, settings, copyLabel, isIgst) {
    // Items rows
    let itemsHtml = (inv.items || []).map((item, i) => `
      <tr>
        <td class="ctr">${i + 1}</td>
        <td>${esc(item.description || '')}${item.catalog_no ? '<br><i style="font-size:7pt;color:#555">' + esc(item.catalog_no) + '</i>' : ''}</td>
        <td class="ctr">${esc(item.hsn_code || '')}</td>
        <td class="ctr">${esc(item.gst_rate || 0)}%</td>
        <td class="num">${fmtQty(item.quantity)}</td>
        <td class="ctr">${esc(item.unit || '')}</td>
        <td class="num">₹${fmt(item.unit_price)}</td>
        <td class="num">₹${fmt(item.amount)}</td>
      </tr>
    `).join('');

    // Totals footer
    let taxRows = '';
    if (isIgst) {
      taxRows = `<tr><td class="lbl">Output IGST</td><td class="val">₹${fmt(inv.igst_total)}</td></tr>`;
    } else {
      taxRows = `
        <tr><td class="lbl">Output CGST</td><td class="val">₹${fmt(inv.cgst_total)}</td></tr>
        <tr><td class="lbl">Output SGST</td><td class="val">₹${fmt(inv.sgst_total)}</td></tr>
      `;
    }

    // HSN breakup – GSTCalculator is globally available (loaded before print.js in index.html)
    const hsnBreakup = inv.hsn_breakup
      ? (typeof inv.hsn_breakup === 'string' ? JSON.parse(inv.hsn_breakup) : inv.hsn_breakup)
      : GSTCalculator.getHsnBreakup(inv.items || [], isIgst);

    let hsnHtml = '';
    if (hsnBreakup.length) {
      const hsnRows = hsnBreakup.map(h => `
        <tr>
          <td>${esc(h.hsn_code || '')}</td>
          <td class="num">₹${fmt(h.taxable_value)}</td>
          ${isIgst ? `
            <td class="ctr">${h.igst_rate}%</td>
            <td class="num">₹${fmt(h.igst_amount)}</td>
          ` : `
            <td class="ctr">${h.cgst_rate}%</td>
            <td class="num">₹${fmt(h.cgst_amount)}</td>
            <td class="ctr">${h.sgst_rate}%</td>
            <td class="num">₹${fmt(h.sgst_amount)}</td>
          `}
          <td class="num"><strong>₹${fmt(h.total_tax)}</strong></td>
        </tr>
      `).join('');
      const hsnHead = isIgst
        ? '<th>HSN/SAC</th><th>Taxable Value</th><th>IGST Rate</th><th>IGST Amt</th><th>Total Tax</th>'
        : '<th>HSN/SAC</th><th>Taxable Value</th><th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th><th>Total Tax</th>';
      hsnHtml = `
        <div style="margin-top:2mm;font-size:7.5pt;font-weight:bold">HSN/SAC-wise Tax Summary:</div>
        <table class="hsn-table">
          <thead><tr>${hsnHead}</tr></thead>
          <tbody>${hsnRows}</tbody>
        </table>
      `;
    }

    // Bank details
    let bankHtml = '';
    if (settings.bank_name) {
      bankHtml = `
        <div class="bank-details">
          <strong>Company's Bank Details:</strong><br>
          A/c Holder's Name: ${esc(settings.company_name)}<br>
          Bank Name: ${esc(settings.bank_name)}${settings.bank_branch ? ', Branch: ' + esc(settings.bank_branch) : ''}<br>
          ${settings.bank_account ? 'A/c No.: ' + esc(settings.bank_account) + '<br>' : ''}
          ${settings.bank_ifsc ? 'IFS Code: ' + esc(settings.bank_ifsc) : ''}
        </div>
      `;
    }

    const dispatchRow = (inv.dispatched_through || inv.destination || inv.motor_vehicle_no) ? `
      <div class="meta-row">
        ${inv.dispatched_through ? `<div class="meta-cell"><strong>Dispatched through:</strong> ${esc(inv.dispatched_through)}</div>` : '<div class="meta-cell"></div>'}
        ${inv.destination ? `<div class="meta-cell"><strong>Destination:</strong> ${esc(inv.destination)}</div>` : '<div class="meta-cell"></div>'}
        ${inv.motor_vehicle_no ? `<div class="meta-cell"><strong>Vehicle No.:</strong> ${esc(inv.motor_vehicle_no)}</div>` : '<div class="meta-cell"></div>'}
      </div>
    ` : '';

    return `
      <div class="copy-page">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2mm">
          <div class="doc-header" style="flex:1;text-align:center;border-bottom:none;padding-bottom:0">
            <div class="company-name">${esc(settings.company_name || '')}</div>
            <div class="company-address">${esc(settings.address || '')}</div>
            <div style="font-size:7.5pt;margin-top:1mm">
              GSTIN: <strong>${esc(settings.gstin || '')}</strong>
              ${settings.pan ? ' | PAN: <strong>' + esc(settings.pan) + '</strong>' : ''}
              ${settings.udyam ? ' | UDYAM: <strong>' + esc(settings.udyam) + '</strong>' : ''}
            </div>
            ${settings.phone ? '<div style="font-size:7.5pt">Ph: ' + esc(settings.phone) + '</div>' : ''}
          </div>
          <div style="text-align:right;padding-left:4mm">
            <div class="doc-title">TAX INVOICE</div>
            <div style="margin-top:3mm"><span class="copy-label">${esc(copyLabel)}</span></div>
          </div>
        </div>
        <hr style="border:none;border-top:2px solid #000;margin:1mm 0">

        <!-- Meta: Invoice No / Date -->
        <div class="meta-row">
          <div class="meta-cell"><strong>Invoice No.:</strong> ${esc(inv.invoice_no || '')}</div>
          <div class="meta-cell"><strong>Date:</strong> ${fmtDate(inv.date)}</div>
          ${inv.challan_no ? `<div class="meta-cell"><strong>Challan No.:</strong> ${esc(inv.challan_no)}</div>` : '<div class="meta-cell"></div>'}
          ${inv.place_of_supply ? `<div class="meta-cell"><strong>Place of Supply:</strong> ${esc(inv.place_of_supply_code || '')} - ${esc(inv.place_of_supply)}</div>` : '<div class="meta-cell"></div>'}
        </div>

        <!-- Party -->
        <div class="party-row">
          <div class="party-cell">
            <div class="party-label">Seller / Consignor</div>
            <div class="party-name">${esc(settings.company_name || '')}</div>
            <div class="party-detail">${esc(settings.address || '')}</div>
            <div class="party-detail">GSTIN: ${esc(settings.gstin || '')} | State: ${esc(settings.state_code || '')} - ${esc(settings.state_name || '')}</div>
          </div>
          <div class="party-cell">
            <div class="party-label">Buyer / Consignee</div>
            <div class="party-name">${esc(inv.buyer_name || '')}</div>
            <div class="party-detail">${esc(inv.buyer_address || '')}</div>
            ${inv.buyer_gstin ? `<div class="party-detail">GSTIN: ${esc(inv.buyer_gstin)}</div>` : ''}
            ${inv.buyer_state_code ? `<div class="party-detail">State: ${esc(inv.buyer_state_code)} - ${esc(inv.buyer_state_name || '')}</div>` : ''}
          </div>
        </div>

        ${dispatchRow}

        <!-- Items table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:4%">Sl<br>No.</th>
              <th style="width:35%">Description of Goods</th>
              <th style="width:9%">HSN/<br>SAC</th>
              <th style="width:7%">GST<br>Rate</th>
              <th style="width:8%">Qty</th>
              <th style="width:6%">Unit</th>
              <th style="width:13%">Rate (₹)</th>
              <th style="width:18%">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="7" class="num"><strong>Taxable Value</strong></td>
              <td class="num"><strong>₹${fmt(inv.subtotal)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <!-- Totals -->
        <table class="totals-table">
          <tr><td class="lbl">Taxable Value</td><td class="val">₹${fmt(inv.subtotal)}</td></tr>
          ${taxRows}
          <tr><td class="lbl">Rounded Off</td><td class="val">${parseFloat(inv.round_off) >= 0 ? '+' : ''}₹${fmt(inv.round_off)}</td></tr>
          <tr class="grand"><td class="lbl">Grand Total</td><td class="val">₹${fmt(inv.grand_total)}</td></tr>
        </table>

        <!-- Amount in words -->
        <div class="amount-words">
          <strong>Amount Chargeable (in words):</strong> ${esc(inv.amount_in_words || '')}
        </div>

        ${hsnHtml}

        <!-- Footer -->
        <div class="footer-row">
          <div class="footer-left">
            ${bankHtml}
            <div class="declaration">
              We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </div>
            ${inv.payment_mode ? '<div style="margin-top:2mm;font-size:7.5pt"><strong>Payment Mode:</strong> ' + esc(inv.payment_mode) + '</div>' : ''}
            ${inv.notes ? '<div style="margin-top:2mm;font-size:7.5pt"><strong>Notes:</strong> ' + esc(inv.notes) + '</div>' : ''}
          </div>
          <div class="footer-right">
            <div>for <strong>${esc(settings.company_name || '')}</strong></div>
            <div class="sig-space"></div>
            <div>________________</div>
            <div><strong>Authorised Signatory</strong></div>
          </div>
        </div>
        <div class="jurisdiction">
          ${settings.state_name ? 'SUBJECT TO ' + esc(settings.state_name).toUpperCase() + ' JURISDICTION | ' : ''}This is a Computer Generated Invoice
        </div>
      </div>
    `;
  }

  // ── Challan HTML builder ──────────────────────────────────────────────────

  function buildChallanCopy(ch, settings, copyLabel) {
    const itemsHtml = (ch.items || []).map((item, i) => `
      <tr>
        <td class="ctr">${i + 1}</td>
        <td class="ctr">${esc(item.catalog_no || '')}</td>
        <td>${esc(item.description || '')}</td>
        <td class="ctr">${esc(item.hsn_code || '')}</td>
        <td>${esc(item.lot_no || '')}</td>
        <td class="ctr">${item.mfg_date ? fmtDate(item.mfg_date) : ''}</td>
        <td class="ctr">${item.exp_date ? fmtDate(item.exp_date) : ''}</td>
        <td class="num">${fmtQty(item.quantity)} ${esc(item.unit || '')}</td>
      </tr>
    `).join('');

    return `
      <div class="copy-page">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2mm">
          <div style="flex:1;text-align:center">
            <div class="company-name">${esc(settings.company_name || '')}</div>
            <div class="company-address">${esc(settings.address || '')}</div>
            <div style="font-size:7.5pt;margin-top:1mm">
              GSTIN: <strong>${esc(settings.gstin || '')}</strong>
              ${settings.pan ? ' | PAN: <strong>' + esc(settings.pan) + '</strong>' : ''}
            </div>
          </div>
          <div style="text-align:right;padding-left:4mm">
            <div class="doc-title">DELIVERY CHALLAN</div>
            <div style="margin-top:3mm"><span class="copy-label">${esc(copyLabel)}</span></div>
          </div>
        </div>
        <hr style="border:none;border-top:2px solid #000;margin:1mm 0">

        <!-- Meta -->
        <div class="meta-row">
          <div class="meta-cell"><strong>Challan No.:</strong> ${esc(ch.challan_no || '')}</div>
          <div class="meta-cell"><strong>Date:</strong> ${fmtDate(ch.date)}</div>
          ${ch.invoice_no ? `<div class="meta-cell"><strong>Invoice No.:</strong> ${esc(ch.invoice_no)}</div>` : '<div class="meta-cell"></div>'}
          ${ch.motor_vehicle_no ? `<div class="meta-cell"><strong>Vehicle No.:</strong> ${esc(ch.motor_vehicle_no)}</div>` : '<div class="meta-cell"></div>'}
        </div>
        ${(ch.dispatched_through || ch.destination) ? `
        <div class="meta-row">
          ${ch.dispatched_through ? `<div class="meta-cell"><strong>Dispatched through:</strong> ${esc(ch.dispatched_through)}</div>` : '<div class="meta-cell"></div>'}
          ${ch.destination ? `<div class="meta-cell"><strong>Destination:</strong> ${esc(ch.destination)}</div>` : '<div class="meta-cell"></div>'}
          <div class="meta-cell"></div>
          <div class="meta-cell"></div>
        </div>
        ` : ''}

        <!-- Party -->
        <div class="party-row">
          <div class="party-cell">
            <div class="party-label">From (Consignor)</div>
            <div class="party-name">${esc(settings.company_name || '')}</div>
            <div class="party-detail">${esc(settings.address || '')}</div>
            <div class="party-detail">GSTIN: ${esc(settings.gstin || '')}</div>
          </div>
          <div class="party-cell">
            <div class="party-label">To (Consignee)</div>
            <div class="party-name">${esc(ch.consignee_name || '')}</div>
            <div class="party-detail">${esc(ch.consignee_address || '')}</div>
            ${ch.consignee_gstin ? `<div class="party-detail">GSTIN: ${esc(ch.consignee_gstin)}</div>` : ''}
          </div>
        </div>

        <!-- Items table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:5%">Sl<br>No.</th>
              <th style="width:10%">Cat.<br>No.</th>
              <th style="width:25%">Item Description</th>
              <th style="width:9%">HSN/<br>SAC</th>
              <th style="width:14%">Lot No.</th>
              <th style="width:12%">Mfg. Date</th>
              <th style="width:12%">Exp. Date</th>
              <th style="width:13%">Quantity</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        ${ch.notes ? `<div style="margin-top:2mm;font-size:7.5pt"><strong>Notes:</strong> ${esc(ch.notes)}</div>` : ''}

        <!-- Footer -->
        <div class="footer-row" style="margin-top:4mm">
          <div class="footer-left">
            <div style="font-size:7.5pt">Receiver's Name &amp; Signature:</div>
            <div style="height:28px;border-bottom:1px solid #000;width:80%;margin-top:20px"></div>
          </div>
          <div class="footer-right">
            <div>for <strong>${esc(settings.company_name || '')}</strong></div>
            <div class="sig-space"></div>
            <div>________________</div>
            <div><strong>Authorised Signatory</strong></div>
          </div>
        </div>
        <div class="jurisdiction">
          ${settings.state_name ? 'SUBJECT TO ' + esc(settings.state_name).toUpperCase() + ' JURISDICTION | ' : ''}This is a Computer Generated Challan
        </div>
      </div>
    `;
  }

  // ── Open new print window ─────────────────────────────────────────────────

  function openPrintWindow(title, bodyHtml) {
    // Open without fixed dimensions so Android Chrome uses full screen
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups for this site to enable PDF export.');
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  ${baseStyles()}
</head>
<body>
  ${bodyHtml}
  ${printBar()}
</body>
</html>`);
    win.document.close();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async function exportInvoicePDF(id) {
    const [inv, s] = await Promise.all([DB.getInvoice(id), DB.getSettings()]);
    if (!inv) { alert('Invoice not found'); return; }

    const isIgst = !!inv.is_igst;
    const copies = COPY_LABELS.map(label => buildInvoiceCopy(inv, s, label, isIgst)).join('');
    openPrintWindow(`Tax Invoice – ${inv.invoice_no || id}`, copies);
  }

  async function exportChallanPDF(id) {
    const [ch, s] = await Promise.all([DB.getChallan(id), DB.getSettings()]);
    if (!ch) { alert('Challan not found'); return; }

    const copies = COPY_LABELS.map(label => buildChallanCopy(ch, s, label)).join('');
    openPrintWindow(`Delivery Challan – ${ch.challan_no || id}`, copies);
  }

  async function exportCombinedPDF(invoiceId, challanId) {
    // Combined: 4 invoice copies then 4 challan copies
    const [inv, s] = await Promise.all([DB.getInvoice(invoiceId), DB.getSettings()]);
    if (!inv) { alert('Invoice not found'); return; }

    // Try to find associated challan
    let ch = null;
    if (challanId) {
      ch = await DB.getChallan(challanId);
    } else if (inv.challan_no) {
      ch = await DB.getChallanByNo(inv.challan_no);
    }

    const isIgst = !!inv.is_igst;
    const invCopies = COPY_LABELS.map(label => buildInvoiceCopy(inv, s, label, isIgst)).join('');
    const chalCopies = ch
      ? COPY_LABELS.map(label => buildChallanCopy(ch, s, label)).join('')
      : '';

    const title = ch
      ? `Combined PDF – ${inv.invoice_no || invoiceId} + ${ch.challan_no || challanId}`
      : `Tax Invoice – ${inv.invoice_no || invoiceId}`;

    openPrintWindow(title, invCopies + chalCopies);
  }

  return { exportInvoicePDF, exportChallanPDF, exportCombinedPDF };
})();
