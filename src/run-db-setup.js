const { Client } = require('pg');

const sqlPath = 'src/database/migrations/20260612_enable_pgvector.sql';
const fs = require('fs');
if (!fs.existsSync(sqlPath)) {
  console.error('SQL file not found:', sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Build SSL configuration from environment without writing to disk
let ssl = false;
if (process.env.PG_CA_BASE64) {
  try {
    const b64 = process.env.PG_CA_BASE64.replace(/\s+/g, '');
    const cert = Buffer.from(b64, 'base64').toString('utf8');
    ssl = { ca: cert, rejectUnauthorized: true };
    console.log('[db-setup] Using CA cert from PG_CA_BASE64 (no file written)');
  } catch (err) {
    console.error('Failed to decode PG_CA_BASE64:', err);
    process.exit(1);
  }
} else {
  // If no CA cert provided, still use SSL but with reduced security (dev only)
  ssl = { rejectUnauthorized: false };
  console.log('[db-setup] No PG_CA_BASE64 provided, connecting with SSL but without CA verification');
}

const client = new Client({ connectionString, ssl });

(async () => {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(sql);
    console.log('Executed SQL migrations');
    await client.end();
  } catch (e) {
    console.error('DB setup failed:', e);
    process.exit(1);
  }
})();
