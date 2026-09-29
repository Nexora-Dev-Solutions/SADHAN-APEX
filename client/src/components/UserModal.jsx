import React, { useState } from 'react';
import { X, User, Shield, Key, Phone, Check, AlertCircle, Lock } from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'COLLECT_PAYMENTS', label: 'Collect Payments & Print Receipts', desc: 'Allows field collections, entering repayments, and printing thermal receipts.' },
  { id: 'ISSUE_LOANS', label: 'Issue Micro-Loans', desc: 'Allows creating and issuing new 58-installment micro-loans.' },
  { id: 'REGISTER_CLIENTS', label: 'Register & Edit Clients', desc: 'Allows onboarding borrowers, KYC photo capture, and updating contact details.' },
  { id: 'VIEW_REPORTS', label: 'View Financial Reports', desc: 'Allows access to daily financial collection summaries and cash audits.' },
  { id: 'TOPUP_LOANS', label: 'Loan Top-Ups & Adjustments', desc: 'Allows requesting balance top-ups on active client loans.' }
];

export default function UserModal({ token, userToEdit, currentUserId, onClose, onSuccess }) {
  const isEditing = Boolean(userToEdit);

  const [name, setName] = useState(userToEdit?.name || '');
  const [username, setUsername] = useState(userToEdit?.username || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(userToEdit?.phone || '');
  const [role, setRole] = useState(userToEdit?.role || 'AGENT');
  const [status, setStatus] = useState(userToEdit?.status || 'ACTIVE');
  
  const initialPerms = userToEdit?.permissions || (
    userToEdit?.role === 'OWNER'
      ? ALL_PERMISSIONS.map(p => p.id)
      : ['COLLECT_PAYMENTS', 'ISSUE_LOANS', 'REGISTER_CLIENTS']
  );
  const [permissions, setPermissions] = useState(initialPerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isSelf = isEditing && String(userToEdit.id) === String(currentUserId);

  const togglePermission = (permId) => {
    if (role === 'OWNER') return; // Owners always have all permissions
    if (permissions.includes(permId)) {
      setPermissions(permissions.filter(p => p !== permId));
    } else {
      setPermissions([...permissions, permId]);
    }
  };

  const selectAllPermissions = () => {
    setPermissions(ALL_PERMISSIONS.map(p => p.id));
  };

  const deselectAllPermissions = () => {
    setPermissions([]);
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'OWNER') {
      setPermissions(ALL_PERMISSIONS.map(p => p.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Staff member full name is required.');
      return;
    }

    if (!isEditing && !username.trim()) {
      setError('Username is required.');
      return;
    }

    if (!isEditing && !password.trim()) {
      setError('Password is required for new accounts.');
      return;
    }

    if (password && password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/users/${userToEdit.id}` : '/api/users';
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        role,
        status,
        permissions: role === 'OWNER' ? ALL_PERMISSIONS.map(p => p.id) : permissions
      };

      if (!isEditing) {
        payload.username = username.trim();
        payload.password = password;
      } else if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404) {
          throw new Error('Backend deployment pending: Render is still updating with the latest backend changes. Please check the Render dashboard tab to ensure the deploy has finished, or wait 1-2 minutes.');
        }
        throw new Error(text.slice(0, 150) || `Server request failed with status ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save staff member');
      }

      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                {isEditing ? `Edit Staff: ${userToEdit.name}` : 'Create Staff / Agent Account'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isEditing ? 'Configure agent role, operational permissions, or reset login password' : 'Add a new collection agent or business partner with custom privileges'}
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                color: '#f87171',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kamal Perera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. agent_kamal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isEditing}
                  style={isEditing ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                  required
                />
                {isEditing && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Username cannot be changed after creation.
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  {isEditing ? 'New Password (leave blank to keep current)' : 'Login Password *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    className="form-input"
                    placeholder={isEditing ? '•••••••• (unchanged)' : 'Enter password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isEditing}
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  disabled={isSelf}
                >
                  <option value="AGENT">Collection Agent (Field Staff)</option>
                  <option value="OWNER">Business Owner (Full Access)</option>
                </select>
                {isSelf && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    You cannot alter your own owner role.
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Account Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isSelf}
                  style={status === 'SUSPENDED' ? { borderColor: '#ef4444', color: '#f87171' } : {}}
                >
                  <option value="ACTIVE">Active (Allowed to login)</option>
                  <option value="SUSPENDED">Suspended (Access blocked)</option>
                </select>
                {isSelf && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    You cannot suspend your own account.
                  </span>
                )}
              </div>
            </div>

            {/* PERMISSIONS SECTION */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#f8fafc' }}>
                    Agent Feature Permissions
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {role === 'OWNER'
                      ? 'Owners automatically have full permissions for all features.'
                      : 'Toggle specific features this agent is permitted to perform.'}
                  </div>
                </div>

                {role !== 'OWNER' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={selectAllPermissions}
                      style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={deselectAllPermissions}
                      style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ALL_PERMISSIONS.map((p) => {
                  const isChecked = role === 'OWNER' || permissions.includes(p.id);
                  const isLocked = role === 'OWNER';

                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '10px 12px',
                        background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: isLocked ? 'default' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLocked}
                        onChange={() => togglePermission(p.id)}
                        style={{ marginTop: '3px', cursor: isLocked ? 'default' : 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: isChecked ? '#60a5fa' : 'var(--text-primary)' }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '10px', padding: '14px 20px' }}>
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
              style={{ flex: 1.5, justifyContent: 'center', gap: '8px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Check size={16} />
                  {isEditing ? 'Update Staff Member' : 'Create Staff Member'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
