import React, { useState } from 'react';
import { Users, UserPlus, Phone, MapPin, PlusCircle, Search, Edit3, ShieldCheck, AlertTriangle, UserCheck, Briefcase } from 'lucide-react';
import { parseSriLankanNic } from '../utils/nicHelper';

export default function ClientsView({
  clients,
  currentUser,
  onOpenNewClient,
  onOpenNewLoanForClient,
  onEditClient
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [kycFilter, setKycFilter] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'PENDING'

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.nic_id && c.nic_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.guarantor_name && c.guarantor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.business_type && c.business_type.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesKyc =
      kycFilter === 'ALL' ||
      (kycFilter === 'VERIFIED' && (c.kyc_status === 'VERIFIED' || !c.kyc_status)) ||
      (kycFilter === 'PENDING' && c.kyc_status === 'PENDING');

    return matchesSearch && matchesKyc;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Client & KYC Directory</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Client contacts, identity verification (KYC), guarantors, and credit
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenNewClient} style={{ gap: '8px' }}>
          <UserPlus size={18} />
          Register Client & KYC
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search name, phone, NIC, guarantor, shop..."
            style={{ paddingLeft: '38px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'VERIFIED', 'PENDING'].map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${kycFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setKycFilter(status)}
            >
              {status === 'ALL' ? 'All Clients' : status === 'VERIFIED' ? 'KYC Verified' : 'KYC Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. DESKTOP & SMART TV VIEW: FULL DATA TABLE              */}
      {/* ======================================================== */}
      <div className="table-card desktop-table-view">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name & Identity</th>
                <th>Phone</th>
                <th>KYC Status</th>
                <th>Guarantor (ඇපකරු)</th>
                <th>Address & Notes</th>
                <th>Active Loans</th>
                <th>Total Debt</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No clients match your criteria.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const demo = parseSriLankanNic(client.nic_id);
                  const isVerified = client.kyc_status === 'VERIFIED' || !client.kyc_status;

                  return (
                    <tr key={client.id}>
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{client.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-primary)' }}>
                            {client.nic_id || 'No NIC'}
                          </span>
                          {demo && (
                            <span style={{ fontSize: '0.72rem', color: '#93c5fd' }}>
                              • {demo.gender}, ~{demo.approximateAge}y
                            </span>
                          )}
                        </div>
                        {client.business_type && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Briefcase size={11} />
                            {client.business_type}
                          </div>
                        )}
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
                      <td>
                        {isVerified ? (
                          <span className="status-badge badge-active" style={{ gap: '4px', display: 'inline-flex', alignItems: 'center' }}>
                            <ShieldCheck size={13} />
                            Verified
                          </span>
                        ) : (
                          <span className="status-badge badge-pending" style={{ gap: '4px', display: 'inline-flex', alignItems: 'center' }}>
                            <AlertTriangle size={13} />
                            Pending
                          </span>
                        )}
                      </td>
                      <td>
                        {client.guarantor_name ? (
                          <div style={{ fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <UserCheck size={13} color="#10b981" />
                              {client.guarantor_name}
                              {client.guarantor_relation && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  ({client.guarantor_relation})
                                </span>
                              )}
                            </div>
                            {client.guarantor_phone && (
                              <a
                                href={`tel:${client.guarantor_phone}`}
                                style={{ fontSize: '0.72rem', color: '#60a5fa', textDecoration: 'none' }}
                              >
                                {client.guarantor_phone}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None recorded</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>{client.address || '—'}</div>
                        {client.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
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
                            title="Edit Client & KYC"
                          >
                            <Edit3 size={14} />
                            Edit / KYC
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
                  );
                })
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
          filteredClients.map((client) => {
            const demo = parseSriLankanNic(client.nic_id);
            const isVerified = client.kyc_status === 'VERIFIED' || !client.kyc_status;

            return (
              <div key={`mob-client-${client.id}`} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {client.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {client.nic_id || 'No NIC'}
                      </span>
                      {demo && (
                        <span style={{ fontSize: '0.72rem', color: '#93c5fd' }}>
                          • {demo.gender}, ~{demo.approximateAge}y
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isVerified ? (
                      <span className="status-badge badge-active" style={{ gap: '3px' }}>
                        <ShieldCheck size={11} /> KYC
                      </span>
                    ) : (
                      <span className="status-badge badge-pending" style={{ gap: '3px' }}>
                        <AlertTriangle size={11} /> Pending
                      </span>
                    )}
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
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACTIVE LOANS</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      {client.active_loans || 0} Plans
                    </div>
                  </div>
                </div>

                {/* Guarantor Info on Mobile */}
                {client.guarantor_name && (
                  <div style={{
                    fontSize: '0.78rem',
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Guarantor: </span>
                      <strong>{client.guarantor_name}</strong>
                      {client.guarantor_relation && <span style={{ color: 'var(--text-muted)' }}> ({client.guarantor_relation})</span>}
                    </div>
                    {client.guarantor_phone && (
                      <a
                        href={`tel:${client.guarantor_phone}`}
                        style={{ color: '#10b981', textDecoration: 'none', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Phone size={12} /> Call
                      </a>
                    )}
                  </div>
                )}

                {client.address && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    📍 {client.address}
                  </div>
                )}

                <div className="mobile-card-actions">
                  <a
                    href={`tel:${client.phone}`}
                    className="btn btn-secondary"
                    style={{ gap: '6px', textDecoration: 'none' }}
                  >
                    <Phone size={16} />
                    Call Client
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
            );
          })
        )}
      </div>
    </div>
  );
}
