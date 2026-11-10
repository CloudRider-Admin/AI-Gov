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
  searchParams: Promise<{ q?: string; c?: string; new?: string }>;
}) {
  const params = await searchParams;
  // "New Govi chat" in the sidebar links to /govi?new=<ts>; keying on it
  // remounts the experience so it always opens on a fresh conversation.
  return (
    <GoviExperience
      key={params.new ?? params.c ?? "govi"}
      initialQuery={params.q}
      initialConversationId={params.c}
    />
  );
}
