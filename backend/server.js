// Tellect Campus — Waitlist Backend
// Captures waitlist emails into PostgreSQL (falls back to in-memory if unavailable).
// Also serves the static landing page (index.html) so a single Render service is enough.

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..')));

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
let pool = null;
let usingPostgres = false;

// In-memory fallback
let memoryEmails = [];

function buildPoolConfig() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://localhost:5432/tellect_waitlist';

  const config = {
    connectionString,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };

  // Hosted Postgres providers (Render, Neon, Supabase, etc.) require TLS.
  // `pg` honours `sslmode=require` in the URL; for other hosts we force SSL on.
  const needsSsl =
    /sslmode=require/i.test(connectionString) ||
    /render\.com|neon\.tech|supabase\.co|amazonaws\.com|azure\.com/i.test(connectionString);

  if (needsSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

async function initPostgres() {
  try {
    const { Pool } = require('pg');
    pool = new Pool(buildPoolConfig());

    // Fail fast if the DB is unreachable so we fall back gracefully.
    await pool.query('SELECT 1');

    // Make sure the table exists (idempotent).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waitlist_emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    usingPostgres = true;
    console.log('✅ Connected to Postgres — waitlist_emails table ready');
  } catch (err) {
    usingPostgres = false;
    pool = null;
    console.warn(`⚠️ Postgres unavailable (${err.message}) — using in-memory storage`);
  }
}

async function saveEmail(email) {
  if (usingPostgres && pool) {
    const { rows } = await pool.query(
      `INSERT INTO waitlist_emails (email, created_at)
       VALUES ($1, NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, created_at`,
      [email]
    );

    // rows is empty when the email already existed (conflict).
    return { saved: 'postgres', created: rows.length > 0, record: rows[0] || null };
  }

  const exists = memoryEmails.some((e) => e.email === email);
  if (!exists) {
    memoryEmails.push({ email, created_at: new Date().toISOString() });
  }
  return { saved: 'memory', created: !exists, record: null };
}

async function listEmails() {
  if (usingPostgres && pool) {
    const { rows } = await pool.query(
      'SELECT email, created_at FROM waitlist_emails ORDER BY created_at DESC'
    );
    return rows;
  }
  return [...memoryEmails].reverse();
}

async function clearEmails() {
  if (usingPostgres && pool) {
    await pool.query('DELETE FROM waitlist_emails');
  }
  memoryEmails = [];
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    usingPostgres,
    emailCount: usingPostgres ? undefined : memoryEmails.length,
  });
});

// Submit email to the waitlist
app.post('/api/waitlist', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const normalized = email.toLowerCase().trim();

  try {
    const result = await saveEmail(normalized);

    if (!result.created) {
      return res.status(409).json({
        success: false,
        error: 'This email is already on the waitlist.',
        email: normalized,
      });
    }

    console.log(`📧 Waitlist signup: ${normalized} (${result.saved})`);
    return res.status(201).json({
      success: true,
      email: normalized,
      saved: result.saved,
    });
  } catch (err) {
    console.error('❌ Failed to save waitlist entry:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Could not save your email. Please try again.',
    });
  }
});

// List waitlist emails (admin)
app.get('/api/waitlist', async (req, res) => {
  try {
    const rows = await listEmails();
    res.json({
      count: rows.length,
      usingPostgres,
      emails: rows.map((r) => r.email),
      records: rows,
    });
  } catch (err) {
    console.error('❌ Failed to list waitlist:', err.message);
    res.status(500).json({ error: 'Could not read the waitlist.' });
  }
});

// Clear the waitlist (admin)
app.delete('/api/waitlist', async (req, res) => {
  try {
    await clearEmails();
    res.json({ message: 'Waitlist cleared.', count: 0 });
  } catch (err) {
    console.error('❌ Failed to clear waitlist:', err.message);
    res.status(500).json({ error: 'Could not clear the waitlist.' });
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
initPostgres().finally(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Tellect Waitlist backend listening on port ${PORT}`);
    console.log(`📍 POST /api/waitlist  •  GET /api/waitlist  •  GET /api/health`);
    console.log(`🌐 Landing page: http://localhost:${PORT}/`);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    server.close(() => process.exit(0));
  });
});

module.exports = app;
