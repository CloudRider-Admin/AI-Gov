'use client';

import Link from 'next/link';
import { BarChart3, Database, ArrowRight } from 'lucide-react';

const adminSections = [
  {
    title: 'Analytics Dashboard',
    description: 'Platform usage metrics, query trends, token consumption, and health monitoring.',
    href: '/admin/analytics',
    icon: BarChart3,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Knowledge Base',
    description: 'Manage governance knowledge entries, seed framework data, and generate vector embeddings.',
    href: '/admin/knowledge',
    icon: Database,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
];

export default function AdminIndexPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your GovSecure platform settings and monitor system health.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-xl border bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className={`inline-flex items-center justify-center rounded-lg p-2.5 ${section.bgColor} mb-3`}>
                <Icon className={`h-5 w-5 ${section.color}`} />
              </div>
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                {section.title}
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {section.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
