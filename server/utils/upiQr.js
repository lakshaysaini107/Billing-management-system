/**
 * UPI QR Code Generator for Invoices
 */
const QRCode = require('qrcode');

/**
 * Generates UPI payment string and Data URL QR code
 * @param {Object} options
 * @param {string} options.upiId e.g. "rsaini@hdfcbank"
 * @param {string} options.payeeName e.g. "RSaini and Associates"
 * @param {number} options.amount e.g. 25960
 * @param {string} options.invoiceNo e.g. "RSA/26-27/001"
 * @returns {Promise<{ upiString: string, qrDataUrl: string }>}
 */
async function generateUpiQr({ upiId, payeeName, amount, invoiceNo }) {
  if (!upiId) {
    return { upiString: '', qrDataUrl: '' };
  }

  const cleanName = encodeURIComponent(payeeName || 'RSaini & Associates');
  const cleanNote = encodeURIComponent(`Payment for Inv ${invoiceNo || 'Consultancy'}`);
  const formattedAmount = Number(amount || 0).toFixed(2);

  let upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${cleanName}&cu=INR`;
  if (formattedAmount > 0) {
    upiString += `&am=${formattedAmount}`;
  }
  upiString += `&tn=${cleanNote}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(upiString, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0f2942',
        light: '#ffffff'
      }
    });

    return { upiString, qrDataUrl };
  } catch (err) {
    console.error('Error generating UPI QR code:', err);
    return { upiString, qrDataUrl: '' };
  }
}

module.exports = { generateUpiQr };
