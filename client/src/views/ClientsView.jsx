import React, { useState } from 'react';
import { Users, UserPlus, Phone, MapPin, PlusCircle, Search, Edit3 } from 'lucide-react';

export default function ClientsView({
  clients,
  currentUser,
  onOpenNewClient,
  onOpenNewLoanForClient,
  onEditClient
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = clients.filter((c) => {
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.nic_id && c.nic_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Client Directory</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Client contacts, active loans, and outstanding credit
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenNewClient} style={{ gap: '8px' }}>
          <UserPlus size={18} />
          Register Client
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '18px' }}>
        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          className="form-input"
          placeholder="Search client name, phone, NIC..."
          style={{ paddingLeft: '38px' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ======================================================== */}
      {/* 1. DESKTOP & SMART TV VIEW: FULL DATA TABLE              */}
      {/* ======================================================== */}
      <div className="table-card desktop-table-view">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Phone</th>
                <th>NIC / ID</th>
                <th>Address & Notes</th>
                <th>Active Loans</th>
                <th>Total Debt</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No clients registered yet.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{client.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: #{client.id}</div>
                    </td>
                    <td>
                      <a
                        href={`tel:${client.phone}`}
                        style={{
                          color: '#60a5fa',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600'
                        }}
                      >
                        <Phone size={14} />
                        {client.phone}
                      </a>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {client.nic_id || '—'}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{client.address || '—'}</div>
                      {client.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {client.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${client.active_loans > 0 ? 'badge-active' : 'badge-pending'}`}>
                        {client.active_loans || 0} Active
                      </span>
                    </td>
                    <td style={{ fontWeight: '800', color: client.total_outstanding > 0 ? '#f87171' : 'var(--text-muted)' }}>
                      Rs. {Number(client.total_outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ gap: '4px' }}
                          onClick={() => onEditClient(client)}
                          title="Edit Client Info"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                        {currentUser.role === 'OWNER' && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ gap: '4px' }}
                            onClick={() => onOpenNewLoanForClient(client)}
                          >
                            <PlusCircle size={14} />
                            Issue Loan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MOBILE PHONE & FOLDABLE VIEW: TOUCH CARDS             */}
      {/* ======================================================== */}
      <div className="mobile-card-view">
        {filteredClients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            No clients found.
          </div>
        ) : (
          filteredClients.map((client) => (
            <div key={`mob-client-${client.id}`} className="mobile-card">
              <div className="mobile-card-header">
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {client.name}
                  </div>
                  {client.nic_id && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      NIC: {client.nic_id}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className={`status-badge ${client.active_loans > 0 ? 'badge-active' : 'badge-pending'}`}>
                    {client.active_loans || 0} Loans
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 8px' }}
                    onClick={() => onEditClient(client)}
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              <div className="mobile-card-stats">
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OUTSTANDING DEBT</div>
                  <div style={{ fontWeight: '800', color: client.total_outstanding > 0 ? '#f87171' : '#10b981', fontSize: '1rem' }}>
                    Rs. {Number(client.total_outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LOCATION / SHOP</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    {client.address || 'Colombo'}
                  </div>
                </div>
              </div>

              {client.notes && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '4px' }}>
                  {client.notes}
                </div>
              )}

              <div className="mobile-card-actions">
                <a
                  href={`tel:${client.phone}`}
                  className="btn btn-secondary"
                  style={{ gap: '6px', textDecoration: 'none' }}
                >
                  <Phone size={16} />
                  Call
                </a>

                {currentUser.role === 'OWNER' && (
                  <button
                    className="btn btn-primary"
                    style={{ gap: '6px' }}
                    onClick={() => onOpenNewLoanForClient(client)}
                  >
                    <PlusCircle size={16} />
                    Issue 58-Loan
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
