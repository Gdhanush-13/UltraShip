const { initDb } = require('../src/db');
const { resolvers } = require('../src/resolvers');
const { Mutation, Query } = resolvers;

beforeAll(async () => {
  await initDb(true);
});

describe('Part 1 – Core Ledger', () => {
  let assetAccId, revenueAccId;

  test('creates accounts', () => {
    const asset = Mutation.createAccount(null, { name: 'Cash', type: 'asset' });
    const revenue = Mutation.createAccount(null, { name: 'Revenue', type: 'revenue' });
    expect(asset.id).toBeDefined();
    expect(revenue.id).toBeDefined();
    assetAccId = asset.id;
    revenueAccId = revenue.id;
  });

  test('new account balance is zero', () => {
    const acc = Mutation.createAccount(null, { name: 'Checking', type: 'asset' });
    expect(acc.balanceCents).toBe(0);
  });

  test('records a double-entry transaction', () => {
    const asset = Mutation.createAccount(null, { name: 'Bank', type: 'asset' });
    const rev = Mutation.createAccount(null, { name: 'Sales', type: 'revenue' });
    const txn = Mutation.recordTransaction(null, {
      debitAccountId: asset.id,
      creditAccountId: rev.id,
      amountCents: 10000,
      description: 'Sale $100',
    });
    expect(txn.entries).toHaveLength(2);
    const debit = txn.entries.find(e => e.entryType === 'debit');
    const credit = txn.entries.find(e => e.entryType === 'credit');
    expect(debit.amountCents).toBe(10000);
    expect(credit.amountCents).toBe(10000);
  });

  test('balance is derived from entries, not stored', () => {
    const acc = Mutation.createAccount(null, { name: 'Escrow', type: 'asset' });
    const other = Mutation.createAccount(null, { name: 'Vendor', type: 'liability' });
    Mutation.recordTransaction(null, {
      debitAccountId: acc.id,
      creditAccountId: other.id,
      amountCents: 5000,
      description: 'Credit 50',
    });
    Mutation.recordTransaction(null, {
      debitAccountId: acc.id,
      creditAccountId: other.id,
      amountCents: 3000,
      description: 'Credit 30',
    });
    const fetched = Query.account(null, { id: acc.id });
    // Escrow: 5000 debit + 3000 debit = 8000 debit, 0 credit → net balance = 8000
    expect(fetched.balanceCents).toBe(8000);
  });

  test('rejects same debit/credit account', () => {
    const acc = Mutation.createAccount(null, { name: 'Loop', type: 'asset' });
    expect(() =>
      Mutation.recordTransaction(null, {
        debitAccountId: acc.id,
        creditAccountId: acc.id,
        amountCents: 100,
        description: 'Self',
      })
    ).toThrow('Debit and credit accounts must differ');
  });

  test('rejects zero or negative amounts', () => {
    const a = Mutation.createAccount(null, { name: 'A', type: 'asset' });
    const b = Mutation.createAccount(null, { name: 'B', type: 'liability' });
    expect(() =>
      Mutation.recordTransaction(null, {
        debitAccountId: a.id,
        creditAccountId: b.id,
        amountCents: 0,
        description: 'Zero',
      })
    ).toThrow('Amount must be positive');
  });
});

describe('Part 2 – Invoice Flow', () => {
  let payerAcc, payeeAcc, invoiceId;

  beforeAll(() => {
    payerAcc = Mutation.createAccount(null, { name: 'Payer Corp', type: 'asset' });
    payeeAcc = Mutation.createAccount(null, { name: 'UltraShip', type: 'revenue' });
  });

  test('creates invoice with line items', () => {
    const inv = Mutation.createInvoice(null, {
      payerAccountId: payerAcc.id,
      payeeAccountId: payeeAcc.id,
      description: 'Freight Invoice #001',
      dueDate: '2025-12-31',
      lineItems: [
        { description: 'Freight charge', quantity: 2, unitPriceCents: 5000 },
        { description: 'Fuel surcharge', quantity: 1, unitPriceCents: 1500 },
      ],
    });
    invoiceId = inv.id;
    expect(inv.status).toBe('draft');
    expect(inv.totalCents).toBe(11500);
    expect(inv.lineItems).toHaveLength(2);
  });

  test('transitions invoice draft → sent', () => {
    const inv = Mutation.updateInvoiceStatus(null, { id: invoiceId, status: 'sent' });
    expect(inv.status).toBe('sent');
  });

  test('rejects invalid status transition (draft → paid)', () => {
    const inv = Mutation.createInvoice(null, {
      payerAccountId: payerAcc.id,
      payeeAccountId: payeeAcc.id,
      description: 'Bad transition',
      dueDate: '2025-12-31',
      lineItems: [{ description: 'Item', quantity: 1, unitPriceCents: 1000 }],
    });
    expect(() =>
      Mutation.updateInvoiceStatus(null, { id: inv.id, status: 'paid' })
    ).toThrow('Invalid status transition');
  });

  test('applies partial payment', () => {
    const payment = Mutation.applyPayment(null, {
      invoiceId,
      amountCents: 5000,
      idempotencyKey: 'pay-001',
    });
    expect(payment.amountCents).toBe(5000);
    const inv = Query.invoice(null, { id: invoiceId });
    expect(inv.paidCents).toBe(5000);
    expect(inv.remainingCents).toBe(6500);
    expect(inv.status).toBe('sent');
  });

  test('idempotent: same payment key returns same result without double-charging', () => {
    const p1 = Mutation.applyPayment(null, { invoiceId, amountCents: 5000, idempotencyKey: 'pay-001' });
    const p2 = Mutation.applyPayment(null, { invoiceId, amountCents: 5000, idempotencyKey: 'pay-001' });
    expect(p1.id).toBe(p2.id);
    const inv = Query.invoice(null, { id: invoiceId });
    expect(inv.paidCents).toBe(5000); // not double charged
  });

  test('prevents overpayment', () => {
    expect(() =>
      Mutation.applyPayment(null, {
        invoiceId,
        amountCents: 99999,
        idempotencyKey: 'pay-overpay',
      })
    ).toThrow('Overpayment prevented');
  });

  test('marks invoice paid when fully settled', () => {
    Mutation.applyPayment(null, { invoiceId, amountCents: 6500, idempotencyKey: 'pay-002' });
    const inv = Query.invoice(null, { id: invoiceId });
    expect(inv.status).toBe('paid');
    expect(inv.remainingCents).toBe(0);
  });

  test('paid invoice cannot accept more payments', () => {
    expect(() =>
      Mutation.applyPayment(null, {
        invoiceId,
        amountCents: 100,
        idempotencyKey: 'pay-003-extra',
      })
    ).toThrow();
  });
});

describe('Part 3 – Edge Case: Idempotency / Race Condition Guard', () => {
  test('concurrent-like payments with same idempotency key only charge once', () => {
    const payer = Mutation.createAccount(null, { name: 'RacePayer', type: 'asset' });
    const payee = Mutation.createAccount(null, { name: 'RacePayee', type: 'revenue' });
    const inv = Mutation.createInvoice(null, {
      payerAccountId: payer.id,
      payeeAccountId: payee.id,
      description: 'Race test invoice',
      dueDate: '2025-12-31',
      lineItems: [{ description: 'Shipping', quantity: 1, unitPriceCents: 20000 }],
    });
    Mutation.updateInvoiceStatus(null, { id: inv.id, status: 'sent' });

    const key = 'race-idem-key-xyz';
    const results = [
      Mutation.applyPayment(null, { invoiceId: inv.id, amountCents: 20000, idempotencyKey: key }),
      Mutation.applyPayment(null, { invoiceId: inv.id, amountCents: 20000, idempotencyKey: key }),
      Mutation.applyPayment(null, { invoiceId: inv.id, amountCents: 20000, idempotencyKey: key }),
    ];

    const uniqueIds = new Set(results.map(r => r.id));
    expect(uniqueIds.size).toBe(1);

    const fetched = Query.invoice(null, { id: inv.id });
    expect(fetched.paidCents).toBe(20000);
    expect(fetched.status).toBe('paid');
  });
});

describe('Input Validation', () => {
  test('rejects blank account name', () => {
    expect(() => Mutation.createAccount(null, { name: '   ', type: 'asset' })).toThrow('Account name cannot be empty');
  });

  test('rejects invalid account type', () => {
    expect(() => Mutation.createAccount(null, { name: 'X', type: 'invalid' })).toThrow("Invalid account type 'invalid'");
  });

  test('rejects invoice with same payer and payee', () => {
    const acc = Mutation.createAccount(null, { name: 'SameAcc', type: 'asset' });
    expect(() =>
      Mutation.createInvoice(null, {
        payerAccountId: acc.id,
        payeeAccountId: acc.id,
        description: 'Self-invoice',
        dueDate: '2025-12-31',
        lineItems: [{ description: 'X', quantity: 1, unitPriceCents: 100 }],
      })
    ).toThrow('Payer and payee accounts must differ');
  });

  test('rejects invoice line item with negative unit price', () => {
    const a = Mutation.createAccount(null, { name: 'NegA', type: 'asset' });
    const b = Mutation.createAccount(null, { name: 'NegB', type: 'revenue' });
    expect(() =>
      Mutation.createInvoice(null, {
        payerAccountId: a.id, payeeAccountId: b.id,
        description: 'Bad price invoice', dueDate: '2025-12-31',
        lineItems: [{ description: 'Item', quantity: 1, unitPriceCents: -500 }],
      })
    ).toThrow('unit price cannot be negative');
  });

  test('rejects invoice line item with zero quantity', () => {
    const a = Mutation.createAccount(null, { name: 'ZqA', type: 'asset' });
    const b = Mutation.createAccount(null, { name: 'ZqB', type: 'revenue' });
    expect(() =>
      Mutation.createInvoice(null, {
        payerAccountId: a.id, payeeAccountId: b.id,
        description: 'Zero qty', dueDate: '2025-12-31',
        lineItems: [{ description: 'Item', quantity: 0, unitPriceCents: 100 }],
      })
    ).toThrow('quantity must be positive');
  });

  test('rejects payment with zero amount', () => {
    expect(() =>
      Mutation.applyPayment(null, { invoiceId: 'any', amountCents: 0, idempotencyKey: 'k0' })
    ).toThrow('Payment amount must be positive');
  });
});

describe('markOverdueInvoices', () => {
  test('transitions past-due sent invoices to overdue', () => {
    const p = Mutation.createAccount(null, { name: 'ODPayer', type: 'asset' });
    const q = Mutation.createAccount(null, { name: 'ODPayee', type: 'revenue' });

    const inv1 = Mutation.createInvoice(null, {
      payerAccountId: p.id, payeeAccountId: q.id,
      description: 'Overdue Invoice 1', dueDate: '2020-01-01',
      lineItems: [{ description: 'Old charge', quantity: 1, unitPriceCents: 5000 }],
    });
    const inv2 = Mutation.createInvoice(null, {
      payerAccountId: p.id, payeeAccountId: q.id,
      description: 'Future Invoice', dueDate: '2099-12-31',
      lineItems: [{ description: 'Future charge', quantity: 1, unitPriceCents: 5000 }],
    });

    Mutation.updateInvoiceStatus(null, { id: inv1.id, status: 'sent' });
    Mutation.updateInvoiceStatus(null, { id: inv2.id, status: 'sent' });

    const changed = Mutation.markOverdueInvoices(null, {});
    expect(changed).toBeGreaterThanOrEqual(1);

    expect(Query.invoice(null, { id: inv1.id }).status).toBe('overdue');
    expect(Query.invoice(null, { id: inv2.id }).status).toBe('sent');
  });

  test('draft invoices are not affected by markOverdueInvoices', () => {
    const p = Mutation.createAccount(null, { name: 'DraftODPayer', type: 'asset' });
    const q = Mutation.createAccount(null, { name: 'DraftODPayee', type: 'revenue' });
    const inv = Mutation.createInvoice(null, {
      payerAccountId: p.id, payeeAccountId: q.id,
      description: 'Old draft', dueDate: '2019-01-01',
      lineItems: [{ description: 'Item', quantity: 1, unitPriceCents: 100 }],
    });
    Mutation.markOverdueInvoices(null, {});
    expect(Query.invoice(null, { id: inv.id }).status).toBe('draft');
  });
});

describe('Ledger Balance Integrity', () => {
  test('sum of all debits equals sum of all credits across the entire ledger', () => {
    const { queryAll } = require('../src/db');
    const entries = queryAll('SELECT entry_type, SUM(amount_cents) as total FROM ledger_entries GROUP BY entry_type', []);
    const debitTotal = entries.find(e => e.entry_type === 'debit')?.total || 0;
    const creditTotal = entries.find(e => e.entry_type === 'credit')?.total || 0;
    expect(debitTotal).toBe(creditTotal);
    expect(debitTotal).toBeGreaterThan(0);
  });

  test('every ledger transaction has exactly 2 entries (one debit, one credit)', () => {
    const { queryAll } = require('../src/db');
    const counts = queryAll(
      `SELECT transaction_id, COUNT(*) as cnt,
       SUM(CASE WHEN entry_type='debit' THEN 1 ELSE 0 END) as debits,
       SUM(CASE WHEN entry_type='credit' THEN 1 ELSE 0 END) as credits
       FROM ledger_entries GROUP BY transaction_id`,
      []
    );
    for (const row of counts) {
      expect(row.cnt).toBe(2);
      expect(row.debits).toBe(1);
      expect(row.credits).toBe(1);
    }
  });
});
