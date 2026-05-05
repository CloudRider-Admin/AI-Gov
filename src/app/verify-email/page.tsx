"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "This verification link is invalid or has already been used.",
  expired: "This verification link has expired. Request a new one below.",
  missing: "No verification token was provided.",
  server: "Something went wrong. Please try again.",
};

function VerifyEmailContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const email = params.get("email");
  const sendError = params.get("sendError") === "1";

  const [resendEmail, setResendEmail] = useState(email ?? "");
  const [resendState, setResendState] = useState<"idle" | "loading" | "sent">("idle");

  useEffect(() => {
    if (email) setResendEmail(email);
  }, [email]);

  const handleResend = async () => {
    if (!resendEmail || resendState === "loading") return;
    setResendState("loading");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    setResendState("sent");
  };

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <AlertTriangle className="w-12 h-12 text-terminal-amber mb-4" />
          <h1 className="text-2xl font-mono font-bold text-terminal-amber mb-2">
            Verification Failed
          </h1>
          <p className="text-terminal-muted text-sm font-mono">
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server}
          </p>
        </div>

        <div className="border-t border-terminal-border pt-6 space-y-3">
          <p className="text-xs font-mono text-terminal-muted text-center uppercase tracking-wider">
            Request a new link
          </p>
          <input
            type="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-terminal-gray border border-terminal-border rounded px-4 py-3 text-terminal-text font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors"
          />
          {resendState === "sent" ? (
            <p className="text-xs text-terminal-green font-mono text-center flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Link sent — check your inbox.
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={!resendEmail || resendState === "loading"}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendState === "loading" ? (
                <>
                  <div className="w-4 h-4 border-2 border-terminal-black border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend Verification Email
                </>
              )}
            </button>
          )}
          <p className="text-center">
            <Link href="/signin" className="text-xs font-mono text-terminal-green hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Default: "check your email" state
  return (
    <div className="p-8 text-center">
      {sendError ? (
        <>
          <AlertTriangle className="w-14 h-14 text-terminal-amber mx-auto mb-4" />
          <h1 className="text-2xl font-mono font-bold text-terminal-amber mb-2">
            Account Created
          </h1>
          <p className="text-terminal-muted text-sm font-mono mb-6">
            Your account was created but we couldn&apos;t send the verification email to{" "}
            {email ? (
              <span className="text-terminal-text">{email}</span>
            ) : (
              "your email address"
            )}
            . Please request a new link below.
          </p>
        </>
      ) : (
        <>
          <Mail className="w-14 h-14 text-terminal-green mx-auto mb-4" />
          <h1 className="text-2xl font-mono font-bold text-terminal-green mb-2">
            Check Your Email
          </h1>
          <p className="text-terminal-muted text-sm font-mono mb-6">
            We sent a verification link to{" "}
            {email ? (
              <span className="text-terminal-text">{email}</span>
            ) : (
              "your email address"
            )}
            . Click the link to activate your account.
          </p>
        </>
      )}

      <p className="text-xs text-terminal-muted font-mono mb-4">
        Didn&apos;t receive it? Check your spam folder or request a new link.
      </p>

      {resendState === "sent" ? (
        <p className="text-xs text-terminal-green font-mono flex items-center justify-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> New link sent — check your inbox.
        </p>
      ) : (
        <button
          onClick={handleResend}
          disabled={!resendEmail || resendState === "loading"}
          className="text-xs font-mono text-terminal-green hover:underline flex items-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendState === "loading" ? (
            <div className="w-3 h-3 border border-terminal-green border-t-transparent rounded-full animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Resend verification email
        </button>
      )}

      <div className="mt-6 pt-6 border-t border-terminal-border">
        <Link href="/signin" className="text-xs font-mono text-terminal-muted hover:text-terminal-green transition-colors">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="terminal-window glow-green max-w-md w-full">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">verify_email.sh</span>
        </div>
        <Suspense>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}