import React from 'react';
import { Printer, X, Share2, Smartphone } from 'lucide-react';

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

  // Generate 384px wide hardware-exact image for 57mm roll (48mm print head @ 203 DPI)
  const handleSendToThermalApp = async () => {
    try {
      // Helper function: runs in measure mode (ctx === null) or draw mode (ctx provided)
      const render = (ctx) => {
        let y = 18;

        const drawCenter = (text, font, isBold = true) => {
          if (ctx) {
            ctx.save();
            ctx.font = `${isBold ? 'bold ' : ''}${font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(text, 192, y);
            ctx.restore();
          }
        };

        const drawRow = (label, val, isHeavy = false, isUnderline = false) => {
          if (ctx) {
            ctx.save();
            ctx.font = `bold ${isHeavy ? '19px' : '18px'} Arial, Helvetica, sans-serif`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(label, 8, y);
            ctx.textAlign = 'right';
            ctx.fillText(val, 376, y);
            if (isUnderline) {
              const tw = ctx.measureText(val).width;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(376 - tw, y + 22);
              ctx.lineTo(376, y + 22);
              ctx.stroke();
            }
            ctx.restore();
          }
          y += 30;
        };

        const drawDivider = () => {
          if (ctx) {
            ctx.save();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([7, 4]);
            ctx.beginPath();
            ctx.moveTo(8, y + 8);
            ctx.lineTo(376, y + 8);
            ctx.stroke();
            ctx.restore();
          }
          y += 20;
        };

        // 1. Header
        drawCenter('SADHAN APEX (PVT) LTD', '24px Arial, sans-serif', true);
        y += 30;
        drawCenter('MICRO FINANCIAL SERVICES', '16px Arial, sans-serif', true);
        y += 22;
        drawCenter('TEL: +94 76 108 3006', '16px Arial, sans-serif', true);
        y += 22;
        drawCenter('OFFICIAL REPAYMENT RECEIPT', '14px Arial, sans-serif', true);
        y += 22;

        drawDivider();

        // 2. Receipt metadata
        drawRow('RECEIPT NO:', String(receipt.receipt_no || ''), true);
        drawRow('DATE/TIME:', formattedDate, false);
        drawRow('COLLECTOR:', String(receipt.collector_name || 'Staff'), false);

        drawDivider();

        // 3. Client & Loan Details
        drawRow('CLIENT:', String(receipt.client_name || ''), true);
        if (receipt.client_phone) {
          drawRow('CONTACT:', String(receipt.client_phone), false);
        }
        drawRow('LOAN REF:', String(receipt.loan_code || ''), true);
        drawRow('PLAN:', hasPenalty ? `Extended (+${penaltyCount * 8}%)` : '58 Days (2-Month)', hasPenalty);
        drawRow('INSTALLMENT:', `#${receipt.current_installment_no || 1} of ${receipt.installment_count || 58}`, true, true);

        drawDivider();

        // 4. Payment
        drawRow('PAYMENT:', `${receipt.payment_type === 'PARTIAL' ? '*PARTIAL*' : 'FULL'} (${receipt.payment_method || 'CASH'})`, true);

        // 5. Overdue Penalty Box
        if (hasPenalty) {
          y += 6;
          const pBoxTop = y;
          const boxH = totalPenalties > 0 ? 76 : 56;
          if (ctx) {
            ctx.save();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(8, pBoxTop, 368, boxH);
            ctx.restore();
          }

          y = pBoxTop + 10;
          drawCenter('*** OVERDUE PENALTY ***', '14px Arial, sans-serif', true);
          y += 20;
          drawCenter(`+${penaltyCount * 8}% on remaining balance`, '13px Arial, sans-serif', true);
          y += 20;
          if (totalPenalties > 0) {
            drawCenter(`Added: + Rs. ${Math.round(totalPenalties).toLocaleString()}`, '14px Arial, sans-serif', true);
          }
          y = pBoxTop + boxH + 8;
        }

        // 6. Amount Received Box (with generous 12px internal clearance)
        y += 8;
        const boxTopY = y;
        const boxHeight = 78;
        if (ctx) {
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeRect(8, boxTopY, 368, boxHeight);
          ctx.restore();
        }

        y = boxTopY + 12;
        drawCenter('AMOUNT RECEIVED', '14px Arial, sans-serif', true);
        y += 22;
        drawCenter(`Rs. ${Math.round(Number(receipt.amount_paid)).toLocaleString()}`, '32px Arial, sans-serif', true);
        y = boxTopY + boxHeight + 14;

        // 7. Balances
        drawRow('PREV BALANCE:', `Rs. ${Math.round(Number(receipt.previous_balance)).toLocaleString()}`, false);
        drawRow('REMAINING BAL:', `Rs. ${Math.round(Number(receipt.remaining_balance)).toLocaleString()}`, true);

        if (hasPenalty && totalPenalties > 0) {
          drawRow('INCL. PENALTY:', `+ Rs. ${Math.round(totalPenalties).toLocaleString()}`, false);
        }

        // 8. Next Due Date
        if (receipt.next_due_date && receipt.next_due_date !== 'Completed') {
          drawDivider();
          drawRow('NEXT DUE DATE:', formatReceiptDateOnly(receipt.next_due_date), false);
          if (receipt.next_due_amount > 0) {
            drawRow('NEXT DUE AMT:', `Rs. ${Math.round(Number(receipt.next_due_amount)).toLocaleString()}`, true);
          }
        }

        // 9. Notes
        if (receipt.notes) {
          if (ctx) {
            ctx.save();
            ctx.font = 'bold 15px Arial, sans-serif';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(`Note: ${receipt.notes}`, 8, y);
            ctx.restore();
          }
          y += 26;
        }

        drawDivider();

        // 10. Footer & Company Credits (never cut off)
        drawCenter('Thank you for your payment!', '17px Arial, sans-serif', true);
        y += 24;
        drawCenter('Keep this receipt for your records.', '14px Arial, sans-serif', true);
        y += 22;
        drawCenter('© Nexora Software Solutions', '16px Arial, sans-serif', true);
        y += 24;

        // 11. Extra bottom feed space so printer tear cutter doesn't cut through credits
        y += 70;

        return y;
      };

      // Pass 1: Measure EXACT required height dynamically
      const requiredHeight = Math.ceil(render(null));

      // Pass 2: Create canvas sized to exact height
      const canvas = document.createElement('canvas');
      canvas.width = 384; // 48mm hardware print width at 203 DPI (384 dots)
      canvas.height = requiredHeight;
      const ctx = canvas.getContext('2d');

      // Solid white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 384, requiredHeight);

      // Black text styling
      ctx.fillStyle = '#000000';

      // Draw all elements
      render(ctx);

      // Pure Black High-Contrast Binarization
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (brightness < 230) {
          data[i] = 0;       // Red
          data[i + 1] = 0;   // Green
          data[i + 2] = 0;   // Blue
          data[i + 3] = 255; // Alpha
        } else {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const fileName = `Receipt-${receipt.receipt_no || 'loan'}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Receipt ${receipt.receipt_no}`,
              text: `Thermal receipt for ${receipt.client_name}`
            });
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
            console.warn('Share error, downloading fallback:', shareErr);
          }
        }

        // Direct download fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      }, 'image/png');
    } catch (e) {
      console.error('Failed to generate thermal receipt image:', e);
      window.print();
    }
  };

  return (
    <div className="modal-overlay thermal-receipt-modal">
      <div className="modal-content thermal-modal-content" style={{ maxWidth: '380px' }}>
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
                {hasPenalty ? `Extended (+${penaltyCount * 8}%)` : '58 Days (2-Month)'}
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
              <div style={{ fontWeight: '800', fontSize: '12px', color: '#000000' }}>Thank you for your payment!</div>
              <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '2px', color: '#000000' }}>
                Keep this receipt for your records.
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: '900',
                marginTop: '8px',
                color: '#000000',
                borderTop: '2px dashed #000000',
                paddingTop: '6px'
              }}>
                © Nexora Software Solutions
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              className="btn btn-primary"
              style={{
                flex: 1.2,
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              onClick={handleSendToThermalApp}
              title="Open direct 384px image in Thermal Bluetooth Printer app"
            >
              <Smartphone size={18} />
              Send to Thermal App
            </button>
            <button
              className="btn btn-secondary"
              style={{
                flex: 0.9,
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '600'
              }}
              onClick={handlePrint}
              title="Print via standard AirPrint dialog"
            >
              <Printer size={17} />
              AirPrint
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: '#94a3b8' }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
