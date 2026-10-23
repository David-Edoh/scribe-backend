const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const users = new Map();

function hashpw(p){ return crypto.createHash('sha256').update(p).digest('hex'); }

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.post('/api/auth/register', (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  if (users.has(email)) return res.status(409).json({ error: 'exists' });
  const id = crypto.randomUUID();
  users.set(email, { id, email, passwordHash: hashpw(password), displayName });
  const token = jwt.sign({ sub: id, email }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ user: { id, email, displayName }, token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const u = users.get(email);
  if (!u || u.passwordHash !== hashpw(password)) return res.status(401).json({ error: 'invalid' });
  const token = jwt.sign({ sub: u.id, email }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ user: { id: u.id, email: u.displayName }, token });
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).end();
  const token = auth.replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ payload });
  } catch (e){ res.status(401).end(); }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('Dev server listening on', port));
