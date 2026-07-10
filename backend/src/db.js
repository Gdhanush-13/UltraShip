const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'ledger.db');
let _db = null;
let _inMemory = false;
let _inTransaction = false;

function saveToFile() {
  if (_db && !_inMemory) {
    try {
      const data = _db.export();
      fs.writeFileSync(DB_FILE, Buffer.from(data));
    } catch (_) {}
  }
}

async function initDb(inMemory = false) {
  _inMemory = inMemory;
  const SQL = await initSqlJs({
    // Explicit WASM path — required for Render/production where CWD may differ
    locateFile: file => path.join(path.dirname(require.resolve('sql.js')), file),
  });
  if (!inMemory && fs.existsSync(DB_FILE)) {
    _db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    _db = new SQL.Database();
  }
  _db.run('PRAGMA foreign_keys = ON');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      reference TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      entry_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      payer_account_id TEXT NOT NULL,
      payee_account_id TEXT NOT NULL,
      description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      transaction_id TEXT,
      amount_cents INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_entries_account ON ledger_entries(account_id);
    CREATE INDEX IF NOT EXISTS idx_entries_txn ON ledger_entries(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON invoice_payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_idem ON invoice_payments(idempotency_key);
  `);
  if (!inMemory) saveToFile();
}

function queryAll(sql, params = []) {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');
  const stmt = _db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');
  _db.run(sql, params);
  if (!_inTransaction) saveToFile();
}

function runGetChanges(sql, params = []) {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');
  _db.run(sql, params);
  const changes = _db.getRowsModified();
  if (!_inTransaction) saveToFile();
  return changes;
}

function execTransaction(fn) {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');
  // Nested call: already inside a transaction — just run without wrapping
  if (_inTransaction) return fn();
  _db.run('BEGIN');
  _inTransaction = true;
  try {
    const result = fn();
    _db.run('COMMIT');
    _inTransaction = false;
    saveToFile();
    return result;
  } catch (err) {
    _inTransaction = false;
    try { _db.run('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

module.exports = { initDb, queryAll, queryOne, run, runGetChanges, execTransaction };
