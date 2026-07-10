import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_ACCOUNTS, GET_INVOICES, GET_TRANSACTIONS } from '../gql';

function fmt(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function Dashboard({ onNavigate }) {
  const { data: accData } = useQuery(GET_ACCOUNTS);
  const { data: invData } = useQuery(GET_INVOICES);
  const { data: txnData } = useQuery(GET_TRANSACTIONS);

  const accounts = accData?.accounts || [];
  const invoices = invData?.invoices || [];
  const txns = txnData?.ledgerTransactions || [];

  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((s, a) => s + a.balanceCents, 0);
  const openInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const openAmount = openInvoices.reduce((s, i) => s + i.remainingCents, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-subtitle">Payment Ledger & Accounts Payable Overview</div>
        </div>
      </div>
      <div className="page">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Accounts</div>
            <div className="stat-value">{accounts.length}</div>
            <div className="stat-change">Active ledger accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Asset Balance</div>
            <div className="stat-value" style={{ fontSize: '20px' }}>{fmt(totalAssets)}</div>
            <div className="stat-change">Derived from entries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Open Invoices</div>
            <div className="stat-value">{openInvoices.length}</div>
            {overdueInvoices.length > 0 && (
              <div className="stat-change" style={{ color: 'var(--red)' }}>{overdueInvoices.length} overdue</div>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-label">Outstanding AP</div>
            <div className="stat-value" style={{ fontSize: '20px' }}>{fmt(openAmount)}</div>
            <div className="stat-change">Pending collection</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Recent Transactions</div>
                <div className="card-subtitle">Last {Math.min(txns.length, 5)} ledger entries</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('transactions')}>View all</button>
            </div>
            {txns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📒</div>
                <div className="empty-state-text">No transactions yet</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Entries</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.slice(0, 5).map(t => (
                      <tr key={t.id}>
                        <td className="bold">{t.description}</td>
                        <td>{t.entries.length}</td>
                        <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Recent Invoices</div>
                <div className="card-subtitle">Latest accounts payable</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('invoices')}>View all</button>
            </div>
            {invoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧾</div>
                <div className="empty-state-text">No invoices yet</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 5).map(inv => (
                      <tr key={inv.id}>
                        <td className="bold">{inv.description.length > 24 ? inv.description.slice(0, 24) + '…' : inv.description}</td>
                        <td>{fmt(inv.totalCents)}</td>
                        <td><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="card" style={{ marginTop: '0' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Account Balances</div>
                <div className="card-subtitle">Derived from double-entry ledger — never stored directly</div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Account</th><th>Type</th><th>Currency</th><th>Balance (debit − credit)</th></tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td className="bold">{a.name}</td>
                      <td><span className={`badge badge-${a.type}`}>{a.type}</span></td>
                      <td>{a.currency}</td>
                      <td className={a.balanceCents >= 0 ? 'amount-positive' : 'amount-negative'}>{fmt(a.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
