import { Metadata } from "next";
import { GoviExperience } from "@/components/advisor/GoviExperience";

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
  return <GoviExperience initialQuery={params.q} initialConversationId={params.c} />;
}
