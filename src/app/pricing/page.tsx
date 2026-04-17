"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Minus, ArrowRight, Zap, Shield, Building2, Users, Loader2 } from "lucide-react";
import { Breadcrumb } from "@/components/ui";
import { Footer } from "@/components/sections";

const plans = [
  {
    id: "free",
    priceKey: null,
    name: "Free",
    icon: Shield,
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Everything you need to start your AI governance journey.",
    cta: "Get Started — Free",
    ctaHref: "/signup",
    highlight: false,
    badge: null,
    features: [
      "5 AI Advisor (Govi) queries per day",
      "All playbooks & learning paths",
      "Visual governance guides",
      "Topic deep-dives",
      "Template previews",
      "Community support",
    ],
  },
  {
    id: "pro",
    priceKey: "PRO_MONTHLY" as const,
    annualPriceKey: "PRO_ANNUAL" as const,
    name: "Pro",
    icon: Zap,
    monthlyPrice: 49,
    annualPrice: 39,
    description: "For teams actively implementing or scaling a governance programme.",
    cta: "Start Pro",
    ctaHref: null,
    highlight: true,
    badge: "Most Popular",
    features: [
      "20 AI Advisor queries per hour",
      "Full conversation history",
      "Full template library — download & customise",
      "Everything in Free",
      "Priority email support",
      "Early access to new features",
    ],
  },
  {
    id: "team",
    priceKey: "TEAM_MONTHLY" as const,
    annualPriceKey: "TEAM_ANNUAL" as const,
    name: "Team",
    icon: Users,
    monthlyPrice: 149,
    annualPrice: 119,
    description: "For teams of 3–10 building or scaling a shared AI governance programme.",
    cta: "Start Team Plan",
    ctaHref: null,
    highlight: false,
    badge: null,
    features: [
      "50 AI Advisor queries per hour (shared)",
      "Team workspace — up to 10 members",
      "Shared conversation history",
      "Full template library — download & customise",
      "Everything in Pro",
      "Priority email support",
    ],
  },
  {
    id: "enterprise",
    priceKey: null,
    name: "Enterprise",
    icon: Building2,
    monthlyPrice: null,
    annualPrice: null,
    description: "For organisations that need custom controls, unlimited seats, and dedicated support.",
    cta: "Contact Sales",
    ctaHref: "/contact",
    ctaSecondary: "Book a 30-min Governance Audit",
    ctaSecondaryHref: "/contact?subject=audit",
    highlight: false,
    badge: null,
    features: [
      "Unlimited AI Advisor queries",
      "Unlimited team seats",
      "Custom integrations",
      "Dedicated account manager",
      "SLA & compliance support",
      "Custom onboarding",
      "Everything in Team",
    ],
  },
];

const comparisonRows = [
  {
    category: "AI Advisor",
    rows: [
      { label: "Queries",              free: "5 / day",  pro: "20 / hour",  team: "50 / hour", enterprise: "Unlimited" },
      { label: "Conversation history", free: false,      pro: true,         team: true,        enterprise: true },
      { label: "Context awareness",    free: "Basic",    pro: "Advanced",   team: "Advanced",  enterprise: "Custom" },
    ],
  },
  {
    category: "Content",
    rows: [
      { label: "Playbooks & learning paths", free: true,  pro: true,  team: true,  enterprise: true },
      { label: "Visual governance guides",   free: true,  pro: true,  team: true,  enterprise: true },
      { label: "Topic deep-dives",           free: true,  pro: true,  team: true,  enterprise: true },
      { label: "Template downloads",         free: false, pro: true,  team: true,  enterprise: true },
    ],
  },
  {
    category: "Team",
    rows: [
      { label: "Team workspace",      free: false, pro: false, team: "Up to 10",  enterprise: "Unlimited" },
      { label: "Shared history",      free: false, pro: false, team: true,        enterprise: true },
      { label: "Member management",   free: false, pro: false, team: true,        enterprise: true },
      { label: "Custom integrations", free: false, pro: false, team: false,       enterprise: true },
      { label: "Custom onboarding",   free: false, pro: false, team: false,       enterprise: true },
    ],
  },
  {
    category: "Support",
    rows: [
      { label: "Community support",         free: true,  pro: true,  team: true,  enterprise: true },
      { label: "Priority email support",    free: false, pro: true,  team: true,  enterprise: true },
      { label: "Dedicated account manager", free: false, pro: false, team: false, enterprise: true },
      { label: "SLA & compliance support",  free: false, pro: false, team: false, enterprise: true },
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value
      ? <Check className="w-4 h-4 text-terminal-green mx-auto" />
      : <Minus className="w-4 h-4 text-terminal-border mx-auto" />;
  }
  return <span className="font-mono text-xs text-terminal-muted">{value}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleCheckout = async (planKey: "PRO" | "TEAM") => {
    setError(null);

    if (status !== "authenticated") {
      router.push(`/signin?callbackUrl=/pricing`);
      return;
    }

    const role = session.user.role;
    const planRole = planKey === "PRO" ? "PRO" : "TEAM";

    // Already on this plan — open billing portal
    if (role === planRole) {
      setLoading("portal");
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      setLoading(null);
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Failed to open billing portal.");
      }
      return;
    }

    const priceKey = planKey === "PRO"
      ? (annual ? "PRO_ANNUAL" : "PRO_MONTHLY")
      : (annual ? "TEAM_ANNUAL" : "TEAM_MONTHLY");

    setLoading(priceKey);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: priceKey }),
    });

    const data = await res.json();
    setLoading(null);

    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error ?? "Something went wrong. Please try again.");
    }
  };

  const isAuthenticated = status === "authenticated";
  const userRole = session?.user?.role;
  // Map user role to plan id for current-plan detection
  const currentPlanId = isAuthenticated
    ? userRole === "PRO" ? "pro"
    : userRole === "TEAM" ? "team"
    : "free"
    : null;

  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: "Pricing" }]} />

          {/* Header */}
          <header className="mb-12 text-center">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Pricing
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-terminal-muted font-sans max-w-2xl mx-auto mb-8">
              Start free. Scale when you&apos;re ready. No hidden fees.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 p-1 border border-terminal-border rounded-lg bg-terminal-gray/30">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded font-mono text-sm transition-colors ${
                  !annual
                    ? "bg-terminal-green text-terminal-black font-bold"
                    : "text-terminal-muted hover:text-terminal-text"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded font-mono text-sm transition-colors flex items-center gap-2 ${
                  annual
                    ? "bg-terminal-green text-terminal-black font-bold"
                    : "text-terminal-muted hover:text-terminal-text"
                }`}
              >
                Annual
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  annual ? "bg-terminal-black/20 text-terminal-black" : "bg-terminal-green/10 text-terminal-green"
                }`}>
                  Save 20%
                </span>
              </button>
            </div>
          </header>

          {/* Error banner */}
          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <p className="font-mono text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-20">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const price = annual ? plan.annualPrice : plan.monthlyPrice;
              const planKey = plan.id === "pro" ? "PRO" : plan.id === "team" ? "TEAM" : null;
              const isCurrentPlan = currentPlanId === plan.id;
              const btnLoading = loading !== null;
              const badge = isCurrentPlan ? "Current Plan" : plan.badge;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-8 transition-colors ${
                    isCurrentPlan
                      ? "border-terminal-green bg-terminal-green/5 ring-1 ring-terminal-green/30"
                      : plan.highlight
                        ? "border-terminal-green bg-terminal-green/5"
                        : "border-terminal-border bg-terminal-dark/30"
                  }`}
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`px-3 py-1 font-mono text-xs font-bold rounded-full ${
                        isCurrentPlan
                          ? "bg-terminal-text text-terminal-black"
                          : "bg-terminal-green text-terminal-black"
                      }`}>
                        {badge}
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-6">
                    <div className={`w-10 h-10 flex items-center justify-center border rounded-xl mb-4 ${
                      plan.highlight
                        ? "border-terminal-green/50 bg-terminal-green/10"
                        : "border-terminal-border bg-terminal-gray/50"
                    }`}>
                      <Icon className={`w-5 h-5 ${plan.highlight ? "text-terminal-green" : "text-terminal-muted"}`} />
                    </div>
                    <h2 className="font-mono text-xl font-bold text-terminal-text mb-1">{plan.name}</h2>
                    <p className="font-sans text-terminal-muted text-sm">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {price === null ? (
                      <div className="font-mono text-3xl font-bold text-terminal-text">Custom</div>
                    ) : price === 0 ? (
                      <div className="font-mono text-3xl font-bold text-terminal-text">Free</div>
                    ) : (
                      <div className="flex items-end gap-1">
                        <span className="font-mono text-terminal-muted text-lg">$</span>
                        <span className="font-mono text-4xl font-bold text-terminal-text">{price}</span>
                        <span className="font-mono text-terminal-muted text-sm mb-1">/mo</span>
                      </div>
                    )}
                    {annual && price !== null && price > 0 && (
                      <p className="font-mono text-xs text-terminal-muted mt-1">
                        Billed ${(price * 12).toLocaleString()} per year
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-terminal-green shrink-0 mt-0.5" />
                        <span className="font-sans text-terminal-muted text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {planKey !== null ? (
                    <button
                      onClick={() => handleCheckout(planKey)}
                      disabled={btnLoading || isCurrentPlan}
                      className={`inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-mono text-sm font-bold transition-colors ${
                        isCurrentPlan
                          ? "bg-terminal-gray/30 text-terminal-muted border border-terminal-border cursor-default"
                          : "bg-terminal-green text-terminal-black hover:bg-terminal-green/90 disabled:opacity-60"
                      }`}
                    >
                      {loading === planKey ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      {isCurrentPlan ? "Current Plan" : plan.cta}
                    </button>
                  ) : isCurrentPlan ? (
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-mono text-sm font-bold transition-colors bg-terminal-gray/30 text-terminal-muted border border-terminal-border hover:border-terminal-green hover:text-terminal-green"
                    >
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <div className="space-y-3">
                      <Link
                        href={isAuthenticated ? "/dashboard" : plan.ctaHref!}
                        className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-mono text-sm font-bold transition-colors border border-terminal-border text-terminal-text hover:border-terminal-green hover:text-terminal-green"
                      >
                        {plan.cta}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      {plan.ctaSecondary && plan.ctaSecondaryHref && (
                        <Link
                          href={plan.ctaSecondaryHref}
                          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-mono text-sm transition-colors bg-terminal-green/10 border border-terminal-green/30 text-terminal-green hover:bg-terminal-green/20"
                        >
                          {plan.ctaSecondary}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feature comparison table */}
          <div className="mb-20">
            <h2 className="font-mono text-2xl font-bold text-terminal-text text-center mb-10">
              Full Feature Comparison
            </h2>
            <div className="overflow-x-auto rounded-xl border border-terminal-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-terminal-border bg-terminal-dark/50">
                    <th className="text-left px-6 py-4 font-mono text-sm text-terminal-muted w-1/2">Feature</th>
                    {plans.map((p) => (
                      <th key={p.id} className={`px-6 py-4 font-mono text-sm text-center ${
                        p.highlight ? "text-terminal-green" : "text-terminal-text"
                      }`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((group) => (
                    <React.Fragment key={group.category}>
                      <tr className="bg-terminal-gray/20">
                        <td colSpan={5} className="px-6 py-2 font-mono text-xs text-terminal-green uppercase tracking-widest">
                          {group.category}
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.label} className="border-t border-terminal-border/50 hover:bg-terminal-gray/10 transition-colors">
                          <td className="px-6 py-4 font-sans text-sm text-terminal-muted">{row.label}</td>
                          <td className="px-6 py-4 text-center"><Cell value={row.free} /></td>
                          <td className="px-6 py-4 text-center bg-terminal-green/[0.03]"><Cell value={row.pro} /></td>
                          <td className="px-6 py-4 text-center"><Cell value={row.team} /></td>
                          <td className="px-6 py-4 text-center"><Cell value={row.enterprise} /></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-20 max-w-3xl mx-auto">
            <h2 className="font-mono text-2xl font-bold text-terminal-text text-center mb-10">
              Pricing FAQs
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: "Can I switch plans at any time?",
                  a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle. You can manage everything from the billing portal.",
                },
                {
                  q: "Is there a free trial for Pro?",
                  a: "The Free plan gives you access to all content and the AI Advisor indefinitely — no credit card required. Pro unlocks the full analysis output and unlimited queries.",
                },
                {
                  q: "What payment methods do you accept?",
                  a: "We accept all major credit and debit cards via Stripe, which is PCI-DSS Level 1 certified. We never store your card details.",
                },
                {
                  q: "What does 'annual billing' mean?",
                  a: "You pay for 12 months upfront and save 20% compared to the monthly rate. You won't be charged again until the year is up.",
                },
                {
                  q: "How do I cancel my subscription?",
                  a: "Open the billing portal from your account or the pricing page. You can cancel at any time — you'll retain Pro access until the end of your paid period.",
                },
                {
                  q: "How do I get an Enterprise quote?",
                  a: "Contact our team via the Contact page and we'll get back to you within one business day.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="card p-6">
                  <h3 className="font-mono text-sm font-bold text-terminal-text mb-2">{q}</h3>
                  <p className="font-sans text-terminal-muted text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center card p-12">
            <h2 className="font-mono text-2xl font-bold text-terminal-text mb-3">
              Ready to govern AI with confidence?
            </h2>
            <p className="text-terminal-muted font-sans mb-8 max-w-lg mx-auto">
              Join organisations already using GovSecure to adopt AI responsibly, compliantly, and profitably.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={isAuthenticated ? "/dashboard" : "/signup"} className="btn-primary">
                {isAuthenticated ? "Go to Dashboard" : "Start for Free"}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 border border-terminal-border text-terminal-muted hover:border-terminal-green hover:text-terminal-green font-mono text-sm rounded-lg transition-colors"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
