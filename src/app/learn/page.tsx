import { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Rocket, Zap, ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/ui";
import { Footer } from "@/components/sections";

export const metadata: Metadata = {
  title: "Learn AI Governance",
  description: "Start your AI governance journey with structured learning paths for every experience level — Getting Started, Scaling, and Advanced.",
  alternates: { canonical: "/learn" },
  openGraph: {
    title: "Learn AI Governance | GovSecure",
    description: "Structured learning paths for every experience level — from AI governance basics to enterprise-scale compliance.",
    url: "/learn",
  },
};

const levels = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "New to AI governance? Start here. Learn the fundamentals, understand why governance matters, and take your first steps.",
    icon: GraduationCap,
    color: "terminal-green",
    href: "/learn/getting-started",
    topics: [
      "What is AI Governance?",
      "Why SMBs Need AI Governance",
      "The AI Governance Starter Pack",
      "Building Your First AI Policy",
    ],
  },
  {
    id: "scaling",
    title: "Scaling",
    description: "Ready to expand? Learn how to scale your governance program, handle more complex use cases, and build organizational capability.",
    icon: Rocket,
    color: "terminal-cyan",
    href: "/learn/scaling",
    topics: [
      "Scaling Governance Across Teams",
      "Advanced Risk Assessment",
      "Vendor & Third-Party AI Governance",
      "Building a Governance Committee",
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "For governance leaders. Master advanced frameworks, regulatory compliance, and enterprise-scale governance operations.",
    icon: Zap,
    color: "terminal-amber",
    href: "/learn/advanced",
    topics: [
      "Enterprise AI Governance Architecture",
      "Regulatory Deep Dives (EU AI Act, NIST)",
      "AI Audit & Assurance",
      "Continuous Monitoring & MLOps Governance",
    ],
  },
];

export default function LearnPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: "Learn" }]} />

          {/* Header */}
          <header className="mb-16 text-center">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Learning Paths
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
              Learn AI Governance
            </h1>
            <p className="text-lg text-terminal-muted font-sans max-w-2xl mx-auto">
              Structured learning paths designed for your experience level. Start where you are, progress at your pace.
            </p>
          </header>

          {/* Learning paths */}
          <div className="space-y-8">
            {levels.map((level, index) => {
              const Icon = level.icon;
              return (
                <Link
                  key={level.id}
                  href={level.href}
                  className="card group block p-8 hover:border-terminal-green/50"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Icon and title */}
                    <div className="flex items-center gap-4 lg:w-1/3">
                      <div className={`w-16 h-16 flex-shrink-0 flex items-center justify-center border-2 border-${level.color}/30 rounded-xl bg-${level.color}/5`}>
                        <Icon className={`w-8 h-8 text-${level.color}`} />
                      </div>
                      <div>
                        <span className="text-terminal-muted font-mono text-xs uppercase tracking-wider">
                          Level {index + 1}
                        </span>
                        <h2 className="font-mono text-2xl font-bold text-terminal-text group-hover:text-terminal-green transition-colors">
                          {level.title}
                        </h2>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="lg:w-1/3">
                      <p className="text-terminal-muted font-sans">
                        {level.description}
                      </p>
                    </div>

                    {/* Topics preview */}
                    <div className="lg:w-1/3">
                      <ul className="space-y-1">
                        {level.topics.slice(0, 3).map((topic, i) => (
                          <li key={i} className="text-terminal-muted text-sm font-mono flex items-center gap-2">
                            <span className="text-terminal-green">→</span>
                            {topic}
                          </li>
                        ))}
                        {level.topics.length > 3 && (
                          <li className="text-terminal-green text-sm font-mono">
                            +{level.topics.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-6 pt-6 border-t border-terminal-border flex items-center justify-between">
                    <span className="text-terminal-green font-mono text-sm">
                      Start {level.title} Path
                    </span>
                    <ArrowRight className="w-5 h-5 text-terminal-green group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
