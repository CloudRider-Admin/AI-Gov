/**
 * The GovSecure wordmark: a green-outlined "Gov" box followed by "Secure".
 * Shared by the public header and the signed-in sidebar so the brand is
 * identical everywhere. `markOnly` renders just the "Gov" box (collapsed rail).
 */
export function Logo({ markOnly = false, className = "" }: { markOnly?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="flex h-8 w-10 flex-none items-center justify-center rounded-md border-2 border-terminal-green">
        <span className="font-mono text-sm font-bold text-terminal-green">Gov</span>
      </span>
      {markOnly ? (
        <span className="sr-only">GovSecure</span>
      ) : (
        <span className="font-mono text-lg font-bold text-terminal-text">Secure</span>
      )}
    </span>
  );
}
