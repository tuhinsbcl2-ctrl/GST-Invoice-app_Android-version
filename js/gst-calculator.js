/**
 * GST Calculation Logic
 * Ported from app/services/gst_calculator.py (desktop version)
 * - CGST + SGST for intra-state (same state codes)
 * - IGST for inter-state (different state codes)
 */

'use strict';

const GSTCalculator = (() => {

  function calculateGST(amount, gstRate, isIgst = false) {
    amount = parseFloat(amount) || 0;
    gstRate = parseFloat(gstRate) || 0;
    if (isIgst) {
      const igst = Math.round(amount * gstRate / 100 * 100) / 100;
      return { cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0, igst_rate: gstRate, igst_amount: igst };
    } else {
      const halfRate = gstRate / 2;
      const cgst = Math.round(amount * halfRate / 100 * 100) / 100;
      const sgst = Math.round(amount * halfRate / 100 * 100) / 100;
      return { cgst_rate: halfRate, cgst_amount: cgst, sgst_rate: halfRate, sgst_amount: sgst, igst_rate: 0, igst_amount: 0 };
    }
  }

  function isIgstApplicable(sellerStateCode, buyerStateCode) {
    return String(sellerStateCode).trim() !== String(buyerStateCode).trim();
  }

  function calculateInvoiceTotals(items, isIgst = false) {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const processedItems = items.map((item, idx) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const gstRate = parseFloat(item.gst_rate) || 0;
      const amount = Math.round(qty * price * 100) / 100;
      const gst = calculateGST(amount, gstRate, isIgst);

      subtotal += amount;
      cgstTotal += gst.cgst_amount;
      sgstTotal += gst.sgst_amount;
      igstTotal += gst.igst_amount;

      return { ...item, sl_no: idx + 1, amount, ...gst };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    cgstTotal = Math.round(cgstTotal * 100) / 100;
    sgstTotal = Math.round(sgstTotal * 100) / 100;
    igstTotal = Math.round(igstTotal * 100) / 100;

    const totalBeforeRound = subtotal + cgstTotal + sgstTotal + igstTotal;
    const grandTotalRaw = Math.round(totalBeforeRound);
    const roundOff = Math.round((grandTotalRaw - totalBeforeRound) * 100) / 100;
    const grandTotal = grandTotalRaw;

    return {
      items: processedItems,
      totals: { subtotal, cgst_total: cgstTotal, sgst_total: sgstTotal, igst_total: igstTotal, round_off: roundOff, grand_total: grandTotal }
    };
  }

  function getHsnBreakup(items, isIgst = false) {
    const hsnMap = {};
    for (const item of items) {
      const hsn = item.hsn_code || '';
      const gstRate = parseFloat(item.gst_rate) || 0;
      const amount = parseFloat(item.amount) || 0;
      const key = `${hsn}__${gstRate}`;
      if (!hsnMap[key]) {
        hsnMap[key] = {
          hsn_code: hsn, gst_rate: gstRate,
          taxable_value: 0, cgst_rate: 0, cgst_amount: 0,
          sgst_rate: 0, sgst_amount: 0, igst_rate: 0, igst_amount: 0, total_tax: 0
        };
      }
      hsnMap[key].taxable_value += amount;
      hsnMap[key].cgst_amount += parseFloat(item.cgst_amount) || 0;
      hsnMap[key].sgst_amount += parseFloat(item.sgst_amount) || 0;
      hsnMap[key].igst_amount += parseFloat(item.igst_amount) || 0;
      if (isIgst) {
        hsnMap[key].igst_rate = gstRate;
      } else {
        hsnMap[key].cgst_rate = gstRate / 2;
        hsnMap[key].sgst_rate = gstRate / 2;
      }
    }
    return Object.values(hsnMap).map(row => ({
      ...row,
      taxable_value: Math.round(row.taxable_value * 100) / 100,
      cgst_amount: Math.round(row.cgst_amount * 100) / 100,
      sgst_amount: Math.round(row.sgst_amount * 100) / 100,
      igst_amount: Math.round(row.igst_amount * 100) / 100,
      total_tax: Math.round((row.cgst_amount + row.sgst_amount + row.igst_amount) * 100) / 100
    }));
  }

  return { calculateGST, isIgstApplicable, calculateInvoiceTotals, getHsnBreakup };
})();
