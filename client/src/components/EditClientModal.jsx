import React, { useState, useRef } from 'react';
import { Edit3, X, Trash2, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { parseSriLankanNic } from '../utils/nicHelper';
import ClientPhotoCapture from './ClientPhotoCapture';

// Sri Lankan NIC format: 9 digits + V/X (Old) OR 12 digits (New)
function validateSriLankanNic(val) {
  if (!val || !val.trim()) return { valid: false, type: null, clean: '', empty: true };
  const clean = val.trim().toUpperCase();
  const oldRegex = /^[0-9]{9}[VX]$/;
  const newRegex = /^[0-9]{12}$/;
  if (oldRegex.test(clean)) return { valid: true, type: 'OLD', clean, empty: false };
  if (newRegex.test(clean)) return { valid: true, type: 'NEW', clean, empty: false };
  return { valid: false, type: null, clean, empty: false };
}

// Sri Lankan Phone format: 10 digits starting with 0 (e.g. 0771234567)
function validateSriLankanPhone(val) {
  if (!val || !val.trim()) return { valid: false, clean: '' };
  let clean = val.trim().replace(/[\s\-()]/g, '');
  if (clean.startsWith('+94')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('94') && clean.length === 11) clean = '0' + clean.slice(2);
  const valid = /^0[0-9]{9}$/.test(clean);
  return { valid, clean };
}

export default function EditClientModal({ client, token, currentUser, onClose, onSuccess, onDeleted }) {
  if (!client) return null;

  const [photoUrl, setPhotoUrl] = useState(client.photo_url || '');
  const [name, setName] = useState(client.name || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [nicId, setNicId] = useState(client.nic_id || '');
  const [address, setAddress] = useState(client.address || '');
  const [notes, setNotes] = useState(client.notes || '');
  const [businessType, setBusinessType] = useState(client.business_type || '');
  const [kycStatus, setKycStatus] = useState(client.kyc_status || 'VERIFIED');
  const [kycNotes, setKycNotes] = useState(client.kyc_notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const isOwner = currentUser?.role === 'OWNER';

  const nicValidation = validateSriLankanNic(nicId);
  const phoneValidation = validateSriLankanPhone(phone);
  const nicDemographics = parseSriLankanNic(nicId);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting || isDeleting) return;

    setError('');

    if (!name.trim()) {
      setError('Client Name is required.');
      return;
    }

    if (!phoneValidation.valid) {
      setError('Invalid Phone Number. Must be a 10-digit Sri Lankan phone number (e.g., 0771234567).');
      return;
    }

    if (!nicId.trim()) {
      setError('NIC / National Identity Card number is required.');
      return;
    }

    if (!nicValidation.valid) {
      setError('Invalid NIC format. Must be 9 digits followed by V/X (e.g., 842100452V) or 12 digits (e.g., 198421004521).');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phoneValidation.clean,
          nic_id: nicValidation.clean,
          address: address.trim(),
          notes: notes.trim(),
          business_type: businessType.trim(),
          photo_url: photoUrl,
          kyc_status: kycStatus,
          kyc_notes: kycNotes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update client');

      onSuccess(data.client);
    } catch (err) {
      setError(err.message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deletingRef.current || isDeleting || isSubmitting) return;

    setError('');
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete client');

      onDeleted(client.id);
    } catch (err) {
      setError(err.message);
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={20} color="#3b82f6" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Edit Client Details & KYC</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleUpdate}>
          <div className="modal-body" style={{ maxHeight: '74vh', overflowY: 'auto' }}>
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

            <ClientPhotoCapture
              photoUrl={photoUrl}
              onPhotoChange={setPhotoUrl}
              label="Borrower Photo"
            />

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
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
                  <label className="form-label" style={{ margin: 0 }}>NIC / National ID *</label>
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
                  value={nicId}
                  onChange={(e) => setNicId(e.target.value.toUpperCase())}
                  style={{
                    borderColor: nicId.trim() ? (nicValidation.valid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)') : undefined
                  }}
                  required
                />
              </div>
            </div>

            {/* Extracted NIC Demographics Card */}
            {nicDemographics && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.8rem',
                color: '#93c5fd'
              }}>
                <ShieldCheck size={18} color="#3b82f6" />
                <div>
                  <strong>NIC Identity Verified:</strong>
                  <span style={{ marginLeft: '6px', color: 'var(--text-primary)' }}>
                    {nicDemographics.gender} • Born {nicDemographics.birthYear} (Age ~{nicDemographics.approximateAge})
                  </span>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Business / Profession</label>
                <input
                  type="text"
                  className="form-input"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g. Retail shop, Market vendor"
                />
              </div>

              <div className="form-group">
                <label className="form-label">KYC Status</label>
                <select
                  className="form-select"
                  value={kycStatus}
                  onChange={(e) => setKycStatus(e.target.value)}
                >
                  <option value="VERIFIED">VERIFIED (KYC Complete)</option>
                  <option value="PENDING">PENDING (Documents Pending)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Physical Address</label>
              <input
                type="text"
                className="form-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Business / Notes</label>
              <textarea
                className="form-textarea"
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
                  <span>Confirm Client Deletion</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Are you sure you want to delete <strong>{client.name}</strong>? This will permanently remove their profile, associated active/past loans, and payment history.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete Client'}
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
                disabled={isSubmitting || (nicId.trim() && !nicValidation.valid) || (phone.trim() && !phoneValidation.valid)}
              >
                <Check size={16} />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
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
                Delete Client
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
