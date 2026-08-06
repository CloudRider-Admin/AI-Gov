"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, Lock, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

/** Human-readable copy for the error codes NextAuth appends to /signin?error=… */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a different sign-in method. Sign in that way first, then link the provider.",
  OAuthSignin: "Could not start the sign-in with that provider. Please try again.",
  OAuthCallback: "The provider sign-in didn't complete. Please try again.",
  AccessDenied: "Access was denied by the provider.",
};

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justVerified = params.get("verified") === "1";
  const oauthError = params.get("error");
  const oauthErrorMessage = oauthError
    ? OAUTH_ERROR_MESSAGES[oauthError] ?? "Sign-in failed. Please try again."
    : null;

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "loading" | "sent">("idle");

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setUnverifiedEmail(null);

    try {
      // Pre-check credentials to get specific error codes
      // (NextAuth v4.24+ sanitises authorize() errors to generic "CredentialsSignin")
      const precheck = await fetch("/api/auth/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const precheckData = await precheck.json();

      if (!precheck.ok) {
        if (precheckData.code === "EMAIL_NOT_VERIFIED") {
          setUnverifiedEmail(formData.email);
          return;
        }
        if (precheckData.code === "RATE_LIMITED") {
          const minutes = precheckData.minutes ?? 15;
          setErrors({ form: `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` });
          return;
        }
        setErrors({ password: "Invalid email or password" });
        return;
      }

      // Credentials verified — now let NextAuth create the session
      const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setErrors({ password: "Invalid email or password" });
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendState === "loading") return;
    setResendState("loading");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unverifiedEmail }),
    });
    setResendState("sent");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-mono font-bold text-terminal-green mb-2">Sign In</h1>
        <p className="text-terminal-muted text-sm">Welcome back to AI Governance</p>
      </div>

      {/* Email verified success banner */}
      {justVerified && (
        <div className="mb-5 p-3 bg-terminal-green/10 border border-terminal-green/30 rounded flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-terminal-green mt-0.5 shrink-0" />
          <p className="text-xs text-terminal-green font-mono">
            Email verified! You can now sign in.
          </p>
        </div>
      )}

      {/* Unverified email banner */}
      {unverifiedEmail && (
        <div className="mb-5 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-400 font-mono">
              Please verify your email before signing in. Check your inbox for a verification link.
            </p>
          </div>
          {resendState === "sent" ? (
            <p className="text-xs text-terminal-green font-mono flex items-center gap-1 pl-6">
              <CheckCircle2 className="w-3 h-3" /> New link sent — check your inbox.
            </p>
          ) : (
            <button
              onClick={handleResendVerification}
              disabled={resendState === "loading"}
              className="text-xs font-mono text-yellow-400 hover:underline flex items-center gap-1 pl-6 disabled:opacity-50"
            >
              {resendState === "loading"
                ? <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              Resend verification email
            </button>
          )}
        </div>
      )}

      {errors.form && (
        <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400 font-mono">{errors.form}</p>
        </div>
      )}

      {/* OAuth error (NextAuth redirects failures here via pages.error) */}
      {oauthErrorMessage && !errors.form && (
        <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400 font-mono">{oauthErrorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-mono text-terminal-muted mb-2 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full bg-terminal-gray border ${errors.email ? "border-red-500" : "border-terminal-border"} rounded px-10 py-3 text-terminal-text font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors`}
              placeholder="john@company.com"
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-400 font-mono flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-xs font-mono text-terminal-muted uppercase tracking-wider">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-mono text-terminal-green hover:underline transition-colors">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full bg-terminal-gray border ${errors.password ? "border-red-500" : "border-terminal-border"} rounded px-10 py-3 text-terminal-text font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors`}
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400 font-mono flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{errors.password}
            </p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="remember"
            className="w-4 h-4 bg-terminal-gray border-terminal-border rounded focus:ring-terminal-green focus:ring-offset-0 text-terminal-green"
          />
          <label htmlFor="remember" className="ml-2 text-sm text-terminal-muted font-mono">
            Remember me
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-terminal-black border-t-transparent rounded-full animate-spin" />
              Signing In...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-terminal-muted font-mono">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-terminal-green hover:underline transition-colors">
            Create Account
          </Link>
        </p>
      </div>

      <OAuthButtons callbackUrl={params.get("callbackUrl") ?? "/dashboard"} />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="terminal-window glow-green max-w-md w-full">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">authenticate.sh</span>
        </div>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}