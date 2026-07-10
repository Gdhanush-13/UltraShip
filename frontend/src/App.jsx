import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import Accounts from './components/Accounts';
import Transactions from './components/Transactions';
import Invoices from './components/Invoices';
import Docs from './components/Docs';

const NAV = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    ],
  },
  {
    section: 'Ledger',
    items: [
      { id: 'accounts', label: 'Accounts', icon: <IconAccounts /> },
      { id: 'transactions', label: 'Transactions', icon: <IconTxn /> },
    ],
  },
  {
    section: 'Accounts Payable',
    items: [
      { id: 'invoices', label: 'Invoices', icon: <IconInvoice /> },
    ],
  },
  {
    section: 'Help',
    items: [
      { id: 'docs', label: 'Docs', icon: <IconDocs /> },
    ],
  },
];

const PAGES = { dashboard: Dashboard, accounts: Accounts, transactions: Transactions, invoices: Invoices, docs: Docs };

export default function App() {
  const [page, setPage] = useState('dashboard');
  const Page = PAGES[page] || Dashboard;

  return (
    <div className="layout">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1F2937', color: '#F9FAFB', border: '1px solid #2D3A55' } }} />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="4" width="14" height="19" rx="2" fill="white" opacity="0.9"/>
              <rect x="7" y="5" width="2" height="17" rx="1" fill="#6C63FF" opacity="0.35"/>
              <rect x="11" y="9" width="6" height="1.5" rx="0.75" fill="#0047FF" opacity="0.5"/>
              <rect x="11" y="12" width="4.5" height="1.5" rx="0.75" fill="#0047FF" opacity="0.4"/>
              <rect x="11" y="15" width="6" height="1.5" rx="0.75" fill="#0047FF" opacity="0.5"/>
              <circle cx="23" cy="23" r="7" fill="#00C2FF"/>
              <text x="23" y="27" textAnchor="middle" fontFamily="Arial" fontSize="9" fontWeight="bold" fill="white">$</text>
            </svg>
          </div>
          <span className="sidebar-logo-text">Ultra<span>Ship</span></span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(section => (
            <div key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(item => (
                <button
                  key={item.id}
                  className={`nav-item${page === item.id ? ' active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: '4px' }}>Payment Ledger v1.0</div>
          <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>TMS · Accounts Payable Module</div>
        </div>
      </aside>

      <div className="main-content">
        {/* Docs shortcut in top-right topbar area */}
        <div style={{
          position: 'fixed', top: '12px', right: '20px', zIndex: 200,
        }}>
          <button
            onClick={() => setPage('docs')}
            style={{
              background: page === 'docs' ? 'var(--primary)' : 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: page === 'docs' ? '#fff' : 'var(--text-2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <IconDocs size={14} /> Docs
          </button>
        </div>
        <Page onNavigate={setPage} />
      </div>
    </div>
  );
}

function IconDocs({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconAccounts() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}
function IconTxn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}
function IconInvoice() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
