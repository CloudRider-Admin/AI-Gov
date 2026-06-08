/**
 * Knowledge-store diagnostic.
 *
 * Answers the operational question: "Is Govi's GovSecure RAG grounding actually
 * live?" — i.e. are GovSecure-tagged rows present in the KnowledgeEntry table,
 * and do they have embeddings so semanticSearch() can retrieve them?
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/diagnoseKnowledgeStore.ts
 *
 * Exit 0 always (diagnostic, not a gate). Prints a clear verdict.
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('\n⚠️  DATABASE_URL is not set — no live knowledge store to inspect.');
    console.log('   GovSecure RAG grounding is therefore NOT live in this environment.');
    console.log('   (System-prompt methodology + bundled generation exemplars still work without a DB.)\n');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const total = await prisma.knowledgeEntry.count();
    const active = await prisma.knowledgeEntry.count({ where: { isActive: true } });

    // Group by sourceType
    const byType = await prisma.knowledgeEntry.groupBy({
      by: ['sourceType'],
      _count: { _all: true },
    });

    // Embedding coverage (embedding is a raw pgvector column; count non-null)
    const embeddedRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM "KnowledgeEntry" WHERE embedding IS NOT NULL AND "isActive" = true`,
    );
    const embedded = Number(embeddedRows[0]?.count ?? 0);

    const govsecureEmbeddedRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM "KnowledgeEntry"
       WHERE embedding IS NOT NULL AND "isActive" = true AND "sourceType" = 'govsecure'`,
    );
    const govsecureEmbedded = Number(govsecureEmbeddedRows[0]?.count ?? 0);

    console.log('\n━━━ Govi Knowledge Store Diagnostic ━━━');
    console.log(`total entries:   ${total}`);
    console.log(`active entries:  ${active}`);
    console.log(`embedded (active): ${embedded}`);
    console.log('\nby sourceType:');
    for (const row of byType.sort((a, b) => b._count._all - a._count._all)) {
      console.log(`  ${String(row.sourceType ?? '(null)').padEnd(14)} ${row._count._all}`);
    }

    console.log('\nverdict:');
    if (embedded === 0) {
      console.log('  ❌ No embedded entries — vector search is OFF; RAG falls back to keyword-only.');
    } else if (govsecureEmbedded === 0) {
      console.log('  ⚠️  Vector search live, but ZERO GovSecure-tagged embedded rows.');
      console.log('     → Run POST /api/knowledge/seed (admin) then the embed job.');
    } else {
      console.log(`  ✅ GovSecure RAG grounding is LIVE — ${govsecureEmbedded} embedded GovSecure rows retrievable.`);
    }
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[diagnoseKnowledgeStore] failed:', err instanceof Error ? err.message : err);
  process.exit(0);
});
