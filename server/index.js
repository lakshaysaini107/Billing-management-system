/**
 * RSaini & Associates - Client, Invoice & Payment Management System
 * Main Application Server
 */
const express = require('express');
const cors = require('cors');
const path = require('node:path');

// Initialize database
require('./db');

// Import routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const serviceRoutes = require('./routes/services');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const settingRoutes = require('./routes/settings');
const backupRoutes = require('./routes/backup');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    practice: 'RSaini & Associates',
    system: 'Client, Invoice & Payment Management System',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('================================================================');
  console.log('  RSAINI & ASSOCIATES - PRACTICING COMPANY SECRETARIES');
  console.log('  Client, Invoice & Payment Management System (v1.0 MVP)');
  console.log('================================================================');
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`  Default Practice Owner: admin / admin123`);
  console.log(`  Default Billing Staff:  billing / billing123`);
  console.log('================================================================');
});
