'use client';

import { useEffect } from 'react';

/**
 * Route-segment error boundary. Catches render/runtime errors in the page tree
 * and shows a recoverable fallback instead of a broken screen.
 *
 * The `console.error` here is the wiring point for an error-monitoring service
 * (e.g. Sentry.captureException(error)) once a DSN is configured.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error.digest ?? '', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'monospace',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
      <p style={{ color: '#888', maxWidth: 480 }}>
        An unexpected error occurred. You can try again — if the problem persists,
        please contact support.
      </p>
      {error.digest && (
        <p style={{ color: '#555', fontSize: '0.75rem' }}>Reference: {error.digest}</p>
      )}
      <button
        onClick={reset}
        style={{
          background: '#00ff88',
          color: '#0a0a0a',
          border: 'none',
          borderRadius: 4,
          padding: '0.6rem 1.4rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
