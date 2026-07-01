"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, CheckCircle2, XCircle } from "lucide-react";

const REASON_MESSAGES: Record<string, string> = {
  invalid: "This invitation link is invalid or has already been used.",
  expired: "This invitation has expired. Ask an admin to send a new one.",
  email_mismatch: "This invitation was sent to a different email address than the one you're signed in with.",
  already_member: "You're already a member of this workspace.",
};

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; org: string }
    | { kind: "error"; reason: string }
  >({ kind: "idle" });

  const accept = async () => {
    setState({ kind: "loading" });
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setState({ kind: "success", org: data.organizationName });
    } else {
      setState({ kind: "error", reason: data.reason ?? "invalid" });
    }
  };

  return (
    <div className="section min-h-screen flex items-center justify-center">
      <div className="glass-card rounded-xl p-8 max-w-md w-full text-center">
        <Building2 className="w-10 h-10 text-terminal-green mx-auto mb-4" />
        <h1 className="font-mono text-xl font-bold text-terminal-text mb-2">Workspace invitation</h1>

        {status === "loading" && <p className="text-sm text-terminal-muted">Checking your session…</p>}

        {status === "unauthenticated" && (
          <>
            <p className="text-sm text-terminal-muted mb-5">
              Sign in (or create an account) with the invited email address to accept.
            </p>
            <Link
              href={`/signin?callbackUrl=/invite/${token}`}
              className="btn-primary text-sm py-2 w-full justify-center"
            >
              Sign in to accept
            </Link>
          </>
        )}

        {status === "authenticated" && state.kind === "idle" && (
          <>
            <p className="text-sm text-terminal-muted mb-5">
              You&apos;ve been invited to collaborate on an AI governance workspace.
            </p>
            <button onClick={accept} className="btn-primary text-sm py-2 w-full justify-center">
              Accept invitation
            </button>
          </>
        )}

        {state.kind === "loading" && <p className="text-sm text-terminal-muted">Accepting…</p>}

        {state.kind === "success" && (
          <>
            <CheckCircle2 className="w-8 h-8 text-terminal-green mx-auto mb-3" />
            <p className="text-sm text-terminal-text mb-5">
              You&apos;ve joined <strong>{state.org}</strong>.
            </p>
            <button onClick={() => router.push("/team")} className="btn-primary text-sm py-2 w-full justify-center">
              Go to workspace
            </button>
          </>
        )}

        {state.kind === "error" && (
          <>
            <XCircle className="w-8 h-8 text-terminal-red mx-auto mb-3" />
            <p className="text-sm text-terminal-muted mb-5">
              {REASON_MESSAGES[state.reason] ?? REASON_MESSAGES.invalid}
            </p>
            <Link href="/" className="btn-secondary text-sm py-2 w-full justify-center">
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
