import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Calculator, Calendar, UserCheck } from 'lucide-react';

export default function NewLoanModal({ token, clients, agents, currentUser, onClose, onSuccess }) {
  const [clientId, setClientId] = useState(clients.length ? clients[0].id : '');
  const [assignedAgentId, setAssignedAgentId] = useState(
    currentUser.role === 'AGENT' ? currentUser.id : (agents.length ? agents[0].id : '')
  );
  const [principal, setPrincipal] = useState('50000');
  const [interestRate, setInterestRate] = useState('16'); // Default 16% (8%/month for 58 installments)
  const [installmentCount, setInstallmentCount] = useState('58'); // Default 58 installments
  const [frequency, setFrequency] = useState('DAILY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Live calculations (Automatic Rounding to clean 100s/50s)
  const parsedPrincipal = parseFloat(principal) || 0;
  const parsedRate = parseFloat(interestRate) || 0;
  const parsedCount = parseInt(installmentCount, 10) || 58;

  const rawInterest = (parsedPrincipal * parsedRate) / 100;
  const rawTotalPayable = parsedPrincipal + rawInterest;
  const rawInstallment = parsedCount > 0 ? (rawTotalPayable / parsedCount) : 0;

  // Round installment cleanly:
  // - >= 1000: round to nearest 100 (e.g. 1788 -> 1800)
  // - 300 to 1000: round to nearest 50 (e.g. 430 -> 450)
  // - < 300: round to nearest 10 (e.g. 116 -> 120)
  let installmentAmount = 0;
  if (rawInstallment >= 1000) {
    installmentAmount = Math.round(rawInstallment / 100) * 100;
  } else if (rawInstallment >= 300) {
    installmentAmount = Math.round(rawInstallment / 50) * 50;
  } else if (rawInstallment > 0) {
    installmentAmount = Math.round(rawInstallment / 10) * 10 || 10;
  }

  // Safety: A loan with interest must NEVER round down so much that profit drops to 0 or below principal
  if (parsedCount > 0 && parsedPrincipal > 0 && parsedRate > 0 && (installmentAmount * parsedCount) <= parsedPrincipal) {
    if (rawInstallment >= 1000) {
      installmentAmount = Math.ceil(rawInstallment / 100) * 100;
    } else if (rawInstallment >= 300) {
      installmentAmount = Math.ceil(rawInstallment / 50) * 50;
    } else {
      installmentAmount = Math.ceil(rawInstallment / 10) * 10;
    }
  }

  const totalPayable = parsedCount > 0 && parsedPrincipal > 0 ? (installmentAmount * parsedCount) : 0;
  const totalInterest = Math.max(0, totalPayable - parsedPrincipal);

  const stepDays = frequency === 'DAILY' ? 1 : frequency === 'WEEKLY' ? 7 : 30;
  const endDate = new Date(new Date(startDate).getTime() + parsedCount * stepDays * 86400000)
    .toISOString()
    .split('T')[0];

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
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Create 58-Installment Loan</h3>
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
                <label className="form-label">Interest Rate (%)</label>
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
                  <option value="58">58 Installments (Standard)</option>
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
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
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
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Interest ({parsedRate}%):</div>
                  <div style={{ fontWeight: '600', color: '#34d399' }}>+ Rs. {Math.round(totalInterest).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Total To Pay Back:</div>
                  <div style={{ fontWeight: '800', color: '#f8fafc', fontSize: '0.98rem' }}>Rs. {Math.round(totalPayable).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Per Installment ({parsedCount}x):</div>
                  <div style={{ fontWeight: '800', color: '#38bdf8', fontSize: '1.02rem', wordBreak: 'break-word' }}>Rs. {Math.round(installmentAmount).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Plan Duration:</div>
                  <div style={{ fontWeight: '500' }}>{parsedCount} {frequency.toLowerCase()}s</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Estimated Maturity:</div>
                  <div style={{ fontWeight: '500' }}>{endDate}</div>
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
              {isSubmitting ? 'Creating...' : 'Create 58-Day Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
