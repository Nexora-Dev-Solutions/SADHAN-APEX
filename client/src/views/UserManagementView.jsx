import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, 
  Search, Edit3, Trash2, Key, Phone, CheckCircle, 
  AlertTriangle, DollarSign, CreditCard, RefreshCw 
} from 'lucide-react';

export default function UserManagementView({
  token,
  currentUser,
  onOpenCreateUser,
  onOpenEditUser,
  onRefreshUsers,
  users = []
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'OWNER' | 'AGENT'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'SUSPENDED'
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (u.name || '').toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.phone || '').includes(term);

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || (u.status || 'ACTIVE') === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalStaff = users.length;
  const activeAgents = users.filter(u => u.role === 'AGENT' && (u.status === 'ACTIVE' || !u.status)).length;
  const totalCollectionsAll = users.reduce((sum, u) => sum + (parseFloat(u.total_collected) || 0), 0);
  const totalActiveLoansAssigned = users.reduce((sum, u) => sum + (parseInt(u.active_loans_count, 10) || 0), 0);

  const handleDelete = async (user) => {
    if (String(user.id) === String(currentUser.id)) {
      alert('You cannot delete your own active account.');
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete staff account "${user.name}" (@${user.username})?`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      onRefreshUsers();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getPermissionLabel = (perm) => {
    switch (perm) {
      case 'COLLECT_PAYMENTS': return '💳 Payments';
      case 'ISSUE_LOANS': return '➕ Loans';
      case 'REGISTER_CLIENTS': return '👥 Clients';
      case 'VIEW_REPORTS': return '📊 Reports';
      case 'TOPUP_LOANS': return '📈 Top-Ups';
      default: return perm;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Staff & Agent Management</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Manage collection agents, operational permissions, account statuses, and team recovery performance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onRefreshUsers} title="Refresh Staff List">
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={onOpenCreateUser} style={{ gap: '8px' }}>
            <UserPlus size={18} />
            Add Staff Member
          </button>
        </div>
      </div>

      {deleteError && (
        <div style={{
          background: 'var(--danger-bg)',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{deleteError}</span>
          </div>
          <button
            onClick={() => setDeleteError('')}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Metric Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <div className="stat-card">
          <div className="stat-icon icon-blue">
            <Users size={22} />
          </div>
          <div>
            <div className="stat-label">Total Staff</div>
            <div className="stat-value">{totalStaff}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-green">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="stat-label">Active Agents</div>
            <div className="stat-value">{activeAgents}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-purple">
            <CreditCard size={22} />
          </div>
          <div>
            <div className="stat-label">Assigned Loans</div>
            <div className="stat-value">{totalActiveLoansAssigned}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon icon-amber">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="stat-label">Total Collections</div>
            <div className="stat-value" style={{ color: '#34d399', fontSize: '1.25rem' }}>
              Rs. {Math.round(totalCollectionsAll).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by staff name, username, phone..."
            style={{ paddingLeft: '38px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'OWNER', 'AGENT'].map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'ALL' ? 'All Roles' : r === 'OWNER' ? 'Owners' : 'Agents'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'ACTIVE', 'SUSPENDED'].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? 'All Status' : s === 'ACTIVE' ? 'Active' : 'Suspended'}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="table-responsive" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-lg)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned Loans</th>
              <th>Total Collected</th>
              <th>Permissions</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No staff members match the selected filter.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isCurrent = String(user.id) === String(currentUser.id);
                const isActive = (user.status || 'ACTIVE') === 'ACTIVE';
                const userPerms = user.permissions || [];

                return (
                  <tr key={`user-row-${user.id}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: user.role === 'OWNER' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: user.role === 'OWNER' ? '#c084fc' : '#60a5fa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '0.85rem'
                        }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                            {user.name} {isCurrent && <span style={{ fontSize: '0.72rem', color: '#60a5fa' }}>(You)</span>}
                          </div>
                          {user.phone ? (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} />
                              {user.phone}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>No phone</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#93c5fd' }}>
                        @{user.username}
                      </span>
                    </td>

                    <td>
                      <span className="status-badge" style={{
                        background: user.role === 'OWNER' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: user.role === 'OWNER' ? '#c084fc' : '#60a5fa',
                        fontWeight: '700'
                      }}>
                        {user.role}
                      </span>
                    </td>

                    <td>
                      <span className="status-badge" style={{
                        background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isActive ? '#34d399' : '#f87171',
                        fontWeight: '700'
                      }}>
                        {isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: '700' }}>
                        {user.active_loans_count || 0} active loans
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: '800', color: '#34d399' }}>
                        Rs. {Math.round(parseFloat(user.total_collected) || 0).toLocaleString()}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                        {user.role === 'OWNER' ? (
                          <span style={{ fontSize: '0.72rem', color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                            Full System Access
                          </span>
                        ) : userPerms.length === 0 ? (
                          <span style={{ fontSize: '0.72rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            No active permissions
                          </span>
                        ) : (
                          userPerms.map((perm) => (
                            <span
                              key={`p-${user.id}-${perm}`}
                              style={{
                                fontSize: '0.7rem',
                                color: '#93c5fd',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {getPermissionLabel(perm)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenEditUser(user)}
                          title="Edit staff details and permissions"
                          style={{ gap: '4px' }}
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>

                        {!isCurrent && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDelete(user)}
                            title="Delete staff account"
                            disabled={isDeleting}
                            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
