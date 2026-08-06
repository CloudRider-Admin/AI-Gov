"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Mail, Lock, AlertTriangle, CheckCircle2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else {
      if (formData.password.length < 8) newErrors.password = "At least 8 characters";
      else if (!/[A-Z]/.test(formData.password)) newErrors.password = "Must contain an uppercase letter";
      else if (!/[a-z]/.test(formData.password)) newErrors.password = "Must contain a lowercase letter";
      else if (!/[0-9]/.test(formData.password)) newErrors.password = "Must contain a number";
      else if (!/[^A-Za-z0-9]/.test(formData.password)) newErrors.password = "Must contain a special character";
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setServerError("An account with this email already exists.");
        } else if (data?.details?.fieldErrors) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.details.fieldErrors)) {
            fieldErrors[key] = (msgs as string[])[0];
          }
          setErrors(fieldErrors);
        } else {
          setServerError(data?.error ?? "Failed to create account. Please try again.");
        }
        return;
      }

      setSuccess(true);
      // Auto-redirect to sign in after a short delay
      setTimeout(() => {
        router.push(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }, 3000);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    if (serverError) setServerError(null);
  };

  if (success) {
    return (
      <div className="p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-terminal-green mx-auto mb-4" />
        <h3 className="text-lg font-mono text-terminal-green mb-2">Account Created!</h3>
        <p className="text-sm text-terminal-muted font-mono mb-4">
          Check your email for a verification link to activate your account.
        </p>
        <p className="text-xs text-terminal-muted font-mono">
          Redirecting to sign in...
        </p>
        <Link
          href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="inline-block mt-4 text-sm text-terminal-green font-mono hover:underline"
        >
          Go to Sign In now
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-mono text-terminal-green mb-2">Create Account</h2>
      <p className="text-sm text-terminal-muted font-mono mb-6">
        Join GovSecure to access AI governance tools
      </p>

      {serverError && (
        <div className="flex items-center gap-2 text-red-400 text-sm font-mono mb-4 p-3 border border-red-400/30 rounded bg-red-400/5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
            Full Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-terminal-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={handleChange("name")}
              placeholder="Jane Doe"
              className={`w-full bg-terminal-bg border rounded px-4 py-2.5 pl-10 text-terminal-text font-mono text-sm focus:outline-none transition-colors ${
                errors.name ? "border-red-400" : "border-terminal-border focus:border-terminal-green"
              }`}
              disabled={isLoading}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-400 font-mono mt-1">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-terminal-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange("email")}
              placeholder="jane@company.com"
              className={`w-full bg-terminal-bg border rounded px-4 py-2.5 pl-10 text-terminal-text font-mono text-sm focus:outline-none transition-colors ${
                errors.email ? "border-red-400" : "border-terminal-border focus:border-terminal-green"
              }`}
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-400 font-mono mt-1">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-terminal-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange("password")}
              placeholder="Min 8 chars, upper, lower, number, special"
              className={`w-full bg-terminal-bg border rounded px-4 py-2.5 pl-10 pr-10 text-terminal-text font-mono text-sm focus:outline-none transition-colors ${
                errors.password ? "border-red-400" : "border-terminal-border focus:border-terminal-green"
              }`}
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
            <p className="text-xs text-red-400 font-mono mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-mono text-terminal-muted uppercase tracking-wider mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-terminal-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={handleChange("confirmPassword")}
              placeholder="Re-enter your password"
              className={`w-full bg-terminal-bg border rounded px-4 py-2.5 pl-10 text-terminal-text font-mono text-sm focus:outline-none transition-colors ${
                errors.confirmPassword ? "border-red-400" : "border-terminal-border focus:border-terminal-green"
              }`}
              disabled={isLoading}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-400 font-mono mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-terminal-black border-t-transparent rounded-full animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-terminal-muted font-mono">
          Already have an account?{" "}
          <Link href="/signin" className="text-terminal-green hover:underline transition-colors">
            Sign In
          </Link>
        </p>
      </div>

      <OAuthButtons callbackUrl={callbackUrl} />

      <p className="text-xs text-terminal-muted font-mono text-center mt-6">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-terminal-green hover:underline">Terms of Service</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-terminal-green hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="terminal-window glow-green max-w-md w-full">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">register.sh</span>
        </div>
        <Suspense>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}