import React, { useState } from 'react';
import { DollarSign, X, Check, AlertCircle } from 'lucide-react';

export default function PaymentModal({ loan, token, onClose, onSuccess }) {
  if (!loan) return null;

  const installmentAmt = parseFloat(loan.installment_amount) || 0;
  const remainingBal = parseFloat(loan.remaining_balance) || 0;

  const [amountPaid, setAmountPaid] = useState(
    Math.min(installmentAmt, remainingBal).toFixed(2)
  );
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = parseFloat(amountPaid) || 0;
  const isPartial = parsedAmount < installmentAmt && parsedAmount < remainingBal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (parsedAmount <= 0) {
      setError('Please enter a payment amount greater than zero.');
      return;
    }

    if (parsedAmount > remainingBal) {
      setError(`Payment amount cannot exceed remaining balance (Rs. ${remainingBal.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          loan_id: loan.id,
          amount_paid: parsedAmount,
          payment_method: paymentMethod,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      onSuccess(data.receipt);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={22} color="#10b981" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Record Loan Payment</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Loan & Client Quick Summary Banner */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {loan.photo_url ? (
                  <img
                    src={loan.photo_url}
                    alt={loan.client_name}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--accent-primary)',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontWeight: '800',
                    fontSize: '1rem'
                  }}>
                    {loan.client_name ? loan.client_name.charAt(0) : 'C'}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {loan.client_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    KYC Verified Borrower • <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{loan.loan_code}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>STANDARD INSTALLMENT</span>
                <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>
                  Rs. {installmentAmt.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>CURRENT OUTSTANDING</span>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#f87171' }}>
                  Rs. {remainingBal.toFixed(2)}
                </span>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                color: '#f87171',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label">Quick Amount Presets</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAmountPaid(installmentAmt.toFixed(2))}
                >
                  Full Installment (Rs. {installmentAmt.toFixed(2)})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAmountPaid((installmentAmt / 2).toFixed(2))}
                >
                  Half (Rs. {(installmentAmt / 2).toFixed(2)})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAmountPaid(remainingBal.toFixed(2))}
                >
                  Full Loan Payoff (Rs. {remainingBal.toFixed(2)})
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Amount (Rs.)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={remainingBal}
                className="form-input"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}
                required
              />
              {isPartial && parsedAmount > 0 && (
                <div style={{
                  marginTop: '6px',
                  fontSize: '0.78rem',
                  color: '#fbbf24',
                  fontWeight: '600'
                }}>
                  ⚠️ Notice: This will be logged as a Partial Payment. A thermal receipt will be generated.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">Cash Payment (Standard)</option>
                <option value="BANK_TRANSFER">Bank Transfer / Deposit</option>
                <option value="ONLINE">Online / Card Payment</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Collector Note (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Paid at shop, remaining due tomorrow"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success" disabled={isSubmitting} style={{ gap: '8px' }}>
              <Check size={18} />
              {isSubmitting ? 'Recording...' : 'Collect & Print Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
