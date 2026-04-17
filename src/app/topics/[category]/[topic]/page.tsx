import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTopicBySlug, getCategories } from "@/lib/sanity";
import { Breadcrumb, PageHeader, MarkdownContent, RelatedCard } from "@/components/ui";
import { Footer } from "@/components/sections";

type SlugValue = { current?: string } | string;

interface TopicPageProps {
  params: Promise<{ category: string; topic: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  const params: { category: string; topic: string }[] = [];
  
  categories.forEach((cat: unknown) => {
    const c = cat as { slug?: SlugValue; topics?: Array<{ slug?: SlugValue }> };
    const categorySlug = typeof c.slug === "string" ? c.slug : c.slug?.current;
    c.topics?.forEach((topic: unknown) => {
      const t = topic as { slug?: SlugValue };
      const topicSlug = typeof t.slug === "string" ? t.slug : t.slug?.current;
      params.push({
        category: categorySlug || "",
        topic: topicSlug || "",
      });
    });
  });
  
  return params.filter((p) => p.category && p.topic);
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topic: topicSlug } = await params;
  const topic = await getTopicBySlug(topicSlug);

  if (!topic) {
    return { title: "Topic Not Found" };
  }

  return {
    title: topic.title,
    description: topic.description,
    alternates: { canonical: `/topics/${topicSlug}` },
    openGraph: {
      title: `${topic.title} | GovSecure`,
      description: topic.description,
      url: `/topics/${topicSlug}`,
      type: "article",
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { category: categorySlug, topic: topicSlug } = await params;
  const topic = await getTopicBySlug(topicSlug);

  if (!topic) {
    notFound();
  }

  return (
    <>
      <article className="section min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: "Topics", href: "/topics" },
              { label: topic.category?.name || categorySlug, href: `/topics/${categorySlug}` },
              { label: topic.title },
            ]}
          />

          <PageHeader
            tag={topic.category?.name || "Topic"}
            title={topic.title}
            description={topic.description}
            iconName="FileText"
          />

          {/* Content */}
          <div className="mt-12 mb-16">
            <MarkdownContent content={topic.content || ""} />
          </div>

          {/* Related topics */}
          {topic.relatedTopics && topic.relatedTopics.length > 0 && (
            <section className="border-t border-terminal-border pt-12">
              <h2 className="font-mono text-xl font-bold text-terminal-text mb-6">
                Related Topics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topic.relatedTopics.map((related: unknown) => {
                  const r = related as {
                    id?: string;
                    _id?: string;
                    title: string;
                    description: string;
                    slug?: SlugValue;
                  };
                  const relatedSlug = typeof r.slug === "string" ? r.slug : r.slug?.current;
                  return (
                  <RelatedCard
                    key={r.id || r._id}
                    title={r.title}
                    description={r.description}
                    href={`/topics/${categorySlug}/${relatedSlug || ""}`}
                  />
                  );
                })}
              </div>
            </section>
          )}

          {/* Back link */}
          <div className="mt-12 pt-8 border-t border-terminal-border">
            <Link
              href={`/topics/${categorySlug}`}
              className="inline-flex items-center gap-2 text-terminal-muted hover:text-terminal-green transition-colors font-mono text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {topic.category?.name || "category"}
            </Link>
          </div>
        </div>
      </article>
      <Footer />
    </>
  );
}
