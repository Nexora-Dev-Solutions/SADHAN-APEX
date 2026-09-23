import React from 'react';
import { DollarSign, Phone, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

export default function CollectionsView({
  reminders,
  onOpenPayment
}) {
  const overdueList = reminders?.overdue || [];
  const dueTodayList = reminders?.due_today || [];
  const totalCollections = overdueList.length + dueTodayList.length;

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Daily Field Collections</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Queue of accounts due today and overdue installments for field visit and collection
        </p>
      </div>

      {totalCollections === 0 ? (
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 14px', display: 'block' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '6px' }}>
            Daily Collections Cleared!
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No installments are currently due or overdue. Excellent collection performance!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* OVERDUE SECTION */}
          {overdueList.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#f87171',
                fontWeight: '800',
                fontSize: '0.95rem',
                marginBottom: '12px'
              }}>
                <AlertTriangle size={20} />
                <span>OVERDUE ACCOUNTS ({overdueList.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px' }}>
                {overdueList.map((item, idx) => (
                  <div
                    key={`col-overdue-${idx}`}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#f87171' }}>
                            {item.client_name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {item.loan_code} • Installment #{item.installment_no} of 58
                          </div>
                        </div>
                        <span className="status-badge badge-overdue">
                          {item.days_late} Days Late
                        </span>
                      </div>

                      <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        margin: '10px 0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
                          <span style={{ fontWeight: '600' }}>{item.due_date}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', marginTop: '4px' }}>
                          <span style={{ fontWeight: '600' }}>Due Amount:</span>
                          <span style={{ fontWeight: '800', color: '#f87171' }}>
                            Rs. {Number(item.balance_due).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                      {item.client_phone && (
                        <a
                          href={`tel:${item.client_phone}`}
                          className="btn btn-secondary"
                          style={{ flex: 1, textDecoration: 'none' }}
                        >
                          <Phone size={16} />
                          Call
                        </a>
                      )}
                      <button
                        className="btn btn-success"
                        style={{ flex: 2, gap: '8px' }}
                        onClick={() => onOpenPayment({
                          id: item.loan_id,
                          loan_code: item.loan_code,
                          client_name: item.client_name,
                          installment_amount: item.balance_due,
                          remaining_balance: item.remaining_balance
                        })}
                      >
                        <DollarSign size={16} />
                        Collect & Print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DUE TODAY SECTION */}
          {dueTodayList.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fbbf24',
                fontWeight: '800',
                fontSize: '0.95rem',
                marginBottom: '12px'
              }}>
                <Clock size={20} />
                <span>SCHEDULED FOR TODAY ({dueTodayList.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px' }}>
                {dueTodayList.map((item, idx) => (
                  <div
                    key={`col-today-${idx}`}
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {item.client_name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {item.loan_code} • Installment #{item.installment_no} of 58
                          </div>
                        </div>
                        <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                          Due Today
                        </span>
                      </div>

                      <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        margin: '10px 0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem' }}>
                          <span style={{ fontWeight: '600' }}>Due Amount:</span>
                          <span style={{ fontWeight: '800', color: '#60a5fa' }}>
                            Rs. {Number(item.balance_due).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                      {item.client_phone && (
                        <a
                          href={`tel:${item.client_phone}`}
                          className="btn btn-secondary"
                          style={{ flex: 1, textDecoration: 'none' }}
                        >
                          <Phone size={16} />
                          Call
                        </a>
                      )}
                      <button
                        className="btn btn-success"
                        style={{ flex: 2, gap: '8px' }}
                        onClick={() => onOpenPayment({
                          id: item.loan_id,
                          loan_code: item.loan_code,
                          client_name: item.client_name,
                          installment_amount: item.balance_due,
                          remaining_balance: item.remaining_balance
                        })}
                      >
                        <DollarSign size={16} />
                        Collect & Print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
