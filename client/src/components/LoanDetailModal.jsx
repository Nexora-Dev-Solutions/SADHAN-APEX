import React, { useState, useEffect } from 'react';
import { FileText, X, DollarSign, Printer, Calendar, CheckCircle2, Clock, AlertTriangle, Edit3 } from 'lucide-react';

export default function LoanDetailModal({ loanId, token, currentUser, onClose, onOpenPayment, onReprintReceipt, onEditLoan }) {
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('installments'); // 'installments' | 'payments'

  useEffect(() => {
    async function fetchLoan() {
      try {
        const res = await fetch(`/api/loans/${loanId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load loan details');
        setLoan(data.loan);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchLoan();
  }, [loanId, token]);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>Loading 58-Installment Ledger...</div>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ padding: '24px' }}>
          <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error || 'Loan not found'}</div>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const paidCount = (loan.installments || []).filter(i => i.status === 'PAID').length;
  const partialCount = (loan.installments || []).filter(i => i.status === 'PARTIAL').length;
  const progressPct = Math.round((paidCount / (loan.installment_count || 58)) * 100);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '840px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>{loan.loan_code}</h3>
              <span className={`status-badge badge-${loan.status.toLowerCase()}`}>
                {loan.status}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Client: <strong style={{ color: 'var(--text-primary)' }}>{loan.client_name}</strong> • Phone: {loan.client_phone}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRINCIPAL</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>Rs. {Number(loan.principal_amount).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TOTAL PAYABLE ({loan.interest_rate_pct}%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#93c5fd' }}>Rs. {Number(loan.total_payable).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TOTAL COLLECTED</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#34d399' }}>Rs. {Number(loan.total_paid).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OUTSTANDING BALANCE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f87171' }}>Rs. {Number(loan.remaining_balance).toLocaleString()}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span>Progress: <strong>{paidCount} of {loan.installment_count || 58} Installments Settled</strong> {partialCount > 0 && `(${partialCount} partial)`}</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{progressPct}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', transition: 'width 0.3s' }}></div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--surface-border)', marginBottom: '16px' }}>
            <button
              className={`btn btn-sm ${activeTab === 'installments' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('installments')}
            >
              58 Installments Schedule ({loan.installments?.length || 0})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('payments')}
            >
              Payment History & Receipts ({loan.payments?.length || 0})
            </button>
          </div>

          {/* Tab 1: Installments Ledger */}
          {activeTab === 'installments' && (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due Date</th>
                    <th>Expected</th>
                    <th>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(loan.installments || []).map((inst) => (
                    <tr key={inst.id}>
                      <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>#{inst.installment_no}</td>
                      <td>{inst.due_date}</td>
                      <td>Rs. {Number(inst.expected_amount).toFixed(2)}</td>
                      <td style={{ color: inst.paid_amount > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: '600' }}>
                        Rs. {Number(inst.paid_amount).toFixed(2)}
                      </td>
                      <td>
                        <span className={`status-badge badge-${inst.status.toLowerCase()}`}>
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Payments & Reprintable Receipts */}
          {activeTab === 'payments' && (
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {(!loan.payments || loan.payments.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No payments logged yet for this loan.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th>Amount Paid</th>
                      <th>Type</th>
                      <th>Collector</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.payments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                          {p.receipt_no}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {new Date(p.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ fontWeight: '800', color: '#10b981' }}>
                          Rs. {Number(p.amount_paid).toFixed(2)}
                        </td>
                        <td>
                          <span className={`status-badge ${p.payment_type === 'PARTIAL' ? 'badge-partial' : 'badge-active'}`}>
                            {p.payment_type}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {p.collector_name || 'Staff'}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ gap: '6px' }}
                            onClick={() => onReprintReceipt({
                              ...p,
                              loan_code: loan.loan_code,
                              client_name: loan.client_name,
                              client_phone: loan.client_phone,
                              installment_count: loan.installment_count
                            })}
                          >
                            <Printer size={14} />
                            Reprint
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentUser?.role === 'OWNER' && onEditLoan && (
              <button
                className="btn btn-secondary"
                style={{ gap: '6px' }}
                onClick={() => {
                  onClose();
                  onEditLoan(loan);
                }}
              >
                <Edit3 size={16} />
                Top-Up / Edit Loan
              </button>
            )}
            {loan.status === 'ACTIVE' && (
              <button
                className="btn btn-success"
                style={{ gap: '8px' }}
                onClick={() => {
                  onClose();
                  onOpenPayment(loan);
                }}
              >
                <DollarSign size={18} />
                Record Repayment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

