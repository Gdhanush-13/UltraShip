# UltraShip — Mini Payment Ledger & Invoice Service

A full-stack Accounts Payable payment processing module for a Transportation Management System (TMS).

**Stack:** Node.js · Apollo Server 4 (GraphQL) · sql.js (SQLite WASM) · React 18 · Vite · Apollo Client

---

## How to Run Locally

**Prerequisites:** Node.js ≥ 18, npm

```bash
# 1. Backend  →  http://localhost:4000/graphql
cd backend && npm install && npm start

# 2. Frontend →  http://localhost:3000
cd frontend && npm install && npm run dev

# 3. Tests (15/15)
cd backend && npm test
```

---

## Architecture

### 1 — System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                         │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              React 18 + Vite  (port 3000)                │  │
│   │                                                          │  │
│   │  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐  │  │
│   │  │  Dashboard  │  │   Accounts /  │  │   Invoices /  │  │  │
│   │  │  (overview) │  │  Transactions │  │   Payments    │  │  │
│   │  └─────────────┘  └───────────────┘  └───────────────┘  │  │
│   │                                                          │  │
│   │              Apollo Client  (gql.js)                     │  │
│   └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────-│───────────────────────────────────────┘
                           │  HTTP POST /graphql
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Node.js + Express  (port 4000)                   │
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │               Apollo Server 4  (GraphQL)                   │ │
│   │                                                            │ │
│   │   schema.js ──► typeDefs (types, queries, mutations)       │ │
│   │   resolvers.js ─► business logic layer                     │ │
│   │        │                                                   │ │
│   │        ▼                                                   │ │
│   │   db.js  (queryOne · queryAll · run · execTransaction)     │ │
│   └────────────────────────┬───────────────────────────────────┘ │
└───────────────────────────-│──────────────────────────────────────┘
                             │  sql.js (SQLite WASM)
                             ▼
                    ┌─────────────────┐
                    │   ledger.db     │  ← persisted to disk after
                    │  (SQLite file)  │    every committed transaction
                    └─────────────────┘
```

---

### 2 — Request / Response Flow

```
Browser                 Apollo Client           Apollo Server          SQLite (sql.js)
   │                        │                        │                      │
   │──── user action ───────►│                        │                      │
   │                        │── HTTP POST /graphql ──►│                      │
   │                        │   { query, variables }  │                      │
   │                        │                        │── execTransaction() ──►│
   │                        │                        │    BEGIN               │
   │                        │                        │    INSERT / UPDATE     │
   │                        │                        │    COMMIT              │
   │                        │                        │◄── rows ───────────────│
   │                        │                        │── saveToFile() ────────►│ (export WASM → disk)
   │                        │◄── { data / errors } ──│                      │
   │◄─── re-render ─────────│                        │                      │
```

---

### 3 — Database Schema

```
┌──────────────────────────────┐
│           accounts           │
├──────────────────────────────┤
│ id          TEXT  PK         │
│ name        TEXT  NOT NULL   │
│ type        TEXT             │  asset | liability | equity
│ currency    TEXT  DEFAULT USD│    revenue | expense
│ created_at  TEXT             │
└──────────────┬───────────────┘
               │ 1
               │           ┌────────────────────────────────┐
               │           │       ledger_transactions       │
               │           ├────────────────────────────────┤
               │           │ id           TEXT  PK          │
               │           │ description  TEXT  NOT NULL    │
               │           │ reference    TEXT  (nullable)  │
               │           │ created_at   TEXT              │
               │           └────────────────┬───────────────┘
               │ N                          │ 1
               │                           │ N (always exactly 2 per txn)
               │           ┌───────────────▼────────────────┐
               │           │         ledger_entries          │
               │           ├────────────────────────────────┤
               └───────────┤ account_id   TEXT  FK          │
                           │ transaction_id TEXT FK         │
                           │ amount_cents INTEGER NOT NULL  │  ← integer, no float
                           │ entry_type   TEXT              │  debit | credit
                           │ created_at   TEXT              │
                           └────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                         invoices                         │
├──────────────────────────────────────────────────────────┤
│ id                TEXT  PK                               │
│ payer_account_id  TEXT  FK → accounts.id                 │
│ payee_account_id  TEXT  FK → accounts.id                 │
│ description       TEXT  NOT NULL                         │
│ due_date          TEXT  NOT NULL                         │
│ status            TEXT  draft|sent|paid|overdue          │
│ currency          TEXT  DEFAULT USD                      │
│ created_at        TEXT                                   │
└────────────────────────────┬─────────────────────────────┘
                             │ 1
          ┌──────────────────┴──────────────────┐
          │ N                                   │ N
┌─────────▼──────────────┐         ┌────────────▼───────────────────┐
│   invoice_line_items   │         │        invoice_payments         │
├────────────────────────┤         ├────────────────────────────────┤
│ id           TEXT PK   │         │ id              TEXT  PK       │
│ invoice_id   TEXT FK   │         │ invoice_id      TEXT  FK       │
│ description  TEXT      │         │ transaction_id  TEXT  FK       │  → ledger_transactions
│ quantity     INTEGER   │         │ amount_cents    INTEGER        │
│ unit_price_cents INT   │         │ idempotency_key TEXT  UNIQUE   │  ← race condition guard
│ amount_cents INTEGER   │         │ created_at      TEXT           │
└────────────────────────┘         └────────────────────────────────┘
   total = SUM(amount_cents)          paid = SUM(amount_cents)
   balance = total − paid             (derived, never cached)
```

---

### 4 — Double-Entry Ledger Model

Every `recordTransaction` or `applyPayment` call writes **exactly 2 rows** to `ledger_entries` — one debit, one credit. The ledger is **append-only**.

```
Example: Apply $115 payment for freight invoice
─────────────────────────────────────────────────────────────────

  ledger_transactions
  ┌─────────────────────────────────────────────────────────┐
  │  id: txn-001   description: "Payment for invoice #INV1" │
  └─────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
  ledger_entries (DEBIT)          ledger_entries (CREDIT)
  ┌───────────────────────┐       ┌───────────────────────┐
  │ account: Payer Corp   │       │ account: UltraShip    │
  │ entry_type: debit     │       │ entry_type: credit    │
  │ amount_cents: 11500   │       │ amount_cents: 11500   │
  └───────────────────────┘       └───────────────────────┘

Account Balance formula (never stored, always computed):
  balance = SUM(debit entries) − SUM(credit entries)
            WHERE account_id = ?

  → Payer Corp  balance: −11500  (money went out)
  → UltraShip   balance: +11500  (money came in)
```

---

### 5 — Invoice Payment State Machine

```
  ┌─────────┐   sendInvoice()   ┌─────────┐
  │  draft  │ ─────────────────► │  sent  │
  └─────────┘                   └────┬────┘
                                     │                  ┌──────────────────────────────┐
                         applyPayment│                  │  applyPayment() guards:      │
                         (partial or │                  │                              │
                          full)      │                  │  1. status ∈ {sent,overdue}  │
                                     │                  │  2. amount ≤ remaining       │
                    ┌────────────────┤                  │  3. idempotency_key UNIQUE   │
                    │                │                  │     → returns same record    │
                    ▼                ▼                  │     on duplicate webhook     │
               ┌─────────┐    ┌──────────┐             └──────────────────────────────┘
               │  paid   │    │ overdue  │
               │ (auto   │    │(due_date │
               │ when    │◄───│ < today) │
               │ paid=   │    └──────────┘
               │ total)  │
               └─────────┘
                (terminal)

  Partial payment example  (invoice total = $115.00):
  ─────────────────────────────────────────────────────
  Payment #1  key=evt-001  amount=$50.00  → remaining=$65.00  status=sent
  Payment #2  key=evt-001  amount=$50.00  → IDEMPOTENT (same record returned)
  Payment #2  key=evt-002  amount=$65.00  → remaining=$0.00   status=paid ✓
  Payment #3  key=evt-003  amount=$1.00   → ERROR: status is paid, rejected ✗
```

---

### 6 — Project File Structure

```
UltraShip/
├── README.md
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js       Express + Apollo Server, awaits initDb()
│   │   ├── schema.js       GraphQL typeDefs (SDL)
│   │   ├── resolvers.js    All query/mutation resolvers + business rules
│   │   └── db.js           sql.js init, helpers (queryOne/queryAll/run/
│   │                       execTransaction), file persistence
│   └── tests/
│       └── ledger.test.js  Jest — 15 tests (Parts 1, 2, 3)
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx         Apollo Client setup
        ├── App.jsx          Sidebar nav shell
        ├── gql.js           All GQL queries & mutations
        ├── index.css        Design system (ultraship.ai dark theme)
        └── components/
            ├── Dashboard.jsx    Stats, recent transactions, balances
            ├── Accounts.jsx     Chart of accounts, create modal
            ├── Transactions.jsx Double-entry recorder, full log
            └── Invoices.jsx     Invoice lifecycle, detail panel,
                                 payment modal (idempotency key input)
```

---

## What's Implemented

### Part 1 — Core Ledger ✅
- Create accounts (asset, liability, equity, revenue, expense)
- Record **double-entry transactions** — every debit has a matching credit
- **Balances never stored** — derived from `SUM(debit) - SUM(credit)` on `ledger_entries`
- All amounts in **integer cents** — no floating point anywhere

### Part 2 — Invoice Flow ✅
- Create invoices with multiple line items (`quantity × unit_price_cents`)
- Status lifecycle: `draft → sent → paid / overdue`
- Full and **partial payments**
- **Overpayment prevention**: rejected if `payment > remaining`
- **Idempotency key** per payment: webhook double-fire returns the same record, no second charge
- Auto-marks invoice `paid` when fully settled
- `markOverdueInvoices` mutation batch-transitions sent+past-due invoices

### Part 3 — Edge Case: Idempotency / Race Condition Guard ✅
Every payment carries a caller-supplied `idempotencyKey`. Inside a SQLite transaction:
1. Check if key already exists → return existing record immediately
2. If not, insert payment + double-entry ledger rows, then commit

`UNIQUE(idempotency_key)` is the final safety net. Node's single-threaded event loop serialises concurrent requests, so no two transactions can interleave at the JS level.

---

## Shortcuts Taken

1. **sql.js (SQLite WASM) over PostgreSQL** — Zero native compilation, zero config. Production would use PostgreSQL with `SELECT ... FOR UPDATE` row locking for true multi-process concurrency.
2. **No authentication** — No JWT/session layer. Production gates every mutation behind auth middleware.
3. **No pagination** — All lists return all rows. Real system needs cursor-based pagination.
4. **No soft-delete / deactivation** — Ledger entries are correctly append-only; accounts/invoices lack a deactivation flow.
5. **Hardcoded API URL** — Frontend points at `localhost:4000`. Production uses env vars + reverse proxy.

---

## What I'd Do Differently With More Time

1. **PostgreSQL + Prisma** with `SELECT FOR UPDATE` for genuine multi-process concurrent payment safety
2. **Refund flow** — Reverse a payment with a new double-entry (credit payer, debit payee) keeping the ledger balanced at all times
3. **Multi-currency** — Fixed exchange rate table; convert at payment time; record FX gain/loss as separate ledger entries
4. **Webhook event log** — Persist raw webhook payloads before processing; enables replay and dead-letter queue
5. **Cursor-based pagination + full-text search** on all list views
6. **E2E tests** with Playwright covering the full invoice payment flow in the browser
7. **CI/CD** — GitHub Actions: lint → test → build → deploy on every PR
