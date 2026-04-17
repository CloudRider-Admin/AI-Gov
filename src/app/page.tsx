import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Hero,
  Audience,
  ValueProposition,
  Playbooks,
  VisualGuides,
  Templates,
  Footer,
} from "@/components/sections";
import { Advisor } from "@/components/advisor";
import { AdvisorButton } from "@/components/ui/ScrollButton";
import { DashboardContent } from "./dashboard/DashboardContent";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    return <DashboardContent />;
  }

  return (
    <>
      {/* Floating AI Advisor Button */}
      <AdvisorButton />

      {/* Section 1: Hero */}
      <Hero />

      {/* Section 2: Interactive Advisor */}
      <Advisor />

      {/* Section 3: Audience - Who This Is For */}
      <Audience />

      {/* Section 4: Governance Playbooks */}
      <Playbooks />

      {/* Section 5: Visual Explainers */}
      <VisualGuides />

      {/* Section 6: Tools & Templates */}
      <Templates />

      {/* Section 7: Value Proposition */}
      <ValueProposition />

      {/* Section 8: Trust & Footer */}
      <Footer />
    </>
  );
}
