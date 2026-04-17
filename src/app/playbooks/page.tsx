import { Metadata } from "next";
import { playbooks } from "@/data/content";
import { Breadcrumb } from "@/components/ui";
import { PlaybooksFilter } from "@/components/filters";
import { Footer } from "@/components/sections";

export const metadata: Metadata = {
  title: "Governance Playbooks",
  description: "Practical step-by-step guides for implementing AI governance at every stage of your journey — from starter pack to advanced compliance.",
  alternates: { canonical: "/playbooks" },
  openGraph: {
    title: "Governance Playbooks | GovSecure",
    description: "Practical step-by-step guides for implementing AI governance at every stage of your journey.",
    url: "/playbooks",
  },
};

export default function PlaybooksPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: "Playbooks" }]} />

          {/* Header */}
          <header className="mb-12">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Governance Playbooks
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
              Practical Guides for Every Stage
            </h1>
            <p className="text-lg text-terminal-muted font-sans max-w-3xl">
              Step-by-step playbooks to help you implement AI governance, from getting started to advanced optimization.
            </p>
          </header>

          {/* Filter and playbooks grid */}
          <PlaybooksFilter playbooks={playbooks} />
        </div>
      </div>
      <Footer />
    </>
  );
}
