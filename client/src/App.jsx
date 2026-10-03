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
import UserManagementView from './views/UserManagementView';

import NewLoanModal from './components/NewLoanModal';
import NewClientModal from './components/NewClientModal';
import EditClientModal from './components/EditClientModal';
import EditLoanModal from './components/EditLoanModal';
import UserModal from './components/UserModal';
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
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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
  const [reminders, setReminders] = useState({ due_today: [], overdue: [], penalties: [] });
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [selectedClientForNewLoan, setSelectedClientForNewLoan] = useState(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState(null);
  const [selectedLoanIdForDetail, setSelectedLoanIdForDetail] = useState(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState(null);
  const [selectedLoanForEdit, setSelectedLoanForEdit] = useState(null);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  const isOwner = (currentUser?.role || '').toUpperCase() === 'OWNER';

  // Permission helper for UI actions
  const canPerform = (perm) => {
    if (isOwner) return true;
    return (currentUser?.permissions || []).includes(perm);
  };

  // Load data when authenticated
  useEffect(() => {
    if (token) {
      loadAllData();
    }
  }, [token]);

  // If user is Agent and view is on reports or users, switch immediately to dashboard
  useEffect(() => {
    if (currentUser && !isOwner && (currentView === 'reports' || currentView === 'users')) {
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

      // If token expired or session invalid, log out cleanly to show login form
      if (dashRes.status === 401 || loansRes.status === 401 || clientsRes.status === 401) {
        handleLogout();
        return;
      }

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
      setDataRefreshKey(k => k + 1);

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
    setDataRefreshKey(k => k + 1);
  };

  const reminderCount = (() => {
    const penaltyIds = new Set((reminders?.penalties || []).map(p => String(p.loan_id || p.id || '')));
    const overdueIds = new Set((reminders?.overdue || []).filter(o => !penaltyIds.has(String(o.loan_id || o.id || ''))).map(o => String(o.loan_id || o.id || '')));
    const dueTodayCount = (reminders?.due_today || []).filter(d => !penaltyIds.has(String(d.loan_id || d.id || '')) && !overdueIds.has(String(d.loan_id || d.id || ''))).length;
    return penaltyIds.size + overdueIds.size + dueTodayCount;
  })();

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
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div className="brand-logo" style={{ margin: '0 auto 14px', width: '54px', height: '54px' }}>
              <CreditCard size={28} />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#f8fafc', marginBottom: '4px', letterSpacing: '0.02em' }}>
              SADHAN APEX (PVT) LTD
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#60a5fa', fontWeight: '700', marginBottom: '4px' }}>
              📞 +94 76 108 3006
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              58-Installment Micro Loans & Field Collection Terminal
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
                placeholder="Enter username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '14px', padding: '11px' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Terminal'}
            </button>
          </form>

          <div style={{ marginTop: '26px', borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }}>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} <strong>Nexora Software Solutions</strong> • All Rights Reserved
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
            <h1 style={{ fontSize: '0.92rem', fontWeight: '800', lineHeight: 1.2 }}>SADHAN APEX</h1>
            <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>(PVT) LTD • 58-Plan</span>
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

          {currentUser?.role === 'OWNER' && (
            <li
              className={`nav-item ${currentView === 'users' ? 'active' : ''}`}
              onClick={() => setCurrentView('users')}
            >
              <UserCheck size={18} />
              <span>User Management</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>
                {agents.length}
              </span>
            </li>
          )}
        </ul>

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

        {/* System Copyright */}
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--surface-border)',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          <div>© {new Date().getFullYear()} <strong>Nexora Software Solutions</strong></div>
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
            <p>SADHAN APEX (PVT) LTD • 📞 +94 76 108 3006 • Powered by Nexora</p>
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

            {canPerform('ISSUE_LOANS') && (
              <button
                className="btn btn-primary btn-sm no-mobile-btn"
                onClick={() => {
                  setSelectedClientForNewLoan(null);
                  setShowNewLoanModal(true);
                }}
                style={{ gap: '6px' }}
              >
                <PlusCircle size={16} />
                <span>Issue Loan</span>
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
              onOpenNewLoan={() => {
                setSelectedClientForNewLoan(null);
                setShowNewLoanModal(true);
              }}
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
              onOpenNewLoan={() => {
                setSelectedClientForNewLoan(null);
                setShowNewLoanModal(true);
              }}
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
              onOpenNewLoanForClient={(client) => {
                setSelectedClientForNewLoan(client?.id || client);
                setShowNewLoanModal(true);
              }}
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
              dataRefreshKey={dataRefreshKey}
              onReprintReceipt={(receipt) => setActiveReceipt(receipt)}
            />
          )}

          {currentView === 'users' && isOwner && (
            <UserManagementView
              token={token}
              currentUser={currentUser}
              users={agents}
              onOpenCreateUser={() => {
                setSelectedUserForEdit(null);
                setShowUserModal(true);
              }}
              onOpenEditUser={(user) => {
                setSelectedUserForEdit(user);
                setShowUserModal(true);
              }}
              onRefreshUsers={loadAllData}
            />
          )}

          {/* System Footer & Copyright (Visible on Mobile & All Views) */}
          <footer className="system-footer">
            <div style={{ color: '#94a3b8' }}>
              © {new Date().getFullYear()} <strong>Nexora Software Solutions</strong> • All Rights Reserved
            </div>
          </footer>
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

        {isOwner && (
          <div
            className={`mobile-nav-item ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => setCurrentView('users')}
          >
            <UserCheck size={20} />
            <span>Users</span>
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
          initialClientId={selectedClientForNewLoan}
          onClose={() => {
            setShowNewLoanModal(false);
            setSelectedClientForNewLoan(null);
          }}
          onSuccess={() => {
            setShowNewLoanModal(false);
            setSelectedClientForNewLoan(null);
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

      {showUserModal && (
        <UserModal
          token={token}
          userToEdit={selectedUserForEdit}
          currentUserId={currentUser.id}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUserForEdit(null);
          }}
          onSuccess={() => {
            setShowUserModal(false);
            setSelectedUserForEdit(null);
            loadAllData();
          }}
        />
      )}
    </div>
  );
}

