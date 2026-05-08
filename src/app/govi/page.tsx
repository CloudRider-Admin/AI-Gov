import { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
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
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-mono font-bold text-terminal-green">
              Govi — AI Governance Advisor
            </h1>
            <p className="text-xs font-mono text-terminal-muted mt-0.5">
              Anchored by the GovSecure Governance Library
            </p>
          </div>
          <Link
            href="/govi/library"
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 border border-terminal-border rounded hover:border-terminal-green hover:text-terminal-green transition-colors text-terminal-muted"
          >
            <BookOpen className="w-3 h-3" />
            GovSecure Library
          </Link>
        </div>
      </div>

      <Advisor showHeader={false} initialQuery={params.q} initialConversationId={params.c} />
    </div>
  );
}