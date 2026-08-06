'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — catches errors thrown in the root layout itself,
 * which the per-segment `error.tsx` cannot. Must render its own <html>/<body>.
 *
 * The `console.error` here is the wiring point for an error-monitoring service
 * (e.g. Sentry.captureException(error)) once a DSN is configured.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error.digest ?? '', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'monospace',
          background: '#0a0a0a',
          color: '#e0e0e0',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ color: '#888', maxWidth: 480 }}>
          A critical error occurred while loading the application. Please refresh
          the page.
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
          Reload
        </button>
      </body>
    </html>
  );
}
