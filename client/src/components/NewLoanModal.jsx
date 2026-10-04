import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Calculator, Calendar, UserCheck } from 'lucide-react';

export default function NewLoanModal({ token, clients, agents, currentUser, onClose, onSuccess, initialClientId }) {
  const [clientId, setClientId] = useState(
    initialClientId ? String(initialClientId) : (clients.length ? String(clients[0].id) : '')
  );
  const [assignedAgentId, setAssignedAgentId] = useState(
    currentUser.role === 'AGENT' ? currentUser.id : (agents.length ? agents[0].id : '')
  );
  const [principal, setPrincipal] = useState('50000');
  const [interestRate, setInterestRate] = useState('8'); // Default 8% for loan term
  const [installmentCount, setInstallmentCount] = useState('58'); // 58-day window (54 scheduled)
  const [frequency, setFrequency] = useState('DAILY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialClientId) {
      setClientId(String(initialClientId));
    }
  }, [initialClientId]);

  // Live calculations (Automatic Rounding to clean 100s/50s)
  const parsedPrincipal = parseFloat(principal) || 0;
  const parsedRate = parseFloat(interestRate) || 0;
  const parsedCount = parseInt(installmentCount, 10) || 58;
  const months = (frequency === 'DAILY' && parsedCount === 58) ? 2 : (frequency === 'MONTHLY' ? parsedCount : Math.max(1, Math.round(parsedCount / 29)));
  const totalInterestRatePct = parsedRate * months;

  const rawInterest = (parsedPrincipal * totalInterestRatePct) / 100;
  const rawTotalPayable = parsedPrincipal + rawInterest;
  const rawInstallment = parsedCount > 0 ? (rawTotalPayable / parsedCount) : 0;

  // Installment calculation (clean exact rupee, rounded to nearest 10 only if fractional cents exist):
  let installmentAmount = Math.round(rawInstallment);
  if (rawInstallment % 1 !== 0) {
    installmentAmount = Math.ceil(rawInstallment / 10) * 10;
  }

  const totalPayable = parsedCount > 0 && parsedPrincipal > 0 ? (installmentAmount * parsedCount) : 0;
  const totalInterest = Math.max(0, totalPayable - parsedPrincipal);

  const stepDays = frequency === 'DAILY' ? 1 : frequency === 'WEEKLY' ? 7 : 30;
  let endDate = '';
  try {
    const parsedStartTime = startDate ? new Date(startDate).getTime() : NaN;
    if (!isNaN(parsedStartTime)) {
      endDate = new Date(parsedStartTime + parsedCount * stepDays * 86400000)
        .toISOString()
        .split('T')[0];
    }
  } catch (err) {
    endDate = '';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!clientId) {
      setError('Please select a client for this loan.');
      return;
    }

    if (parsedPrincipal <= 0) {
      setError('Principal amount must be greater than zero.');
      return;
    }

    if (!startDate || isNaN(new Date(startDate).getTime())) {
      setError('Please enter a valid loan start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: clientId,
          assigned_agent_id: assignedAgentId,
          principal_amount: parsedPrincipal,
          interest_rate_pct: parsedRate,
          installment_count: parsedCount,
          frequency,
          start_date: startDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create loan');
      }

      onSuccess(data.loan);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={22} color="#3b82f6" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Issue Micro Loan</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                color: '#f87171',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.88rem'
              }}>
                {error}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Client</label>
                <select
                  className="form-select"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                >
                  <option value="">-- Select Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Collector</label>
                <select
                  className="form-select"
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Principal Amount (Rs.)</label>
                <input
                  type="number"
                  step="500"
                  min="1000"
                  className="form-input"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  style={{ fontSize: '1.1rem', fontWeight: '700', color: '#60a5fa' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Monthly Interest Rate (%)
                  <span style={{ color: '#38bdf8', fontSize: '0.74rem', marginLeft: '6px' }}>
                    (58 Days = 2 Mos: {totalInterestRatePct}%)
                  </span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  className="form-input"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  style={{ fontSize: '1.1rem', fontWeight: '700' }}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Installment Plan</label>
                <select
                  className="form-select"
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                >
                  <option value="58">58 Days (2 Months / 29+29 Days)</option>
                  <option value="29">29 Days (1 Month)</option>
                  <option value="30">30 Installments</option>
                  <option value="60">60 Installments</option>
                  <option value="100">100 Installments</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select
                  className="form-select"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="DAILY">Daily Installment</option>
                  <option value="WEEKLY">Weekly Installment</option>
                  <option value="MONTHLY">Monthly Installment</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Loan Start Date</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Calendar size={18} color="#60a5fa" style={{ position: 'absolute', left: '14px', pointerEvents: 'none', zIndex: 1 }} />
                <input
                  type="date"
                  className="form-input"
                  style={{ paddingLeft: '44px', minHeight: '46px', cursor: 'pointer' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Live Financial Breakdown Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
              marginTop: '10px'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', marginBottom: '10px' }}>
                📊 Automatic Calculation Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Principal:</div>
                  <div style={{ fontWeight: '600' }}>Rs. {parsedPrincipal.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Interest ({parsedRate}%/mo × {months}m = {totalInterestRatePct}%):</div>
                  <div style={{ fontWeight: '600', color: '#34d399' }}>+ Rs. {Math.round(totalInterest).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Total To Pay Back:</div>
                  <div style={{ fontWeight: '800', color: '#f8fafc', fontSize: '0.98rem' }}>Rs. {Math.round(totalPayable).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Per Installment:</div>
                  <div style={{ fontWeight: '800', color: '#38bdf8', fontSize: '1.02rem', wordBreak: 'break-word' }}>Rs. {Math.round(installmentAmount).toLocaleString()} / day</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Scheduled Payback:</div>
                  <div style={{ fontWeight: '600', color: '#60a5fa' }}>{parsedCount} {frequency === 'DAILY' ? 'days' : frequency === 'WEEKLY' ? 'weeks' : 'months'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Term Breakdown:</div>
                  <div style={{ fontWeight: '500' }}>{parsedCount === 58 ? '29 Days (M1) + 29 Days (M2)' : `${parsedCount} installments`}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '8px', width: '100%', padding: '12px 16px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ flex: 1.5, justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              <PlusCircle size={18} />
              {isSubmitting ? 'Issuing...' : 'Issue Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
