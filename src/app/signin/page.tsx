"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, Lock, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justVerified = params.get("verified") === "1";

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

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-terminal-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-terminal-gray px-2 text-terminal-muted font-mono">Or continue with</span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full bg-terminal-gray border border-terminal-border rounded px-4 py-3 text-terminal-text font-mono text-sm hover:border-terminal-green transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="w-full bg-terminal-gray border border-terminal-border rounded px-4 py-3 text-terminal-text font-mono text-sm hover:border-terminal-green transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>
      </div>
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
