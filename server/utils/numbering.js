/**
 * Financial Year and Invoice/Receipt Numbering Utilities
 */

/**
 * Returns Indian Financial Year for a given date
 * @param {Date|string} dateInput
 * @param {string} format 'short' (e.g. "26-27") or 'full' (e.g. "2026-27")
 * @returns {string}
 */
function getFinancialYear(dateInput = new Date(), format = 'short') {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return getFinancialYear(new Date(), format);
  }

  const month = d.getMonth() + 1; // 1 - 12
  const fullYear = d.getFullYear();

  let startYear, endYear;
  if (month >= 4) {
    startYear = fullYear;
    endYear = fullYear + 1;
  } else {
    startYear = fullYear - 1;
    endYear = fullYear;
  }

  const startShort = String(startYear).slice(-2);
  const endShort = String(endYear).slice(-2);

  if (format === 'short') {
    return `${startShort}-${endShort}`;
  } else if (format === 'full-four') {
    return `${startYear}-${endYear}`;
  } else {
    // Default 'full' like 2026-27
    return `${startYear}-${endShort}`;
  }
}

/**
 * Formats an invoice number
 * @param {string} prefix e.g. "RSA/"
 * @param {string} fy e.g. "26-27"
 * @param {number} sequence e.g. 1
 * @param {number} padding e.g. 3
 * @returns {string} e.g. "RSA/26-27/001"
 */
function formatInvoiceNumber(prefix, fy, sequence, padding = 3) {
  const cleanPrefix = prefix ? prefix.trim() : 'RSA/';
  const cleanFy = fy ? fy.trim() : getFinancialYear();
  const paddedSeq = String(sequence).padStart(Number(padding) || 3, '0');
  
  if (cleanPrefix.endsWith('/')) {
    return `${cleanPrefix}${cleanFy}/${paddedSeq}`;
  } else {
    return `${cleanPrefix}/${cleanFy}/${paddedSeq}`;
  }
}

/**
 * Formats a receipt number
 * @param {string} fy e.g. "26-27"
 * @param {number} sequence e.g. 1
 * @returns {string} e.g. "RCP/26-27/001"
 */
function formatReceiptNumber(fy, sequence, padding = 3) {
  const cleanFy = fy ? fy.trim() : getFinancialYear();
  const paddedSeq = String(sequence).padStart(padding, '0');
  return `RCP/${cleanFy}/${paddedSeq}`;
}

module.exports = {
  getFinancialYear,
  formatInvoiceNumber,
  formatReceiptNumber
};
