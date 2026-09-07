import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          padding: 'var(--spacing-4)'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-6)',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              color: 'var(--color-danger)', 
              fontSize: 'var(--text-2xl)', 
              fontFamily: 'var(--font-heading)',
              marginBottom: 'var(--spacing-4)'
            }}>
              Something went wrong
            </h1>
            <p style={{
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--spacing-6)',
              fontSize: 'var(--text-base)'
            }}>
              An unexpected error occurred in the application.
            </p>
            <div style={{
              backgroundColor: 'var(--color-surface-elevated)',
              padding: 'var(--spacing-4)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--spacing-6)',
              textAlign: 'left',
              overflowX: 'auto',
              border: '1px solid var(--color-border)'
            }}>
              <code style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                {this.state.error?.toString() || 'Unknown error'}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                padding: 'var(--spacing-3) var(--spacing-6)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '600',
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 40%, transparent)'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
