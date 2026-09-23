import React, { useState } from 'react';
import { Edit3, X, Trash2, Check, AlertTriangle, ShieldCheck, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { parseSriLankanNic } from '../utils/nicHelper';

// Sri Lankan NIC format: 9 digits + V/X (Old) OR 12 digits (New)
function validateSriLankanNic(val) {
  if (!val || !val.trim()) return { valid: true, type: null, clean: '' };
  const clean = val.trim().toUpperCase();
  const oldRegex = /^[0-9]{9}[VX]$/;
  const newRegex = /^[0-9]{12}$/;
  if (oldRegex.test(clean)) return { valid: true, type: 'OLD', clean };
  if (newRegex.test(clean)) return { valid: true, type: 'NEW', clean };
  return { valid: false, type: null, clean };
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

  const [name, setName] = useState(client.name || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [nicId, setNicId] = useState(client.nic_id || '');
  const [address, setAddress] = useState(client.address || '');
  const [notes, setNotes] = useState(client.notes || '');
  const [businessType, setBusinessType] = useState(client.business_type || '');

  // KYC & Guarantor
  const [showGuarantor, setShowGuarantor] = useState(Boolean(client.guarantor_name));
  const [guarantorName, setGuarantorName] = useState(client.guarantor_name || '');
  const [guarantorPhone, setGuarantorPhone] = useState(client.guarantor_phone || '');
  const [guarantorNic, setGuarantorNic] = useState(client.guarantor_nic || '');
  const [guarantorRelation, setGuarantorRelation] = useState(client.guarantor_relation || '');
  const [kycStatus, setKycStatus] = useState(client.kyc_status || 'VERIFIED');
  const [kycNotes, setKycNotes] = useState(client.kyc_notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const isOwner = currentUser?.role === 'OWNER';

  const nicValidation = validateSriLankanNic(nicId);
  const phoneValidation = validateSriLankanPhone(phone);
  const nicDemographics = parseSriLankanNic(nicId);

  const handleUpdate = async (e) => {
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
          guarantor_name: guarantorName.trim(),
          guarantor_phone: guarantorPhone.trim(),
          guarantor_nic: guarantorNic.trim(),
          guarantor_relation: guarantorRelation.trim(),
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
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError('');
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
                  value={nicId}
                  onChange={(e) => setNicId(e.target.value.toUpperCase())}
                  style={{
                    borderColor: nicId.trim() ? (nicValidation.valid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)') : undefined
                  }}
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

            {/* Guarantor Details Section */}
            <div style={{
              marginTop: '12px',
              marginBottom: '16px',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.03)'
                }}
                onClick={() => setShowGuarantor(!showGuarantor)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: '700' }}>
                  <UserCheck size={16} color="#10b981" />
                  <span>Guarantor / Surety Details (ඇපකරු)</span>
                  {guarantorName && <span style={{ fontSize: '0.72rem', color: '#10b981' }}>({guarantorName})</span>}
                </div>
                {showGuarantor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {showGuarantor && (
                <div style={{ padding: '14px', borderTop: '1px solid var(--surface-border)' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Guarantor Full Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Bandara Perera"
                        value={guarantorName}
                        onChange={(e) => setGuarantorName(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Relationship to Client</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Spouse, Brother, Business Partner"
                        value={guarantorRelation}
                        onChange={(e) => setGuarantorRelation(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Guarantor Phone</label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="0779876543"
                        value={guarantorPhone}
                        onChange={(e) => setGuarantorPhone(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Guarantor NIC</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="781234567V"
                        value={guarantorNic}
                        onChange={(e) => setGuarantorNic(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                </div>
              )}
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
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete Client & All Data'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div>
              {isOwner && !showDeleteConfirm && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ gap: '6px' }}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                >
                  <Trash2 size={15} />
                  Delete Client
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || (nicId.trim() && !nicValidation.valid) || (phone.trim() && !phoneValidation.valid)}
                style={{ gap: '6px' }}
              >
                <Check size={16} />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
