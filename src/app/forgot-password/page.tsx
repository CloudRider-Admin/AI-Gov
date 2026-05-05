"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateEmail = () => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email format");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail()) return;

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setShowSuccess(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) {
      setError("");
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="terminal-window glow-green max-w-md w-full">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500" />
            <div className="terminal-dot bg-yellow-500" />
            <div className="terminal-dot bg-green-500" />
            <span className="ml-4 text-xs text-terminal-muted font-mono">
              password_reset_sent.sh
            </span>
          </div>
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-terminal-green mx-auto mb-4" />
            <h2 className="text-2xl font-mono font-bold text-terminal-green mb-2">
              Check Your Email
            </h2>
            <p className="text-terminal-muted font-mono text-sm mb-6">
              We&apos;ve sent password reset instructions to:
            </p>
            <p className="text-terminal-text font-mono text-sm mb-8 bg-terminal-black px-4 py-2 rounded border border-terminal-border">
              {email}
            </p>
            <p className="text-terminal-muted font-mono text-xs mb-6">
              If you don&apos;t receive an email within a few minutes, please check your spam folder.
            </p>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-terminal-green hover:underline font-mono text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="terminal-window glow-green max-w-md w-full">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">
            reset_password.sh
          </span>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-terminal-green hover:underline font-mono text-sm mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
            <h1 className="text-3xl font-mono font-bold text-terminal-green mb-2">
              Reset Password
            </h1>
            <p className="text-terminal-muted text-sm">
              Enter your email address and we&apos;ll send you instructions to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono text-terminal-muted mb-2 uppercase tracking-wider"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={handleChange}
                  className={`w-full bg-terminal-gray border ${error ? "border-red-500" : "border-terminal-border"
                    } rounded px-10 py-3 text-terminal-text font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors`}
                  placeholder="john@company.com"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="mt-1 text-xs text-red-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {error}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-terminal-black border-t-transparent rounded-full animate-spin" />
                  Sending Instructions...
                </>
              ) : (
                "Send Reset Instructions"
              )}
            </button>
          </form>

          {/* Additional Help */}
          <div className="mt-6 p-4 bg-terminal-black border border-terminal-border rounded">
            <p className="text-xs text-terminal-muted font-mono mb-2">
              <span className="text-terminal-green">Note:</span> If you don&apos;t have access to your email, please contact your administrator.
            </p>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-terminal-muted font-mono">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-terminal-green hover:underline transition-colors"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}