/**
 * Item name matching for the search boxes.
 *
 * A plain `includes` breaks as soon as the query contains a space: "knight sword"
 * finds nothing because the catalogue spells it "Knight's Sword", and the word
 * order has to match exactly. Splitting the query into words and requiring each
 * one to appear makes both of those work.
 */

/**
 * Lowercase, strip accents, and reduce punctuation to spaces so that
 * "Siegbräu" matches "siegbrau" and "Knight's" matches "knights".
 * Letters and digits of any script are kept, so Chinese names still match.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * True when every word of `query` appears in `name`, in any order.
 * An empty query matches everything.
 */
export function matchesItemSearch(name: string, query: string): boolean {
  const haystack = normalise(name);
  const terms = normalise(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  return terms.every(term => haystack.includes(term));
}
