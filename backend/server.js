// Simple Waitlist Backend
// Captures emails and can be configured to use Postgres or in-memory storage

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Try to use Postgres, fallback to in-memory
let emails = [];
let usingPostgres = false;

// Check if pg is available
try {
  const { Pool } = require('pg');
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/tellect_waitlist';
  
  try {
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
    });
    
    // Test the connection
    pool.query('SELECT NOW()', (err, res) => {
      if (!err) {
        usingPostgres = true;
        emails = []; // Will be fetched from DB on startup
        console.log('✅ Connected to Postgres database');
      }
    });
    
    // Set up a periodic fetch from DB
    setInterval(() => {
      pool.query('SELECT email, created_at FROM waitlist_emails ORDER BY created_at DESC LIMIT 10', (err, res) => {
        if (!err && res.rowCount > 0) {
          emails = res.rows.map(r => ({ email: r.email, created_at: r.created_at }));
        }
      });
    }, 10000);
    
  } catch (pgErr) {
    console.warn('⚠️ Postgres connection failed, using in-memory storage:', pgErr.message);
    usingPostgres = false;
  }
} catch (e) {
  console.warn('⚠️ pg module not found, using in-memory storage:', e.message);
  usingPostgres = false;
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Tellect Waitlist Backend Running',
    usingPostgres,
    emailCount: emails.length
  });
});

// Submit email to waitlist
app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check for duplicates
  const alreadyExists = emails.some(e => e.email === normalizedEmail);
  if (alreadyExists) {
    return res.status(409).json({ error: 'Email already on waitlist' });
  }
  
  const entry = {
    email: normalizedEmail,
    created_at: new Date().toISOString()
  };
  
  if (usingPostgres) {
    // Save to Postgres
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/tellect_waitlist'
    });
    
    pool.query(
      'INSERT INTO waitlist_emails (email, created_at) VALUES ($1, $2)',
      [normalizedEmail, new Date()],
      (err, result) => {
        if (err) {
          console.error('Postgres insert error:', err.message);
          // Fallback to in-memory
          emails.push(entry);
          io?.emit('waitlist:new', entry);
          return res.json({ success: true, saved: 'memory', email: normalizedEmail });
        }
        emails.push(entry);
        io?.emit('waitlist:new', entry);
        res.json({ success: true, saved: 'postgres', email: normalizedEmail });
      }
    );
  } else {
    // In-memory storage
    emails.push(entry);
    console.log(`📧 Waitlist entry: ${normalizedEmail}`);
    res.json({ success: true, saved: 'memory', email: normalizedEmail });
  }
});

// Get all waitlist emails (admin endpoint)
app.get('/api/waitlist', (req, res) => {
  const uniqueEmails = [...new Set(emails.map(e => e.email))];
  res.json({ emails: uniqueEmails, count: uniqueEmails.length });
});

// Reset waitlist (admin)
app.delete('/api/waitlist', (req, res) => {
  emails = [];
  if (usingPostgres) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/tellect_waitlist'
    });
    pool.query('DELETE FROM waitlist_emails', (err, res) => {
      if (err) console.error(err.message);
    });
  }
  res.json({ message: 'Waitlist cleared', count: 0 });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Tellect Waitlist Backend running on port ${PORT}`);
  console.log(`📍 API endpoint: POST /api/waitlist`);
  console.log(`🌐 Frontend should point to: http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

// Export for testing
module.exports = app;