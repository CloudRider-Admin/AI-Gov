import { Metadata } from "next";
import { categories } from "@/data/topics";
import { Breadcrumb } from "@/components/ui";
import { TopicsFilter } from "@/components/filters";
import { Footer } from "@/components/sections";

export const metadata: Metadata = {
  title: "Topics & Categories",
  description: "Explore AI governance topics organized by category — Strategy, Risk & Compliance, Security, Ethics, and Operations.",
  alternates: { canonical: "/topics" },
  openGraph: {
    title: "Topics & Categories | GovSecure",
    description: "Explore AI governance topics organized by category — Strategy, Risk & Compliance, Security, Ethics, and Operations.",
    url: "/topics",
  },
};

export default function TopicsPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: "Topics" }]} />

          {/* Header */}
          <header className="mb-12">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Knowledge Base
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
              Topics & Categories
            </h1>
            <p className="text-lg text-terminal-muted font-sans max-w-3xl">
              Explore AI governance topics organized by category. Deep-dive into specific areas or browse all content.
            </p>
          </header>

          {/* Filter and topics */}
          <TopicsFilter categories={categories} />
        </div>
      </div>
      <Footer />
    </>
  );
}
