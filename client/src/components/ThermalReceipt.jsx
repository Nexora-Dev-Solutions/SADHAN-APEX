import React from 'react';
import { Printer, X, Share2 } from 'lucide-react';

export default function ThermalReceipt({ receipt, onClose }) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const lines = [
      'SADHAN APEX (PVT) LTD',
      'TEL: +94 76 108 3006',
      '--------------------------------',
      `RECEIPT NO: ${receipt.receipt_no}`,
      `DATE: ${formattedDate}`,
      `COLLECTOR: ${receipt.collector_name || 'Staff'}`,
      '--------------------------------',
      `CLIENT: ${receipt.client_name}`,
      receipt.client_phone ? `CONTACT: ${receipt.client_phone}` : '',
      `LOAN REF: ${receipt.loan_code}`,
      `INSTALLMENT: #${receipt.current_installment_no || 1} of ${receipt.installment_count || 58}`,
      '================================',
      `AMOUNT RECEIVED: Rs. ${Math.round(Number(receipt.amount_paid)).toLocaleString()}`,
      '================================',
      `PREV BALANCE: Rs. ${Math.round(Number(receipt.previous_balance)).toLocaleString()}`,
      `REMAINING BAL: Rs. ${Math.round(Number(receipt.remaining_balance)).toLocaleString()}`,
      receipt.next_due_date && receipt.next_due_date !== 'Completed' ? `NEXT DUE: ${formatReceiptDateOnly(receipt.next_due_date)}` : '',
      receipt.next_due_amount > 0 ? `NEXT AMOUNT: Rs. ${Math.round(Number(receipt.next_due_amount)).toLocaleString()}` : '',
      '--------------------------------',
      'Thank you for your payment!'
    ].filter(Boolean).join('\n');

    const phone = (receipt.client_phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '94' + phone.slice(1) : phone;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  };

  const formattedDate = new Date(receipt.created_at || Date.now()).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formatReceiptDateOnly = (val) => {
    if (!val || val === 'Completed') return val;
    let str = '';
    try {
      str = typeof val === 'string' ? val.split('T')[0] : (val instanceof Date && !isNaN(val.getTime()) ? val.toISOString().split('T')[0] : String(val).split('T')[0]);
    } catch (e) {
      return String(val);
    }
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return str;
    const dateObj = new Date(y, m - 1, d);
    return !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : str;
  };

  const pCountFromReceipt = parseInt(receipt.penalty_count, 10);
  const pCountFromNotes = receipt.loan_notes ? (receipt.loan_notes.match(/\[Penalty/g) || []).length : 0;
  const penaltyCount = !isNaN(pCountFromReceipt) && pCountFromReceipt > 0
    ? pCountFromReceipt
    : (pCountFromNotes > 0 ? pCountFromNotes : (receipt.penalty_applied ? 1 : 0));
  
  const hasPenalty = Boolean(penaltyCount > 0 || receipt.penalty_applied || (receipt.current_installment_no > 58));

  let totalPenalties = parseFloat(receipt.total_penalties) || 0;
  if (!totalPenalties && receipt.loan_notes) {
    const matches = receipt.loan_notes.match(/Rs\.\s*([\d,]+(?:\.\d+)?)/g);
    if (matches) {
      totalPenalties = matches.reduce((sum, m) => sum + parseFloat(m.replace(/[^\d.]/g, '') || 0), 0);
    }
  }

  return (
    <div className="modal-overlay thermal-receipt-modal">
      <div className="modal-content" style={{ maxWidth: '380px' }}>
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={18} color="#3b82f6" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Thermal Receipt (58mm)</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleWhatsAppShare}
              title="Share receipt via WhatsApp"
              style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}
            >
              <Share2 size={13} />
              WhatsApp
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ background: '#0a0e17', padding: '14px 10px' }}>
          {/* Thermal Receipt Paper - EXACT 48mm hardware print width */}
          <div className="thermal-receipt-container">
            <div className="receipt-header">
              <div className="receipt-title">
                SADHAN APEX (PVT) LTD
              </div>
              <div className="receipt-subtitle">
                MICRO FINANCIAL SERVICES
              </div>
              <div style={{ fontSize: '10px', color: '#222', fontWeight: '700', marginTop: '2px' }}>
                TEL: +94 76 108 3006
              </div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '1px' }}>
                OFFICIAL REPAYMENT RECEIPT
              </div>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-row">
              <span className="receipt-label">RECEIPT NO:</span>
              <span className="receipt-value">{receipt.receipt_no}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">DATE/TIME:</span>
              <span className="receipt-value">{formattedDate}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">COLLECTOR:</span>
              <span className="receipt-value">{receipt.collector_name || 'Staff'}</span>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-row">
              <span className="receipt-label">CLIENT:</span>
              <span className="receipt-value">{receipt.client_name}</span>
            </div>
            {receipt.client_phone && (
              <div className="receipt-row">
                <span className="receipt-label">CONTACT:</span>
                <span className="receipt-value">{receipt.client_phone}</span>
              </div>
            )}
            <div className="receipt-row">
              <span className="receipt-label">LOAN REF:</span>
              <span className="receipt-value">{receipt.loan_code}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">PLAN:</span>
              <span className="receipt-value" style={{ fontWeight: hasPenalty ? '800' : 'normal' }}>
                {hasPenalty ? `Extended (+${penaltyCount * 8}%)` : '54 Days (58-Lim)'}
              </span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">INSTALLMENT:</span>
              <span className="receipt-value" style={{ textDecoration: 'underline', fontWeight: '800' }}>
                #{receipt.current_installment_no || 1} of {receipt.installment_count || 58}
              </span>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-row">
              <span className="receipt-label">PAYMENT:</span>
              <span className="receipt-value" style={{ fontWeight: '800' }}>
                {receipt.payment_type === 'PARTIAL' ? '*PARTIAL*' : 'FULL'} ({receipt.payment_method || 'CASH'})
              </span>
            </div>

            {/* Overdue Penalty Notice */}
            {hasPenalty && (
              <div style={{
                margin: '6px 0',
                padding: '4px 6px',
                border: '1px dashed #000',
                borderRadius: '3px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '9px', fontWeight: '900' }}>
                  *** OVERDUE PENALTY ***
                </div>
                <div style={{ fontSize: '8.5px', fontWeight: '700', color: '#111' }}>
                  +{penaltyCount * 8}% on remaining balance
                </div>
                {totalPenalties > 0 && (
                  <div style={{ fontSize: '9px', fontWeight: '800' }}>
                    Added: + Rs. {Math.round(totalPenalties).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Prominent Amount Box - Clean border to prevent thermal ink smear */}
            <div className="receipt-amount-box">
              <div className="receipt-amount-title">AMOUNT RECEIVED</div>
              <div className="receipt-amount-main">Rs. {Math.round(Number(receipt.amount_paid)).toLocaleString()}</div>
            </div>

            <div className="receipt-row">
              <span className="receipt-label">PREV BALANCE:</span>
              <span className="receipt-value">Rs. {Math.round(Number(receipt.previous_balance)).toLocaleString()}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label" style={{ fontWeight: '800' }}>REMAINING BAL:</span>
              <span className="receipt-value" style={{ fontWeight: '800' }}>
                Rs. {Math.round(Number(receipt.remaining_balance)).toLocaleString()}
              </span>
            </div>
            {hasPenalty && totalPenalties > 0 && (
              <div className="receipt-row" style={{ fontSize: '9px', color: '#333' }}>
                <span className="receipt-label">INCL. PENALTY:</span>
                <span className="receipt-value" style={{ fontWeight: '700' }}>
                  + Rs. {Math.round(totalPenalties).toLocaleString()}
                </span>
              </div>
            )}

            {receipt.next_due_date && receipt.next_due_date !== 'Completed' && (
              <>
                <div className="receipt-divider"></div>
                <div className="receipt-row">
                  <span className="receipt-label">NEXT DUE DATE:</span>
                  <span className="receipt-value">{formatReceiptDateOnly(receipt.next_due_date)}</span>
                </div>
                {receipt.next_due_amount > 0 && (
                  <div className="receipt-row">
                    <span className="receipt-label">NEXT DUE AMT:</span>
                    <span className="receipt-value">Rs. {Math.round(Number(receipt.next_due_amount)).toLocaleString()}</span>
                  </div>
                )}
              </>
            )}

            {receipt.notes && (
              <div style={{ marginTop: '4px', fontSize: '9px', fontStyle: 'italic' }}>
                Note: {receipt.notes}
              </div>
            )}

            <div className="receipt-divider"></div>

            <div className="receipt-footer">
              <div style={{ fontWeight: '700' }}>Thank you for your payment!</div>
              <div style={{ fontSize: '8.5px', marginTop: '2px', color: '#555' }}>
                Keep this receipt for your records.
              </div>
              <div style={{
                fontSize: '8px',
                marginTop: '6px',
                color: '#777',
                borderTop: '1px dashed #bbb',
                paddingTop: '4px'
              }}>
                © Nexora Software Solutions
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ display: 'flex', gap: '8px', width: '100%', padding: '12px 16px' }}>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Done
          </button>
          <button
            className="btn btn-primary"
            style={{
              flex: 1.8,
              justifyContent: 'center',
              gap: '8px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
            }}
            onClick={handlePrint}
          >
            <Printer size={18} />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
