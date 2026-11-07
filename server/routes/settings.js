const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { db, hashPassword } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

router.use(authMiddleware);

// Setup multer for logo upload
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `firm_logo_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// GET /api/settings - retrieve all settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve settings' });
  }
});

// PUT /api/settings - update settings (admin/owner only)
router.put('/', requireRole(['admin', 'owner']), (req, res) => {
  const settingsData = req.body;
  if (!settingsData || typeof settingsData !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid settings data.' });
  }

  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(settingsData)) {
      stmt.run(k, String(v));
    }

    logAudit(req, 'SETTINGS_UPDATE', 'settings', '0', `Updated practice settings by ${req.user.username}`);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// POST /api/settings/upload-logo - upload firm logo/letterhead artwork
router.post('/upload-logo', requireRole(['admin', 'owner']), upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const relativeUrl = `/uploads/${req.file.filename}`;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('logo_url', relativeUrl);

    logAudit(req, 'LOGO_UPLOAD', 'settings', '0', `Uploaded new practice logo: ${req.file.filename}`);
    res.json({ success: true, message: 'Logo uploaded successfully', logoUrl: relativeUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to upload logo' });
  }
});

// GET /api/settings/users - list users (admin only)
router.get('/users', requireRole(['admin', 'owner']), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, full_name, email, role, status, created_at, last_login
      FROM users
      ORDER BY id ASC
    `).all();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
});

// POST /api/settings/users - create new user
router.post('/users', requireRole(['admin', 'owner']), (req, res) => {
  const { username, password, full_name, email, role } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ success: false, message: 'Username, password and full name are required.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }

    const { hash, salt } = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, email, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(username.trim(), hash, salt, full_name.trim(), email || '', role || 'billing');

    const newUserId = Number(result.lastInsertRowid);
    logAudit(req, 'USER_CREATE', 'user', newUserId, `Created new user ${username} with role ${role || 'billing'}`);

    res.status(201).json({ success: true, message: 'User created successfully', user_id: newUserId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// PUT /api/settings/users/:id - update user role or status
router.put('/users/:id', requireRole(['admin', 'owner']), (req, res) => {
  const { full_name, email, role, status, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let passHash = user.password_hash;
    let passSalt = user.salt;
    if (password && password.trim()) {
      const hp = hashPassword(password.trim());
      passHash = hp.hash;
      passSalt = hp.salt;
    }

    db.prepare(`
      UPDATE users SET
        full_name = ?, email = ?, role = ?, status = ?, password_hash = ?, salt = ?
      WHERE id = ?
    `).run(
      full_name || user.full_name,
      email !== undefined ? email : user.email,
      role || user.role,
      status || user.status,
      passHash,
      passSalt,
      user.id
    );

    logAudit(req, 'USER_UPDATE', 'user', user.id, `Updated user ${user.username}`);
    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

module.exports = router;

