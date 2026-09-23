import React, { useState } from 'react';
import { Search, PlusCircle, DollarSign, FileText, Phone } from 'lucide-react';

export default function LoansView({
  loans,
  currentUser,
  onOpenNewLoan,
  onOpenPayment,
  onOpenLoanDetail
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredLoans = loans.filter((l) => {
    const matchesSearch =
      l.loan_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.client_phone && l.client_phone.includes(searchTerm));

    const matchesStatus =
      statusFilter === 'ALL' || l.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Loan Management</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            All 58-installment plans, schedules, and recovery statuses
          </p>
        </div>

        {currentUser.role === 'OWNER' && (
          <button className="btn btn-primary" onClick={onOpenNewLoan} style={{ gap: '8px' }}>
            <PlusCircle size={18} />
            Create 58-Loan (8%)
          </button>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search client, phone, loan code..."
            style={{ paddingLeft: '38px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'ACTIVE', 'COMPLETED'].map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. DESKTOP & SMART TV VIEW: FULL TABLE                   */}
      {/* ======================================================== */}
      <div className="table-card desktop-table-view">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan Code</th>
                <th>Client</th>
                <th>Principal / Rate</th>
                <th>Installment</th>
                <th>Paid / Total</th>
                <th>Remaining</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No loans match your criteria.
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
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
                      <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '700' }}>
                        {loan.interest_rate_pct}% interest
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '700' }}>Rs. {Number(loan.installment_amount).toFixed(2)}</div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        58x ({loan.frequency})
                      </span>
                    </td>
                    <td>
                      <div>Rs. {Number(loan.total_paid).toLocaleString()}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        of Rs. {Number(loan.total_payable).toLocaleString()}
                      </div>
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
        {filteredLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            No loans match your criteria.
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const totalPayable = parseFloat(loan.total_payable) || 1;
            const totalPaid = parseFloat(loan.total_paid) || 0;
            const pct = Math.min(100, Math.round((totalPaid / totalPayable) * 100));

            return (
              <div key={`mob-loan-${loan.id}`} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '800', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
                        {loan.loan_code}
                      </span>
                      <span className={`status-badge badge-${loan.status.toLowerCase()}`}>
                        {loan.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {loan.client_name}
                    </div>
                  </div>

                  {loan.client_phone && (
                    <a
                      href={`tel:${loan.client_phone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 10px', textDecoration: 'none' }}
                      title="Call Client"
                    >
                      <Phone size={14} />
                    </a>
                  )}
                </div>

                {/* Mobile Financial Breakdown */}
                <div className="mobile-card-stats">
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>INSTALLMENT (58x)</div>
                    <div style={{ fontWeight: '800', color: '#60a5fa', fontSize: '0.98rem' }}>
                      Rs. {Number(loan.installment_amount).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loan.frequency}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>REMAINING BALANCE</div>
                    <div style={{ fontWeight: '800', color: loan.remaining_balance > 0 ? '#f87171' : '#10b981', fontSize: '1.05rem' }}>
                      Rs. {Number(loan.remaining_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: '600' }}>8% Interest Plan</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    <span>Recovered: Rs. {Number(loan.total_paid).toLocaleString()}</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)' }}></div>
                  </div>
                </div>

                {/* Touch-Friendly Action Buttons */}
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
                      Pay & Receipt
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
