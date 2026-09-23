import React from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle, X, DollarSign } from 'lucide-react';

export default function NotificationCenter({ reminders, onClose, onQuickPay }) {
  if (!reminders) return null;

  const totalCount = (reminders.due_today?.length || 0) + (reminders.overdue?.length || 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={22} color="#f59e0b" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Reminders & Daily Dues</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {totalCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <CheckCircle size={44} color="#10b981" style={{ margin: '0 auto 12px', display: 'block' }} />
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>All Clear!</h4>
              <p style={{ fontSize: '0.88rem' }}>No installments are overdue or due today.</p>
            </div>
          ) : (
            <div>
              {/* Overdue Section */}
              {reminders.overdue?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#f87171',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    marginBottom: '10px'
                  }}>
                    <AlertTriangle size={18} />
                    <span>OVERDUE INSTALLMENTS ({reminders.overdue.length})</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {reminders.overdue.map((item, idx) => (
                      <div
                        key={`overdue-${idx}`}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', color: '#f87171', fontSize: '0.92rem' }}>
                            {item.client_name} • {item.days_late} Days Late
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {item.loan_code} • Inst #{item.installment_no} • Due: {item.due_date}
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                            Due Amount: Rs. {Number(item.balance_due).toFixed(2)}
                          </div>
                        </div>

                        <button
                          className="btn btn-success btn-sm"
                          style={{ gap: '6px', flexShrink: 0 }}
                          onClick={() => {
                            onClose();
                            onQuickPay({
                              id: item.loan_id,
                              loan_code: item.loan_code,
                              client_name: item.client_name,
                              installment_amount: item.balance_due,
                              remaining_balance: item.remaining_balance
                            });
                          }}
                        >
                          <DollarSign size={14} />
                          Collect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due Today Section */}
              {reminders.due_today?.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fbbf24',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    marginBottom: '10px'
                  }}>
                    <Clock size={18} />
                    <span>DUE TODAY ({reminders.due_today.length})</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {reminders.due_today.map((item, idx) => (
                      <div
                        key={`today-${idx}`}
                        style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', color: '#fbbf24', fontSize: '0.92rem' }}>
                            {item.client_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {item.loan_code} • Inst #{item.installment_no} of 58
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                            Amount: Rs. {Number(item.balance_due).toFixed(2)}
                          </div>
                        </div>

                        <button
                          className="btn btn-success btn-sm"
                          style={{ gap: '6px', flexShrink: 0 }}
                          onClick={() => {
                            onClose();
                            onQuickPay({
                              id: item.loan_id,
                              loan_code: item.loan_code,
                              client_name: item.client_name,
                              installment_amount: item.balance_due,
                              remaining_balance: item.remaining_balance
                            });
                          }}
                        >
                          <DollarSign size={14} />
                          Collect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '12px 16px' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
