import React, { useState } from 'react';
import { Printer, X, CheckCircle, Bluetooth, Share2, Copy, Check, Smartphone } from 'lucide-react';
import { printDirectWebBluetooth, generateTextReceipt, generateEscPos } from '../utils/thermalPrinter';

export default function ThermalReceipt({ receipt, onClose }) {
  if (!receipt) return null;

  const [paperWidth, setPaperWidth] = useState('58mm'); // '58mm' | '80mm'
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [btStatus, setBtStatus] = useState('');
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    setIsBluetoothPrinting(true);
    setBtStatus('Pairing with Bluetooth printer...');
    try {
      await printDirectWebBluetooth(receipt, paperWidth === '80mm' ? 48 : 32);
      setBtStatus('✓ Printed successfully!');
      setTimeout(() => setBtStatus(''), 4000);
    } catch (err) {
      console.warn('Bluetooth print notice:', err);
      // If user cancelled device picker, or bluetooth not available
      setBtStatus(err.message.includes('User cancelled') ? 'Pairing cancelled' : (err.message || 'Bluetooth connection failed'));
      setTimeout(() => setBtStatus(''), 6000);
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const handleRawBtPrint = () => {
    try {
      const escBytes = generateEscPos(receipt, paperWidth === '80mm' ? 48 : 32);
      let binary = '';
      for (let i = 0; i < escBytes.byteLength; i++) {
        binary += String.fromCharCode(escBytes[i]);
      }
      const base64 = btoa(binary);
      // RawBT / Thermal Bluetooth Printer Android intent URL
      window.location.href = `rawbt:data:application/octet-stream;base64,${base64}`;
    } catch (err) {
      handlePrint();
    }
  };

  const handleWhatsAppShare = () => {
    const text = generateTextReceipt(receipt, 32);
    const phone = (receipt.client_phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '94' + phone.slice(1) : phone;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    const text = generateTextReceipt(receipt, 32);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={20} color="#3b82f6" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>Thermal Receipt Terminal</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Paper Size & Direct Bluetooth Bar */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid var(--surface-border)',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>ROLL WIDTH:</span>
            <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px', border: '1px solid var(--surface-border)' }}>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                style={{
                  border: 'none',
                  background: paperWidth === '58mm' ? 'var(--accent-primary)' : 'transparent',
                  color: paperWidth === '58mm' ? '#fff' : 'var(--text-muted)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                58mm (Pocket POS)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                style={{
                  border: 'none',
                  background: paperWidth === '80mm' ? 'var(--accent-primary)' : 'transparent',
                  color: paperWidth === '80mm' ? '#fff' : 'var(--text-muted)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                80mm (Counter POS)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleWhatsAppShare}
              title="Share receipt via WhatsApp"
              style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}
            >
              <Share2 size={13} />
              WhatsApp
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCopyText}
              title="Copy receipt plain text"
              style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
            >
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {btStatus && (
          <div className="no-print" style={{
            background: btStatus.includes('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: btStatus.includes('✓') ? '#34d399' : '#60a5fa',
            padding: '8px 16px',
            fontSize: '0.78rem',
            textAlign: 'center',
            fontWeight: '600',
            borderBottom: '1px solid var(--surface-border)'
          }}>
            {btStatus}
          </div>
        )}

        <div className="modal-body" style={{ background: '#0a0e17' }}>
          {/* Thermal Receipt Paper representation */}
          <div className={`thermal-receipt-container ${paperWidth === '80mm' ? 'roll-80mm' : ''}`}>
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
              <span className="receipt-value" style={{ fontWeight: hasPenalty ? '800' : 'normal' }}>
                {hasPenalty ? `Extended (${penaltyCount}x 58-Cycles Exceeded)` : '54 Days (58-Day Limit)'}
              </span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">INSTALLMENT #:</span>
              <span className="receipt-value" style={{ textDecoration: 'underline', fontWeight: '800' }}>
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

            {/* Overdue Penalty Notice Box if loan exceeded 58-day cycles */}
            {hasPenalty && (
              <div style={{
                margin: '8px 0',
                padding: '6px 8px',
                border: '1.5px dashed #000',
                borderRadius: '4px',
                background: '#fafafa',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.04em' }}>
                  *** OVERDUE PENALTY NOTICE ***
                </div>
                <div style={{ fontSize: '9px', fontWeight: '700', marginTop: '2px', color: '#111' }}>
                  {penaltyCount > 1 
                    ? `${penaltyCount}x 58-Installment Sets Exceeded (+${penaltyCount * 8}% Overdue Penalties)`
                    : '58-Installment Limit Exceeded (+8% Overdue Penalty)'}
                </div>
                {totalPenalties > 0 && (
                  <div style={{ fontSize: '9.5px', fontWeight: '800', marginTop: '2px' }}>
                    Total Penalty Added: + Rs. {Math.round(totalPenalties).toLocaleString()}
                  </div>
                )}
                <div style={{ fontSize: '8.5px', color: '#333', marginTop: '2px' }}>
                  Installment count extended to #{receipt.installment_count || 58} slots.
                </div>
              </div>
            )}

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
            {hasPenalty && totalPenalties > 0 && (
              <div className="receipt-row" style={{ fontSize: '9px', color: '#444', marginTop: '1px' }}>
                <span className="receipt-label">INCL. OVERDUE PENALTY:</span>
                <span className="receipt-value" style={{ fontWeight: '700' }}>
                  + Rs. {Math.round(totalPenalties).toLocaleString()} ({penaltyCount}x 8%)
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

        <div className="modal-footer no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '14px 16px' }}>
          {/* Main Print Actions Row */}
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              className="btn btn-primary"
              style={{
                flex: 1.5,
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
              }}
              onClick={handleBluetoothPrint}
              disabled={isBluetoothPrinting}
            >
              <Bluetooth size={18} />
              <span>{isBluetoothPrinting ? 'Connecting...' : 'Direct Bluetooth Print'}</span>
            </button>

            <button
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center', gap: '6px' }}
              onClick={handlePrint}
              title="Standard browser print (optimized for 58mm paper)"
            >
              <Printer size={16} />
              <span>System Print</span>
            </button>
          </div>

          {/* Secondary Actions Row */}
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, justifyContent: 'center', gap: '6px', fontSize: '0.76rem' }}
              onClick={handleRawBtPrint}
              title="Open directly in RawBT or Thermal Bluetooth Printer Android app"
            >
              <Smartphone size={14} />
              <span>Thermal App Print</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '80px', justifyContent: 'center' }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
