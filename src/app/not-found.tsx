import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="terminal-window max-w-lg w-full">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">404</span>
        </div>
        <div className="p-6">
          <h2 className="text-terminal-green font-mono text-lg mb-2">
            Page not found
          </h2>
          <p className="text-terminal-muted font-mono text-sm mb-4">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link href="/" className="btn-primary text-sm">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
