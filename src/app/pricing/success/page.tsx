import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Subscription Confirmed",
  robots: { index: false },
};

export default function PricingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="terminal-window glow-green max-w-md w-full text-center">
        <div className="terminal-header">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-4 text-xs text-terminal-muted font-mono">subscription_confirmed.sh</span>
        </div>
        <div className="p-10">
          <CheckCircle className="w-16 h-16 text-terminal-green mx-auto mb-6" />
          <h1 className="font-mono text-3xl font-bold text-terminal-green mb-3">
            You&apos;re on Pro!
          </h1>
          <p className="font-sans text-terminal-muted text-sm mb-8 leading-relaxed">
            Your subscription is active. You now have access to 20 AI Advisor queries per hour,
            full conversation history, and the complete template library.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/" className="btn-primary w-full justify-center">
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/govi"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-terminal-border text-terminal-muted hover:border-terminal-green hover:text-terminal-green font-mono text-sm rounded-md transition-colors"
            >
              Try the AI Advisor
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
