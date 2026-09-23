import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Users,
  CalendarCheck,
  Bell,
  LogOut,
  UserCheck,
  PlusCircle,
  Menu,
  X,
  Printer,
  Smartphone,
  Laptop,
  Tv,
  BarChart3
} from 'lucide-react';

import DashboardView from './views/DashboardView';
import LoansView from './views/LoansView';
import ClientsView from './views/ClientsView';
import CollectionsView from './views/CollectionsView';
import ReportsView from './views/ReportsView';

import NewLoanModal from './components/NewLoanModal';
import NewClientModal from './components/NewClientModal';
import EditClientModal from './components/EditClientModal';
import EditLoanModal from './components/EditLoanModal';
import PaymentModal from './components/PaymentModal';
import LoanDetailModal from './components/LoanDetailModal';
import ThermalReceipt from './components/ThermalReceipt';
import NotificationCenter from './components/NotificationCenter';

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('loan_token') || '');
  const [currentUser, setCurrentUser] = useState(
    JSON.parse(localStorage.getItem('loan_user') || 'null')
  );

  // Login form state
  const [loginUsername, setLoginUsername] = useState('owner');
  const [loginPassword, setLoginPassword] = useState('owner123');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App navigation
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'loans' | 'clients' | 'collections'
  const [isTvMode, setIsTvMode] = useState(false);

  // Data state
  const [metrics, setMetrics] = useState({});
  const [loans, setLoans] = useState([]);
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [reminders, setReminders] = useState({ due_today: [], overdue: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState(null);
  const [selectedLoanIdForDetail, setSelectedLoanIdForDetail] = useState(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState(null);
  const [selectedLoanForEdit, setSelectedLoanForEdit] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);


  const isOwner = (currentUser?.role || '').toUpperCase() === 'OWNER';

  // Auto-login on very first visit only; respect explicit logout
  useEffect(() => {
    const hasExplicitlyLoggedOut = localStorage.getItem('loan_logged_out') === 'true';
    if (token) {
      loadAllData();
    } else if (!hasExplicitlyLoggedOut && !localStorage.getItem('loan_token')) {
      // First visit convenience login
      handleLogin('owner', 'owner123');
    }
  }, [token]);

  // If user is Agent and view is on reports, switch immediately to dashboard
  useEffect(() => {
    if (currentUser && !isOwner && currentView === 'reports') {
      setCurrentView('dashboard');
    }
  }, [currentUser, isOwner, currentView]);

  // Smart TV real-time auto-polling
  useEffect(() => {
    if (!token || !isTvMode) return;
    const interval = setInterval(() => {
      loadAllData();
    }, 15000);
    return () => clearInterval(interval);
  }, [token, isTvMode]);

  const handleLogin = async (usr, pwd) => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      localStorage.removeItem('loan_logged_out');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usr || loginUsername,
          password: pwd || loginPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('loan_token', data.token);
      localStorage.setItem('loan_user', JSON.stringify(data.user));
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.setItem('loan_logged_out', 'true');
    setToken('');
    setCurrentUser(null);
    localStorage.removeItem('loan_token');
    localStorage.removeItem('loan_user');
    setCurrentView('dashboard');
  };

  const quickSwitchUser = (targetRole) => {
    if (targetRole === 'OWNER') {
      handleLogin('owner', 'owner123');
    } else {
      if (currentView === 'reports') setCurrentView('dashboard');
      handleLogin('agent1', 'agent123');
    }
  };

  const loadAllData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Parallel data fetch
      const [dashRes, loansRes, clientsRes, remindersRes] = await Promise.all([
        fetch('/api/dashboard', { headers }),
        fetch('/api/loans', { headers }),
        fetch('/api/clients', { headers }),
        fetch('/api/reminders', { headers })
      ]);

      const [dashData, loansData, clientsData, remindersData] = await Promise.all([
        dashRes.json(),
        loansRes.json(),
        clientsRes.json(),
        remindersRes.json()
      ]);

      if (dashData.metrics) setMetrics(dashData.metrics);
      if (loansData.loans) setLoans(loansData.loans);
      if (clientsData.clients) setClients(clientsData.clients);
      if (remindersData) setReminders(remindersData);

      // If owner, also fetch agents list for loan assignments
      if (currentUser?.role === 'OWNER') {
        const usersRes = await fetch('/api/users', { headers });
        const usersData = await usersRes.json();
        if (usersData.users) setAgents(usersData.users);
      }
    } catch (err) {
      console.error('Error fetching application data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Payment completed handler
  const handlePaymentSuccess = (receipt) => {
    setSelectedLoanForPayment(null);
    setActiveReceipt(receipt);
    loadAllData(); // Refresh metrics and balances
  };

  const reminderCount = (reminders?.due_today?.length || 0) + (reminders?.overdue?.length || 0);

  // If not logged in, render authentication page
  if (!token || !currentUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'radial-gradient(circle at center, #1e293b 0%, #090d16 100%)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(17, 24, 39, 0.85)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px',
          backdropFilter: 'blur(16px)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div className="brand-logo" style={{ margin: '0 auto 16px', width: '54px', height: '54px' }}>
              <CreditCard size={28} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f8fafc', marginBottom: '6px' }}>LoanPro Manager</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              58-Installment Micro Loans & Field Collection PWA
            </p>
          </div>

          {loginError && (
            <div style={{
              background: 'var(--danger-bg)',
              color: '#f87171',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px',
              fontSize: '0.85rem'
            }}>
              {loginError}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Terminal'}
            </button>
          </form>

          {/* Quick Demo Switcher Buttons */}
          <div style={{ marginTop: '26px', borderTop: '1px solid var(--surface-border)', paddingTop: '20px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Instant Demo Access
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setLoginUsername('owner'); setLoginPassword('owner123'); handleLogin('owner', 'owner123'); }}
              >
                Owner Mode
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setLoginUsername('agent1'); setLoginPassword('agent123'); handleLogin('agent1', 'agent123'); }}
              >
                Agent Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isTvMode ? 'tv-display-mode' : ''}`}>
      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-logo">
            <CreditCard size={22} />
          </div>
          <div className="brand-info">
            <h1>LoanPro</h1>
            <span>58-Plan • 8% Rate</span>
          </div>
        </div>

        <ul className="nav-links">
          <li
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </li>

          <li
            className={`nav-item ${currentView === 'loans' ? 'active' : ''}`}
            onClick={() => setCurrentView('loans')}
          >
            <CreditCard size={18} />
            <span>58-Loans</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>
              {loans.length}
            </span>
          </li>

          <li
            className={`nav-item ${currentView === 'clients' ? 'active' : ''}`}
            onClick={() => setCurrentView('clients')}
          >
            <Users size={18} />
            <span>Clients</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>
              {clients.length}
            </span>
          </li>

          <li
            className={`nav-item ${currentView === 'collections' ? 'active' : ''}`}
            onClick={() => setCurrentView('collections')}
          >
            <CalendarCheck size={18} />
            <span>Field Dues</span>
            {reminderCount > 0 && (
              <span className="nav-badge">{reminderCount}</span>
            )}
          </li>

          {currentUser?.role === 'OWNER' && (
            <li
              className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
              onClick={() => setCurrentView('reports')}
            >
              <BarChart3 size={18} />
              <span>Reports & Ledger</span>
            </li>
          )}
        </ul>

        {/* Quick Role Switcher for Testing */}
        <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', margin: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
            SIMULATE ROLE:
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn btn-sm ${currentUser.role === 'OWNER' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
              onClick={() => quickSwitchUser('OWNER')}
            >
              Owner
            </button>
            <button
              className={`btn btn-sm ${currentUser.role === 'AGENT' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
              onClick={() => quickSwitchUser('AGENT')}
            >
              Agent
            </button>
          </div>
        </div>

        {/* User Card */}
        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="user-avatar">
              {currentUser.name.charAt(0)}
            </div>
            <div className="user-details">
              <div className="user-name">{currentUser.name}</div>
              <span className={`user-role-tag ${currentUser.role.toLowerCase()}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <div className="main-wrapper">
        {/* TOP BAR */}
        <header className="top-bar">
          <div className="page-title">
            <h2>
              {currentView === 'dashboard' && 'Executive Overview'}
              {currentView === 'loans' && '58-Installment Portfolio'}
              {currentView === 'clients' && 'Client Directory'}
              {currentView === 'collections' && 'Field Collections Queue'}
              {currentView === 'reports' && 'Monthly Reports & Master Ledger'}
            </h2>
            <p>Real-time sync • ATM Thermal Print Ready</p>
          </div>

          <div className="top-actions">
            {/* Smart TV Display Mode Toggle */}
            <button
              className={`btn btn-sm ${isTvMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsTvMode(!isTvMode)}
              title={isTvMode ? 'Exit Smart TV Mode' : 'Switch to Smart TV Display Mode'}
              style={{ gap: '6px' }}
            >
              <Tv size={16} />
              <span className="no-mobile-btn">{isTvMode ? 'TV Mode ON' : 'Smart TV'}</span>
            </button>

            {/* Reminders Button */}
            <button
              className="btn btn-secondary"
              onClick={() => setShowNotificationCenter(true)}
              style={{ position: 'relative', padding: '8px 12px' }}
              title="Notifications & Dues"
            >
              <Bell size={18} />
              {reminderCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--danger)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800'
                }}>
                  {reminderCount}
                </span>
              )}
            </button>

            {/* Mobile / Global Log Out Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
              title={`Logged in as ${currentUser.name} (${currentUser.role}). Click to Log Out`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171'
              }}
            >
              <LogOut size={15} />
              <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Logout</span>
            </button>

            {isOwner && (
              <button
                className="btn btn-primary btn-sm no-mobile-btn"
                onClick={() => setShowNewLoanModal(true)}
                style={{ gap: '6px' }}
              >
                <PlusCircle size={16} />
                <span>New 58-Loan</span>
              </button>
            )}
          </div>
        </header>

        {/* CONTENT BODY */}
        <main className="content-body">
          {currentView === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              reminders={reminders}
              loans={loans}
              currentUser={currentUser}
              isTvMode={isTvMode}
              onOpenNewLoan={() => setShowNewLoanModal(true)}
              onOpenNewClient={() => setShowNewClientModal(true)}
              onOpenPayment={(loan) => setSelectedLoanForPayment(loan)}
              onOpenLoanDetail={(loanId) => setSelectedLoanIdForDetail(loanId)}
              onOpenReminders={() => setShowNotificationCenter(true)}
            />
          )}

          {currentView === 'loans' && (
            <LoansView
              loans={loans}
              currentUser={currentUser}
              onOpenNewLoan={() => setShowNewLoanModal(true)}
              onOpenPayment={(loan) => setSelectedLoanForPayment(loan)}
              onOpenLoanDetail={(loanId) => setSelectedLoanIdForDetail(loanId)}
              onEditLoan={(loan) => setSelectedLoanForEdit(loan)}
            />
          )}

          {currentView === 'clients' && (
            <ClientsView
              clients={clients}
              currentUser={currentUser}
              onOpenNewClient={() => setShowNewClientModal(true)}
              onOpenNewLoanForClient={(client) => setShowNewLoanModal(true)}
              onEditClient={(client) => setSelectedClientForEdit(client)}
            />
          )}

          {currentView === 'collections' && (
            <CollectionsView
              reminders={reminders}
              onOpenPayment={(loan) => setSelectedLoanForPayment(loan)}
            />
          )}

          {currentView === 'reports' && currentUser?.role === 'OWNER' && (
            <ReportsView
              token={token}
              currentUser={currentUser}
              onReprintReceipt={(receipt) => setActiveReceipt(receipt)}
            />
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION (Phones & Foldables) */}
      <nav className="mobile-bottom-nav">
        <div
          className={`mobile-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </div>

        <div
          className={`mobile-nav-item ${currentView === 'loans' ? 'active' : ''}`}
          onClick={() => setCurrentView('loans')}
        >
          <CreditCard size={20} />
          <span>Loans</span>
        </div>

        <div
          className={`mobile-nav-item ${currentView === 'collections' ? 'active' : ''}`}
          onClick={() => setCurrentView('collections')}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <CalendarCheck size={20} />
            {reminderCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-4px',
                background: 'var(--danger)',
                width: '8px',
                height: '8px',
                borderRadius: '50%'
              }}></span>
            )}
          </div>
          <span>Dues</span>
        </div>

        <div
          className={`mobile-nav-item ${currentView === 'clients' ? 'active' : ''}`}
          onClick={() => setCurrentView('clients')}
        >
          <Users size={20} />
          <span>Clients</span>
        </div>

        {isOwner && (
          <div
            className={`mobile-nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => setCurrentView('reports')}
          >
            <BarChart3 size={20} />
            <span>Reports</span>
          </div>
        )}
      </nav>

      {/* MODALS */}
      {showNewLoanModal && (
        <NewLoanModal
          token={token}
          clients={clients}
          agents={agents}
          currentUser={currentUser}
          onClose={() => setShowNewLoanModal(false)}
          onSuccess={() => {
            setShowNewLoanModal(false);
            loadAllData();
          }}
        />
      )}

      {showNewClientModal && (
        <NewClientModal
          token={token}
          onClose={() => setShowNewClientModal(false)}
          onSuccess={() => {
            setShowNewClientModal(false);
            loadAllData();
          }}
        />
      )}

      {selectedClientForEdit && (
        <EditClientModal
          client={selectedClientForEdit}
          token={token}
          currentUser={currentUser}
          onClose={() => setSelectedClientForEdit(null)}
          onSuccess={() => {
            setSelectedClientForEdit(null);
            loadAllData();
          }}
          onDeleted={() => {
            setSelectedClientForEdit(null);
            loadAllData();
          }}
        />
      )}

      {selectedLoanForEdit && (
        <EditLoanModal
          loan={selectedLoanForEdit}
          token={token}
          agents={agents}
          currentUser={currentUser}
          onClose={() => setSelectedLoanForEdit(null)}
          onSuccess={() => {
            setSelectedLoanForEdit(null);
            loadAllData();
          }}
          onDeleted={() => {
            setSelectedLoanForEdit(null);
            loadAllData();
          }}
        />
      )}

      {selectedLoanForPayment && (
        <PaymentModal
          loan={selectedLoanForPayment}
          token={token}
          onClose={() => setSelectedLoanForPayment(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {selectedLoanIdForDetail && (
        <LoanDetailModal
          loanId={selectedLoanIdForDetail}
          token={token}
          currentUser={currentUser}
          onClose={() => setSelectedLoanIdForDetail(null)}
          onOpenPayment={(loan) => setSelectedLoanForPayment(loan)}
          onReprintReceipt={(receipt) => setActiveReceipt(receipt)}
          onEditLoan={(loan) => setSelectedLoanForEdit(loan)}
        />
      )}

      {activeReceipt && (
        <ThermalReceipt
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {showNotificationCenter && (
        <NotificationCenter
          reminders={reminders}
          onClose={() => setShowNotificationCenter(false)}
          onQuickPay={(loan) => setSelectedLoanForPayment(loan)}
        />
      )}
    </div>
  );
}
