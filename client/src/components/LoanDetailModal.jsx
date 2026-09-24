import React, { useState, useEffect } from 'react';
import { FileText, X, DollarSign, Printer, CheckCircle2, Clock, AlertTriangle, Edit3, User } from 'lucide-react';

// Format date cleanly: '2026-09-23T00:00:00.000Z' -> '23 Sep 2026'
function formatCleanDate(d) {
  if (!d) return '—';
  const str = typeof d === 'string' ? d.split('T')[0] : new Date(d).toISOString().split('T')[0];
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  const [y, m, day] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  return `${day} ${monthName} ${y}`;
}

export default function LoanDetailModal({ loanId, token, currentUser, onClose, onOpenPayment, onReprintReceipt, onEditLoan }) {
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('installments'); // 'installments' | 'payments'
  const [penaltyLoading, setPenaltyLoading] = useState(false);

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

  const handleApplyPenalty = async () => {
    if (!loan) return;
    const penaltyAmt = Math.round(Number(loan.remaining_balance) * 0.08);
    if (!window.confirm(`Apply 8% overdue penalty (Rs. ${penaltyAmt.toLocaleString()}) to ${loan.loan_code}?`)) return;
    setPenaltyLoading(true);
    try {
      const res = await fetch(`/api/loans/${loan.id}/penalty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ penalty_pct: 8.0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply penalty');
      const detailRes = await fetch(`/api/loans/${loan.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const detailData = await detailRes.json();
      if (detailData.loan) setLoan(detailData.loan);
    } catch (err) {
      alert(err.message);
    } finally {
      setPenaltyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>Loading Loan Ledger...</div>
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
      <div className="modal-content" style={{ maxWidth: '780px', width: '100%', padding: 0 }}>
        {/* Header with borrower photo and status */}
        <div className="modal-header" style={{ padding: '14px 18px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            {loan.photo_url ? (
              <img
                src={loan.photo_url}
                alt={loan.client_name}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--accent-primary)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontWeight: '800',
                fontSize: '1.1rem'
              }}>
                {loan.client_name ? loan.client_name.charAt(0) : <User size={20} />}
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, fontFamily: 'var(--font-mono)' }}>
                  {loan.loan_code}
                </h3>
                <span className={`status-badge badge-${loan.status.toLowerCase()}`}>
                  {loan.status}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Client: <strong style={{ color: 'var(--text-primary)' }}>{loan.client_name}</strong> • Phone: {loan.client_phone}
              </div>
            </div>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '16px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Summary Cards: 2x2 Clean Grid on all screens */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '16px'
          }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PRINCIPAL</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '2px' }}>Rs. {Number(loan.principal_amount).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL PAYABLE ({loan.interest_rate_pct}%)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#93c5fd', marginTop: '2px' }}>Rs. {Number(loan.total_payable).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL COLLECTED</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>Rs. {Number(loan.total_paid).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>OUTSTANDING BALANCE</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#f87171', marginTop: '2px' }}>Rs. {Number(loan.remaining_balance).toLocaleString()}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span>Progress: <strong>{paidCount} of {loan.installment_count || 58} Settled</strong> {partialCount > 0 && `(${partialCount} partial)`}</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{progressPct}%</span>
            </div>
            <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', transition: 'width 0.3s' }}></div>
            </div>
          </div>

          {/* Overdue Penalty Banner (Exceeded 58-Day Limit) */}
          {loan.status === 'ACTIVE' && loan.end_date && new Date().toISOString().split('T')[0] > loan.end_date && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontWeight: '700', color: '#f87171', fontSize: '0.88rem' }}>
                  ⚠️ 58-Day Limit Exceeded
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  58-day window ended on {formatCleanDate(loan.end_date)}. Unpaid: Rs. {Math.round(Number(loan.remaining_balance)).toLocaleString()}.
                </div>
              </div>
              {currentUser?.role === 'OWNER' && (
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    fontWeight: '700',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={handleApplyPenalty}
                  disabled={penaltyLoading}
                >
                  {penaltyLoading ? 'Applying...' : `Apply 8% Penalty (+Rs. ${Math.round(Number(loan.remaining_balance) * 0.08).toLocaleString()})`}
                </button>
              )}
            </div>
          )}

          {/* Responsive Full-Width Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--surface-border)', marginBottom: '14px' }}>
            <button
              className={`btn btn-sm ${activeTab === 'installments' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.82rem', textAlign: 'center' }}
              onClick={() => setActiveTab('installments')}
            >
              Schedule ({loan.installments?.length || 0})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '8px 10px', fontSize: '0.82rem', textAlign: 'center' }}
              onClick={() => setActiveTab('payments')}
            >
              Payments ({loan.payments?.length || 0})
            </button>
          </div>

          {/* Tab 1: Installments Schedule (100% Full-Width Responsive List, ZERO Horizontal Scroll) */}
          {activeTab === 'installments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(loan.installments || []).map((inst) => {
                const isBlank = inst.status === 'BLANK' || (loan.status === 'COMPLETED' && inst.status !== 'PAID');
                const isPaid = inst.status === 'PAID';
                const isPartial = inst.status === 'PARTIAL';

                return (
                  <div
                    key={inst.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      background: isBlank ? 'rgba(255, 255, 255, 0.01)' : isPaid ? 'rgba(16, 185, 129, 0.05)' : isPartial ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid ' + (isBlank ? 'rgba(255, 255, 255, 0.05)' : isPaid ? 'rgba(16, 185, 129, 0.22)' : isPartial ? 'rgba(245, 158, 11, 0.25)' : 'var(--surface-border)'),
                      borderRadius: '8px',
                      gap: '8px',
                      opacity: isBlank ? 0.45 : 1
                    }}
                  >
                    {/* Left: Installment Number & Due Date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{
                        fontWeight: '800',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        color: isBlank ? 'var(--text-muted)' : 'var(--accent-primary)',
                        minWidth: '32px'
                      }}>
                        #{inst.installment_no}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: isBlank ? '400' : '600', color: isBlank ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {formatCleanDate(inst.due_date)}
                        </div>
                        {isPartial && !isBlank && (
                          <div style={{ fontSize: '0.7rem', color: '#10b981' }}>
                            Paid: Rs. {Math.round(Number(inst.paid_amount)).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Expected Amount & Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: isBlank ? '400' : '700', color: isBlank ? 'var(--text-muted)' : isPaid ? '#10b981' : 'var(--text-primary)' }}>
                          {isBlank ? '—' : `Rs. ${Math.round(Number(inst.expected_amount)).toLocaleString()}`}
                        </div>
                      </div>
                      {isBlank ? (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          minWidth: '60px',
                          textAlign: 'center'
                        }}>
                          —
                        </span>
                      ) : (
                        <span
                          className={`status-badge badge-${inst.status.toLowerCase()}`}
                          style={{
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            minWidth: '60px',
                            textAlign: 'center'
                          }}
                        >
                          {inst.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Payments & Receipts (Responsive Cards) */}
          {activeTab === 'payments' && (
            <div>
              {(!loan.payments || loan.payments.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No payments logged yet for this loan.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {loan.payments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                          {p.receipt_no}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatCleanDate(p.created_at)} • {p.collector_name || 'Collector'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: '#10b981', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                            Rs. {Number(p.amount_paid).toFixed(2)}
                          </div>
                          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                            {p.payment_type}
                          </span>
                        </div>

                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ gap: '4px', fontSize: '0.72rem', padding: '5px 8px', flexShrink: 0 }}
                          onClick={() => onReprintReceipt({
                            ...p,
                            loan_code: loan.loan_code,
                            client_name: loan.client_name,
                            client_phone: loan.client_phone,
                            installment_count: loan.installment_count
                          })}
                        >
                          <Printer size={12} />
                          Reprint
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loan.status === 'ACTIVE' && (
            <button
              className="btn btn-success"
              style={{
                width: '100%',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 16px',
                fontSize: '0.95rem',
                fontWeight: '700'
              }}
              onClick={() => {
                onClose();
                onOpenPayment(loan);
              }}
            >
              <DollarSign size={18} />
              Pay Installment
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center', padding: '9px 12px' }}
              onClick={onClose}
            >
              Close
            </button>
            {currentUser?.role === 'OWNER' && onEditLoan && (
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', gap: '6px', padding: '9px 12px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  onClose();
                  onEditLoan(loan);
                }}
              >
                <Edit3 size={15} />
                Top-Up / Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
