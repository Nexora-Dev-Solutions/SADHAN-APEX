import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main, #0b0f17)',
          color: 'var(--text-primary, #f8fafc)',
          padding: '20px',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: 'var(--surface-card, #111827)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px', color: '#f8fafc' }}>
              Unexpected Display Glitch
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '24px' }}>
              The application encountered a minor display issue. All your database records and collection entries remain completely safe.
            </p>

            <button
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'var(--accent-primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              <RefreshCw size={16} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
