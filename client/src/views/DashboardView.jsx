import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  CreditCard,
  AlertCircle,
  Clock,
  PlusCircle,
  UserPlus,
  ArrowUpRight,
  Tv,
  Phone,
  LogOut
} from 'lucide-react';

export default function DashboardView({
  metrics,
  reminders,
  loans,
  currentUser,
  isTvMode,
  onOpenNewLoan,
  onOpenNewClient,
  onOpenPayment,
  onOpenLoanDetail,
  onOpenReminders,
  onLogout
}) {
  const m = metrics || {};
  const isOwner = currentUser?.role === 'OWNER';

  return (
    <div>
      {/* TV Live Monitor Status Bar when TV mode active */}
      {isTvMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="tv-pulse-dot"></span>
            <span style={{ fontWeight: '800', color: '#60a5fa', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
              SMART TV MONITOR MODE • LIVE SYNC ACTIVE
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Auto-refreshing every 15s • Optimized for 1080p / 4K Displays
          </div>
        </div>
      )}

      {/* Top Banner / Welcome (Hidden in TV Mode for clean minimal wall dashboard) */}
      {!isTvMode && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.3) 0%, rgba(17, 24, 39, 0.7) 100%)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc', marginBottom: '2px' }}>
              Welcome back, {currentUser?.name}!
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {isOwner
                ? '58-Installment Portfolio • 8% Rate • Real-time Field Returns'
                : 'Field Collection Terminal • Record Repayments & Thermal Receipts'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isOwner && (
              <button className="btn btn-primary btn-sm" onClick={onOpenNewLoan} style={{ gap: '6px' }}>
                <PlusCircle size={16} />
                New 58-Loan (8%)
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={onOpenNewClient} style={{ gap: '6px' }}>
              <UserPlus size={16} />
              Add Client
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              style={{
                gap: '6px',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.08)'
              }}
              title="Log Out of Terminal"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Reminder Notification Banner if dues exist */}
      {((reminders?.overdue?.length || 0) > 0 || (reminders?.due_today?.length || 0) > 0) && (
        <div
          onClick={onOpenReminders}
          style={{
            background: (reminders?.overdue?.length || 0) > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${(reminders?.overdue?.length || 0) > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'transform 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color={(reminders?.overdue?.length || 0) > 0 ? '#f87171' : '#fbbf24'} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {(reminders?.overdue?.length || 0) > 0
                  ? `Attention: ${reminders.overdue.length} Overdue Installments require follow up!`
                  : `Reminder: ${reminders.due_today.length} Installments are due today.`}
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} color="var(--text-secondary)" />
        </div>
      )}

      {/* Key Financial Metrics Cards (Massive on TV, Compact on Mobile) */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Outstanding</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>
            Rs. {Number(m.total_outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">Pending loan recovery across all clients</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Collected</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#c084fc' }}>
            Rs. {Number(m.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">Repayments received to date</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Today's Collections</span>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#60a5fa' }}>
            Rs. {Number(m.today_collected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-subtext">{m.today_payments_count || 0} receipt(s) issued today</div>
        </div>

        {isOwner && (
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Capital Lent (8% Plan)</span>
              <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                <CreditCard size={20} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              Rs. {Number(m.total_capital_lent || 0).toLocaleString()}
            </div>
            <div className="stat-subtext">Expected Interest: +Rs. {Number(m.total_expected_interest || 0).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. DESKTOP & SMART TV VIEW: FULL DATA TABLE              */}
      {/* ======================================================== */}
      <div className="table-card desktop-table-view">
        <div className="table-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>Active 58-Installment Loans</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Real-time balance, installment progress, and field repayments
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan Code</th>
                <th>Client Name</th>
                <th>Principal / Payable</th>
                <th>Installment Amt</th>
                <th>Remaining Bal</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No loans found. Click "New 58-Loan" to start!
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id}>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                      {loan.loan_code}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{loan.client_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{loan.client_phone}</div>
                    </td>
                    <td>
                      <div>Rs. {Number(loan.principal_amount).toLocaleString()}</div>
                      <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                        Total: Rs. {Number(loan.total_payable).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ fontWeight: '700' }}>
                      Rs. {Number(loan.installment_amount).toFixed(2)}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                        ({loan.frequency})
                      </span>
                    </td>
                    <td style={{ fontWeight: '800', color: loan.remaining_balance > 0 ? '#f87171' : '#10b981' }}>
                      Rs. {Number(loan.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`status-badge badge-${loan.status.toLowerCase()}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenLoanDetail(loan.id)}
                        >
                          Ledger
                        </button>
                        {loan.status === 'ACTIVE' && (
                          <button
                            className="btn btn-success btn-sm"
                            style={{ gap: '4px' }}
                            onClick={() => onOpenPayment(loan)}
                          >
                            <DollarSign size={14} />
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MOBILE PHONE & FOLDABLE VIEW: TOUCH CARDS             */}
      {/* ======================================================== */}
      <div className="mobile-card-view">
        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Active 58-Loans ({loans.length})
        </div>

        {loans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No loans found.
          </div>
        ) : (
          loans.map((loan) => (
            <div key={`mob-dash-${loan.id}`} className="mobile-card">
              <div className="mobile-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: '800', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {loan.loan_code}
                    </span>
                    <span className={`status-badge badge-${loan.status.toLowerCase()}`}>
                      {loan.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '800' }}>
                    {loan.client_name}
                  </div>
                </div>

                {loan.client_phone && (
                  <a
                    href={`tel:${loan.client_phone}`}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 10px', textDecoration: 'none' }}
                  >
                    <Phone size={14} />
                  </a>
                )}
              </div>

              <div className="mobile-card-stats">
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INSTALLMENT</div>
                  <div style={{ fontWeight: '800', color: '#60a5fa', fontSize: '0.95rem' }}>
                    Rs. {Number(loan.installment_amount).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>58x ({loan.frequency})</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REMAINING</div>
                  <div style={{ fontWeight: '800', color: loan.remaining_balance > 0 ? '#f87171' : '#10b981', fontSize: '1rem' }}>
                    Rs. {Number(loan.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#34d399' }}>8% Plan</div>
                </div>
              </div>

              <div className="mobile-card-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => onOpenLoanDetail(loan.id)}
                >
                  Ledger
                </button>
                {loan.status === 'ACTIVE' && (
                  <button
                    className="btn btn-success"
                    style={{ gap: '6px' }}
                    onClick={() => onOpenPayment(loan)}
                  >
                    <DollarSign size={16} />
                    Pay
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
