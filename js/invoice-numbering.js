/**
 * Auto-sequencing invoice numbering.
 * Ported from app/services/invoice_numbering.py (desktop version)
 * Format: PREFIX/SERIAL/YEAR  e.g. NE/008/25-26
 */

'use strict';

const InvoiceNumbering = (() => {

  function getFinancialYear(refDate = null) {
    const d = refDate ? new Date(refDate) : new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-based
    if (month >= 4) {
      return `${String(year).slice(2)}-${String(year + 1).slice(2)}`;
    } else {
      return `${String(year - 1).slice(2)}-${String(year).slice(2)}`;
    }
  }

  async function getNextInvoiceNumber(prefix = 'NE', refDate = null) {
    const fy = getFinancialYear(refDate);
    const seq = await DB.getInvoiceSequence(prefix, fy);
    const nextSerial = (seq ? seq.last_serial : 0) + 1;
    const serialStr = String(nextSerial).padStart(3, '0');
    // Save the updated sequence
    await DB.saveInvoiceSequence(prefix, fy, nextSerial);
    return `${prefix}/${serialStr}/${fy}`;
  }

  async function peekNextInvoiceNumber(prefix = 'NE', refDate = null) {
    const fy = getFinancialYear(refDate);
    const seq = await DB.getInvoiceSequence(prefix, fy);
    const nextSerial = (seq ? seq.last_serial : 0) + 1;
    const serialStr = String(nextSerial).padStart(3, '0');
    return `${prefix}/${serialStr}/${fy}`;
  }

  async function rollbackInvoiceNumber(prefix = 'NE', refDate = null) {
    const fy = getFinancialYear(refDate);
    const seq = await DB.getInvoiceSequence(prefix, fy);
    if (seq && seq.last_serial > 0) {
      await DB.saveInvoiceSequence(prefix, fy, seq.last_serial - 1);
    }
  }

  return { getFinancialYear, getNextInvoiceNumber, peekNextInvoiceNumber, rollbackInvoiceNumber };
})();
