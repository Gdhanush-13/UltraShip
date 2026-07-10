import React, { useState } from 'react';

const SECTIONS = [
  {
    icon: '🚀',
    title: 'Getting Started',
    color: '#6366F1',
    intro: 'UltraShip is a mini Accounts Payable payment ledger built for Transportation Management Systems (TMS). It handles double-entry accounting, invoice lifecycle, and idempotent payment processing.',
    items: [
      'Create ledger accounts (asset, liability, equity, revenue, expense)',
      'Record double-entry transactions — every debit has a matching credit',
      'Create invoices with line items and due dates',
      'Apply full or partial payments with idempotency keys',
      'Track overdue invoices automatically with markOverdueInvoices',
    ],
  },
  {
    icon: '📊',
    title: 'Dashboard',
    color: '#06B6D4',
    intro: 'The dashboard gives a real-time overview of your ledger health — all values are derived live from transaction entries, never stored as stale numbers.',
    items: [
      'Total accounts and asset balance (debit − credit)',
      'Ledger transaction count across all double-entry records',
      'Open invoice count with overdue alert indicator',
      'Outstanding AP amount (sum of remaining balances)',
      'Total paid amount across all settled invoices',
      'Quick action shortcuts to all common tasks',
    ],
  },
  {
    icon: '🏦',
    title: 'Accounts',
    color: '#22C55E',
    intro: 'The Chart of Accounts is the foundation of the ledger. Every account balance is always derived from its transaction history — never stored directly.',
    items: [
      'Five account types: asset, liability, equity, revenue, expense',
      'Balance = SUM(debit entries) − SUM(credit entries) — always accurate',
      'Multi-currency support (USD, EUR, GBP, CAD)',
      'Accounts are immutable once they have transaction history',
      'Grouped by type with individual balance totals',
    ],
    note: '⚠️ Accounts cannot be deleted once they hold transaction history. This preserves ledger integrity and audit trail.',
  },
  {
    icon: '⇄',
    title: 'Transactions',
    color: '#EAB308',
    intro: 'Every financial movement is recorded as a double-entry transaction — one debit and one matching credit. This guarantees the ledger stays balanced at all times.',
    items: [
      'Debit account + Credit account + amount = one transaction',
      'Both entries always carry the same amount in cents (no floats)',
      'Optional reference field for PO numbers, check numbers, etc.',
      'Debit/credit account names shown inline for quick scanning',
      'Account balances update immediately after recording',
    ],
    note: '⚠️ Transactions are immutable and cannot be deleted. To reverse a transaction, record a new one with swapped debit/credit accounts.',
  },
  {
    icon: '🧾',
    title: 'Invoices',
    color: '#F97316',
    intro: 'Invoices represent accounts payable obligations. Each invoice has line items, a due date, a full payment history, and moves through a defined status lifecycle.',
    items: [
      'Status lifecycle: draft → sent → paid / overdue',
      'Line items: description × quantity × unit price (in cents)',
      'Partial payments supported — remainingCents tracks what\'s left',
      'Invoice auto-marks as paid when remainingCents reaches zero',
      'markOverdueInvoices batch-transitions all past-due sent invoices',
    ],
  },
  {
    icon: '💳',
    title: 'Payments',
    color: '#EC4899',
    intro: 'Payments are applied against invoices. Each payment creates a double-entry ledger transaction so the full money trail is always visible and auditable.',
    items: [
      'Every payment links to a ledger transaction (debit payer, credit payee)',
      'Overpayment is prevented — amount cannot exceed remainingCents',
      'Payments on a fully paid invoice are rejected',
      'Idempotency key prevents duplicate charges from webhook retries',
      'Modal auto-generates crypto.randomUUID() — user can override',
      '"Pay in full" shortcut fills the remaining balance automatically',
    ],
  },
  {
    icon: '🔑',
    title: 'Idempotency',
    color: '#A855F7',
    intro: 'Payment webhooks can fire multiple times for the same event. UltraShip uses idempotency keys to guarantee a payment is only applied once, regardless of how many times the request arrives.',
    items: [
      'Every applyPayment call requires a unique idempotencyKey string',
      'Same key = same existing payment returned, no new charge created',
      'UNIQUE constraint on idempotency_key column in SQLite is the safety net',
      "Node's single-threaded event loop serialises concurrent requests at the JS level",
      'Frontend auto-generates a UUID per payment modal open — user can regenerate',
    ],
    code: `# Webhook fires twice — only charged once
applyPayment(invoiceId: "inv-1", amountCents: 5000, idempotencyKey: "evt-webhook-001")
# → Creates payment, charges $50.00

applyPayment(invoiceId: "inv-1", amountCents: 5000, idempotencyKey: "evt-webhook-001")
# → Returns same payment record, no new charge ✓`,
  },
  {
    icon: '📡',
    title: 'GraphQL API',
    color: '#06B6D4',
    intro: 'All data access is through a single GraphQL endpoint. Use the Apollo Sandbox at /graphql to explore and test all queries and mutations interactively.',
    items: [
      'POST /graphql — main GraphQL endpoint',
      'GET /health — service health check with timestamp',
      'GET / — API info and endpoint listing',
      'Introspection enabled — explore schema in Apollo Sandbox',
      'All amounts in integer cents — never floating point',
    ],
    code: `# Example: Create an account
mutation {
  createAccount(name: "Freight Payable", type: liability) {
    id name type balanceCents
  }
}

# Example: Apply a payment
mutation {
  applyPayment(
    invoiceId: "inv-123"
    amountCents: 5000
    idempotencyKey: "evt-abc-001"
  ) {
    id amountCents createdAt
  }
}`,
  },
  {
    icon: '🏗️',
    title: 'Architecture',
    color: '#10B981',
    intro: 'UltraShip uses a clean layered architecture: React frontend → Apollo Client → Express + Apollo Server → sql.js (SQLite WASM) persisted to disk.',
    items: [
      'Frontend: React 18 + Vite + Apollo Client 3 (HttpLink)',
      'Backend: Node.js + Express + Apollo Server 4',
      'Database: sql.js (SQLite compiled to WebAssembly — no native deps)',
      'DB persisted to ledger.db after every committed transaction',
      'CORS: comma-separated CORS_ORIGIN env var for multi-origin support',
      'Deployed: Render (backend) + Vercel (frontend) — auto-deploy on push',
    ],
  },
  {
    icon: '🧪',
    title: 'Tests',
    color: '#F43F5E',
    intro: 'The backend has 25 Jest tests covering all core ledger logic, invoice flow, idempotency, input validation, and ledger balance integrity.',
    items: [
      'Part 1 — Core ledger: account creation, double-entry, balance derivation',
      'Part 2 — Invoice flow: lifecycle, partial payments, overpayment prevention',
      'Part 3 — Race condition guard: concurrent identical keys charge only once',
      'Input validation: blank names, invalid types, negative prices, zero qty',
      'markOverdueInvoices: transitions past-due sent invoices, ignores drafts',
      'Ledger integrity: total debits === total credits across entire ledger',
    ],
    code: `# Run tests
cd backend && npm test

# Expected output
Tests: 25 passed, 25 total`,
  },
];

export default function Docs() {
  const [active, setActive] = useState(null);

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Documentation</div>
          <div className="topbar-subtitle">Learn how to use UltraShip to manage your payments and ledger effectively.</div>
        </div>
        <a
          href="https://ultraship-ledger-api.onrender.com/graphql"
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none' }}
        >
          Open API Sandbox ↗
        </a>
      </div>

      <div className="page">
        {/* Quick links bar */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px',
        }}>
          {SECTIONS.map(s => (
            <button
              key={s.title}
              onClick={() => {
                setActive(s.title === active ? null : s.title);
                document.getElementById(`doc-${s.title}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                background: active === s.title ? s.color : 'var(--surface)',
                border: `1px solid ${active === s.title ? s.color : 'var(--border)'}`,
                borderRadius: '20px',
                padding: '4px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: active === s.title ? '#fff' : 'var(--text-2)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {s.icon} {s.title}
            </button>
          ))}
        </div>

        {/* Card grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px',
        }}>
          {SECTIONS.map(s => (
            <div
              id={`doc-${s.title}`}
              key={s.title}
              style={{
                background: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderRadius: '12px',
                padding: '24px',
                borderTop: `3px solid ${s.color}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: `${s.color}22`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                }}>{s.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{s.title}</span>
              </div>

              {/* Intro */}
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px', lineHeight: 1.6 }}>
                {s.intro}
              </p>

              {/* Items */}
              <ul style={{ paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {s.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)', alignItems: 'flex-start' }}>
                    <span style={{ color: s.color, fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Note */}
              {s.note && (
                <div style={{
                  marginTop: '14px', padding: '10px 12px',
                  background: 'rgba(234,179,8,0.08)', borderLeft: '3px solid var(--yellow)',
                  borderRadius: '4px', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5,
                }}>
                  {s.note}
                </div>
              )}

              {/* Code block */}
              {s.code && (
                <pre style={{
                  marginTop: '14px', background: 'var(--bg-card, #111)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '12px 14px',
                  fontSize: '11.5px', color: '#a5f3fc',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflowX: 'auto', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{s.code}</pre>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '40px', padding: '24px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>UltraShip Payment Ledger</div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              Built with Node.js · Apollo Server · sql.js · React 18 · Vite
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="https://ultra-ship-dev.vercel.app" target="_blank" rel="noreferrer"
              className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Open App ↗
            </a>
            <a href="https://github.com/Gdhanush-13/UltraShip" target="_blank" rel="noreferrer"
              className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              GitHub ↗
            </a>
            <a href="https://ultraship-ledger-api.onrender.com/graphql" target="_blank" rel="noreferrer"
              className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              GraphQL API ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
