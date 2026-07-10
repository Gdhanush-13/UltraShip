import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import toast from 'react-hot-toast';
import { GET_ACCOUNTS, CREATE_ACCOUNT } from '../gql';

function fmt(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function Accounts() {
  const [showModal, setShowModal] = useState(false);
  const { data, loading, refetch } = useQuery(GET_ACCOUNTS);
  const [createAccount, { loading: creating }] = useMutation(CREATE_ACCOUNT);

  const [form, setForm] = useState({ name: '', type: 'asset', currency: 'USD' });

  const accounts = data?.accounts || [];

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Account name required');
    try {
      await createAccount({ variables: { name: form.name.trim(), type: form.type, currency: form.currency } });
      toast.success('Account created');
      setForm({ name: '', type: 'asset', currency: 'USD' });
      setShowModal(false);
      refetch();
    } catch (err) {
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || 'Error';
      toast.error(msg);
    }
  }

  const byType = accounts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || []).concat(a);
    return acc;
  }, {});

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Chart of Accounts</div>
          <div className="topbar-subtitle">Double-entry ledger accounts — balances derived from transaction entries</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <PlusIcon /> New Account
          </button>
        </div>
      </div>

      <div className="page">
        {loading ? (
          <div className="loading-center"><span className="spinner" /> Loading accounts…</div>
        ) : accounts.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🏦</div>
              <div className="empty-state-text">No accounts yet. Create your first ledger account.</div>
            </div>
          </div>
        ) : (
          Object.entries(byType).map(([type, accs]) => (
            <div className="card" key={type}>
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ textTransform: 'capitalize' }}>{type} Accounts</div>
                  <div className="card-subtitle">{accs.length} account{accs.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Type</th>
                      <th>Currency</th>
                      <th>Balance (Debit − Credit)</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map(a => (
                      <tr key={a.id}>
                        <td className="bold">{a.name}</td>
                        <td><span className={`badge badge-${a.type}`}>{a.type}</span></td>
                        <td>{a.currency}</td>
                        <td className={a.balanceCents >= 0 ? 'amount-positive' : 'amount-negative'}>
                          {fmt(a.balanceCents)}
                        </td>
                        <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              New Ledger Account
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Account Name</label>
                <input
                  placeholder="e.g. Accounts Payable, Cash, Revenue"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Account Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <span className="spinner" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
