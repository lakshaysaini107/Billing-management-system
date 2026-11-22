/**
 * Database Module for RSaini & Associates Billing & Client Management
 * Uses Node.js 24 built-in DatabaseSync from node:sqlite
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'rsa_billing.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Hash password using PBKDF2
 */
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password
 */
function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return check === hash;
}

/**
 * Initialize Tables
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'billing', -- 'admin', 'owner', 'billing'
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT UNIQUE,
      legal_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      cin_llpin TEXT,
      gstin TEXT,
      pan TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      pincode TEXT,
      contact_person TEXT,
      designation TEXT,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sac_code TEXT DEFAULT '998242',
      description TEXT,
      default_fee REAL DEFAULT 0.0,
      default_tax_rate REAL DEFAULT 18.0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE, -- NULL for drafts, fixed on issue
      financial_year TEXT NOT NULL,
      sequence_number INTEGER,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'
      place_of_supply TEXT,
      supply_type TEXT DEFAULT 'intra_state', -- 'intra_state' (CGST+SGST), 'inter_state' (IGST), 'exempt'
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount_type TEXT DEFAULT 'fixed',
      discount_value REAL DEFAULT 0.0,
      discount_amount REAL DEFAULT 0.0,
      taxable_amount REAL NOT NULL DEFAULT 0.0,
      cgst_rate REAL DEFAULT 0.0,
      cgst_amount REAL DEFAULT 0.0,
      sgst_rate REAL DEFAULT 0.0,
      sgst_amount REAL DEFAULT 0.0,
      igst_rate REAL DEFAULT 0.0,
      igst_amount REAL DEFAULT 0.0,
      total_tax REAL DEFAULT 0.0,
      round_off REAL DEFAULT 0.0,
      grand_total REAL NOT NULL DEFAULT 0.0,
      paid_amount REAL DEFAULT 0.0,
      balance_amount REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      terms TEXT,
      issued_at DATETIME,
      issued_by INTEGER REFERENCES users(id),
      cancelled_at DATETIME,
      cancelled_by INTEGER REFERENCES users(id),
      cancellation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id),
      service_code TEXT,
      item_name TEXT NOT NULL,
      sac_code TEXT DEFAULT '998242',
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1.0,
      rate REAL NOT NULL DEFAULT 0.0,
      discount_percent REAL DEFAULT 0.0,
      taxable_value REAL NOT NULL DEFAULT 0.0,
      tax_rate REAL DEFAULT 18.0,
      tax_amount REAL DEFAULT 0.0,
      total_amount REAL NOT NULL DEFAULT 0.0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      payment_date DATE NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL, -- 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Demand Draft'
      reference_number TEXT,
      bank_name TEXT,
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedDefaultData();
}

/**
 * Seed initial settings, services, users and realistic demonstration records
 */
function seedDefaultData() {
  // 1. Seed Settings
  const defaultSettings = {
    firm_name: 'RSaini & Associates',
    firm_tagline: 'Practicing Company Secretaries',
    practitioner_name: 'CS R. Saini',
    qualifications: 'M.Com, FCS, ACMA, LL.B',
    membership_no: 'FCS 10842',
    cop_no: 'CP No. 14280',
    peer_reviewed: 'Peer Reviewed Practice Unit No. 1928/2023',
    address_line1: 'Office Suite 402, 4th Floor, Corporate Heights',
    address_line2: 'Barakhamba Road, Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    state_code: '07',
    pincode: '110001',
    phone: '+91 98110 00000',
    email: 'contact@rsainiassociates.com',
    website: 'www.rsainiassociates.com',
    pan: 'AAAAA0000A',
    gstin: '07AAAAA0000A1Z5',
    bank_name: 'HDFC Bank',
    account_name: 'RSaini and Associates',
    account_number: '50200012345678',
    account_type: 'Current Account',
    ifsc_code: 'HDFC0000123',
    branch: 'Connaught Place, New Delhi - 110001',
    upi_id: 'rsaini@hdfcbank',
    invoice_prefix: 'RSA/',
    fy_format: 'YY-YY',
    sequence_padding: '3',
    next_sequence: '1',
    default_tax_rate: '18',
    default_sac_code: '998242',
    print_letterhead_artwork: '1', // 1 = show digital letterhead, 0 = pre-printed blank stationery mode
    invoice_terms: `1. Payment is strictly due within 15 days of invoice date.
2. Please quote Invoice Number as payment reference in NEFT / RTGS / UPI transfers.
3. Official Receipt will be issued automatically upon realisation of funds.
4. Cheque / Demand Draft to be drawn in favour of 'RSaini and Associates'.
5. All corporate disputes are subject to the exclusive jurisdiction of courts in New Delhi.`,
    authorized_signatory_label: 'For RSaini & Associates\nPracticing Company Secretaries\n\n\nAuthorised Signatory'
  };

  const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, val] of Object.entries(defaultSettings)) {
    const existing = getSettingStmt.get(key);
    if (!existing) {
      insertSettingStmt.run(key, String(val));
    }
  }

  // 2. Seed Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const adminPass = hashPassword('admin123');
    const billingPass = hashPassword('billing123');

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, email, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('admin', adminPass.hash, adminPass.salt, 'CS R. Saini (Practice Owner)', 'rsaini@rsainiassociates.com', 'admin');
    insertUser.run('billing', billingPass.hash, billingPass.salt, 'Neha Sharma (Billing Desk)', 'billing@rsainiassociates.com', 'billing');
  }

  // 3. Seed Service Catalogue
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (serviceCount === 0) {
    const servicesList = [
      {
        code: 'PCS-ANN-01',
        name: 'Annual ROC Compliance & Filing',
        sac_code: '998242',
        description: 'Preparation, certification and filing of Annual Return (MGT-7/7A) and Financial Statements (AOC-4/AOC-4 XBRL) with MCA.',
        default_fee: 15000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-AUD-02',
        name: 'Secretarial Audit (Sec 204)',
        sac_code: '998242',
        description: 'Comprehensive Secretarial Audit under Section 204 of the Companies Act, 2013 and issuance of Secretarial Audit Report in Form MR-3.',
        default_fee: 45000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-INC-03',
        name: 'Company Incorporation (Private Ltd / OPC)',
        sac_code: '998242',
        description: 'End-to-end incorporation of Private Limited Company or OPC via SPICe+ (RUN, Name Reservation, MOA, AOA, PAN, TAN, EPFO, ESIC & Bank A/c).',
        default_fee: 12000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-LLP-04',
        name: 'LLP Incorporation & Agreement Drafting',
        sac_code: '998242',
        description: 'LLP name reservation (RUN-LLP), FiLLiP filing, drafting and stamping of customized LLP Agreement, and Form 3 filing.',
        default_fee: 10000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-DIR-05',
        name: 'Director KYC Filing (DIR-3 KYC)',
        sac_code: '998242',
        description: 'Annual verification and filing of DIR-3 KYC / DIR-3 KYC Web for Directors having valid DIN.',
        default_fee: 1500,
        default_tax_rate: 18
      },
      {
        code: 'PCS-CHG-06',
        name: 'Charge Creation / Modification / Satisfaction',
        sac_code: '998242',
        description: 'Drafting charge hypothecation documents and filing Form CHG-1 / CHG-4 with Registrar of Companies.',
        default_fee: 8000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-SRH-07',
        name: 'MCA Search Report & Legal Due Diligence',
        sac_code: '998242',
        description: 'Inspection of public documents on MCA portal, preparation and certification of detailed Search and Status Report for Bank lending.',
        default_fee: 7500,
        default_tax_rate: 18
      },
      {
        code: 'PCS-CAP-08',
        name: 'Increase in Share Capital & Allotment (PAS-3)',
        sac_code: '998242',
        description: 'Alteration of Capital Clause in MOA, convening EGM, filing Form SH-7 and return of allotment in Form PAS-3.',
        default_fee: 18000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-REG-09',
        name: 'Change of Registered Office (Shifting)',
        sac_code: '998242',
        description: 'Board & EGM approvals, newspaper publication, petition drafting and filing Form INC-22 / INC-23.',
        default_fee: 20000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-DIR-10',
        name: 'Appointment / Resignation of Director (DIR-12)',
        sac_code: '998242',
        description: 'Drafting board resolutions, consent letters (DIR-2), resignation notice, and filing Form DIR-12 with ROC.',
        default_fee: 5000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-RET-11',
        name: 'Corporate Secretarial Retainership (Quarterly)',
        sac_code: '998242',
        description: 'Ongoing corporate secretarial compliance retainership, advisory on board procedures, statutory registers maintenance.',
        default_fee: 30000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-SCR-12',
        name: 'Scrutinizer Services for E-Voting / AGM',
        sac_code: '998242',
        description: 'Acting as independent PCS Scrutinizer for remote e-voting and ballot voting at Annual General Meeting and issuing Report.',
        default_fee: 25000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-TM-13',
        name: 'Trademark Search & Application Filing',
        sac_code: '998242',
        description: 'Trademark search, classification under Nice classification, drafting user affidavit and filing Form TM-A with IP India.',
        default_fee: 6500,
        default_tax_rate: 18
      },
      {
        code: 'PCS-DGT-14',
        name: 'Digital Signature Certificate (Class 3 Signing)',
        sac_code: '998242',
        description: 'Issuance and token delivery of Class 3 Digital Signature Certificate (2 years validity) for Directors and Authorised Signatories.',
        default_fee: 2000,
        default_tax_rate: 18
      },
      {
        code: 'PCS-MOA-15',
        name: 'Object Clause Alteration & Name Change',
        sac_code: '998242',
        description: 'Drafting altered MOA, passing Special Resolution, filing Form MGT-14 and INC-24 for approval of Central Government.',
        default_fee: 22000,
        default_tax_rate: 18
      }
    ];

    const insertService = db.prepare(`
      INSERT INTO services (code, name, sac_code, description, default_fee, default_tax_rate, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    for (const s of servicesList) {
      insertService.run(s.code, s.name, s.sac_code, s.description, s.default_fee, s.default_tax_rate);
    }
  }

  // 4. Seed Clients
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  if (clientCount === 0) {
    const clientsList = [
      {
        client_code: 'CLI-001',
        legal_name: 'Apex Infotech Solutions Private Limited',
        entity_type: 'Private Limited Company',
        cin_llpin: 'U72200DL2019PTC345678',
        gstin: '07AABCA1234F1Z1',
        pan: 'AABCA1234F',
        address: 'B-14, Okhla Industrial Area, Phase-I',
        city: 'New Delhi',
        state: 'Delhi',
        state_code: '07',
        pincode: '110020',
        contact_person: 'Mr. Rajesh Verma',
        designation: 'Managing Director',
        phone: '+91 98765 43210',
        email: 'rajesh.verma@apexinfotech.co.in',
        status: 'active',
        notes: 'Annual secretarial retainership client. Prompt payer.'
      },
      {
        client_code: 'CLI-002',
        legal_name: 'Skybound Global Logistics LLP',
        entity_type: 'Limited Liability Partnership',
        cin_llpin: 'AAB-9876',
        gstin: '07AAGFS5678Q1Z4',
        pan: 'AAGFS5678Q',
        address: 'Plot No. 45, Sector 18, Udyog Vihar',
        city: 'Gurugram',
        state: 'Haryana',
        state_code: '06',
        pincode: '122015',
        contact_person: 'Ms. Sunita Rao',
        designation: 'Designated Partner',
        phone: '+91 99101 23456',
        email: 'sunita@skyboundlogistics.com',
        status: 'active',
        notes: 'Inter-state supply (Haryana). IGST applies.'
      },
      {
        client_code: 'CLI-003',
        legal_name: 'GreenVenture CleanTech Private Limited',
        entity_type: 'Private Limited Company',
        cin_llpin: 'U40106DL2022PTC401234',
        gstin: '07AABCG9012D1ZR',
        pan: 'AABCG9012D',
        address: '702, World Trade Tower, Barakhamba Lane',
        city: 'New Delhi',
        state: 'Delhi',
        state_code: '07',
        pincode: '110001',
        contact_person: 'Dr. Vivek Mehra',
        designation: 'Director & CEO',
        phone: '+91 98102 34567',
        email: 'vmehra@greenventure.in',
        status: 'active',
        notes: 'Startup recognized by DPIIT. Series A funding compliance underway.'
      },
      {
        client_code: 'CLI-004',
        legal_name: 'Bharat Infrastructure & Heavy Engineering Ltd',
        entity_type: 'Public Limited Company',
        cin_llpin: 'L45201DL1998PLC098765',
        gstin: '07AAACB4455P1ZK',
        pan: 'AAACB4455P',
        address: '12, Barakhamba Road, Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        state_code: '07',
        pincode: '110001',
        contact_person: 'Mr. Arvind Saxena',
        designation: 'Company Secretary & Compliance Officer',
        phone: '+91 98111 88990',
        email: 'cs@bharatinfra.com',
        status: 'active',
        notes: 'Public company. Requires annual Secretarial Audit under Sec 204.'
      },
      {
        client_code: 'CLI-005',
        legal_name: 'Dr. Ananya Sharma Advisory',
        entity_type: 'Sole Proprietorship',
        cin_llpin: '',
        gstin: '',
        pan: 'AKRPS1234M',
        address: 'C-28, Defence Colony',
        city: 'New Delhi',
        state: 'Delhi',
        state_code: '07',
        pincode: '110024',
        contact_person: 'Dr. Ananya Sharma',
        designation: 'Principal Consultant',
        phone: '+91 97112 33445',
        email: 'ananya@sharmaadvisory.com',
        status: 'active',
        notes: 'Unregistered client (no GSTIN). Intra-state supply.'
      }
    ];

    const insertClient = db.prepare(`
      INSERT INTO clients (client_code, legal_name, entity_type, cin_llpin, gstin, pan, address, city, state, state_code, pincode, contact_person, designation, phone, email, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of clientsList) {
      insertClient.run(
        c.client_code, c.legal_name, c.entity_type, c.cin_llpin, c.gstin, c.pan,
        c.address, c.city, c.state, c.state_code, c.pincode, c.contact_person,
        c.designation, c.phone, c.email, c.status, c.notes
      );
    }
  }

  // 5. Seed Demonstration Invoices & Payments
  const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
  if (invoiceCount === 0) {
    // We will create 4 sample invoices:
    // 1. Paid Invoice (RSA/26-27/001) for Client 1
    // 2. Partially Paid Invoice (RSA/26-27/002) for Client 2 (Interstate)
    // 3. Overdue Invoice (RSA/26-27/003) for Client 3
    // 4. Issued / Pending Invoice (RSA/26-27/004) for Client 4
    // 5. Draft Invoice (Client 5)

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        invoice_number, financial_year, sequence_number, client_id, invoice_date, due_date,
        status, place_of_supply, supply_type, subtotal, discount_type, discount_value, discount_amount,
        taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
        total_tax, round_off, grand_total, paid_amount, balance_amount, notes, terms, issued_at, issued_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (
        invoice_id, service_id, service_code, item_name, sac_code, description,
        quantity, rate, discount_percent, taxable_value, tax_rate, tax_amount, total_amount, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPayment = db.prepare(`
      INSERT INTO payments (
        receipt_number, invoice_id, client_id, payment_date, amount, payment_mode, reference_number, bank_name, notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Invoice 1: Fully Paid
    // Subtotal: 15,000 + 3,000 (2 DSCs) = 18,000. GST 18% (9% CGST 1620, 9% SGST 1620) = 3240. Total = 21,240.
    const inv1 = insertInvoice.run(
      'RSA/26-27/001', '26-27', 1, 1, '2026-10-05', '2026-10-20',
      'paid', '07-Delhi', 'intra_state', 18000, 'fixed', 0, 0,
      18000, 9, 1620, 9, 1620, 0, 0,
      3240, 0, 21240, 21240, 0,
      'Annual compliance package and director DSC renewal for FY 2025-26.',
      'Payment terms: 15 days.', '2026-10-05 10:30:00', 1
    );
    const inv1Id = Number(inv1.lastInsertRowid);

    insertItem.run(inv1Id, 1, 'PCS-ANN-01', 'Annual ROC Compliance & Filing', '998242', 'Filing of AOC-4 & MGT-7 with MCA', 1, 15000, 0, 15000, 18, 2700, 17700, 1);
    insertItem.run(inv1Id, 14, 'PCS-DGT-14', 'Digital Signature Certificate (Class 3 Signing)', '998242', 'Class 3 DSC (2 Years) for 2 Directors', 2, 1500, 0, 3000, 18, 540, 3540, 2);

    insertPayment.run('RCP/26-27/001', inv1Id, 1, '2026-10-14', 21240, 'NEFT', 'HDFCN26288123456', 'HDFC Bank', 'Full payment received against Inv RSA/26-27/001', 1);

    // Invoice 2: Partially Paid (Inter-state supply: Skybound Logistics in Haryana, IGST 18%)
    // Service: LLP Incorporation & Agreement Drafting (10,000) + Trademark (6,500) = 16,500. IGST 18% = 2970. Total = 19,470.
    // Paid 10,000 via UPI. Balance = 9,470.
    const inv2 = insertInvoice.run(
      'RSA/26-27/002', '26-27', 2, 2, '2026-10-18', '2026-11-02',
      'partially_paid', '06-Haryana', 'inter_state', 16500, 'fixed', 0, 0,
      16500, 0, 0, 0, 0, 18, 2970,
      2970, 0, 19470, 10000, 9470,
      'LLP setup and initial brand trademark filing.',
      'Payment terms: 15 days.', '2026-10-18 14:15:00', 1
    );
    const inv2Id = Number(inv2.lastInsertRowid);

    insertItem.run(inv2Id, 4, 'PCS-LLP-04', 'LLP Incorporation & Agreement Drafting', '998242', 'FiLLiP, drafting LLP deed and Form 3 filing', 1, 10000, 0, 10000, 18, 1800, 11800, 1);
    insertItem.run(inv2Id, 13, 'PCS-TM-13', 'Trademark Search & Application Filing', '998242', 'TM-A in Class 39 (Logistics)', 1, 6500, 0, 6500, 18, 1170, 7670, 2);

    insertPayment.run('RCP/26-27/002', inv2Id, 2, '2026-10-25', 10000, 'UPI', 'UPI/329871234901', 'State Bank of India', 'Part payment received via UPI', 1);

    // Invoice 3: Overdue Invoice (Client 3 GreenVenture)
    // Due date was 2026-10-25. Total: 18,000 + 18% = 21,240. Paid: 0. Balance: 21,240.
    const inv3 = insertInvoice.run(
      'RSA/26-27/003', '26-27', 3, 3, '2026-10-10', '2026-10-25',
      'overdue', '07-Delhi', 'intra_state', 18000, 'fixed', 0, 0,
      18000, 9, 1620, 9, 1620, 0, 0,
      3240, 0, 21240, 0, 21240,
      'Increase in share capital and SH-7 / PAS-3 preparation for Angel investment round.',
      'Payment terms: 15 days.', '2026-10-10 16:00:00', 1
    );
    const inv3Id = Number(inv3.lastInsertRowid);
    insertItem.run(inv3Id, 8, 'PCS-CAP-08', 'Increase in Share Capital & Allotment (PAS-3)', '998242', 'Drafting EGM notices, SH-7 and PAS-3', 1, 18000, 0, 18000, 18, 3240, 21240, 1);

    // Invoice 4: Issued (Pending payment, due on 2026-11-15) for Client 4 (Bharat Infra)
    // Secretarial Audit: 45,000 + 18% = 53,100.
    const inv4 = insertInvoice.run(
      'RSA/26-27/004', '26-27', 4, 4, '2026-10-31', '2026-11-15',
      'issued', '07-Delhi', 'intra_state', 45000, 'fixed', 0, 0,
      45000, 9, 4050, 9, 4050, 0, 0,
      8100, 0, 53100, 0, 53100,
      'Secretarial Audit Fee for financial year under Section 204 of Companies Act, 2013.',
      'Payment terms: 15 days.', '2026-10-31 11:00:00', 1
    );
    const inv4Id = Number(inv4.lastInsertRowid);
    insertItem.run(inv4Id, 2, 'PCS-AUD-02', 'Secretarial Audit (Sec 204)', '998242', 'Audit of statutory registers, MCA records and secretarial standards', 1, 45000, 0, 45000, 18, 8100, 53100, 1);

    // Invoice 5: Draft Invoice for Client 5
    const inv5 = insertInvoice.run(
      null, '26-27', null, 5, '2026-11-05', '2026-11-20',
      'draft', '07-Delhi', 'intra_state', 7500, 'fixed', 0, 0,
      7500, 9, 675, 9, 675, 0, 0,
      1350, 0, 8850, 0, 8850,
      'Search report for SBI loan facility.',
      'Payment terms: 15 days.', null, null
    );
    const inv5Id = Number(inv5.lastInsertRowid);
    insertItem.run(inv5Id, 7, 'PCS-SRH-07', 'MCA Search Report & Legal Due Diligence', '998242', 'Inspection of MCA index of charges and preparation of Search Report', 1, 7500, 0, 7500, 18, 1350, 8850, 1);

    // Update settings next sequence
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('5', 'next_sequence');

    // Audit logs for initial setup
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(1, 'admin', 'SYSTEM_INIT', 'system', '0', 'Initial database setup and practice configuration for RSaini & Associates');
    insertAudit.run(1, 'admin', 'INVOICE_ISSUE', 'invoice', String(inv1Id), 'Issued invoice RSA/26-27/001 for Apex Infotech Solutions Private Limited');
    insertAudit.run(1, 'admin', 'PAYMENT_RECORD', 'payment', '1', 'Recorded receipt RCP/26-27/001 of ₹21,240 against invoice RSA/26-27/001');
  }
}

// Initialize on require
initSchema();

module.exports = {
  db,
  hashPassword,
  verifyPassword
};

