/**
 * Converts numbers to Indian currency words format (Lakhs, Crores)
 * e.g. 125000 -> "One Lakh Twenty-Five Thousand Rupees Only"
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertThreeDigit(n) {
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

function convertNumberToWords(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Zero Rupees Only';
  const val = Number(num);
  if (val === 0) return 'Zero Rupees Only';

  const parts = val.toFixed(2).split('.');
  let integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);

  if (integerPart === 0 && decimalPart === 0) {
    return 'Zero Rupees Only';
  }

  let words = '';

  // Crores (>= 1,00,00,000)
  if (integerPart >= 10000000) {
    const crores = Math.floor(integerPart / 10000000);
    words += convertNumberToWordsInternal(crores) + ' Crore ';
    integerPart %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (integerPart >= 100000) {
    const lakhs = Math.floor(integerPart / 100000);
    words += convertNumberToWordsInternal(lakhs) + ' Lakh ';
    integerPart %= 100000;
  }

  // Thousands (>= 1,000)
  if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    words += convertNumberToWordsInternal(thousands) + ' Thousand ';
    integerPart %= 1000;
  }

  // Hundreds and remaining (< 1,000)
  if (integerPart > 0) {
    words += convertThreeDigit(integerPart) + ' ';
  }

  words = words.trim();
  let result = words ? 'Rupees ' + words : '';

  if (decimalPart > 0) {
    const paiseWords = convertThreeDigit(decimalPart);
    if (result) {
      result += ' and ' + paiseWords + ' Paise';
    } else {
      result = paiseWords + ' Paise';
    }
  }

  return (result + ' Only').replace(/\s+/g, ' ');
}

function convertNumberToWordsInternal(n) {
  if (n < 100) {
    if (n >= 20) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '');
    }
    return ones[n];
  }
  return convertThreeDigit(n);
}

module.exports = { convertNumberToWords };

