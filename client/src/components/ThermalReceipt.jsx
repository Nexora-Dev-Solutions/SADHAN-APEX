import React from 'react';
import { Printer, X, CheckCircle } from 'lucide-react';

export default function ThermalReceipt({ receipt, onClose }) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(receipt.created_at || Date.now()).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="modal-overlay thermal-receipt-modal">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={20} color="#3b82f6" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Thermal Receipt Preview</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ background: '#0a0e17' }}>
          {/* Thermal Receipt Paper representation */}
          <div className="thermal-receipt-container">
            <div className="receipt-header">
              <div className="receipt-title" style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.04em' }}>
                SADHAN APEX (PVT) LTD
              </div>
              <div className="receipt-subtitle" style={{ fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>
                MICRO FINANCIAL SERVICES
              </div>
              <div style={{ fontSize: '10px', color: '#333', fontWeight: '600', marginTop: '3px' }}>
                TEL: +94 76 108 3006
              </div>
              <div style={{ fontSize: '9px', color: '#666', marginTop: '1px' }}>
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
              <span className="receipt-value">54 Days (58-Day Limit)</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">INSTALLMENT #:</span>
              <span className="receipt-value" style={{ textDecoration: 'underline' }}>
                #{receipt.current_installment_no || 1} of {receipt.installment_count || 58}
              </span>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-row">
              <span className="receipt-label">PAYMENT TYPE:</span>
              <span className="receipt-value" style={{ fontWeight: '800' }}>
                {receipt.payment_type === 'PARTIAL' ? '*** PARTIAL PAYMENT ***' : 'FULL INSTALLMENT'}
              </span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">PAYMENT METHOD:</span>
              <span className="receipt-value">{receipt.payment_method || 'CASH'}</span>
            </div>

            {/* Prominent Amount Box */}
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

            {receipt.next_due_date && receipt.next_due_date !== 'Completed' && (
              <>
                <div className="receipt-divider"></div>
                <div className="receipt-row">
                  <span className="receipt-label">NEXT DUE DATE:</span>
                  <span className="receipt-value">{receipt.next_due_date}</span>
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
              <div style={{ marginTop: '6px', fontSize: '10px', fontStyle: 'italic' }}>
                Note: {receipt.notes}
              </div>
            )}

            <div className="receipt-divider"></div>

            <div className="receipt-barcode">
              ||||| | |||| ||| || ||||
            </div>

            <div className="receipt-footer">
              <div style={{ fontWeight: '700' }}>Thank you for your payment!</div>
              <div style={{ fontSize: '9px', marginTop: '2px', color: '#666' }}>
                Keep this receipt for your records.
              </div>
              <div style={{
                fontSize: '8px',
                marginTop: '8px',
                color: '#777',
                borderTop: '1px dashed #ccc',
                paddingTop: '5px',
                letterSpacing: '0.02em'
              }}>
                © Nexora Software Solutions • All Rights Reserved
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ display: 'flex', gap: '8px', width: '100%', padding: '12px 16px' }}>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Done
          </button>
          <button className="btn btn-primary" style={{ flex: 1.5, justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }} onClick={handlePrint}>
            <Printer size={18} />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
