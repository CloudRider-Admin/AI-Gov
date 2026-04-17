import nistPlaybookData from './nistPlaybook.json';

export interface NISTPlaybookEntry {
  type: string;
  title: string;
  category: string;
  description: string;
  section_about?: string;
}

const entries = Object.values(nistPlaybookData) as NISTPlaybookEntry[];

export function getBySubcategory(subcategory: string): NISTPlaybookEntry | undefined {
  return entries.find(
    e => e.title.toLowerCase() === subcategory.toLowerCase()
  );
}

export function getByFunction(func: string): NISTPlaybookEntry[] {
  return entries.filter(
    e => e.type.toLowerCase() === func.toLowerCase()
  );
}

export function searchPlaybook(query: string, limit = 5): NISTPlaybookEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return entries
    .map(e => {
      const text = `${e.title} ${e.description} ${e.section_about ?? ''}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
      return { entry: e, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}
