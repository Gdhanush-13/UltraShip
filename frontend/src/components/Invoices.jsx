import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import toast from 'react-hot-toast';
import { GET_INVOICES, GET_INVOICE, GET_ACCOUNTS, CREATE_INVOICE, UPDATE_INVOICE_STATUS, APPLY_PAYMENT, MARK_OVERDUE } from '../gql';

function fmt(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.toUpperCase()}</span>;
}

const STATUS_TRANSITIONS = { draft: ['sent'], sent: ['overdue'], overdue: [] };

export default function Invoices({ onNavigate }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);

  const { data, loading, refetch } = useQuery(GET_INVOICES);
  const { data: accData } = useQuery(GET_ACCOUNTS);
  const { data: invDetail, refetch: refetchDetail } = useQuery(GET_INVOICE, {
    variables: { id: selectedId },
    skip: !selectedId,
    fetchPolicy: 'network-only',
  });

  const [createInvoice, { loading: creating }] = useMutation(CREATE_INVOICE);
  const [updateStatus] = useMutation(UPDATE_INVOICE_STATUS);
  const [applyPayment, { loading: paying }] = useMutation(APPLY_PAYMENT);
  const [markOverdue] = useMutation(MARK_OVERDUE);

  const invoices = data?.invoices || [];
  const accounts = accData?.accounts || [];
  const invoice = invDetail?.invoice || null;

  // Create invoice form
  const [form, setForm] = useState({
    payerAccountId: '', payeeAccountId: '', description: '', dueDate: '', currency: 'USD',
    lineItems: [{ description: '', quantity: 1, unitPriceCents: '' }],
  });

  // Payment form — auto-generate idempotency key when modal opens
  const [payForm, setPayForm] = useState({ amountDollars: '', idempotencyKey: '' });

  function openPayModal(invoiceId) {
    setSelectedId(invoiceId);
    setPayForm({ amountDollars: '', idempotencyKey: crypto.randomUUID() });
    setShowPayModal(true);
  }

  function addLineItem() {
    setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', quantity: 1, unitPriceCents: '' }] }));
  }
  function removeLineItem(i) {
    setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));
  }
  function updateLineItem(i, field, val) {
    setForm(f => {
      const li = [...f.lineItems];
      li[i] = { ...li[i], [field]: val };
      return { ...f, lineItems: li };
    });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.payerAccountId || !form.payeeAccountId) return toast.error('Select both payer and payee accounts');
    if (form.payerAccountId === form.payeeAccountId) return toast.error('Payer and payee must differ');
    const lineItems = form.lineItems.map(li => ({
      description: li.description,
      quantity: parseInt(li.quantity),
      unitPriceCents: Math.round(parseFloat(li.unitPriceCents) * 100),
    }));
    if (lineItems.some(li => !li.description || isNaN(li.unitPriceCents) || li.unitPriceCents <= 0)) {
      return toast.error('Fill in all line items with valid prices');
    }
    try {
      await createInvoice({ variables: { ...form, lineItems } });
      toast.success('Invoice created');
      setShowCreate(false);
      setForm({ payerAccountId: '', payeeAccountId: '', description: '', dueDate: '', currency: 'USD', lineItems: [{ description: '', quantity: 1, unitPriceCents: '' }] });
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await updateStatus({ variables: { id, status } });
      toast.success(`Invoice marked as ${status}`);
      refetch();
      if (selectedId === id) refetchDetail();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleMarkOverdue() {
    try {
      const { data } = await markOverdue();
      toast.success(`${data.markOverdueInvoices} invoice(s) marked overdue`);
      refetch();
      if (selectedId) refetchDetail();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function gqlError(err) {
    const msg = err?.graphQLErrors?.[0]?.message || err?.message || 'Unknown error';
    return msg.replace(/^.*?:\s*/, '');
  }

  async function handlePayment(e) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(payForm.amountDollars) * 100);
    if (!amountCents || amountCents <= 0) return toast.error('Enter a valid amount');
    if (!payForm.idempotencyKey.trim()) return toast.error('Idempotency key required');
    try {
      await applyPayment({ variables: { invoiceId: selectedId, amountCents, idempotencyKey: payForm.idempotencyKey.trim() } });
      toast.success('Payment applied');
      setShowPayModal(false);
      setPayForm({ amountDollars: '', idempotencyKey: '' });
      refetch();
      refetchDetail();
    } catch (err) {
      toast.error(gqlError(err));
    }
  }

  const selectedInvoice = invoices.find(i => i.id === selectedId);

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Invoices</div>
          <div className="topbar-subtitle">Accounts Payable · Draft → Sent → Paid / Overdue</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary" onClick={() => onNavigate('docs')}>
            <DocsIcon /> Docs
          </button>
          <button className="btn btn-secondary" onClick={handleMarkOverdue}>Mark Overdue</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <PlusIcon /> New Invoice
          </button>
        </div>
      </div>

      <div className="page" style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 420px' : '1fr', gap: '20px' }}>
        {/* List */}
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">All Invoices</div>
                <div className="card-subtitle">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {loading ? (
              <div className="loading-center"><span className="spinner" /> Loading…</div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧾</div>
                <div className="empty-state-text">No invoices yet. Create your first one.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Payer</th>
                      <th>Total</th>
                      <th>Remaining</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} onClick={() => setSelectedId(inv.id === selectedId ? null : inv.id)} style={{ cursor: 'pointer', background: inv.id === selectedId ? 'var(--surface-2)' : '' }}>
                        <td className="bold">{inv.description}</td>
                        <td>{inv.payerAccount?.name}</td>
                        <td>{fmt(inv.totalCents)}</td>
                        <td className={inv.remainingCents > 0 ? 'amount-negative' : 'amount-positive'}>
                          {fmt(inv.remainingCents)}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-3)' }}>{inv.dueDate}</td>
                        <td><StatusBadge status={inv.status} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          {STATUS_TRANSITIONS[inv.status]?.map(next => (
                            <button key={next} className="btn btn-secondary btn-sm" style={{ marginRight: '4px' }}
                              onClick={() => handleStatusChange(inv.id, next)}>
                              → {next}
                            </button>
                          ))}
                          {['sent', 'overdue'].includes(inv.status) && inv.remainingCents > 0 && (
                            <button className="btn btn-success btn-sm" onClick={() => openPayModal(inv.id)}>
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedId && invoice && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Invoice Detail</div>
                  <div className="card-subtitle" style={{ fontFamily: 'monospace', fontSize: '10px' }}>{invoice.id}</div>
                </div>
                <button className="modal-close" onClick={() => setSelectedId(null)}>×</button>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <label>Status</label>
                  <p><StatusBadge status={invoice.status} /></p>
                </div>
                <div className="detail-item">
                  <label>Due Date</label>
                  <p>{invoice.dueDate}</p>
                </div>
                <div className="detail-item">
                  <label>Payer</label>
                  <p>{invoice.payerAccount?.name}</p>
                </div>
                <div className="detail-item">
                  <label>Payee</label>
                  <p>{invoice.payeeAccount?.name}</p>
                </div>
              </div>

              {/* Payment progress */}
              <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--dark-3)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Payment Progress</span>
                  <span style={{ fontSize: '12px', fontWeight: '700' }}>
                    {fmt(invoice.paidCents)} / {fmt(invoice.totalCents)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${invoice.totalCents > 0 ? Math.min(100, (invoice.paidCents / invoice.totalCents) * 100) : 0}%` }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>
                  {fmt(invoice.remainingCents)} remaining
                </div>
              </div>

              {/* Line items */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line Items</div>
                {invoice.lineItems.map(li => (
                  <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{li.description}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{li.quantity} × {fmt(li.unitPriceCents)}</div>
                    </div>
                    <div style={{ fontWeight: '700' }}>{fmt(li.amountCents)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: '700' }}>
                  <span>Total</span>
                  <span>{fmt(invoice.totalCents)}</span>
                </div>
              </div>

              {/* Payments */}
              {invoice.payments.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment History</div>
                  {invoice.payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--green)' }}>{fmt(p.amountCents)}</div>
                        <div style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: '10px' }}>{p.idempotencyKey}</div>
                      </div>
                      <div style={{ color: 'var(--text-3)' }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {['sent', 'overdue'].includes(invoice.status) && invoice.remainingCents > 0 && (
                <button className="btn btn-success" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
                  onClick={() => openPayModal(invoice.id)}>
                  Apply Payment
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              New Invoice
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Description</label>
                <input placeholder="e.g. Freight Invoice #001" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Payer Account (AP)</label>
                  <select value={form.payerAccountId} onChange={e => setForm(f => ({ ...f, payerAccountId: e.target.value }))} required>
                    <option value="">Select payer…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payee Account (Receives payment)</label>
                  <select value={form.payeeAccountId} onChange={e => setForm(f => ({ ...f, payeeAccountId: e.target.value }))} required>
                    <option value="">Select payee…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>LINE ITEMS</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addLineItem}>+ Add</button>
                </div>
                {form.lineItems.map((li, i) => (
                  <div key={i} className="line-item-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input placeholder="Description" value={li.description}
                        onChange={e => updateLineItem(i, 'description', e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input type="number" min="1" placeholder="Qty" value={li.quantity}
                        onChange={e => updateLineItem(i, 'quantity', e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input type="number" min="0.01" step="0.01" placeholder="Unit price $"
                        value={li.unitPriceCents}
                        onChange={e => updateLineItem(i, 'unitPriceCents', e.target.value)} required />
                    </div>
                    <button type="button" className="btn btn-danger btn-sm"
                      style={{ marginBottom: 0 }}
                      disabled={form.lineItems.length === 1}
                      onClick={() => removeLineItem(i)}>✕</button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: 'var(--text)', marginTop: '8px' }}>
                  Total: {fmt(form.lineItems.reduce((s, li) => s + (parseFloat(li.unitPriceCents) * parseInt(li.quantity) || 0) * 100, 0))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <span className="spinner" /> : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Apply Payment
              <button className="modal-close" onClick={() => setShowPayModal(false)}>×</button>
            </div>
            <div style={{ background: 'var(--dark-3)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }}>{selectedInvoice.description}</div>
              <div style={{ fontSize: '20px', fontWeight: '800' }}>{fmt(selectedInvoice.remainingCents)} <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-2)' }}>remaining</span></div>
            </div>
            <form onSubmit={handlePayment}>
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Amount (USD)
                  <button type="button" className="btn btn-secondary btn-sm"
                    style={{ fontSize: '10px', padding: '2px 8px' }}
                    onClick={() => setPayForm(f => ({ ...f, amountDollars: (selectedInvoice.remainingCents / 100).toFixed(2) }))}
                  >Pay in full</button>
                </label>
                <input type="number" min="0.01" step="0.01"
                  placeholder={`Max ${fmt(selectedInvoice.remainingCents)}`}
                  value={payForm.amountDollars}
                  onChange={e => setPayForm(f => ({ ...f, amountDollars: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Idempotency Key
                  <button type="button" className="btn btn-secondary btn-sm"
                    style={{ fontSize: '10px', padding: '2px 8px' }}
                    onClick={() => setPayForm(f => ({ ...f, idempotencyKey: crypto.randomUUID() }))}
                  >Regenerate</button>
                </label>
                <input
                  value={payForm.idempotencyKey}
                  onChange={e => setPayForm(f => ({ ...f, idempotencyKey: e.target.value }))} required />
                <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                  Auto-generated · same key = same payment, never double-charged
                </span>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={paying}>
                  {paying ? <span className="spinner" /> : 'Apply Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DocsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
