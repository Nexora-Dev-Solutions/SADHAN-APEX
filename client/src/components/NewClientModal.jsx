import React, { useState } from 'react';
import { UserPlus, X, Check, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

// Sri Lankan NIC format: 9 digits + V/X (Old) OR 12 digits (New)
export function validateSriLankanNic(val) {
  if (!val || !val.trim()) return { valid: true, type: null, clean: '' };
  const clean = val.trim().toUpperCase();
  const oldRegex = /^[0-9]{9}[VX]$/;
  const newRegex = /^[0-9]{12}$/;
  if (oldRegex.test(clean)) return { valid: true, type: 'OLD', clean };
  if (newRegex.test(clean)) return { valid: true, type: 'NEW', clean };
  return { valid: false, type: null, clean };
}

// Sri Lankan Phone format: 10 digits starting with 0 (e.g. 0771234567)
export function validateSriLankanPhone(val) {
  if (!val || !val.trim()) return { valid: false, clean: '' };
  let clean = val.trim().replace(/[\s\-()]/g, '');
  if (clean.startsWith('+94')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('94') && clean.length === 11) clean = '0' + clean.slice(2);
  const valid = /^0[0-9]{9}$/.test(clean);
  return { valid, clean };
}

export default function NewClientModal({ token, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nicId, setNicId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const nicValidation = validateSriLankanNic(nicId);
  const phoneValidation = validateSriLankanPhone(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Client Name is required.');
      return;
    }

    if (!phoneValidation.valid) {
      setError('Invalid Phone Number. Must be a 10-digit Sri Lankan phone number (e.g., 0771234567).');
      return;
    }

    if (nicId.trim() && !nicValidation.valid) {
      setError('Invalid NIC format. Must be 9 digits followed by V/X (e.g., 842100452V) or 12 digits (e.g., 198421004521).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phoneValidation.clean,
          nic_id: nicValidation.clean,
          address: address.trim(),
          notes: notes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register client');
      }

      onSuccess(data.client);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={22} color="#3b82f6" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Register New Client</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                lineHeight: 1.45
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
                <div>
                  <strong>Validation Notice:</strong>
                  <div style={{ marginTop: '2px' }}>{error}</div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sunil Wickramasinghe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Phone Number *</label>
                  {phone.trim() && (
                    phoneValidation.valid ? (
                      <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Check size={12} /> Valid 10-digit
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>
                        e.g. 0771234567
                      </span>
                    )
                  )}
                </div>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="0771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    borderColor: phone.trim() ? (phoneValidation.valid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(245, 158, 11, 0.5)') : undefined
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>NIC / National ID</label>
                  {nicId.trim() && (
                    nicValidation.valid ? (
                      <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ShieldCheck size={12} /> {nicValidation.type === 'OLD' ? '9-digit + V/X' : '12-digit'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#f87171' }}>
                        Invalid format
                      </span>
                    )
                  )}
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="842100452V or 198421004521"
                  value={nicId}
                  onChange={(e) => setNicId(e.target.value.toUpperCase())}
                  style={{
                    borderColor: nicId.trim() ? (nicValidation.valid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)') : undefined
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Sri Lankan NIC (9 digits + V/X or 12 digits). Strictly checked for duplicates.
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Physical Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="Shop No, Street, City"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Business / Notes</label>
              <textarea
                className="form-textarea"
                rows="2"
                placeholder="e.g. Vegetable stall vendor at main market"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || (nicId.trim() && !nicValidation.valid) || (phone.trim() && !phoneValidation.valid)}
              style={{ gap: '8px' }}
            >
              <Check size={18} />
              {isSubmitting ? 'Saving...' : 'Register Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
