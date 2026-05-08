import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';
import { GOVERNANCE_KNOWLEDGE_BASE } from '@/lib/ai/knowledgeBase';
import { SECTOR_GUIDANCE } from '@/data/sectorGuidance';
import { EMERGING_REGULATIONS } from '@/data/emergingRegulations';
import { getAllSeedEntries } from '@/lib/knowledge/seedData';
import { clearKnowledgeEmbedding } from '@/lib/knowledge/embeddings';

/**
 * POST /api/knowledge/seed
 * Admin-only: import ALL knowledge documents into the KnowledgeEntry table.
 *
 * Sources:
 * 1. Static governance KB (5 overview docs)
 * 2. Sector guidance (3 sectors — finance, healthcare, government)
 * 3. Emerging regulations (5 regulations)
 * 4. Comprehensive seed data (~115 entries):
 *    - NIST AI RMF: overview, 4 functions, ~15 categories, 72 playbook entries
 *    - EU AI Act: overview, prohibited practices, high-risk, requirements, GPAI
 *    - ISO 42001: overview, 10 clause entries
 *    - GDPR: 5 AI-specific article entries
 *    - Cross-references: NIST↔ISO, EU AI Act↔NIST
 *    - Implementation: SMB roadmap, risk assessment template
 *
 * Idempotent — upserts by title + sourceType to avoid duplicates.
 */
export async function POST() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let created = 0;
  let updated = 0;

  try {
    // ── 1. Seed static governance knowledge base (original 5 docs) ──
    for (const doc of GOVERNANCE_KNOWLEDGE_BASE) {
      const existing = await prisma.knowledgeEntry.findFirst({
        where: { title: doc.title, sourceType: 'static' },
      });

      if (existing) {
        const updatedEntry = await prisma.knowledgeEntry.update({
          where: { id: existing.id },
          data: {
            content: doc.content,
            category: doc.category,
            tags: doc.tags,
            source: doc.source,
            sourceType: 'static',
            embeddedAt: null,
          },
        });
        await clearKnowledgeEmbedding(updatedEntry.id);
        updated++;
      } else {
        await prisma.knowledgeEntry.create({
          data: {
            title: doc.title,
            content: doc.content,
            category: doc.category,
            tags: doc.tags,
            source: doc.source,
            sourceType: 'static',
          },
        });
        created++;
      }
    }

    // ── 2. Seed sector guidance ──
    for (const sector of SECTOR_GUIDANCE) {
      const title = `AI Governance for ${sector.displayName}`;
      const content = [
        sector.description,
        `\nKey Regulations:\n${sector.keyRegulations.map((r) => `- ${r.name}: ${r.relevance}`).join('\n')}`,
        `\nRisk Factors:\n${sector.riskFactors.map((r) => `- ${r.factor} (${r.severity}): ${r.description}`).join('\n')}`,
        `\nRecommendations:\n${sector.recommendations.map((r) => `- ${r}`).join('\n')}`,
        `\nFramework Priorities:\n${sector.frameworkPriorities.map((f) => `- ${f.framework}: ${f.focus}`).join('\n')}`,
      ].join('\n');
      const tags = [sector.sector, ...sector.keyRegulations.map((r) => r.name.split(' ')[0]), 'sector-guidance'];

      const existing = await prisma.knowledgeEntry.findFirst({
        where: { title, sourceType: 'sector' },
      });

      if (existing) {
        const updatedEntry = await prisma.knowledgeEntry.update({
          where: { id: existing.id },
          data: { content, category: 'best-practice', tags, source: `GovSecure Sector Guidance — ${sector.displayName}`, embeddedAt: null },
        });
        await clearKnowledgeEmbedding(updatedEntry.id);
        updated++;
      } else {
        await prisma.knowledgeEntry.create({
          data: { title, content, category: 'best-practice', tags, source: `GovSecure Sector Guidance — ${sector.displayName}`, sourceType: 'sector' },
        });
        created++;
      }
    }

    // ── 3. Seed emerging regulations ──
    for (const reg of EMERGING_REGULATIONS) {
      const title = `${reg.shortName} — ${reg.jurisdiction}`;
      const content = [
        reg.summary,
        `\nStatus: ${reg.status}${reg.effectiveDate ? ` (Effective: ${reg.effectiveDate})` : ''}`,
        `\nKey Provisions:\n${reg.keyProvisions.map((p) => `- ${p.provision}: ${p.description}`).join('\n')}`,
        `\nCompliance Actions:\n${reg.complianceActions.map((a) => `- ${a}`).join('\n')}`,
        reg.penaltyRange ? `\nPenalties: ${reg.penaltyRange}` : '',
      ].join('\n');
      const tags = [reg.shortName, reg.jurisdiction, ...reg.affectedSectors.slice(0, 4), 'emerging-regulation'];

      const existing = await prisma.knowledgeEntry.findFirst({
        where: { title, sourceType: 'regulation' },
      });

      if (existing) {
        const updatedEntry = await prisma.knowledgeEntry.update({
          where: { id: existing.id },
          data: { content, category: 'regulation', tags, source: reg.name, embeddedAt: null },
        });
        await clearKnowledgeEmbedding(updatedEntry.id);
        updated++;
      } else {
        await prisma.knowledgeEntry.create({
          data: { title, content, category: 'regulation', tags, source: reg.name, sourceType: 'regulation' },
        });
        created++;
      }
    }

    // ── 4. Seed comprehensive framework knowledge ──
    // This is the key expansion: flattens NIST subcategories, EU AI Act articles,
    // ISO 42001 clauses, GDPR articles, cross-references, and 72 NIST playbook
    // entries into individual embeddable documents.
    const comprehensiveEntries = await getAllSeedEntries();

    for (const entry of comprehensiveEntries) {
      const existing = await prisma.knowledgeEntry.findFirst({
        where: { title: entry.title, sourceType: entry.sourceType },
      });

      if (existing) {
        const updatedEntry = await prisma.knowledgeEntry.update({
          where: { id: existing.id },
          data: {
            content: entry.content,
            category: entry.category,
            tags: entry.tags,
            source: entry.source,
            sourceType: entry.sourceType,
            embeddedAt: null,
          },
        });
        await clearKnowledgeEmbedding(updatedEntry.id);
        updated++;
      } else {
        await prisma.knowledgeEntry.create({
          data: {
            title: entry.title,
            content: entry.content,
            category: entry.category,
            tags: entry.tags,
            source: entry.source,
            sourceType: entry.sourceType,
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      message: `Seed complete: ${created} created, ${updated} updated`,
      created,
      updated,
      total: created + updated,
      breakdown: {
        staticKB: GOVERNANCE_KNOWLEDGE_BASE.length,
        sectors: SECTOR_GUIDANCE.length,
        emergingRegs: EMERGING_REGULATIONS.length,
        comprehensive: comprehensiveEntries.length,
      },
    });
  } catch (error) {
    console.error('[seed] Error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
