"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [formData, setFormData] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = "Must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = "Must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = "Must contain at least one number";
    } else if (!/[^A-Za-z0-9]/.test(formData.password)) {
      newErrors.password = "Must contain at least one special character";
    }

    if (!formData.confirm) {
      newErrors.confirm = "Please confirm your password";
    } else if (formData.password !== formData.confirm) {
      newErrors.confirm = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: formData.password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors({ form: data.error ?? "Failed to reset password. Please try again." });
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/signin"), 3000);
    } catch {
      setErrors({ form: "Network error. Please check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="terminal-window glow-green max-w-md w-full">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500" />
            <div className="terminal-dot bg-yellow-500" />
            <div className="terminal-dot bg-green-500" />
            <span className="ml-4 text-xs text-terminal-muted font-mono">password_updated.sh</span>
          </div>
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-terminal-green mx-auto mb-4" />
            <h2 className="text-2xl font-mono font-bold text-terminal-green mb-2">
              Password Updated
            </h2>
            <p className="text-terminal-muted font-mono text-sm mb-6">
              Your password has been reset successfully. Redirecting to sign in...
            </p>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-terminal-green hover:underline font-mono text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Sign In Now
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
          <span className="ml-4 text-xs text-terminal-muted font-mono">set_new_password.sh</span>
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
              Set New Password
            </h1>
            <p className="text-terminal-muted text-sm">
              Enter a new password for your account.
            </p>
          </div>

          {errors.form && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400 font-mono">{errors.form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono text-terminal-muted mb-2 uppercase tracking-wider"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full bg-terminal-gray border ${
                    errors.password ? "border-red-500" : "border-terminal-border"
                  } rounded px-10 py-3 text-terminal-text font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-terminal-green transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm"
                className="block text-xs font-mono text-terminal-muted mb-2 uppercase tracking-wider"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
                <input
                  type={showConfirm ? "text" : "password"}
                  id="confirm"
                  name="confirm"
                  value={formData.confirm}
                  onChange={handleChange}
                  className={`w-full bg-terminal-gray border ${
                    errors.confirm ? "border-red-500" : "border-terminal-border"
                  } rounded px-10 py-3 text-terminal-text font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-terminal-green transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm && (
                <p className="mt-1 text-xs text-red-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.confirm}
                </p>
              )}
            </div>

            {/* Password requirements hint */}
            <div className="p-3 bg-terminal-black border border-terminal-border rounded">
              <p className="text-xs text-terminal-muted font-mono">
                <span className="text-terminal-green">Requirements:</span>{" "}
                8+ characters, uppercase, lowercase, number, special character
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-terminal-black border-t-transparent rounded-full animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
