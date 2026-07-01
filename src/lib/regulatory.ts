import { prisma } from './prisma';

export interface RegulatoryItem {
  id: string;
  title: string;
  summary: string;
  jurisdiction: string;
  framework: string | null;
  severity: string; // info | notable | critical
  url: string | null;
  publishedAt: string;
}

/**
 * Curated fallback so the Regulatory Radar is useful before any DB rows are
 * seeded. These are stable, well-known milestones; DB rows (admin-managed) take
 * precedence when present.
 */
const CURATED: RegulatoryItem[] = [
  {
    id: 'eu-aia-gpai',
    title: 'EU AI Act — GPAI obligations in effect',
    summary:
      'Transparency and documentation obligations for general-purpose AI models apply. Providers must maintain technical documentation and a summary of training data.',
    jurisdiction: 'EU',
    framework: 'EU-AI-Act',
    severity: 'notable',
    url: 'https://artificialintelligenceact.eu/',
    publishedAt: '2025-08-02',
  },
  {
    id: 'eu-aia-highrisk',
    title: 'EU AI Act — high-risk system requirements phasing in',
    summary:
      'Obligations for high-risk AI systems (risk management, data governance, human oversight, logging) phase in through 2026–2027. Confirm whether your registered systems are classified high-risk.',
    jurisdiction: 'EU',
    framework: 'EU-AI-Act',
    severity: 'critical',
    url: 'https://artificialintelligenceact.eu/',
    publishedAt: '2026-08-02',
  },
  {
    id: 'nist-genai-profile',
    title: 'NIST Generative AI Profile (AI 600-1)',
    summary:
      'NIST published a companion profile to the AI RMF addressing risks unique to generative AI. Useful for mapping controls to LLM-based systems.',
    jurisdiction: 'US-Federal',
    framework: 'NIST-AI-RMF',
    severity: 'info',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    publishedAt: '2024-07-26',
  },
  {
    id: 'us-co-ai-act',
    title: 'Colorado AI Act (SB 24-205)',
    summary:
      'First US comprehensive state AI law targeting algorithmic discrimination in consequential decisions. Deployers of high-risk AI face duty-of-care and disclosure obligations.',
    jurisdiction: 'US-CA',
    framework: null,
    severity: 'notable',
    url: 'https://leg.colorado.gov/bills/sb24-205',
    publishedAt: '2026-06-30',
  },
];

/** Active regulatory items, DB-first with curated fallback, newest first. */
export async function getRegulatoryFeed(limit = 20): Promise<RegulatoryItem[]> {
  let rows: RegulatoryItem[] = [];
  try {
    const dbRows = await prisma.regulatoryUpdate.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
    rows = dbRows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      jurisdiction: r.jurisdiction,
      framework: r.framework,
      severity: r.severity,
      url: r.url,
      publishedAt: r.publishedAt.toISOString(),
    }));
  } catch (err) {
    console.error('[regulatory] DB read failed, using curated feed:', err);
  }

  const merged = rows.length > 0 ? rows : CURATED;
  return [...merged]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
