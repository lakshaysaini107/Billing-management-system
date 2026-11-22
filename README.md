<p align="center">
  <img src="public/assets/billflow-logo.png" alt="BillFlow Logo" width="380" />
</p>

# BillFlow — Client, Invoice & Payment Management System
**Smart Practice Billing & Revenue Management Platform (v1.0 MVP)**

A specialised, centralized billing, client master record, and payment tracking application built for professional practices.

---

## 🌟 Key Capabilities & Requirements Addressed

| Requirement | Module / Feature | Details |
|---|---|---|
| **FR-01** | Secure Authentication | Role-based authentication (Practice Owner / Admin & Billing Staff). |
| **FR-02** | Client Master Records | Stores Legal Name, Entity Type, CIN/LLPIN, GSTIN, PAN, Registered Address, State Code, Contact Person, Phone, Email, Retainership Notes. |
| **FR-03** | Duplicate Prevention | Warns about likely duplicate clients using CIN/LLPIN, GSTIN, Phone, or Legal Name in real time. |
| **FR-04** | Service Catalogue | Pre-loaded with 15 PCS services (Annual ROC Filing, Secretarial Audit Sec 204, Incorporations, DIR-3 KYC, Charges, Search Reports) with standard SAC codes (998242) and default fees. |
| **FR-05** | Draft Invoicing | Create, edit, and delete draft invoices before final issue. |
| **FR-06** | Sequential Numbering | Configurable financial year series (`RSA/26-27/001`) fixed upon issue; never reused. |
| **FR-07** | Automated Calculations | Line totals, line discounts, invoice discounts, GST breakdown (CGST 9% + SGST 9% or IGST 18%), rounding off, and Amount in Words in Indian currency format (Lakhs & Crores). |
| **FR-08** | Approved Letterhead PDF | Professional A4 letterhead layout with firm credentials (FCS, CP No, Peer Review), address, bank details, and dynamic UPI Payment QR Code. Supports toggling between **Digital Letterhead** and **Pre-Printed Stationery Mode**. |
| **FR-09** | Status Lifecycle | Draft → Issued → Partially Paid → Paid → Overdue (auto-calculated) → Cancelled. |
| **FR-10** | Payment Collections | Supports multiple full or partial payment receipts per invoice, tracking modes (NEFT, RTGS, IMPS, UPI, Cheque, Cash) and UTR references. Generates printable official Receipt Vouchers. |
| **FR-11** | Search & Register | Filter invoices by number, client, date range, financial year, and status. |
| **FR-12** | Client Ledger | Real-time statement of account showing chronological invoice debits, payment credits, and running net balances with one-click print. |
| **FR-13** | Reports & Analytics | Real-time Executive Dashboard, GST Billing Register (exportable to CSV), Collection Register (exportable to CSV), and Overdue Aging Analysis (0-30, 31-60, 61-90, 90+ days). |
| **FR-14** | Compliance Audit Trail | Automatically records every client addition, invoice issue, cancellation, payment, and settings change. |
| **FR-15** | Strict Deletion Controls | Issued invoices cannot be deleted or silently overwritten. Authorised cancellation retains cancellation reason and permanently preserves the invoice number. |
| **FR-16** | Backup & Disaster Recovery | One-click complete database backup export (JSON), raw SQLite file download, and full restore with transaction safety. |

---

## 🚀 Quick Start & How to Run

### 1. Start the Application
Run from the workspace directory (`d:\bsm`):
```bash
npm start
```
or
```bash
node server/index.js
```

The application will start on **`http://localhost:3000`**.

### 2. Default Authorized Credentials
| Role | Username | Password |
|---|---|---|
| **Practice Owner / Admin** | `admin` | `admin123` |
| **Billing Desk** | `billing` | `billing123` |

*(Quick demo buttons are also provided directly on the login screen for one-click access.)*

---

## 📁 Technical Architecture

- **Backend**: Node.js 24 with native `node:sqlite` (`DatabaseSync`), Express 5, CORS, Multer (logo uploads), and QRCode generator.
- **Frontend**: Clean Single Page Application (SPA) with responsive dashboard, real-time recalculation engine, A4 print stylesheet (`print.css`), and dynamic modals.
- **Database**: SQLite database stored at `data/rsa_billing.db` (auto-created and auto-seeded with realistic PCS demonstration records).
- **Print / PDF**: Direct browser vector print (`window.print()`) calibrated to standard A4 (210mm x 297mm) paper, with instant toggle for pre-printed stationery.

