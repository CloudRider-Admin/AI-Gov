import { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { Footer } from "@/components/sections";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of GovSecure — the AI governance platform for SMBs.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | GovSecure",
    description: "The terms that govern your use of GovSecure.",
    url: "/terms",
  },
};

interface LegalSection {
  title: string;
  paragraphs: string[];
}

const SECTIONS: LegalSection[] = [
  {
    title: "1. Agreement to these terms",
    paragraphs: [
      "GovSecure is an AI governance platform operated by CloudRider Nexus, based in Chicago, Illinois, USA (\"GovSecure\", \"we\", \"us\", or \"our\"). These Terms of Service (the \"Terms\") form a binding agreement between you and GovSecure governing your access to and use of the GovSecure websites, applications, APIs, and related services (together, the \"Service\").",
      "By creating an account, clicking to accept, or otherwise accessing or using the Service, you agree to these Terms and to our Privacy Policy, which is incorporated by reference. If you do not agree, do not use the Service.",
      "If you use the Service on behalf of a company or other organisation, you represent that you have authority to bind that organisation to these Terms, and \"you\" refers to that organisation. The Service is intended for business use by users who are at least 18 years old; it is not directed to consumers or children.",
    ],
  },
  {
    title: "2. Important notice — not legal, compliance, or professional advice",
    paragraphs: [
      "GovSecure is a software tool that helps you organise and accelerate your own AI governance work. It is not a law firm, consultancy, auditor, or certification body, and no attorney–client or other professional relationship is created by your use of it.",
      "All outputs of the Service — including Govi Advisor responses, intake risk scores and tiers, generated policies, DPIAs, threat models, checklists, TPRM questionnaires, playbooks, maturity scores, and compliance mappings to frameworks such as the EU AI Act, NIST AI RMF, and ISO/IEC 42001 — are informational starting points generated with the assistance of artificial intelligence. They may be incomplete, inaccurate, out of date, or unsuitable for your specific circumstances.",
      "You are solely responsible for reviewing, validating, and adapting any output before relying on it, and for obtaining qualified legal, privacy, security, or compliance advice for your situation. Nothing produced by the Service guarantees compliance with, or a particular outcome under, any law, regulation, standard, or framework.",
    ],
  },
  {
    title: "3. The Service",
    paragraphs: [
      "The Service includes, and may change over time, features such as: the Govi AI Advisor (a conversational assistant); the intake risk assessment; the document generator (policies, DPIAs, threat models, checklists, and similar artefacts); the playbook generator; the AI system inventory/register; the continuous compliance posture and control-assessment surface; the remediation task tracker; the evidence and audit log; the AI governance maturity score; the regulatory-change feed; and the GovSecure content library.",
      "We may add, modify, suspend, or discontinue features at any time. Some features depend on your subscription plan, and some are provided on a beta or evaluation basis and may be changed or withdrawn without notice.",
    ],
  },
  {
    title: "4. Accounts and sign-in",
    paragraphs: [
      "To use most features you must create an account using an email and password, or by signing in with a supported third-party identity provider (such as Google or GitHub). You must provide accurate, current, and complete information and keep it up to date.",
      "You are responsible for safeguarding your credentials and for all activity under your account. You must keep your credentials confidential, use them only for your own account, and promptly notify us at hello@govsecure.ai of any suspected unauthorised use. We are not liable for loss arising from unauthorised use of your account.",
    ],
  },
  {
    title: "5. Organisations, workspaces, and team access",
    paragraphs: [
      "The Service supports shared organisation workspaces with role-based access (such as Owner, Admin, Contributor, and Viewer). If you create or join a workspace, you understand that content in that workspace — including AI systems, assessments, generated documents, tasks, and audit records — may be visible to, and manageable by, other members according to their roles.",
      "A workspace Owner or Admin controls membership, roles, and shared content, and may invite or remove members and access or delete workspace content. If you are invited to a workspace, the organisation that operates it is responsible for it and for the actions of its members. You are responsible for the users you invite and for configuring access appropriately.",
    ],
  },
  {
    title: "6. Acceptable use",
    paragraphs: [
      "You agree not to, and not to permit anyone to: (a) use the Service unlawfully or in violation of these Terms; (b) attempt to gain unauthorised access to the Service, other accounts, or our systems; (c) probe, scan, disrupt, or overload the Service, or circumvent rate limits, usage or token budgets, authentication, or security controls (including the prompt-injection and abuse safeguards); (d) reverse engineer, decompile, or attempt to extract source code, models, prompts, or the underlying knowledge base, except to the extent this restriction is prohibited by law; (e) use the Service, or its outputs, to build or train a competing product or model, or to scrape or resell the Service; or (f) submit content that is unlawful, infringing, malicious, or that you do not have the right to submit.",
      "You must not submit personal data about other individuals unless you have a lawful basis to do so, and you must not upload content containing malware or that you are contractually or legally prohibited from sharing.",
    ],
  },
  {
    title: "7. AI features and third-party model providers",
    paragraphs: [
      "To generate responses and documents, and to index documents you upload, the Service sends your queries and relevant context to third-party AI model providers (currently OpenAI, and Anthropic as a fallback) and generates vector embeddings of your uploaded documents. These providers process the data on our behalf as service providers.",
      "AI outputs are generated probabilistically and may contain errors or fabricated references (\"hallucinations\"). Citations, regulatory references, and framework mappings must be independently verified. You must not use the Service to make automated decisions that produce legal or similarly significant effects on individuals without appropriate human review.",
    ],
  },
  {
    title: "8. Your content and data",
    paragraphs: [
      "\"Your Content\" means the information you submit to the Service (such as questions, assessment answers, uploaded documents, and organisation details) and the documents and artefacts you generate with it. As between you and us, you retain all rights you have in Your Content.",
      "You grant us a worldwide, non-exclusive licence to host, store, process, transmit, display, and create derived data (such as text extractions and embeddings) from Your Content solely to provide, secure, and support the Service for you and your workspace. We do not sell Your Content, and we do not use it to train our own or third parties' foundation models.",
      "You are responsible for Your Content, for having the necessary rights and lawful bases to submit it, and for maintaining your own copies. Our handling of personal data is described in the Privacy Policy; where you submit personal data about your organisation's systems or third parties, you act as the controller and we act as your processor.",
    ],
  },
  {
    title: "9. Intellectual property",
    paragraphs: [
      "The Service, including its software, design, content library, document templates, framework mappings, knowledge base, and all related intellectual property, is owned by GovSecure or its licensors and is protected by law. Except for the rights expressly granted to you here, we reserve all rights.",
      "We grant you a limited, non-exclusive, non-transferable, revocable right to access and use the Service, and to use the documents you generate, for your own internal business governance purposes, subject to these Terms and your plan.",
      "If you send us feedback or suggestions, you grant us a perpetual, irrevocable, royalty-free licence to use them without restriction or obligation to you.",
    ],
  },
  {
    title: "10. Subscriptions, plans, and billing",
    paragraphs: [
      "The Service is offered under different plans (such as Free, Pro, Team, and Enterprise) with different features and usage allowances, including monthly token or usage limits. Details and current pricing are shown on our pricing page.",
      "Paid plans are billed in advance through our payment processor (Stripe) on a recurring (monthly or annual) basis and renew automatically until cancelled. By subscribing, you authorise us and our processor to charge your payment method for the applicable fees and taxes. You are responsible for providing valid payment details.",
      "You may cancel at any time; cancellation takes effect at the end of the current billing period, and you retain paid access until then. Except where required by law, fees are non-refundable and we do not provide refunds or credits for partial periods or unused allowances. We may change plans, features, allowances, and pricing on a prospective basis with notice; changes apply from your next renewal. We may suspend or limit the Service if fees are overdue.",
    ],
  },
  {
    title: "11. Third-party services",
    paragraphs: [
      "The Service integrates with third-party services — including AI model providers, our payment processor, identity providers used for sign-in, email delivery, hosting, and content management. Your use of those integrations may be subject to the third party's own terms and privacy practices, and we are not responsible for third-party services.",
    ],
  },
  {
    title: "12. Disclaimers",
    paragraphs: [
      "To the maximum extent permitted by law, the Service and all outputs are provided \"as is\" and \"as available\", without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, accuracy, non-infringement, and any warranty that the Service will be uninterrupted, error-free, secure, or that outputs will be accurate, complete, or achieve compliance with any law or standard.",
    ],
  },
  {
    title: "13. Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, GovSecure and its suppliers will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, data, goodwill, or business, arising out of or relating to the Service or these Terms, whether based in contract, tort, or otherwise, even if advised of the possibility of such damages.",
      "Our total aggregate liability for all claims arising out of or relating to the Service or these Terms will not exceed the greater of the amounts you paid us for the Service in the twelve months before the event giving rise to the claim, or USD 100. Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.",
    ],
  },
  {
    title: "14. Indemnification",
    paragraphs: [
      "You will defend, indemnify, and hold harmless GovSecure and its officers, employees, and agents from and against any claims, liabilities, damages, and expenses (including reasonable legal fees) arising out of or related to Your Content, your use of the Service, your violation of these Terms, or your violation of any law or third-party right.",
    ],
  },
  {
    title: "15. Suspension and termination",
    paragraphs: [
      "You may stop using the Service and delete your account at any time. We may suspend or terminate your access, with or without notice, if you breach these Terms, if required for security or legal reasons, or if your account is inactive or unpaid.",
      "On termination, your right to use the Service ends and we may delete Your Content in accordance with the Privacy Policy and our retention practices. Sections that by their nature should survive termination — including content ownership, IP, disclaimers, limitation of liability, indemnification, and governing law — will survive.",
    ],
  },
  {
    title: "16. Changes to the Service and these terms",
    paragraphs: [
      "We may update these Terms from time to time. If we make material changes, we will provide notice — for example, by email or an in-app notice — before they take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms. If you do not agree, you must stop using the Service.",
    ],
  },
  {
    title: "17. Governing law and disputes",
    paragraphs: [
      "These Terms are governed by the laws of the State of Illinois, United States, without regard to conflict-of-laws rules. You and GovSecure agree to the exclusive jurisdiction of the state and federal courts located in Cook County, Chicago, Illinois for any dispute not subject to an alternative dispute-resolution process, except that either party may seek injunctive relief in any court of competent jurisdiction.",
    ],
  },
  {
    title: "18. General",
    paragraphs: [
      "These Terms, together with the Privacy Policy and any plan-specific or order terms, are the entire agreement between you and us regarding the Service. If any provision is held unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of assets. Neither party is liable for delays or failures caused by events beyond its reasonable control.",
    ],
  },
  {
    title: "19. Contact",
    paragraphs: [
      "Questions about these Terms? Contact us at hello@govsecure.ai, or write to us at CloudRider Nexus, Chicago, Illinois, USA.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-3xl mx-auto">
          <Breadcrumb items={[{ label: "Terms of Service" }]} />

          <header className="mb-12">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Legal
            </span>
            <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-4">
              Terms of Service
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
