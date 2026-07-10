const { v4: uuidv4 } = require('uuid');
const db = require('./db');

function getAccountBalance(accountId) {
  const row = db.queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END), 0) AS balance
    FROM ledger_entries WHERE account_id = ?
  `, [accountId]);
  return row ? row.balance : 0;
}

function getInvoiceTotalCents(invoiceId) {
  const row = db.queryOne(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM invoice_line_items WHERE invoice_id = ?`,
    [invoiceId]
  );
  return row ? row.total : 0;
}

function getInvoicePaidCents(invoiceId) {
  const row = db.queryOne(
    `SELECT COALESCE(SUM(amount_cents), 0) AS paid FROM invoice_payments WHERE invoice_id = ?`,
    [invoiceId]
  );
  return row ? row.paid : 0;
}

function enrichAccount(row) {
  if (!row) return null;
  return { ...row, balanceCents: getAccountBalance(row.id), createdAt: row.created_at };
}

function enrichInvoice(row) {
  if (!row) return null;
  const totalCents = getInvoiceTotalCents(row.id);
  const paidCents = getInvoicePaidCents(row.id);
  const lineItems = db.queryAll(`SELECT * FROM invoice_line_items WHERE invoice_id = ?`, [row.id]).map(li => ({
    ...li,
    invoiceId: li.invoice_id,
    unitPriceCents: li.unit_price_cents,
    amountCents: li.amount_cents,
  }));
  return {
    ...row,
    totalCents,
    paidCents,
    remainingCents: totalCents - paidCents,
    createdAt: row.created_at,
    dueDate: row.due_date,
    status: row.status,
    currency: row.currency,
    lineItems,
  };
}

function enrichTransaction(row) {
  if (!row) return null;
  const entries = db.queryAll(`SELECT * FROM ledger_entries WHERE transaction_id = ?`, [row.id]);
  return {
    ...row,
    createdAt: row.created_at,
    entries: entries.map(e => ({
      ...e,
      entryType: e.entry_type,
      amountCents: e.amount_cents,
      transactionId: e.transaction_id,
      createdAt: e.created_at,
    })),
  };
}

const resolvers = {
  Query: {
    accounts: () => db.queryAll(`SELECT * FROM accounts ORDER BY created_at DESC`).map(enrichAccount),
    account: (_, { id }) => enrichAccount(db.queryOne(`SELECT * FROM accounts WHERE id = ?`, [id])),
    ledgerTransactions: () =>
      db.queryAll(`SELECT * FROM ledger_transactions ORDER BY created_at DESC`).map(enrichTransaction),
    ledgerTransaction: (_, { id }) =>
      enrichTransaction(db.queryOne(`SELECT * FROM ledger_transactions WHERE id = ?`, [id])),
    invoices: () => db.queryAll(`SELECT * FROM invoices ORDER BY created_at DESC`).map(enrichInvoice),
    invoice: (_, { id }) => enrichInvoice(db.queryOne(`SELECT * FROM invoices WHERE id = ?`, [id])),
  },

  Account: {
    balanceCents: (parent) => parent.balanceCents ?? getAccountBalance(parent.id),
  },

  LedgerEntry: {
    account: (parent) => enrichAccount(db.queryOne(`SELECT * FROM accounts WHERE id = ?`, [parent.account_id || parent.accountId])),
  },

  Invoice: {
    payerAccount: (parent) => enrichAccount(db.queryOne(`SELECT * FROM accounts WHERE id = ?`, [parent.payer_account_id])),
    payeeAccount: (parent) => enrichAccount(db.queryOne(`SELECT * FROM accounts WHERE id = ?`, [parent.payee_account_id])),
    lineItems: (parent) => parent.lineItems || db.queryAll(`SELECT * FROM invoice_line_items WHERE invoice_id = ?`, [parent.id]).map(li => ({
      ...li,
      invoiceId: li.invoice_id,
      unitPriceCents: li.unit_price_cents,
      amountCents: li.amount_cents,
    })),
    payments: (parent) => db.queryAll(`SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY created_at ASC`, [parent.id]).map(p => ({
      ...p,
      invoiceId: p.invoice_id,
      amountCents: p.amount_cents,
      idempotencyKey: p.idempotency_key,
      createdAt: p.created_at,
      transaction_id: p.transaction_id,
    })),
  },

  InvoicePayment: {
    transaction: (parent) => parent.transaction_id
      ? enrichTransaction(db.queryOne(`SELECT * FROM ledger_transactions WHERE id = ?`, [parent.transaction_id]))
      : null,
  },

  Mutation: {
    createAccount: (_, { name, type, currency = 'USD' }) => {
      const trimmed = (name || '').trim();
      if (!trimmed) throw new Error('Account name cannot be empty');
      const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      if (!validTypes.includes(type)) throw new Error(`Invalid account type '${type}'`);
      const id = uuidv4();
      db.run(`INSERT INTO accounts (id, name, type, currency) VALUES (?, ?, ?, ?)`, [id, trimmed, type, currency]);
      return enrichAccount(db.queryOne(`SELECT * FROM accounts WHERE id = ?`, [id]));
    },

    recordTransaction: (_, { debitAccountId, creditAccountId, amountCents, description, reference }) => {
      if (amountCents <= 0) throw new Error('Amount must be positive');
      if (debitAccountId === creditAccountId) throw new Error('Debit and credit accounts must differ');

      const debitAcc = db.queryOne(`SELECT id FROM accounts WHERE id = ?`, [debitAccountId]);
      const creditAcc = db.queryOne(`SELECT id FROM accounts WHERE id = ?`, [creditAccountId]);
      if (!debitAcc) throw new Error(`Debit account ${debitAccountId} not found`);
      if (!creditAcc) throw new Error(`Credit account ${creditAccountId} not found`);

      const txnId = uuidv4();
      db.execTransaction(() => {
        db.run(`INSERT INTO ledger_transactions (id, description, reference) VALUES (?, ?, ?)`, [txnId, description, reference || null]);
        db.run(`INSERT INTO ledger_entries (id, transaction_id, account_id, amount_cents, entry_type) VALUES (?, ?, ?, ?, 'debit')`, [uuidv4(), txnId, debitAccountId, amountCents]);
        db.run(`INSERT INTO ledger_entries (id, transaction_id, account_id, amount_cents, entry_type) VALUES (?, ?, ?, ?, 'credit')`, [uuidv4(), txnId, creditAccountId, amountCents]);
      });
      return enrichTransaction(db.queryOne(`SELECT * FROM ledger_transactions WHERE id = ?`, [txnId]));
    },

    createInvoice: (_, { payerAccountId, payeeAccountId, description, dueDate, currency = 'USD', lineItems }) => {
      if (!lineItems || lineItems.length === 0) throw new Error('Invoice must have at least one line item');
      if (payerAccountId === payeeAccountId) throw new Error('Payer and payee accounts must differ');
      for (const li of lineItems) {
        if (!li.description || !li.description.trim()) throw new Error('Line item description cannot be empty');
        if (li.quantity <= 0) throw new Error('Line item quantity must be positive');
        if (li.unitPriceCents < 0) throw new Error('Line item unit price cannot be negative');
      }
      const payerAcc = db.queryOne(`SELECT id FROM accounts WHERE id = ?`, [payerAccountId]);
      const payeeAcc = db.queryOne(`SELECT id FROM accounts WHERE id = ?`, [payeeAccountId]);
      if (!payerAcc) throw new Error(`Payer account ${payerAccountId} not found`);
      if (!payeeAcc) throw new Error(`Payee account ${payeeAccountId} not found`);

      const invoiceId = uuidv4();
      db.execTransaction(() => {
        db.run(`INSERT INTO invoices (id, payer_account_id, payee_account_id, description, due_date, currency) VALUES (?, ?, ?, ?, ?, ?)`, [invoiceId, payerAccountId, payeeAccountId, description.trim(), dueDate, currency]);
        for (const li of lineItems) {
          const amountCents = li.quantity * li.unitPriceCents;
          db.run(`INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price_cents, amount_cents) VALUES (?, ?, ?, ?, ?, ?)`, [uuidv4(), invoiceId, li.description.trim(), li.quantity, li.unitPriceCents, amountCents]);
        }
      });
      return enrichInvoice(db.queryOne(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]));
    },

    updateInvoiceStatus: (_, { id, status }) => {
      const invoice = db.queryOne(`SELECT * FROM invoices WHERE id = ?`, [id]);
      if (!invoice) throw new Error(`Invoice ${id} not found`);

      const transitions = { draft: ['sent'], sent: ['paid', 'overdue'], overdue: ['paid'] };
      if (invoice.status === status) return enrichInvoice(invoice);
      if (!transitions[invoice.status]?.includes(status)) {
        throw new Error(`Invalid status transition: ${invoice.status} → ${status}`);
      }
      db.run(`UPDATE invoices SET status = ? WHERE id = ?`, [status, id]);
      return enrichInvoice(db.queryOne(`SELECT * FROM invoices WHERE id = ?`, [id]));
    },

    applyPayment: (_, { invoiceId, amountCents, idempotencyKey }) => {
      if (amountCents <= 0) throw new Error('Payment amount must be positive');

      const result = db.execTransaction(() => {
        const existing = db.queryOne(`SELECT * FROM invoice_payments WHERE idempotency_key = ?`, [idempotencyKey]);
        if (existing) return existing;

        const invoice = db.queryOne(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
        if (!['sent', 'overdue'].includes(invoice.status)) {
          throw new Error(`Invoice is in status '${invoice.status}' and cannot accept payments. It must be 'sent' or 'overdue'.`);
        }

        const totalCents = getInvoiceTotalCents(invoiceId);
        const paidCents = getInvoicePaidCents(invoiceId);
        const remainingCents = totalCents - paidCents;

        if (amountCents > remainingCents) {
          throw new Error(`Overpayment prevented: payment ${amountCents} cents exceeds remaining balance ${remainingCents} cents`);
        }

        const txnId = uuidv4();
        db.run(`INSERT INTO ledger_transactions (id, description, reference) VALUES (?, ?, ?)`, [
          txnId, `Payment for invoice ${invoiceId}`, idempotencyKey,
        ]);
        db.run(`INSERT INTO ledger_entries (id, transaction_id, account_id, amount_cents, entry_type) VALUES (?, ?, ?, ?, 'debit')`, [
          uuidv4(), txnId, invoice.payer_account_id, amountCents,
        ]);
        db.run(`INSERT INTO ledger_entries (id, transaction_id, account_id, amount_cents, entry_type) VALUES (?, ?, ?, ?, 'credit')`, [
          uuidv4(), txnId, invoice.payee_account_id, amountCents,
        ]);

        const paymentId = uuidv4();
        db.run(`INSERT INTO invoice_payments (id, invoice_id, transaction_id, amount_cents, idempotency_key) VALUES (?, ?, ?, ?, ?)`, [
          paymentId, invoiceId, txnId, amountCents, idempotencyKey,
        ]);

        if (paidCents + amountCents >= totalCents) {
          db.run(`UPDATE invoices SET status = 'paid' WHERE id = ?`, [invoiceId]);
        }

        return db.queryOne(`SELECT * FROM invoice_payments WHERE id = ?`, [paymentId]);
      });

      return {
        ...result,
        invoiceId: result.invoice_id,
        amountCents: result.amount_cents,
        idempotencyKey: result.idempotency_key,
        createdAt: result.created_at,
        transaction_id: result.transaction_id,
      };
    },

    markOverdueInvoices: () => {
      const today = new Date().toISOString().split('T')[0];
      return db.runGetChanges(
        `UPDATE invoices SET status = 'overdue' WHERE status = 'sent' AND due_date < ?`,
        [today]
      );
    },
  },
};

module.exports = { resolvers };
