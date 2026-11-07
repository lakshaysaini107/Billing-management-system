/**
 * Formatters and Common Utilities
 */
const Utils = {
  /**
   * Format Indian Rupee currency (e.g. ₹25,960.00)
   */
  formatINR(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
    const val = Number(amount);
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  /**
   * Format Date to standard Indian business format (DD MMM YYYY)
   */
  formatDate(dateInput) {
    if (!dateInput) return '-';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateInput);
    }
  },

  /**
   * Status badge HTML
   */
  statusBadge(status) {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'draft':
        return '<span class="badge badge-draft"><span style="width:6px;height:6px;border-radius:50%;background:#64748b;"></span>Draft</span>';
      case 'issued':
        return '<span class="badge badge-issued"><span style="width:6px;height:6px;border-radius:50%;background:#0284c7;"></span>Issued</span>';
      case 'partially_paid':
      case 'partial':
        return '<span class="badge badge-partial"><span style="width:6px;height:6px;border-radius:50%;background:#d97706;"></span>Partially Paid</span>';
      case 'paid':
        return '<span class="badge badge-paid"><span style="width:6px;height:6px;border-radius:50%;background:#059669;"></span>Paid</span>';
      case 'overdue':
        return '<span class="badge badge-overdue"><span style="width:6px;height:6px;border-radius:50%;background:#dc2626;"></span>Overdue</span>';
      case 'cancelled':
        return '<span class="badge badge-cancelled"><span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;"></span>Cancelled</span>';
      case 'active':
        return '<span class="badge badge-active"><span style="width:6px;height:6px;border-radius:50%;background:#059669;"></span>Active</span>';
      case 'inactive':
        return '<span class="badge badge-inactive"><span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;"></span>Inactive</span>';
      default:
        return `<span class="badge badge-draft">${this.escapeHtml(status)}</span>`;
    }
  },

  /**
   * Client Entity Type badge
   */
  clientTypeBadge(type) {
    return `<span style="font-size:11px; padding:2px 8px; border-radius:4px; background:#f1f5f9; color:#475569; font-weight:600; border:1px solid #e2e8f0;">${this.escapeHtml(type || 'Company')}</span>`;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * CSV Exporter
   */
  exportToCsv(filename, rows) {
    if (!rows || !rows.length) {
      Toast.warning('No data available to export.');
      return;
    }

    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : String(row[k]);
          cell = cell.replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(separator);
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Convert number to words in Indian Rupees
   */
  numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function threeDigit(n) {
      let str = '';
      if (n >= 100) {
        str += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '') + ' ';
      } else if (n > 0) {
        str += ones[n] + ' ';
      }
      return str.trim();
    }

    if (!num || isNaN(num) || Number(num) === 0) return 'Zero Rupees Only';
    const parts = Number(num).toFixed(2).split('.');
    let intPart = parseInt(parts[0], 10);
    const decPart = parseInt(parts[1], 10);

    let words = '';
    if (intPart >= 10000000) {
      words += threeDigit(Math.floor(intPart / 10000000)) + ' Crore ';
      intPart %= 10000000;
    }
    if (intPart >= 100000) {
      words += threeDigit(Math.floor(intPart / 100000)) + ' Lakh ';
      intPart %= 100000;
    }
    if (intPart >= 1000) {
      words += threeDigit(Math.floor(intPart / 1000)) + ' Thousand ';
      intPart %= 1000;
    }
    if (intPart > 0) {
      words += threeDigit(intPart) + ' ';
    }
    words = words.trim();
    let res = words ? 'Rupees ' + words : '';
    if (decPart > 0) {
      res += (res ? ' and ' : '') + threeDigit(decPart) + ' Paise';
    }
    return (res + ' Only').replace(/\s+/g, ' ');
  }
};

