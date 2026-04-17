import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle, MessageSquare } from "lucide-react";
import { Breadcrumb } from "@/components/ui";
import { Footer } from "@/components/sections";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about GovSecure — our AI governance platform, Govi AI Advisor, pricing, security, and compliance with NIST AI RMF, ISO 42001, EU AI Act, and GDPR.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ | GovSecure",
    description:
      "Common questions about GovSecure, Govi AI Advisor, pricing, security, and compliance.",
    url: "/faq",
  },
};

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  id: string;
  title: string;
  description: string;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    title: "General",
    description: "About GovSecure and how it works",
    items: [
      {
        q: "What is GovSecure?",
        a: "GovSecure is an AI governance platform built for small and mid-sized businesses (SMBs). We help you assess AI risks, generate governance artefacts (policies, DPIAs, threat models, playbooks), and stay compliant with frameworks like NIST AI RMF, ISO/IEC 42001, the EU AI Act, and GDPR — without needing a dedicated compliance team.",
      },
      {
        q: "Who is GovSecure for?",
        a: "We're built for SMBs and scale-ups that are deploying AI (chatbots, ML models, GenAI tools) and need practical, lightweight governance. If you're asking 'how do we use AI responsibly without hiring a compliance officer?', GovSecure is for you.",
      },
      {
        q: "Do I need compliance or legal expertise to use GovSecure?",
        a: "No. Our AI Advisor (Govi) translates complex regulatory language into plain, actionable guidance. That said, the output is preliminary — for binding decisions, always consult qualified governance counsel.",
      },
      {
        q: "Which AI governance frameworks do you cover?",
        a: "We map every assessment against NIST AI Risk Management Framework (AI RMF), ISO/IEC 42001 AI Management Systems, the EU AI Act, GDPR, and sector-specific guidance (HIPAA for healthcare, SOC 2, PCI-DSS, and more).",
      },
      {
        q: "How quickly can I get started?",
        a: "Under two minutes. Sign up with email or Google/GitHub, ask Govi a question about your AI use case, and you'll get a risk assessment and recommended policies immediately.",
      },
    ],
  },
  {
    id: "advisor",
    title: "Govi AI Advisor",
    description: "Using the AI governance advisor",
    items: [
      {
        q: "What is Govi?",
        a: "Govi is our AI Governance Advisor — a specialised assistant trained on AI RMF, ISO 42001, the EU AI Act, and GDPR. Describe your AI use case, and Govi returns a risk profile, recommended policies, applicable regulations, and follow-up questions to refine the assessment.",
      },
      {
        q: "How does Govi decide whether to ask clarifying questions?",
        a: "If your initial query is specific (e.g. 'Assess a customer service chatbot using GPT-4 for insurance claims'), Govi goes straight to a full assessment. If it's vague (e.g. 'I need an AI risk assessment'), Govi asks 3–5 targeted questions about your use case, industry, data, users, and deployment context — so the output is actually tailored to you, not a generic template.",
      },
      {
        q: "Can Govi generate actual documents, not just advice?",
        a: "Yes. Once Govi has enough context, it can generate full artefacts: AI Intake Risk Assessments, DPIAs, threat models, bias audits, vendor assessments, incident response playbooks, and governance roadmaps. Artefacts are saved to your account and can be exported as Markdown.",
      },
      {
        q: "How does Govi remember earlier parts of the conversation?",
        a: "Every follow-up message carries the full thread history — prior exchanges, established facts (your industry, model, data types), and the original request. Govi will not re-ask questions you've already answered in the same conversation.",
      },
      {
        q: "Is my conversation with Govi private?",
        a: "Yes. Conversations are tied to your account, stored encrypted, and never used to train external models. We do not share data with third parties beyond the LLM provider needed to generate responses, and we never log your queries in plain text outside your own dashboard.",
      },
      {
        q: "What if Govi gets something wrong?",
        a: "Govi is a decision-support tool, not a replacement for expert judgement. Every response ends with a disclaimer: this is a preliminary assessment — consult governance counsel for binding advice. If you spot a mistake, use the Contact page to let us know.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & Billing",
    description: "Plans, payments, and cancellations",
    items: [
      {
        q: "Is there a free plan?",
        a: "Yes. The Free plan gives you access to all learning content and the Govi AI Advisor indefinitely — no credit card required. Paid plans (Pro, Team, Enterprise) unlock unlimited queries, the full analysis output, document generation, and regulatory mapping.",
      },
      {
        q: "Can I switch plans at any time?",
        a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle. You can manage everything from the billing portal.",
      },
      {
        q: "What payment methods do you accept?",
        a: "All major credit and debit cards via Stripe, which is PCI-DSS Level 1 certified. We never store your card details directly.",
      },
      {
        q: "What does 'annual billing' mean?",
        a: "You pay for 12 months upfront and save 20% compared to the monthly rate. You won't be charged again until the year is up.",
      },
      {
        q: "How do I cancel my subscription?",
        a: "Open the billing portal from your account or the pricing page. You can cancel at any time — you'll retain paid access until the end of your current billing period.",
      },
      {
        q: "Do you offer refunds?",
        a: "If you cancel within 14 days of your first paid charge, we'll issue a full refund — no questions asked. After that, access continues until the end of your billing period.",
      },
      {
        q: "How do I get an Enterprise quote?",
        a: "Contact our team via the Contact page. We'll reply within one business day with a tailored quote based on seat count, usage, and support needs.",
      },
    ],
  },
  {
    id: "security",
    title: "Security & Compliance",
    description: "Data protection and trust",
    items: [
      {
        q: "Where is my data stored?",
        a: "Data is stored in encrypted PostgreSQL databases hosted in EU and US regions, depending on your account. All data at rest is encrypted with AES-256, and data in transit uses TLS 1.3.",
      },
      {
        q: "Is GovSecure GDPR compliant?",
        a: "Yes. We act as a data processor under GDPR, offer a Data Processing Addendum (DPA) on request, and honour data subject rights including access, deletion, and portability.",
      },
      {
        q: "Do you use my data to train AI models?",
        a: "No. Your conversations, artefacts, and uploaded documents are never used to train LLMs or shared with third parties for training purposes.",
      },
      {
        q: "Who can see my assessments and documents?",
        a: "Only you and users you explicitly invite to your workspace. GovSecure staff can access support tickets only with your permission.",
      },
      {
        q: "What happens to my data if I cancel?",
        a: "Your artefacts remain available for 30 days after cancellation so you can export them. After 30 days, data is permanently deleted from our live systems; backups are purged within 90 days.",
      },
      {
        q: "Do you undergo third-party security audits?",
        a: "We're working towards SOC 2 Type II certification. Our security posture includes regular penetration testing, dependency scanning, and an active vulnerability disclosure programme.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Access",
    description: "Sign-in, teams, and support",
    items: [
      {
        q: "How do I reset my password?",
        a: "Go to the sign-in page and click 'Forgot password'. We'll email you a reset link valid for 30 minutes.",
      },
      {
        q: "Can I sign in with Google or GitHub?",
        a: "Yes. Both OAuth providers are supported on the sign-in and signup pages.",
      },
      {
        q: "How do I add teammates to my workspace?",
        a: "Team and Enterprise plans support seat-based access. Invite teammates from the account settings page using their email address — they'll receive an invitation link.",
      },
      {
        q: "What if I need help?",
        a: "Email support via the Contact page. Free users get responses within two business days; Pro and above get priority response within one business day. Enterprise customers have dedicated Slack channels.",
      },
      {
        q: "Can I export my data?",
        a: "Yes. Every generated artefact includes a Markdown export, and you can download your full conversation history from account settings.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-5xl mx-auto">
          <Breadcrumb items={[{ label: "FAQ" }]} />

          {/* Header */}
          <header className="mb-16 text-center">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Frequently Asked Questions
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
              How can we help?
            </h1>
            <p className="text-lg text-terminal-muted font-sans max-w-2xl mx-auto">
              Answers to common questions about GovSecure, Govi, pricing, security, and getting started with AI governance.
            </p>
          </header>

          {/* Category jump-nav */}
          <nav
            aria-label="FAQ categories"
            className="mb-12 flex flex-wrap justify-center gap-3"
          >
            {FAQ_CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-mono border border-terminal-border rounded-full text-terminal-muted hover:border-terminal-green hover:text-terminal-green transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {cat.title}
              </a>
            ))}
          </nav>

          {/* Categories */}
          <div className="space-y-16">
            {FAQ_CATEGORIES.map((category) => (
              <section
                key={category.id}
                id={category.id}
                className="scroll-mt-24"
                aria-labelledby={`${category.id}-heading`}
              >
                <div className="mb-8 border-b border-terminal-border pb-4">
                  <h2
                    id={`${category.id}-heading`}
                    className="font-mono text-2xl font-bold text-terminal-text mb-1"
                  >
                    {category.title}
                  </h2>
                  <p className="font-sans text-sm text-terminal-muted">
                    {category.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {category.items.map(({ q, a }) => (
                    <details
                      key={q}
                      className="card p-6 group cursor-pointer [&_summary::-webkit-details-marker]:hidden"
                    >
                      <summary className="flex items-start justify-between gap-4">
                        <h3 className="font-mono text-sm font-bold text-terminal-text flex-1">
                          {q}
                        </h3>
                        <span
                          aria-hidden="true"
                          className="shrink-0 font-mono text-terminal-green text-lg leading-none transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="mt-4 font-sans text-terminal-muted text-sm leading-relaxed">
                        {a}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-20 text-center card p-12">
            <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center border border-terminal-green/30 rounded-xl bg-terminal-green/5">
              <MessageSquare className="w-5 h-5 text-terminal-green" />
            </div>
            <h2 className="font-mono text-2xl font-bold text-terminal-text mb-3">
              Still have questions?
            </h2>
            <p className="text-terminal-muted font-sans mb-8 max-w-lg mx-auto">
              Can&apos;t find what you&apos;re looking for? Our team replies to every enquiry within one business day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contact" className="btn-primary">
                Contact Us
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/advisor"
                className="inline-flex items-center gap-2 px-6 py-3 border border-terminal-border text-terminal-muted hover:border-terminal-green hover:text-terminal-green font-mono text-sm rounded-lg transition-colors"
              >
                Try Govi Advisor
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
