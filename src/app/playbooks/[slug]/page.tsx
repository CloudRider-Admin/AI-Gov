import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Calendar } from "lucide-react";
import { getPlaybookBySlug, getAllPlaybookSlugs, getPlaybooks } from "@/lib/sanity";
import { Breadcrumb, PageHeader, MarkdownContent, RelatedCard, ContentNavigation } from "@/components/ui";
import { Footer } from "@/components/sections";

interface PlaybookPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPlaybookSlugs();
  return slugs.map((slug: string) => ({ slug }));
}

export async function generateMetadata({ params }: PlaybookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const playbook = await getPlaybookBySlug(slug);

  if (!playbook) {
    return { title: "Playbook Not Found" };
  }

  return {
    title: playbook.title,
    description: playbook.description,
    alternates: { canonical: `/playbooks/${slug}` },
    openGraph: {
      title: `${playbook.title} | GovSecure`,
      description: playbook.description,
      url: `/playbooks/${slug}`,
      type: "article",
    },
  };
}

export default async function PlaybookPage({ params }: PlaybookPageProps) {
  const { slug } = await params;
  const [playbook, allPlaybooks] = await Promise.all([
    getPlaybookBySlug(slug),
    getPlaybooks(),
  ]);

  if (!playbook) {
    notFound();
  }

  // Find previous and next playbooks
  const currentIndex = allPlaybooks.findIndex(
    (p: unknown) => {
      const slugValue = (p as { slug?: { current?: string } | string }).slug;
      const resolvedSlug = typeof slugValue === "string" ? slugValue : slugValue?.current;
      return resolvedSlug === slug;
    }
  );
  const previousPlaybook = currentIndex > 0 ? allPlaybooks[currentIndex - 1] : null;
  const nextPlaybook = currentIndex < allPlaybooks.length - 1 ? allPlaybooks[currentIndex + 1] : null;

  return (
    <>
      <article className="section min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: "Playbooks", href: "/playbooks" },
              { label: playbook.title },
            ]}
          />

          <PageHeader
            tag="Playbook"
            title={playbook.title}
            description={playbook.description}
            iconName="BookOpen"
            level={playbook.level}
          />

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-6 mb-12 pb-8 border-b border-terminal-border">
            {playbook.estimatedReadTime && (
              <div className="flex items-center gap-2 text-terminal-muted text-sm">
                <Clock className="w-4 h-4" />
                <span>{playbook.estimatedReadTime} min read</span>
              </div>
            )}
            {playbook.publishedAt && (
              <div className="flex items-center gap-2 text-terminal-muted text-sm">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(playbook.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="mb-16">
            <MarkdownContent content={playbook.content || ""} />
          </div>

          {/* Related playbooks */}
          {playbook.relatedPlaybooks && playbook.relatedPlaybooks.length > 0 && (
            <section className="border-t border-terminal-border pt-12">
              <h2 className="font-mono text-xl font-bold text-terminal-text mb-6">
                Related Playbooks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {playbook.relatedPlaybooks.map((related: unknown) => (
                  (() => {
                    const r = related as {
                      id?: string;
                      _id?: string;
                      title: string;
                      description: string;
                      level?: "beginner" | "intermediate" | "leadership";
                      slug?: { current?: string } | string;
                    };
                    const relatedSlug = typeof r.slug === "string" ? r.slug : r.slug?.current;
                    return (
                  <RelatedCard
                    key={r.id || r._id}
                    title={r.title}
                    description={r.description}
                    href={`/playbooks/${relatedSlug || ""}`}
                    level={r.level}
                  />
                    );
                  })()
                ))}
              </div>
            </section>
          )}

          {/* Previous/Next navigation */}
          <ContentNavigation
            previous={
              previousPlaybook
                ? {
                    title: (previousPlaybook as { title: string }).title,
                    href: `/playbooks/${(() => {
                      const slugValue = (previousPlaybook as { slug?: { current?: string } | string }).slug;
                      return typeof slugValue === "string" ? slugValue : slugValue?.current;
                    })()}`,
                  }
                : null
            }
            next={
              nextPlaybook
                ? {
                    title: (nextPlaybook as { title: string }).title,
                    href: `/playbooks/${(() => {
                      const slugValue = (nextPlaybook as { slug?: { current?: string } | string }).slug;
                      return typeof slugValue === "string" ? slugValue : slugValue?.current;
                    })()}`,
                  }
                : null
            }
          />
        </div>
      </article>
      <Footer />
    </>
  );
}
