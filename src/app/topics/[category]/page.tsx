import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { getCategoryBySlug, getAllCategorySlugs } from "@/lib/sanity";
import { Breadcrumb, PageHeader } from "@/components/ui";
import type { IconName } from "@/components/ui/PageHeader";
import { Footer } from "@/components/sections";

type SlugValue = { current?: string } | string;

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}


export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((category: string) => ({ category }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);

  if (!category) {
    return { title: "Category Not Found" };
  }

  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/topics/${categorySlug}` },
    openGraph: {
      title: `${category.name} | GovSecure`,
      description: category.description,
      url: `/topics/${categorySlug}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);

  if (!category) {
    notFound();
  }

  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: "Topics", href: "/topics" },
              { label: category.name },
            ]}
          />

          <PageHeader
            tag="Category"
            title={category.name}
            description={category.description}
            iconName={category.icon as IconName}
          />

          {/* Topics grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            {category.topics?.map((topic: unknown) => {
              const t = topic as {
                id?: string;
                _id?: string;
                title: string;
                description: string;
                slug?: SlugValue;
              };
              const slugValue = t.slug;
              const resolvedSlug = typeof slugValue === "string" ? slugValue : slugValue?.current;
              return (
              <Link
                key={t.id || t._id}
                href={`/topics/${categorySlug}/${resolvedSlug || ""}`}
                className="card group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-mono text-lg font-bold text-terminal-text group-hover:text-terminal-green transition-colors">
                    {t.title}
                  </h2>
                  <ArrowUpRight className="w-5 h-5 text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <p className="text-terminal-muted font-sans text-sm leading-relaxed">
                  {t.description}
                </p>
              </Link>
              );
            })}
          </div>

          {/* Back link */}
          <div className="mt-12 pt-8 border-t border-terminal-border">
            <Link
              href="/topics"
              className="inline-flex items-center gap-2 text-terminal-muted hover:text-terminal-green transition-colors font-mono text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all categories
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
