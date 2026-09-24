import React, { useState } from 'react';
import { Edit3, PlusCircle, Trash2, X, Check, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';

export default function EditLoanModal({ loan, token, agents, currentUser, onClose, onSuccess, onDeleted }) {
  if (!loan) return null;

  const currentPrincipal = parseFloat(loan.principal_amount) || 0;
  const currentRate = parseFloat(loan.interest_rate_pct) || 8;
  const currentPaid = parseFloat(loan.total_paid) || 0;
  const currentCount = parseInt(loan.installment_count, 10) || 58;

  // Active sub-tab: 'topup' (add more money to same ledger) | 'edit' (edit terms)
  const [activeTab, setActiveTab] = useState('topup');

  // Top-Up state
  const [topupAmount, setTopupAmount] = useState('');

  // General edit state
  const [editPrincipal, setEditPrincipal] = useState(String(currentPrincipal));
  const [interestRate, setInterestRate] = useState(String(currentRate));
  const [assignedAgentId, setAssignedAgentId] = useState(loan.assigned_agent_id ? String(loan.assigned_agent_id) : '');
  const [status, setStatus] = useState(loan.status || 'ACTIVE');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const isOwner = currentUser?.role === 'OWNER';

  // Live calculation for Top-Up
  const parsedTopup = parseFloat(topupAmount) || 0;
  const calculatedNewPrincipal = activeTab === 'topup' ? currentPrincipal + parsedTopup : (parseFloat(editPrincipal) || currentPrincipal);
  const calculatedRate = parseFloat(interestRate) || currentRate;

  const scheduleCount = currentCount === 58 ? 54 : currentCount;
  const rawNewInterest = (calculatedNewPrincipal * calculatedRate) / 100;
  const rawNewPayable = calculatedNewPrincipal + rawNewInterest;
  const rawNewInst = scheduleCount > 0 ? (rawNewPayable / scheduleCount) : 0;

  let calculatedNewInstAmt = 0;
  if (rawNewInst >= 1000) {
    calculatedNewInstAmt = Math.round(rawNewInst / 100) * 100;
  } else if (rawNewInst >= 300) {
    calculatedNewInstAmt = Math.round(rawNewInst / 50) * 50;
  } else if (rawNewInst > 0) {
    calculatedNewInstAmt = Math.round(rawNewInst / 10) * 10 || 10;
  }

  // Safety: A loan with interest must NEVER round down so much that profit drops to 0 or below principal
  if (scheduleCount > 0 && calculatedNewPrincipal > 0 && calculatedRate > 0 && (calculatedNewInstAmt * scheduleCount) <= calculatedNewPrincipal) {
    if (rawNewInst >= 1000) {
      calculatedNewInstAmt = Math.ceil(rawNewInst / 100) * 100;
    } else if (rawNewInst >= 300) {
      calculatedNewInstAmt = Math.ceil(rawNewInst / 50) * 50;
    } else {
      calculatedNewInstAmt = Math.ceil(rawNewInst / 10) * 10;
    }
  }

  const calculatedTotalPayable = Math.round(calculatedNewInstAmt * scheduleCount);
  const calculatedInterest = Math.max(0, calculatedTotalPayable - calculatedNewPrincipal);
  const calculatedNewRemaining = Math.max(0, Math.round(calculatedTotalPayable - currentPaid));

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');

    if (activeTab === 'topup' && parsedTopup <= 0) {
      setError('Please enter a valid top-up amount greater than zero.');
      return;
    }

    if (activeTab === 'edit' && parseFloat(editPrincipal) <= 0) {
      setError('Principal amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = activeTab === 'topup'
        ? {
            topup_amount: parsedTopup,
            interest_rate_pct: calculatedRate,
            assigned_agent_id: assignedAgentId ? parseInt(assignedAgentId, 10) : null
          }
        : {
            principal_amount: parseFloat(editPrincipal),
            interest_rate_pct: calculatedRate,
            assigned_agent_id: assignedAgentId ? parseInt(assignedAgentId, 10) : null,
            status
          };

      const res = await fetch(`/api/loans/${loan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update loan');

      onSuccess(data.loan);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete loan');

      onDeleted(loan.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={20} color="#3b82f6" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Manage / Top-Up Loan</h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {loan.loan_code} • Client: <strong>{loan.client_name}</strong>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab switch between Top-Up Cash & Edit Terms */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-border)', padding: '8px 16px 0 16px', background: 'rgba(0,0,0,0.15)', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'topup' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flex: 1,
              padding: '9px 8px',
              fontSize: '0.84rem',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              borderBottom: 'none',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setActiveTab('topup')}
          >
            💰 Top-Up Cash
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flex: 1,
              padding: '9px 8px',
              fontSize: '0.84rem',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              borderBottom: 'none',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setActiveTab('edit')}
          >
            ✏️ Edit Terms
          </button>
        </div>

        <form onSubmit={handleUpdate}>
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

            {/* TAB 1: TOP-UP CASH TO SAME LEDGER */}
            {activeTab === 'topup' && (
              <div>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: '18px',
                  fontSize: '0.85rem'
                }}>
                  💡 <strong>Same-Ledger Top-Up:</strong> If the client returned to receive additional cash, enter the extra amount below. The system automatically recalculates the total payable and updates the remaining 58 installments without creating a confusing duplicate loan!
                </div>

                <div className="form-group">
                  <label className="form-label">Additional Money Received By Client (Rs.) *</label>
                  <input
                    type="number"
                    step="500"
                    min="500"
                    placeholder="e.g. 10000"
                    className="form-input"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    style={{ fontSize: '1.25rem', fontWeight: '800', color: '#60a5fa' }}
                    required
                  />
                </div>
              </div>
            )}

            {/* TAB 2: EDIT FULL TERMS */}
            {activeTab === 'edit' && (
              <div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Total Principal (Rs.)</label>
                    <input
                      type="number"
                      step="500"
                      min="1000"
                      className="form-input"
                      value={editPrincipal}
                      onChange={(e) => setEditPrincipal(e.target.value)}
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
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
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

                  <div className="form-group">
                    <label className="form-label">Loan Status</label>
                    <select
                      className="form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="DEFAULTED">DEFAULTED</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* LIVE CALCULATION PREVIEW */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              marginTop: '12px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', marginBottom: '8px' }}>
                📊 Updated Ledger Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.84rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Updated Principal:</div>
                  <div style={{ fontWeight: '700' }}>Rs. {calculatedNewPrincipal.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Interest ({calculatedRate}%):</div>
                  <div style={{ fontWeight: '700', color: '#34d399' }}>+ Rs. {calculatedInterest.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Total Payable:</div>
                  <div style={{ fontWeight: '800', color: '#f8fafc' }}>Rs. {calculatedTotalPayable.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Already Repaid:</div>
                  <div style={{ fontWeight: '600', color: '#10b981' }}>- Rs. {currentPaid.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>New Balance to Recover:</div>
                  <div style={{ fontWeight: '800', color: '#f87171', fontSize: '1rem', wordBreak: 'break-word' }}>
                    Rs. {Math.round(calculatedNewRemaining).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Per Installment:</div>
                  <div style={{ fontWeight: '800', color: '#38bdf8', fontSize: '1rem', wordBreak: 'break-word' }}>
                    Rs. {Math.round(calculatedNewInstAmt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Delete Confirmation Box */}
            {showDeleteConfirm && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginTop: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: '700', marginBottom: '6px' }}>
                  <AlertTriangle size={18} />
                  <span>Confirm Loan Deletion</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Are you sure you want to delete loan <strong>{loan.loan_code}</strong>? This will permanently delete its 58-installment ledger and all logged payment receipts.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete Loan'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
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
                style={{ flex: 1.5, justifyContent: 'center', gap: '6px' }}
                disabled={isSubmitting}
              >
                <Check size={16} />
                {isSubmitting ? 'Updating...' : (activeTab === 'topup' ? 'Apply Top-Up' : 'Save Changes')}
              </button>
            </div>
            {isOwner && !showDeleteConfirm && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '9px 12px'
                }}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
              >
                <Trash2 size={15} />
                Delete Loan
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
