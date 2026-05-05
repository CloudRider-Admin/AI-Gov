import { MessageSquare, ScanSearch, FileSignature } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: MessageSquare,
    title: "Describe your use case",
    body: "Tell Govi in plain English what AI system, model, or feature you're planning — no jargon required.",
  },
  {
    n: "02",
    icon: ScanSearch,
    title: "Get instant analysis",
    body: "Govi maps your use case to EU AI Act, GDPR, and NIST frameworks, surfaces risks, and flags policy gaps.",
  },
  {
    n: "03",
    icon: FileSignature,
    title: "Generate governance artifacts",
    body: "Turn the analysis into DPIAs, threat models, model cards, and implementation playbooks — ready to review.",
  },
];

export function HowItWorks() {
  return (
    <section className="section">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 border border-terminal-border rounded-full bg-terminal-dark/50">
            <span className="w-1.5 h-1.5 bg-terminal-green rounded-full" />
            <span className="font-mono text-xs text-terminal-muted uppercase tracking-wider">
              How it works
            </span>
          </span>
          <h2 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-4">
            From use case to compliant artifact in three steps
          </h2>
          <p className="text-base md:text-lg text-terminal-muted font-sans max-w-2xl mx-auto leading-relaxed">
            Govi is an AI governance co-pilot for small and mid-sized teams.
            Paste a use case, get a grounded risk assessment, and walk away with
            drafts you can hand to legal.
          </p>
        </div>

        {/* Step cards */}
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.n}
                className="relative rounded-xl border border-terminal-border bg-terminal-gray/30 p-6 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-terminal-green/10 text-terminal-green">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span
                    className="font-mono text-xs text-terminal-muted tracking-wider"
                    aria-hidden="true"
                  >
                    {step.n}
                  </span>
                </div>
                <h3 className="font-mono text-base font-semibold text-terminal-text">
                  {step.title}
                </h3>
                <p className="text-sm font-sans text-terminal-muted leading-relaxed">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Try it hint */}
        <p className="mt-10 text-center text-sm font-sans text-terminal-muted">
          Try it below — no sign-up needed for your first analysis.
        </p>
      </div>
    </section>
  );
}