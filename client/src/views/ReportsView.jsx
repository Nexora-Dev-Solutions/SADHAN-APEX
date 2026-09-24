import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Printer,
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Award,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';

export default function ReportsView({ token, currentUser, onReprintReceipt, dataRefreshKey }) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [report, setReport] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters for Transactions & Receipts ledger
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('MONTH'); // 'MONTH' or 'ALL'
  const [hoveredDay, setHoveredDay] = useState(null);

  useEffect(() => {
    loadReportData();
  }, [selectedMonth, token, dataRefreshKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransactions();
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedMonth, search, methodFilter, scopeFilter, token, dataRefreshKey]);

  const loadReportData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/monthly?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load monthly report');
      setReport(data.report);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (scopeFilter === 'MONTH') {
        params.append('month', selectedMonth);
      } else {
        params.append('month', 'ALL');
      }
      if (search.trim()) params.append('search', search.trim());
      if (methodFilter !== 'ALL') params.append('payment_method', methodFilter);
      params.append('limit', '300');

      const res = await fetch(`/api/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const handleMonthChange = (offset) => {
    let [year, month] = selectedMonth.split('-').map(Number);
    month += offset;
    if (month > 12) {
      year += 1;
      month = 1;
    } else if (month < 1) {
      year -= 1;
      month = 12;
    }
    const newMonthStr = `${year}-${String(month).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
  };

  const formatMonthTitle = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[month - 1] || ''} ${year}`;
  };

  const exportToCsv = () => {
    if (!transactions.length) return;
    const headers = [
      'Receipt No',
      'Date',
      'Time',
      'Client Name',
      'Phone',
      'NIC',
      'Loan Code',
      'Payment Type',
      'Payment Method',
      'Amount Paid (Rs)',
      'Remaining Balance (Rs)',
      'Collector'
    ];

    const rows = transactions.map((t) => {
      const d = new Date(t.created_at || Date.now());
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = d.toTimeString().slice(0, 5);
      return [
        `"${t.receipt_no || ''}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${(t.client_name || '').replace(/"/g, '""')}"`,
        `"${t.client_phone || ''}"`,
        `"${t.client_nic || ''}"`,
        `"${t.loan_code || ''}"`,
        `"${t.payment_type || 'FULL'}"`,
        `"${t.payment_method || 'CASH'}"`,
        Number(t.amount_paid || 0).toFixed(2),
        Number(t.remaining_balance || 0).toFixed(2),
        `"${(t.collector_name || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `loanpro_transactions_${scopeFilter === 'MONTH' ? selectedMonth : 'all_history'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare Daily Chart Dimensions & Max Scale
  const daysInMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };
  const totalDays = daysInMonth();
  const dailyDataMap = {};
  (report?.daily_breakdown || []).forEach((d) => {
    dailyDataMap[d.day] = d;
  });

  const dailyChartData = Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    return dailyDataMap[day] || { day, amount: 0, count: 0 };
  });

  const maxDailyAmount = Math.max(...dailyChartData.map((d) => d.amount), 1000);

  return (
    <div>
      {/* Top Header & Month Navigator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={24} color="#3b82f6" />
            Monthly Financial Report & Ledger
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Financial health, field collection analytics, and searchable master receipts
          </p>
        </div>

        {/* Month Selector & CSV Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)',
            padding: '2px 4px'
          }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 8px', border: 'none', background: 'transparent' }}
              onClick={() => handleMonthChange(-1)}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 8px',
              fontWeight: '700',
              fontSize: '0.88rem',
              minWidth: '140px',
              justifyContent: 'center',
              color: '#93c5fd'
            }}>
              <Calendar size={15} color="#3b82f6" />
              <span>{formatMonthTitle(selectedMonth)}</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 8px', border: 'none', background: 'transparent' }}
              onClick={() => handleMonthChange(1)}
              title="Next Month"
              disabled={selectedMonth >= currentMonthStr}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {selectedMonth !== currentMonthStr && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedMonth(currentMonthStr)}
            >
              Current Month
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { loadReportData(); loadTransactions(); }}
            title="Refresh Report Data"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={exportToCsv}
            disabled={!transactions.length}
            style={{ gap: '6px' }}
            title="Download formatted Excel/CSV spreadsheet"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--danger-bg)',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          fontSize: '0.88rem'
        }}>
          {error}
        </div>
      )}

      {/* 4 KEY PERFORMANCE METRIC CARDS */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-label">Total Monthly Collections</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            Rs. {Number(report?.total_collected || 0).toLocaleString()}
          </div>
          <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>
            🧾 {report?.total_payments_count || 0} Receipts logged in {formatMonthTitle(selectedMonth)}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-label">Disbursed Capital (New Loans)</div>
          <div className="stat-value" style={{ color: '#60a5fa' }}>
            Rs. {Number(report?.total_disbursed || 0).toLocaleString()}
          </div>
          <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>
            🤝 {report?.new_loans_count || 0} New 58-Day plans issued
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #a855f7' }}>
          <div className="stat-label">Expected Markup (8% Profit)</div>
          <div className="stat-value" style={{ color: '#c084fc' }}>
            + Rs. {Number(report?.total_interest_earned || 0).toLocaleString()}
          </div>
          <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>
            📊 Contractual interest on month's loans
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="stat-label">Active Paying Clients</div>
          <div className="stat-value" style={{ color: '#fbbf24' }}>
            {report?.unique_clients_paid || 0}
          </div>
          <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>
            👥 Unique individuals paid this month
          </div>
        </div>
      </div>

      {/* CHARTS ROW: Daily Collections Trend & Collector Leaderboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Daily Collection Revenue Bar Chart */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#38bdf8" />
                <span>Daily Collection Velocity</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Day-by-day cash intake across all 58-day loans
              </div>
            </div>
            {hoveredDay && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '0.78rem',
                color: '#38bdf8',
                fontWeight: '700'
              }}>
                Day {hoveredDay.day}: Rs. {hoveredDay.amount.toLocaleString()} ({hoveredDay.count}x)
              </div>
            )}
          </div>

          {/* SVG Visual Bars */}
          <div style={{ width: '100%', height: '170px', display: 'flex', alignItems: 'flex-end', gap: '3px', paddingTop: '10px' }}>
            {dailyChartData.map((d) => {
              const heightPct = Math.max((d.amount / maxDailyAmount) * 100, 3);
              const isPeak = d.amount > 0 && d.amount === maxDailyAmount;
              const hasCollections = d.amount > 0;
              const isHovered = hoveredDay?.day === d.day;

              return (
                <div
                  key={`day-bar-${d.day}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => setHoveredDay(d)}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      background: isHovered
                        ? '#38bdf8'
                        : isPeak
                        ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)'
                        : hasCollections
                        ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.2s ease',
                      boxShadow: isHovered ? '0 0 10px rgba(56, 189, 248, 0.6)' : undefined
                    }}
                  />
                  <div style={{
                    fontSize: '0.62rem',
                    color: isHovered ? '#38bdf8' : 'var(--text-muted)',
                    marginTop: '4px',
                    fontWeight: isHovered || isPeak ? '800' : '400'
                  }}>
                    {d.day % 5 === 0 || d.day === 1 || d.day === totalDays ? d.day : ''}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--surface-border)',
            paddingTop: '8px',
            marginTop: '8px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)'
          }}>
            <span>Day 1</span>
            <span>Hover/Tap bar to inspect day details</span>
            <span>Day {totalDays}</span>
          </div>
        </div>

        {/* Collector Performance Leaderboard */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Award size={18} color="#f59e0b" />
              <span>Collector Contributions</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Cash recoveries logged by field agents this month
            </div>

            {(!report?.collectors_breakdown || report.collectors_breakdown.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No collector records found for this period.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {report.collectors_breakdown.map((c, idx) => {
                  const sharePct = report.total_collected > 0
                    ? Math.round((c.total_collected / report.total_collected) * 100)
                    : 0;

                  return (
                    <div key={`coll-${idx}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {idx + 1}. {c.collector_name}
                        </span>
                        <span style={{ fontWeight: '800', color: '#10b981' }}>
                          Rs. {c.total_collected.toLocaleString()}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({c.receipts_count} receipts • {sharePct}%)
                          </span>
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '7px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(sharePct, 100)}%`,
                          height: '100%',
                          background: idx === 0
                            ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                            : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Badges */}
          <div style={{
            display: 'flex',
            gap: '8px',
            borderTop: '1px solid var(--surface-border)',
            paddingTop: '12px',
            marginTop: '16px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment Channel:</span>
            {(report?.methods_breakdown || []).map((m, idx) => (
              <span
                key={`method-${idx}`}
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.25)'
                }}
              >
                {m.payment_method}: <strong>Rs. {m.amount.toLocaleString()}</strong> ({m.count}x)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* MASTER TRANSACTIONS & RECEIPTS LEDGER SECTION */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginTop: '10px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🧾 Master Transactions & Receipts Ledger</span>
              <span style={{
                fontSize: '0.75rem',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: '700'
              }}>
                {transactions.length} Records
              </span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Search across historical receipts, inspect balances, and reprint physical thermal receipts
            </p>
          </div>

          {/* Quick Scope Switcher */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn btn-sm ${scopeFilter === 'MONTH' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setScopeFilter('MONTH')}
              style={{ fontSize: '0.78rem', padding: '6px 10px' }}
            >
              {formatMonthTitle(selectedMonth)}
            </button>
            <button
              className={`btn btn-sm ${scopeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setScopeFilter('ALL')}
              style={{ fontSize: '0.78rem', padding: '6px 10px' }}
            >
              All History
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search Receipt # (REC-...), Client Name, NIC, Loan Code..."
              style={{ paddingLeft: '36px', fontSize: '0.86rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Method Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'CASH', 'BANK_TRANSFER'].map((method) => (
              <button
                key={method}
                className={`btn btn-sm ${methodFilter === method ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                onClick={() => setMethodFilter(method)}
              >
                {method === 'ALL' ? 'All Channels' : method.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="desktop-table-view">
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No transaction receipts found matching your search.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', minWidth: '950px' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap', width: '130px' }}>Receipt #</th>
                    <th style={{ whiteSpace: 'nowrap', width: '140px' }}>Date & Time</th>
                    <th style={{ minWidth: '180px' }}>Client & Contact</th>
                    <th style={{ whiteSpace: 'nowrap', width: '120px' }}>Loan Ref</th>
                    <th style={{ whiteSpace: 'nowrap', width: '90px' }}>Method</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '130px' }}>Amount Paid</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '140px' }}>Remaining Bal</th>
                    <th style={{ whiteSpace: 'nowrap', width: '140px' }}>Collector</th>
                    <th style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '100px' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const d = new Date(t.created_at || Date.now());
                    const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={`tx-${t.id}`}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontWeight: '800',
                            fontFamily: 'monospace',
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.1)',
                            padding: '3px 7px',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            {t.receipt_no}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '600' }}>{dateFormatted}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{timeFormatted}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{t.client_name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {t.client_phone} {t.client_nic ? `• ${t.client_nic}` : ''}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {t.loan_code}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: t.payment_method === 'CASH' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: t.payment_method === 'CASH' ? '#34d399' : '#60a5fa'
                          }}>
                            {t.payment_method || 'CASH'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#10b981', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
                          Rs. {Math.round(Number(t.amount_paid)).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          Rs. {Math.round(Number(t.remaining_balance)).toLocaleString()}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                            {t.collector_name || 'Staff'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ gap: '4px', padding: '5px 9px', fontSize: '0.76rem' }}
                            onClick={() => onReprintReceipt(t)}
                            title="Reprint thermal receipt slip"
                          >
                            <Printer size={13} color="#38bdf8" />
                            <span>Reprint</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="mobile-card-view" style={{ display: 'none' }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No transaction receipts found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {transactions.map((t) => {
                const d = new Date(t.created_at || Date.now());
                const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={`mobile-tx-${t.id}`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: '800',
                          color: '#38bdf8',
                          fontSize: '0.85rem'
                        }}>
                          {t.receipt_no}
                        </span>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                          {t.client_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t.loan_code} • {dateFormatted} {timeFormatted}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#10b981' }}>
                          Rs. {Math.round(Number(t.amount_paid)).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Bal: Rs. {Math.round(Number(t.remaining_balance)).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: '8px',
                      marginTop: '4px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Collector: <strong>{t.collector_name || 'Staff'}</strong>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ gap: '5px', padding: '6px 12px', fontSize: '0.78rem' }}
                        onClick={() => onReprintReceipt(t)}
                      >
                        <Printer size={13} color="#38bdf8" />
                        Reprint
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
