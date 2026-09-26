import React from 'react';
import { DollarSign, Phone, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

export default function CollectionsView({
  reminders,
  onOpenPayment
}) {
  const penaltiesList = reminders?.penalties || [];

  // Group overdue accounts by loan so each account appears only once with highest days late
  const rawOverdue = reminders?.overdue || [];
  const overdueMap = new Map();
  for (const item of rawOverdue) {
    const key = item.loan_id || item.loan_code;
    if (!overdueMap.has(key)) {
      overdueMap.set(key, { ...item });
    } else {
      const existing = overdueMap.get(key);
      existing.missed_installments_count = (existing.missed_installments_count || 1) + 1;
      if (item.days_late > existing.days_late) {
        existing.days_late = item.days_late;
        existing.due_date = item.due_date;
        existing.installment_no = item.installment_no;
      }
    }
  }
  const overdueList = Array.from(overdueMap.values()).sort((a, b) => b.days_late - a.days_late);

  const rawDueToday = reminders?.due_today || [];
  const dueTodayMap = new Map();
  for (const item of rawDueToday) {
    const key = item.loan_id || item.loan_code;
    if (!dueTodayMap.has(key)) dueTodayMap.set(key, { ...item });
  }
  const dueTodayList = Array.from(dueTodayMap.values());

  const totalCollections = penaltiesList.length + overdueList.length + dueTodayList.length;

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Daily Field Collections</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Queue of accounts due today, overdue installments, and 58-day limit exceeded penalties for field collection
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
            No installments are currently due, overdue, or penalized. Excellent collection performance!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 1. SCHEDULED FOR TODAY SECTION (Priority Queue) */}
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

            {dueTodayList.length === 0 ? (
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px dashed rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                color: 'var(--text-muted)',
                fontSize: '0.88rem'
              }}>
                No standard installments scheduled specifically for today. All active accounts are either collected or listed in Overdue below.
              </div>
            ) : (
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
                            {item.loan_code} • Installment #{item.installment_no}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Today's Installment:</span>
                          <span style={{ fontWeight: '600' }}>Rs. {Math.round(Number(item.installment_amount || item.balance_due)).toLocaleString()}</span>
                        </div>
                        {Number(item.past_overdue_amount) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '4px', color: '#f87171' }}>
                            <span>Past Arrears ({item.missed_installments_count} missed):</span>
                            <span style={{ fontWeight: '700' }}>Rs. {Math.round(Number(item.past_overdue_amount)).toLocaleString()}</span>
                          </div>
                        )}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '1.05rem',
                          marginTop: Number(item.past_overdue_amount) > 0 ? '6px' : '2px',
                          borderTop: Number(item.past_overdue_amount) > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          paddingTop: Number(item.past_overdue_amount) > 0 ? '6px' : 0
                        }}>
                          <span style={{ fontWeight: '700' }}>{Number(item.past_overdue_amount) > 0 ? 'Total to Pay Today:' : 'Due Amount:'}</span>
                          <span style={{ fontWeight: '800', color: '#60a5fa' }}>
                            Rs. {Math.round(Number(item.total_due_to_date || item.balance_due)).toLocaleString()}
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
                          installment_amount: item.total_due_to_date || item.balance_due,
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
            )}
          </div>

          {/* 2. OVERDUE ACCOUNTS SECTION */}
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
                            {item.loan_code} • {item.missed_installments_count} missed installment{item.missed_installments_count > 1 ? 's' : ''} (since #{item.installment_no})
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
                          <span style={{ color: 'var(--text-muted)' }}>Overdue Since:</span>
                          <span style={{ fontWeight: '600' }}>{item.due_date}</span>
                        </div>
                        {Number(item.missed_installments_count) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                            <span>Past Missed ({item.missed_installments_count} days):</span>
                            <span style={{ fontWeight: '600', color: '#fca5a5' }}>
                              Rs. {Math.round(Number(item.past_overdue_amount || item.total_missed_amount || item.balance_due)).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {Number(item.today_installment_amount) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '2px', color: 'var(--text-muted)' }}>
                            <span>Due Today:</span>
                            <span style={{ fontWeight: '600', color: '#fbbf24' }}>
                              Rs. {Math.round(Number(item.today_installment_amount)).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '1.05rem',
                          marginTop: '6px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                          paddingTop: '6px'
                        }}>
                          <span style={{ fontWeight: '700' }}>Total to Pay to Date:</span>
                          <span style={{ fontWeight: '800', color: '#f87171' }}>
                            Rs. {Math.round(Number(item.total_due_to_date || item.balance_due)).toLocaleString()}
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
                          installment_amount: item.total_due_to_date || item.balance_due,
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

          {/* 3. 58-DAY LIMIT EXCEEDED PENALTIES SECTION */}
          {penaltiesList.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ef4444',
                fontWeight: '800',
                fontSize: '0.95rem',
                marginBottom: '12px'
              }}>
                <AlertTriangle size={20} />
                <span>58-DAY LIMIT EXCEEDED • PENALTIES ({penaltiesList.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px' }}>
                {penaltiesList.map((item, idx) => (
                  <div
                    key={`col-penalty-${idx}`}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
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
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.loan_code} • 58-Day Limit Exceeded
                          </div>
                        </div>
                        <span className="status-badge" style={{ background: '#ef4444', color: '#fff', fontWeight: '800' }}>
                          8% Penalty Added
                        </span>
                      </div>

                      <div style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        margin: '10px 0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Overdue Window:</span>
                          <span style={{ fontWeight: '600', color: '#fca5a5' }}>{item.days_overdue} days past 58 days</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', marginTop: '6px' }}>
                          <span style={{ fontWeight: '600' }}>Outstanding Balance:</span>
                          <span style={{ fontWeight: '800', color: '#f87171' }}>
                            Rs. {Math.round(Number(item.remaining_balance)).toLocaleString()}
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
                          installment_amount: item.installment_amount || item.remaining_balance,
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
