import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import toast from 'react-hot-toast';
import { GET_TRANSACTIONS, GET_ACCOUNTS, RECORD_TRANSACTION } from '../gql';

function fmt(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function Transactions() {
  const [showModal, setShowModal] = useState(false);
  const { data, loading, refetch } = useQuery(GET_TRANSACTIONS);
  const { data: accData, refetch: refetchAccounts } = useQuery(GET_ACCOUNTS);
  const [recordTxn, { loading: recording }] = useMutation(RECORD_TRANSACTION);

  const [form, setForm] = useState({
    debitAccountId: '', creditAccountId: '', amountDollars: '', description: '', reference: '',
  });

  const txns = data?.ledgerTransactions || [];
  const accounts = accData?.accounts || [];

  async function handleRecord(e) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
    if (!amountCents || amountCents <= 0) return toast.error('Enter a valid positive amount');
    if (!form.debitAccountId || !form.creditAccountId) return toast.error('Select both accounts');
    if (form.debitAccountId === form.creditAccountId) return toast.error('Debit and credit accounts must differ');
    try {
      await recordTxn({
        variables: {
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          amountCents,
          description: form.description,
          reference: form.reference || undefined,
        },
      });
      toast.success('Transaction recorded');
      setForm({ debitAccountId: '', creditAccountId: '', amountDollars: '', description: '', reference: '' });
      setShowModal(false);
      refetch();
      refetchAccounts();
    } catch (err) {
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || 'Error';
      toast.error(msg);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Ledger Transactions</div>
          <div className="topbar-subtitle">All double-entry accounting transactions — every debit has a matching credit</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <PlusIcon /> Record Transaction
          </button>
        </div>
      </div>

      <div className="page">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Transaction Log</div>
              <div className="card-subtitle">{txns.length} transaction{txns.length !== 1 ? 's' : ''} · Amounts stored in cents, no floating point</div>
            </div>
          </div>
          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading…</div>
          ) : txns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📒</div>
              <div className="empty-state-text">No transactions yet. Record your first double-entry transaction.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Debit Account</th>
                    <th>Credit Account</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(t => {
                    const debit = t.entries.find(e => e.entryType === 'debit');
                    const credit = t.entries.find(e => e.entryType === 'credit');
                    return (
                      <tr key={t.id}>
                        <td className="bold">{t.description}</td>
                        <td className="mono" style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                          {t.reference || '—'}
                        </td>
                        <td>
                          <span style={{ color: 'var(--yellow)' }}>Dr</span>{' '}
                          {debit?.account?.name || '—'}
                        </td>
                        <td>
                          <span style={{ color: 'var(--green)' }}>Cr</span>{' '}
                          {credit?.account?.name || '—'}
                        </td>
                        <td className="amount-positive">{debit ? fmt(debit.amountCents) : '—'}</td>
                        <td style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Record Double-Entry Transaction
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecord}>
              <div className="form-group">
                <label>Description</label>
                <input
                  placeholder="e.g. Freight payment to carrier"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Debit Account <span style={{ color: 'var(--yellow)' }}>(Dr)</span></label>
                  <select value={form.debitAccountId} onChange={e => setForm(f => ({ ...f, debitAccountId: e.target.value }))} required>
                    <option value="">Select account…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Credit Account <span style={{ color: 'var(--green)' }}>(Cr)</span></label>
                  <select value={form.creditAccountId} onChange={e => setForm(f => ({ ...f, creditAccountId: e.target.value }))} required>
                    <option value="">Select account…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Amount (USD)</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    placeholder="0.00"
                    value={form.amountDollars}
                    onChange={e => setForm(f => ({ ...f, amountDollars: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Reference (optional)</label>
                  <input
                    placeholder="PO#, check number, etc."
                    value={form.reference}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={recording}>
                  {recording ? <span className="spinner" /> : 'Record Transaction'}
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
