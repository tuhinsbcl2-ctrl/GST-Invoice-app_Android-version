/**
 * Convert numeric amounts to Indian English words.
 * Ported from app/services/number_to_words.py (desktop version)
 * Format: "INR Sixty Two Thousand Seven Hundred and Ninety only"
 */

'use strict';

const NumberToWords = (() => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigit(n) {
    n = Math.floor(n);
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function threeDigit(n) {
    n = Math.floor(n);
    if (n >= 100) {
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + twoDigit(n % 100) : '');
    }
    return twoDigit(n);
  }

  function indianNumToWords(n) {
    n = Math.floor(n);
    if (n === 0) return 'Zero';
    let result = '';
    if (n >= 10000000) { // Crore
      result += threeDigit(Math.floor(n / 10000000)) + ' Crore ';
      n = n % 10000000;
    }
    if (n >= 100000) { // Lakh
      result += twoDigit(Math.floor(n / 100000)) + ' Lakh ';
      n = n % 100000;
    }
    if (n >= 1000) { // Thousand
      result += twoDigit(Math.floor(n / 1000)) + ' Thousand ';
      n = n % 1000;
    }
    if (n > 0) {
      result += threeDigit(n);
    }
    return result.trim();
  }

  function amountToWords(amount, currency = 'INR') {
    if (amount === null || amount === undefined) amount = 0;
    amount = parseFloat(amount) || 0;
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);

    let result = `${currency} ${indianNumToWords(rupees)}`;
    if (paise > 0) {
      result += ` and ${indianNumToWords(paise)} Paise`;
    }
    result += ' only';
    return result;
  }

  return { amountToWords, indianNumToWords };
})();
