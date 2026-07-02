import { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { Footer } from "@/components/sections";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How GovSecure collects, uses, and protects your personal data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | GovSecure",
    description: "How GovSecure collects, uses, and protects your personal data.",
    url: "/privacy",
  },
};

interface LegalSection {
  title: string;
  paragraphs: string[];
}

const SECTIONS: LegalSection[] = [
  {
    title: "1. Overview and our role",
    paragraphs: [
      "GovSecure is an AI governance platform for small and mid-sized businesses, operated by CloudRider Nexus, based in Chicago, Illinois, USA (\"GovSecure\", \"we\", \"us\"). This Privacy Policy explains what personal data we collect when you use GovSecure (the \"Service\"), how and why we use it, who we share it with, and the choices and rights you have.",
      "For your account and our own operational data, we act as the controller. For the content you submit about your organisation's AI systems, staff, or third parties — for example in assessments, uploaded documents, and generated artefacts — you are the controller and we act as your processor, handling that content on your behalf and on your instructions.",
    ],
  },
  {
    title: "2. Data we collect",
    paragraphs: [
      "Account and profile data: your name and email address; your password stored only as a salted bcrypt hash (never in plain text); and, if you sign in with Google or GitHub, the basic profile information those providers return (such as name, email, and avatar). We do not receive your third-party password.",
      "Onboarding and profile settings: your occupational role, the AI tools your business uses, your governance concerns, your maturity-assessment answers, and preferences you set in the app.",
      "Governance content you provide: questions and messages you send to the Govi Advisor; assessment answers; documents you upload (which we process into extracted text chunks and vector embeddings so Govi can reference them); and the records you create — AI system inventory entries, control assessments, remediation tasks, maturity snapshots, and generated artefacts such as policies, DPIAs, and threat models. This content may describe your organisation and, if you choose to include it, individuals.",
      "Billing data: when you subscribe, our payment processor (Stripe) collects and processes your payment details. We do not store full card numbers; we receive limited information such as your plan, billing status, and transaction identifiers.",
      "Usage, analytics, and technical data: analytics and audit events (such as sign-ins, queries, and document generation), token-usage records, rate-limiting records (which may include your IP address), and standard technical metadata such as browser and device information and log data needed to operate and secure the Service.",
      "Communications: if you subscribe to our newsletter, contact us, or request support, we collect the information you provide and our correspondence with you.",
    ],
  },
  {
    title: "3. Cookies and sessions",
    paragraphs: [
      "We use a small number of strictly necessary cookies, principally to keep you signed in via a secure session token. We do not use the session cookie for advertising. Where required by law, any non-essential analytics will be subject to your consent.",
    ],
  },
  {
    title: "4. How we use your data",
    paragraphs: [
      "We use your data to: provide and operate the Service; authenticate you and secure your account; run risk assessments and generate governance documents and playbooks; personalise Govi's questions and guidance to your role; answer your questions using your own uploaded documents (retrieval-augmented generation); maintain your inventory, tasks, compliance posture, and audit trail; process payments and manage subscriptions; enforce usage limits and prevent abuse; provide support; and comply with legal obligations.",
      "We may use aggregated or de-identified data to understand usage and improve the Service. We do not sell your personal data, and we do not use your content to train our own or third parties' foundation models.",
    ],
  },
  {
    title: "5. AI processing and model providers",
    paragraphs: [
      "To generate responses and documents, and to index the documents you upload, we send your queries and the relevant context to third-party AI model providers — currently OpenAI, with Anthropic used as a fallback — and we generate vector embeddings of your uploaded documents. These providers act as our sub-processors and are contractually restricted from using your data to train their models.",
      "Inputs are screened by automated safeguards (including prompt-injection detection) before processing. AI outputs may be inaccurate and should be reviewed; see our Terms of Service for details.",
    ],
  },
  {
    title: "6. Legal bases (GDPR/UK GDPR)",
    paragraphs: [
      "Where the GDPR or UK GDPR applies, we rely on: performance of a contract (to provide the Service you signed up for); our legitimate interests (to secure, maintain, and improve the Service and prevent abuse), balanced against your rights; consent (for optional communications and any non-essential cookies), which you may withdraw at any time; and compliance with legal obligations.",
    ],
  },
  {
    title: "7. How we share data and our sub-processors",
    paragraphs: [
      "We share personal data only with service providers that help us run GovSecure, under contracts that restrict their use of it. These currently include: OpenAI and Anthropic (AI processing); Stripe (payments); our cloud hosting and managed database providers; Resend (transactional email); Sanity (content management); and Google and GitHub (only where you choose to sign in with them).",
      "Within a shared workspace, your content may be visible to other members according to their assigned roles. We may also disclose data where required by law or legal process, to protect our rights, users, or the security of the Service, or in connection with a merger, acquisition, or sale of assets (with notice where required). We will update the list of sub-processors as it changes.",
    ],
  },
  {
    title: "8. International transfers",
    paragraphs: [
      "Some of our providers process data in the United States or other countries. Where we transfer personal data internationally, we rely on appropriate safeguards, such as the European Commission's Standard Contractual Clauses (and the UK addendum) or an equivalent mechanism.",
    ],
  },
  {
    title: "9. Data retention",
    paragraphs: [
      "We retain your account and content while your account is active. If you delete your account, or ask us to delete your data, we delete or anonymise your personal data within a reasonable period, except where we must retain certain records to comply with legal, tax, or security obligations, to resolve disputes, or to preserve the integrity of audit logs. Residual copies may persist in backups for a limited time before being overwritten.",
    ],
  },
  {
    title: "10. Security",
    paragraphs: [
      "We protect your data with encryption in transit (TLS), bcrypt-hashed credentials, role-based access controls, rate limiting and abuse safeguards, and audit logging. No method of transmission or storage is perfectly secure. If we become aware of a personal-data breach affecting you, we will notify you and the relevant authorities as required by law.",
    ],
  },
  {
    title: "11. Your rights and choices",
    paragraphs: [
      "Depending on where you live, you may have rights to access, correct, delete, export (port), restrict, or object to the processing of your personal data, and to withdraw consent. Many of these you can exercise directly in the app; otherwise contact us at hello@govsecure.ai. We will not discriminate against you for exercising your rights.",
      "If we act as your processor for content about your organisation or third parties, we will assist you in responding to individuals' requests; those individuals should contact you as the controller in the first instance. You may also lodge a complaint with your data-protection supervisory authority. We do not sell or \"share\" personal information for cross-context behavioural advertising as those terms are defined under applicable US state privacy laws.",
    ],
  },
  {
    title: "12. Your responsibilities for third-party data",
    paragraphs: [
      "When you submit personal data about your employees, customers, or other third parties, you are responsible for having a lawful basis to do so and for providing any required notices to those individuals. Please only submit personal data that is necessary for your governance purposes. A data processing agreement is available on request for customers who require one.",
    ],
  },
  {
    title: "13. Children",
    paragraphs: [
      "The Service is intended for business use by adults and is not directed to children. We do not knowingly collect personal data from anyone under 18 (or the age of digital consent in your jurisdiction). If you believe a child has provided us data, contact us and we will delete it.",
    ],
  },
  {
    title: "14. Changes to this policy",
    paragraphs: [
      "We may update this policy from time to time. If we make material changes, we will notify you before they take effect — for example, by email or an in-app notice — and update the \"Last updated\" date above.",
    ],
  },
  {
    title: "15. Contact",
    paragraphs: [
      "Privacy questions or requests? Contact us at hello@govsecure.ai, or write to us at CloudRider Nexus, Chicago, Illinois, USA.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-3xl mx-auto">
          <Breadcrumb items={[{ label: "Privacy Policy" }]} />

          <header className="mb-12">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Legal
            </span>
            <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm font-mono text-terminal-muted">
              Last updated: July 1, 2026
            </p>
          </header>

          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="font-mono text-lg font-bold text-terminal-text mb-3">
                  {section.title}
                </h2>
                {section.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-terminal-muted font-sans leading-relaxed mb-3"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
