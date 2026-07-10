import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import Accounts from './components/Accounts';
import Transactions from './components/Transactions';
import Invoices from './components/Invoices';

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
];

const PAGES = { dashboard: Dashboard, accounts: Accounts, transactions: Transactions, invoices: Invoices };

export default function App() {
  const [page, setPage] = useState('dashboard');
  const Page = PAGES[page] || Dashboard;

  return (
    <div className="layout">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1F2937', color: '#F9FAFB', border: '1px solid #2D3A55' } }} />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">US</div>
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
          Payment Ledger v1.0 · TMS Module
        </div>
      </aside>

      <div className="main-content">
        <Page onNavigate={setPage} />
      </div>
    </div>
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
