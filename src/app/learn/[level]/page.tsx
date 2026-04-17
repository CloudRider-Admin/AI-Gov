import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, FileText, ArrowLeft, ArrowUpRight, CheckCircle } from "lucide-react";
import { Breadcrumb, PageHeader } from "@/components/ui";
import { Footer } from "@/components/sections";
import { playbooks } from "@/data/content";
import { categories } from "@/data/topics";

interface LearnLevelPageProps {
  params: Promise<{ level: string }>;
}

const levelData: Record<string, {
  title: string;
  description: string;
  iconName: "GraduationCap" | "Rocket" | "Zap";
  color: string;
  intro: string;
  objectives: string[];
  playbookIds: string[];
  categoryIds: string[];
}> = {
  "getting-started": {
    title: "Getting Started",
    description: "New to AI governance? Start here with the fundamentals.",
    iconName: "GraduationCap",
    color: "terminal-green",
    intro: "Welcome to your AI governance journey. This learning path covers the essential concepts, frameworks, and first steps you need to establish governance in your organization. No prior experience required.",
    objectives: [
      "Understand what AI governance is and why it matters",
      "Learn the key regulatory frameworks (NIST, ISO, EU AI Act)",
      "Create your first AI use case inventory",
      "Draft a basic AI Acceptable Use Policy",
      "Establish initial governance roles and responsibilities",
    ],
    playbookIds: ["starter-pack", "spreadsheets-policies", "aup-design"],
    categoryIds: ["strategy"],
  },
  "scaling": {
    title: "Scaling",
    description: "Expand your governance program across the organization.",
    iconName: "Rocket",
    color: "terminal-cyan",
    intro: "You've established the basics. Now it's time to scale. This path teaches you how to expand governance across teams, handle complex use cases, and build sustainable organizational capability.",
    objectives: [
      "Scale governance processes across multiple teams",
      "Implement advanced risk assessment methodologies",
      "Manage third-party and vendor AI risks",
      "Build and run an AI governance committee",
      "Create governance metrics and reporting",
    ],
    playbookIds: ["shadow-ai", "executive-guide"],
    categoryIds: ["risk-compliance", "operations"],
  },
  "advanced": {
    title: "Advanced",
    description: "Master enterprise-scale governance and compliance.",
    iconName: "Zap",
    color: "terminal-amber",
    intro: "For governance leaders ready to tackle enterprise complexity. Deep-dive into regulatory compliance, audit preparation, and advanced governance architectures.",
    objectives: [
      "Design enterprise AI governance architecture",
      "Achieve regulatory compliance (EU AI Act, sector-specific)",
      "Prepare for and pass AI audits",
      "Implement continuous monitoring and MLOps governance",
      "Lead organizational AI ethics initiatives",
    ],
    playbookIds: ["executive-guide"],
    categoryIds: ["security", "ethics"],
  },
};

export async function generateStaticParams() {
  return Object.keys(levelData).map((level) => ({ level }));
}

export async function generateMetadata({ params }: LearnLevelPageProps): Promise<Metadata> {
  const { level: levelSlug } = await params;
  const level = levelData[levelSlug];

  if (!level) {
    return { title: "Level Not Found" };
  }

  return {
    title: `${level.title} — Learn AI Governance`,
    description: level.description,
    alternates: { canonical: `/learn/${levelSlug}` },
    openGraph: {
      title: `${level.title} | GovSecure`,
      description: level.description,
      url: `/learn/${levelSlug}`,
    },
  };
}

export default async function LearnLevelPage({ params }: LearnLevelPageProps) {
  const { level: levelSlug } = await params;
  const level = levelData[levelSlug];

  if (!level) {
    notFound();
  }

  const levelPlaybooks = playbooks.filter((p) => level.playbookIds.includes(p.id));
  const levelCategories = categories.filter((c) => level.categoryIds.includes(c.id));

  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: "Learn", href: "/learn" },
              { label: level.title },
            ]}
          />

          <PageHeader
            tag="Learning Path"
            title={level.title}
            description={level.description}
            iconName={level.iconName}
          />

          {/* Introduction */}
          <div className="mt-8 mb-12 p-6 bg-terminal-dark/50 border border-terminal-border rounded-lg">
            <p className="text-terminal-muted font-sans leading-relaxed">
              {level.intro}
            </p>
          </div>

          {/* Learning objectives */}
          <section className="mb-16">
            <h2 className="font-mono text-xl font-bold text-terminal-text mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-terminal-green" />
              Learning Objectives
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {level.objectives.map((objective, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-4 border border-terminal-border rounded-lg bg-terminal-gray/30"
                >
                  <span className="text-terminal-green font-mono text-sm">{index + 1}.</span>
                  <span className="text-terminal-text font-sans text-sm">{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Recommended Playbooks */}
          <section className="mb-16">
            <h2 className="font-mono text-xl font-bold text-terminal-text mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-terminal-green" />
              Recommended Playbooks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {levelPlaybooks.map((playbook) => (
                <Link
                  key={playbook.id}
                  href={`/playbooks/${playbook.slug}`}
                  className="card group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-mono text-base font-bold text-terminal-text group-hover:text-terminal-green transition-colors">
                      {playbook.title}
                    </h3>
                    <ArrowUpRight className="w-4 h-4 text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <p className="text-terminal-muted font-sans text-sm line-clamp-2">
                    {playbook.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Related Topics */}
          <section className="mb-16">
            <h2 className="font-mono text-xl font-bold text-terminal-text mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-terminal-green" />
              Related Topics
            </h2>
            <div className="space-y-6">
              {levelCategories.map((category) => (
                <div key={category.id} className="card p-6">
                  <Link
                    href={`/topics/${category.slug}`}
                    className="font-mono text-lg font-bold text-terminal-text hover:text-terminal-green transition-colors"
                  >
                    {category.name}
                  </Link>
                  <p className="text-terminal-muted font-sans text-sm mt-1 mb-4">
                    {category.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {category.topics.slice(0, 4).map((topic) => (
                      <Link
                        key={topic.id}
                        href={`/topics/${category.slug}/${topic.slug}`}
                        className="px-3 py-1 text-xs font-mono text-terminal-muted border border-terminal-border rounded hover:border-terminal-green hover:text-terminal-green transition-colors"
                      >
                        {topic.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Back link */}
          <div className="pt-8 border-t border-terminal-border">
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 text-terminal-muted hover:text-terminal-green transition-colors font-mono text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all learning paths
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
