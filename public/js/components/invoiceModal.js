/**
 * Invoice View / Print Modal & Letterhead Renderer
 */
const InvoiceModal = {
  currentInvoice: null,
  isPreprintedMode: false,

  async open(invoiceId) {
    const modalId = 'invoice-view-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    try {
      const data = await API.get(`/api/invoices/${invoiceId}`);
      this.currentInvoice = data;
      this.isPreprintedMode = data.settings.print_letterhead_artwork === '0';

      const inv = data.invoice;
      const items = data.items;
      const settings = data.settings;
      const user = API.getUser() || {};
      const canCancel = (user.role === 'admin' || user.role === 'owner') && inv.status !== 'cancelled' && inv.status !== 'draft';

      const backdrop = document.createElement('div');
      backdrop.id = modalId;
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-content modal-xl" style="height:92vh;">
          
          <!-- Top Control Header (Hidden in Print) -->
          <div class="modal-header no-print">
            <div style="display:flex; align-items:center; gap:12px;">
              <span class="modal-title">
                ${inv.invoice_number ? `Invoice: ${Utils.escapeHtml(inv.invoice_number)}` : `Draft Invoice #${inv.id}`}
              </span>
              ${Utils.statusBadge(inv.status)}
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
              <!-- Toggle Letterhead Mode -->
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#475569; cursor:pointer; background:#f1f5f9; padding:5px 10px; border-radius:6px; border:1px solid #cbd5e1;">
                <input type="checkbox" id="toggle-stationery-mode" onchange="InvoiceModal.toggleStationery(this.checked)" ${this.isPreprintedMode ? 'checked' : ''} />
                Pre-printed Stationery Mode
              </label>

              <!-- Actions -->
              ${inv.status === 'draft' ? `
                <button class="btn btn-primary btn-sm" onclick="InvoiceModal.issueDraft(${inv.id})">
                  Issue Invoice
                </button>
              ` : ''}

              ${inv.balance_amount > 0 && inv.status !== 'cancelled' && inv.status !== 'draft' ? `
                <button class="btn btn-success btn-sm" onclick="PaymentsView.openRecordPaymentModal(${inv.id})">
                  Record Payment (Bal: ${Utils.formatINR(inv.balance_amount)})
                </button>
              ` : ''}

              <button class="btn btn-primary btn-sm" onclick="InvoiceModal.downloadPdf()" title="Download genuine A4 PDF document">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Download PDF
              </button>

              <button class="btn btn-outline btn-sm" onclick="InvoiceModal.printInvoice()" title="Print to office printer or Save as PDF via Browser">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Print / Browser PDF
              </button>

              <button class="btn btn-outline btn-sm" onclick="InvoiceModal.downloadHtml()" title="Download offline standalone HTML file with embedded styles">
                Offline HTML
              </button>

              ${canCancel ? `
                <button class="btn btn-danger btn-sm" onclick="InvoiceModal.cancelInvoicePrompt(${inv.id})">
                  Cancel Invoice
                </button>
              ` : ''}

              <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
            </div>
          </div>

          <!-- Printable Invoice Body -->
          <div class="modal-body" style="background:#e2e8f0; padding:24px; overflow-y:auto;">
            <div id="printable-invoice-container">
              ${this.renderLetterheadHtml(data)}
            </div>
          </div>

        </div>
      `;

      document.body.appendChild(backdrop);
    } catch (err) {
      Toast.error('Failed to open invoice: ' + err.message);
    }
  },

  toggleStationery(isStationery) {
    this.isPreprintedMode = isStationery;
    const bodyEl = document.body;
    if (isStationery) {
      bodyEl.classList.add('preprinted-mode');
    } else {
      bodyEl.classList.remove('preprinted-mode');
    }
    const container = document.getElementById('printable-invoice-container');
    if (container && this.currentInvoice) {
      container.innerHTML = this.renderLetterheadHtml(this.currentInvoice);
    }
  },

  renderLetterheadHtml(data) {
    const inv = data.invoice;
    const items = data.items;
    const settings = data.settings;
    const hideLetterhead = this.isPreprintedMode;

    return `
      <div class="invoice-paper-preview" id="invoice-paper">
        
        <!-- Letterhead Header -->
        <div class="inv-letterhead-header" style="${hideLetterhead ? 'visibility:hidden; height:35mm; margin-bottom:5mm;' : ''}">
          <div style="display:flex; gap:16px; align-items:center;">
            <!-- Firm Emblem / Logo -->
            <div style="height:55px; max-width:160px; flex-shrink:0; display:flex; align-items:center;">
              <img src="${settings.logo_url || '/assets/billflow-logo.png'}" style="max-height:100%; max-width:100%; object-fit:contain;" alt="Logo" />
            </div>

            <div class="inv-firm-branding">
              <div class="inv-firm-name">${Utils.escapeHtml(settings.firm_name || 'BillFlow')}</div>
              <div class="inv-firm-tagline">${Utils.escapeHtml(settings.firm_tagline || 'Client, Invoice & Payment Management System')}</div>
              <div class="inv-firm-creds">
                <strong>${Utils.escapeHtml(settings.practitioner_name || 'CS R. Saini')}</strong>, ${Utils.escapeHtml(settings.qualifications || 'M.Com, FCS, ACMA, LL.B')}<br>
                <span>${Utils.escapeHtml(settings.membership_no || 'FCS 10842')} • ${Utils.escapeHtml(settings.cop_no || 'CP No. 14280')} • ${Utils.escapeHtml(settings.peer_reviewed || 'Peer Reviewed Practice')}</span>
              </div>
            </div>
          </div>

          <div class="inv-firm-contacts">
            <div>${Utils.escapeHtml(settings.address_line1 || '')}</div>
            <div>${Utils.escapeHtml(settings.address_line2 || '')}</div>
            <div>${Utils.escapeHtml(settings.city || 'New Delhi')} - ${Utils.escapeHtml(settings.pincode || '110001')}</div>
            <div style="margin-top:3px;"><strong>Phone:</strong> ${Utils.escapeHtml(settings.phone || '')}</div>
            <div><strong>Email:</strong> ${Utils.escapeHtml(settings.email || '')}</div>
            <div style="margin-top:3px; font-weight:700; color:#0f2942;">
              PAN: ${Utils.escapeHtml(settings.pan || '')} | GSTIN: ${Utils.escapeHtml(settings.gstin || '')}
            </div>
          </div>
        </div>

        <!-- Document Header -->
        <div class="inv-doc-title">
          TAX INVOICE
          ${inv.status === 'cancelled' ? ' <span style="color:#ef4444;">[CANCELLED]</span>' : ''}
          ${inv.status === 'draft' ? ' <span style="color:#64748b;">[DRAFT]</span>' : ''}
        </div>

        <!-- Meta Grid: Client & Invoice Info -->
        <div class="inv-meta-grid">
          <!-- Billed To (Client) -->
          <div class="inv-meta-box">
            <h4>Billed To (Client Details):</h4>
            <div style="font-size:13px; font-weight:800; color:#0f2942;">
              ${Utils.escapeHtml(inv.client_name)}
            </div>
            <div style="font-weight:600; color:#64748b; margin-bottom:4px;">
              ${Utils.escapeHtml(inv.client_entity_type || '')}
            </div>
            <div>${Utils.escapeHtml(inv.client_address || '')}</div>
            <div>${Utils.escapeHtml(inv.client_city || '')}, ${Utils.escapeHtml(inv.client_state || '')} - ${Utils.escapeHtml(inv.client_pincode || '')}</div>
            <div style="margin-top:4px;">
              ${inv.client_cin ? `<div><strong>CIN / LLPIN:</strong> ${Utils.escapeHtml(inv.client_cin)}</div>` : ''}
              ${inv.client_gstin ? `<div><strong>GSTIN:</strong> ${Utils.escapeHtml(inv.client_gstin)}</div>` : '<div><strong>GSTIN:</strong> Unregistered</div>'}
              ${inv.client_pan ? `<div><strong>PAN:</strong> ${Utils.escapeHtml(inv.client_pan)}</div>` : ''}
              <div><strong>State / Code:</strong> ${Utils.escapeHtml(inv.client_state || '')} (${Utils.escapeHtml(inv.client_state_code || '07')})</div>
            </div>
            <div style="margin-top:4px; font-size:10.5px; color:#475569;">
              <strong>Attn:</strong> ${Utils.escapeHtml(inv.client_contact || '-')} ${inv.client_designation ? `(${Utils.escapeHtml(inv.client_designation)})` : ''}
            </div>
          </div>

          <!-- Invoice Specifics -->
          <div class="inv-meta-box">
            <h4>Invoice Details:</h4>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <tr>
                <td style="padding:2px 0; color:#64748b;">Invoice Number:</td>
                <td style="padding:2px 0; font-weight:800; color:#0f2942; text-align:right;">
                  ${inv.invoice_number ? Utils.escapeHtml(inv.invoice_number) : `<span style="color:#64748b;">Draft #${inv.id}</span>`}
                </td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#64748b;">Invoice Date:</td>
                <td style="padding:2px 0; font-weight:700; text-align:right;">${Utils.formatDate(inv.invoice_date)}</td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#64748b;">Payment Due Date:</td>
                <td style="padding:2px 0; font-weight:700; text-align:right;">${Utils.formatDate(inv.due_date)}</td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#64748b;">Financial Year:</td>
                <td style="padding:2px 0; font-weight:600; text-align:right;">${Utils.escapeHtml(inv.financial_year)}</td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#64748b;">Place of Supply:</td>
                <td style="padding:2px 0; font-weight:600; text-align:right;">${Utils.escapeHtml(inv.place_of_supply || '07-Delhi')}</td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#64748b;">Supply Classification:</td>
                <td style="padding:2px 0; font-weight:600; text-align:right;">
                  ${inv.supply_type === 'intra_state' ? 'Intra-State (CGST + SGST)' : inv.supply_type === 'inter_state' ? 'Inter-State (IGST)' : 'Exempt Supply'}
                </td>
              </tr>
              <tr>
                <td style="padding:2px 0; color:#64748b;">Reverse Charge Applicable:</td>
                <td style="padding:2px 0; font-weight:600; text-align:right;">No</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Line Items Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">#</th>
              <th>Description of Professional Services</th>
              <th style="width:75px; text-align:center;">SAC</th>
              <th style="width:50px; text-align:center;">Qty</th>
              <th style="width:90px; text-align:right;">Rate (₹)</th>
              <th style="width:50px; text-align:center;">Disc</th>
              <th style="width:95px; text-align:right;">Taxable (₹)</th>
              <th style="width:65px; text-align:center;">GST</th>
              <th style="width:105px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => `
              <tr>
                <td style="text-align:center; color:#64748b;">${idx + 1}</td>
                <td>
                  <div style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(it.item_name)}</div>
                  ${it.description ? `<div style="font-size:10px; color:#475569; margin-top:2px;">${Utils.escapeHtml(it.description)}</div>` : ''}
                </td>
                <td style="text-align:center; font-family:monospace;">${Utils.escapeHtml(it.sac_code || '998242')}</td>
                <td style="text-align:center;">${it.quantity}</td>
                <td style="text-align:right;">${Utils.formatINR(it.rate).replace('₹', '')}</td>
                <td style="text-align:center;">${it.discount_percent > 0 ? `${it.discount_percent}%` : '-'}</td>
                <td style="text-align:right; font-weight:600;">${Utils.formatINR(it.taxable_value).replace('₹', '')}</td>
                <td style="text-align:center;">${it.tax_rate}%</td>
                <td style="text-align:right; font-weight:700;">${Utils.formatINR(it.total_amount).replace('₹', '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Calculation & Remittance Section -->
        <div class="inv-calculation-section">
          
          <!-- Left: Amount in Words & Bank Remittance Box -->
          <div class="inv-words-and-bank">
            <div style="margin-bottom:12px;">
              <span style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700;">Invoice Total in Words:</span>
              <div style="font-weight:700; color:#0f2942; font-size:11.5px; margin-top:2px;">
                ${Utils.escapeHtml(inv.amountInWords)}
              </div>
            </div>

            <!-- Bank & UPI Remittance Details Box -->
            <div class="bank-remittance-box">
              <div style="flex:1;">
                <div style="font-size:11px; font-weight:800; color:#0f2942; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                  Bank Remittance Details:
                </div>
                <table style="width:100%; font-size:10.5px; border-collapse:collapse;">
                  <tr><td style="color:#64748b; width:80px;">Bank Name:</td><td><strong>${Utils.escapeHtml(settings.bank_name || 'HDFC Bank')}</strong></td></tr>
                  <tr><td style="color:#64748b;">Account Name:</td><td><strong>${Utils.escapeHtml(settings.account_name || 'BillFlow Accounts')}</strong></td></tr>
                  <tr><td style="color:#64748b;">Account No:</td><td><strong style="font-family:monospace; font-size:11px;">${Utils.escapeHtml(settings.account_number || '')}</strong></td></tr>
                  <tr><td style="color:#64748b;">IFSC Code:</td><td><strong style="font-family:monospace;">${Utils.escapeHtml(settings.ifsc_code || '')}</strong></td></tr>
                  <tr><td style="color:#64748b;">Branch:</td><td>${Utils.escapeHtml(settings.branch || '')}</td></tr>
                  <tr><td style="color:#64748b;">UPI ID:</td><td><strong style="color:#0284c7;">${Utils.escapeHtml(settings.upi_id || '')}</strong></td></tr>
                </table>
              </div>

              <!-- UPI QR Code -->
              ${inv.upiQrDataUrl ? `
                <div style="text-align:center;">
                  <div class="upi-qr-frame">
                    <img src="${inv.upiQrDataUrl}" alt="UPI QR Code" />
                  </div>
                  <div style="font-size:8.5px; font-weight:700; color:#0f2942; margin-top:3px;">Scan &amp; Pay via UPI</div>
                </div>
              ` : ''}
            </div>

            ${inv.notes ? `
              <div style="margin-top:10px; font-size:10px; color:#475569;">
                <strong>Notes:</strong> ${Utils.escapeHtml(inv.notes)}
              </div>
            ` : ''}
          </div>

          <!-- Right: Totals Box -->
          <div class="inv-totals-box">
            <div class="inv-total-row">
              <span style="color:#64748b;">Subtotal (Taxable Value):</span>
              <span style="font-weight:600;">${Utils.formatINR(inv.subtotal)}</span>
            </div>

            ${inv.discount_amount > 0 ? `
              <div class="inv-total-row">
                <span style="color:#64748b;">Discount:</span>
                <span style="color:#dc2626;">- ${Utils.formatINR(inv.discount_amount)}</span>
              </div>
            ` : ''}

            <div class="inv-total-row" style="background:#f8fafc;">
              <span style="font-weight:600;">Net Taxable Amount:</span>
              <span style="font-weight:700;">${Utils.formatINR(inv.taxable_amount)}</span>
            </div>

            ${inv.supply_type === 'intra_state' ? `
              <div class="inv-total-row">
                <span style="color:#64748b;">Central GST (CGST @ ${inv.cgst_rate}%):</span>
                <span>${Utils.formatINR(inv.cgst_amount)}</span>
              </div>
              <div class="inv-total-row">
                <span style="color:#64748b;">State GST (SGST @ ${inv.sgst_rate}%):</span>
                <span>${Utils.formatINR(inv.sgst_amount)}</span>
              </div>
            ` : inv.supply_type === 'inter_state' ? `
              <div class="inv-total-row">
                <span style="color:#64748b;">Integrated GST (IGST @ ${inv.igst_rate}%):</span>
                <span>${Utils.formatINR(inv.igst_amount)}</span>
              </div>
            ` : `
              <div class="inv-total-row">
                <span style="color:#64748b;">GST Treatment:</span>
                <span>Exempt / Nil</span>
              </div>
            `}

            <div class="inv-total-row">
              <span style="color:#64748b;">Round Off:</span>
              <span>${inv.round_off >= 0 ? '+' : ''}${Utils.formatINR(inv.round_off)}</span>
            </div>

            <div class="inv-total-row grand-total">
              <span>Grand Total:</span>
              <span style="font-size:15px;">${Utils.formatINR(inv.grand_total)}</span>
            </div>

            ${inv.paid_amount > 0 ? `
              <div class="inv-total-row" style="color:#047857; font-weight:600;">
                <span>Amount Realised:</span>
                <span>${Utils.formatINR(inv.paid_amount)}</span>
              </div>
              <div class="inv-total-row" style="background:#fef2f2; color:#b91c1c; font-weight:800;">
                <span>Net Balance Due:</span>
                <span>${Utils.formatINR(inv.balance_amount)}</span>
              </div>
            ` : ''}
          </div>

        </div>

        <!-- Terms & Signatures -->
        <div class="inv-signatures-section">
          <!-- Terms & Declarations -->
          <div class="inv-terms-box">
            <div style="font-weight:700; color:#0f2942; margin-bottom:3px; text-transform:uppercase;">Terms &amp; Declarations:</div>
            <div style="white-space:pre-line;">${Utils.escapeHtml(inv.terms || settings.invoice_terms || '')}</div>
          </div>

          <!-- Signatory Box -->
          <div class="inv-signature-box">
            <div style="font-weight:700; color:#0f2942; line-height:1.2;">
              For ${Utils.escapeHtml(settings.firm_name || 'BillFlow')}
            </div>
            <div style="font-size:9.5px; color:#64748b;">Practicing Company Secretaries</div>
            <div class="inv-signature-line"></div>
            <div style="font-weight:700; color:#0f2942;">Authorised Signatory</div>
            <div style="font-size:9.5px; color:#64748b;">Peer Reviewed PCS Practice</div>
          </div>
        </div>

      </div>
    `;
  },

  printInvoice() {
    window.print();
  },

  async downloadPdf() {
    const el = document.getElementById('invoice-paper');
    if (!el) return;
    const inv = this.currentInvoice?.invoice || {};
    const invNo = inv.invoice_number || `Draft_${inv.id || 'Invoice'}`;
    const cleanNo = invNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Invoice_${cleanNo}_BillFlow.pdf`;

    Toast.info('Generating PDF document, please wait...');

    if (typeof html2pdf !== 'undefined') {
      try {
        const opt = {
          margin:       [8, 8, 8, 8],
          filename:     filename,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollY: 0
          },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        const prevShadow = el.style.boxShadow;
        const prevBorder = el.style.border;
        el.style.boxShadow = 'none';
        el.style.border = 'none';

        await html2pdf().set(opt).from(el).save();

        el.style.boxShadow = prevShadow;
        el.style.border = prevBorder;

        Toast.success(`Downloaded ${filename}`);
        return;
      } catch (err) {
        console.error('html2pdf generation error:', err);
        Toast.error('PDF export encountered an issue; opening print dialog...');
      }
    }

    window.print();
  },

  downloadHtml() {
    const el = document.getElementById('invoice-paper');
    if (!el) return;
    const inv = this.currentInvoice?.invoice || {};
    const invNo = inv.invoice_number || `Draft_${inv.id || 'Invoice'}`;
    const cleanNo = invNo.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Clone element so we can safely embed images as base64
    const clone = el.cloneNode(true);
    const origImages = el.querySelectorAll('img');
    const cloneImages = clone.querySelectorAll('img');
    origImages.forEach((origImg, idx) => {
      const cloneImg = cloneImages[idx];
      if (cloneImg && origImg.complete && origImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = origImg.naturalWidth;
          canvas.height = origImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(origImg, 0, 0);
          cloneImg.src = canvas.toDataURL('image/png');
        } catch (e) {
          // If canvas extraction fails, keep original src
        }
      }
    });

    const standaloneCss = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; padding: 24px; color: #1e293b; }
      .invoice-paper-preview { background: #ffffff; width: 100%; max-width: 820px; margin: 0 auto; padding: 30px 40px; border: 1px solid #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); font-size: 12px; color: #1e293b; position: relative; }
      .inv-letterhead-header { border-bottom: 2px solid #b38e44; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
      .inv-firm-branding { flex: 1; }
      .inv-firm-name { font-size: 24px; font-weight: 800; color: #0f2942; letter-spacing: 1px; line-height: 1.1; }
      .inv-firm-tagline { font-size: 11.5px; font-weight: 700; color: #b38e44; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 3px; }
      .inv-firm-creds { font-size: 10.5px; color: #475569; margin-top: 4px; font-weight: 500; }
      .inv-firm-contacts { text-align: right; font-size: 10.5px; color: #475569; line-height: 1.4; }
      .inv-doc-title { text-align: center; font-size: 16px; font-weight: 800; color: #0f2942; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 18px; padding: 4px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
      .inv-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
      .inv-meta-box h4 { font-size: 11.5px; text-transform: uppercase; color: #0f2942; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px; }
      .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      .inv-table th { background-color: #0f2942; color: #ffffff; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; border: 1px solid #0f2942; }
      .inv-table td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 11px; }
      .inv-table tfoot td { font-weight: 600; background-color: #f8fafc; }
      .inv-calculation-section { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
      .inv-words-and-bank { flex: 1.2; }
      .inv-totals-box { flex: 0.8; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
      .inv-total-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; }
      .inv-total-row.grand-total { background-color: #0f2942; color: #ffffff; font-size: 13.5px; font-weight: 800; border-bottom: none; }
      .bank-remittance-box { border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; background: #f8fafc; display: flex; gap: 15px; align-items: center; margin-top: 10px; }
      .upi-qr-frame { width: 90px; height: 90px; flex-shrink: 0; background: #ffffff; border: 1px solid #cbd5e1; padding: 2px; border-radius: 4px; }
      .upi-qr-frame img { width: 100%; height: 100%; display: block; }
      .inv-signatures-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
      .inv-terms-box { flex: 1.2; font-size: 10.5px; color: #475569; line-height: 1.45; }
      .inv-signature-box { flex: 0.8; text-align: center; }
      .inv-signature-line { margin: 40px auto 6px; width: 170px; border-bottom: 1px dashed #334155; }
      @media print {
        @page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }
        body { background: #ffffff !important; padding: 0 !important; }
        .invoice-paper-preview { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
        .inv-table th { background-color: #0f2942 !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .inv-total-row.grand-total { background-color: #0f2942 !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .inv-table th, .inv-table td { border: 1px solid #333333 !important; }
      }
    `;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invNo} - BillFlow</title>
  <style>
    ${standaloneCss}
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${cleanNo}_BillFlow.html`;
    link.click();
    Toast.success(`Downloaded ${cleanNo}_BillFlow.html (Standalone)`);
  },

  async issueDraft(invoiceId) {
    if (!confirm('Are you sure you want to issue this invoice? A permanent sequential invoice number will be allocated and cannot be modified or deleted.')) {
      return;
    }

    try {
      const res = await API.post(`/api/invoices/${invoiceId}/issue`);
      Toast.success(res.message);
      this.open(invoiceId);
      if (typeof InvoicesView !== 'undefined' && InvoicesView.loadInvoices) {
        InvoicesView.loadInvoices();
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to issue invoice');
    }
  },

  cancelInvoicePrompt(invoiceId) {
    const reason = prompt('Please enter the mandatory reason for cancelling this issued invoice:');
    if (reason === null) return;
    if (!reason.trim()) {
      Toast.error('A valid cancellation reason is required.');
      return;
    }

    API.post(`/api/invoices/${invoiceId}/cancel`, { reason: reason.trim() })
      .then(res => {
        Toast.success(res.message);
        this.open(invoiceId);
        if (typeof InvoicesView !== 'undefined' && InvoicesView.loadInvoices) {
          InvoicesView.loadInvoices();
        }
      })
      .catch(err => {
        Toast.error(err.message || 'Cancellation failed');
      });
  }
};

