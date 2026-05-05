import { Metadata } from "next";
import { Advisor } from "@/components/advisor";

export const metadata: Metadata = {
  title: "Govi - AI Governance Advisor",
  description:
    "Ask Govi, your AI governance expert, for guidance on responsible AI practices, compliance, and risk management.",
};

export default async function GoviPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; c?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen pt-16 pb-12">
      <div className="border-b border-terminal-border bg-terminal-black/80 backdrop-blur-sm sticky top-16 z-10 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-mono font-bold text-terminal-green">
              Govi — AI Governance Advisor
            </h1>
            <p className="text-xs font-mono text-terminal-muted mt-0.5">
              Ask about risk, compliance, policy, and responsible AI for your organisation
            </p>
          </div>
          <span className="text-xs font-mono text-terminal-muted hidden sm:block">
            Powered by GPT-4o
          </span>
        </div>
      </div>

      <Advisor showHeader={false} initialQuery={params.q} initialConversationId={params.c} />
    </div>
  );
}