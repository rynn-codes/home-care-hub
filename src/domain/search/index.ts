/**
 * The ⌘K search: one index over the people Joy knows, scored so a name
 * beats a detail beats a phone number, and the first result is the one
 * somebody at the desk meant.
 */
export type SearchKind = "client" | "admission" | "employee" | "contact";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  name: string;
  /** The grey line — role, stage, organisation. */
  detail: string;
  /** Phone, email, address, caregiver… anything else worth matching on. */
  terms: string[];
  to: string;
}

export interface SearchHit extends SearchItem {
  score: number;
  matchedOn: "name" | "detail" | "term";
}

export const KIND_LABELS: Record<SearchKind, string> = {
  client: "Clients",
  admission: "Admissions",
  employee: "Employees",
  contact: "People",
};

const KIND_ORDER: SearchKind[] = ["client", "admission", "employee", "contact"];
const norm = (s: string) => s.toLowerCase().trim();
const digits = (s: string) => s.replace(/\D+/g, "");

/** 100 exact, 80 prefix, 60 a word's prefix, 55 initials, 30 anywhere inside. */
export function scoreText(haystack: string, query: string, allowSubstring = true): number {
  const h = norm(haystack);
  const q = norm(query);
  if (!h || !q) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  const words = h.split(/[\s,./-]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (q.length >= 2 && words.length > 1 && words.map((w) => w[0]).join("").startsWith(q)) return 55;
  return allowSubstring && h.includes(q) ? 30 : 0;
}

/** Phone numbers match on digits alone, and only once four have been typed. */
export function scorePhone(haystack: string, query: string): number {
  const h = digits(haystack);
  const q = digits(query);
  if (h.length < 7 || q.length < 4) return 0;
  if (h === q) return 90;
  return h.includes(q) ? 50 : 0;
}

export function search(items: readonly SearchItem[], query: string, limit = 20): SearchHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const item of items) {
    let score = scoreText(item.name, query);
    let matchedOn: SearchHit["matchedOn"] = "name";
    const detail = scoreText(item.detail, query);
    if (detail * 0.5 > score) {
      score = detail * 0.5;
      matchedOn = "detail";
    }
    const numeric = /^\d+$/.test(q);
    for (const term of item.terms) {
      const t = Math.max(scoreText(term, query, !numeric) * 0.5, scorePhone(term, query) * 0.6);
      if (t > score) {
        score = t;
        matchedOn = "term";
      }
    }
    if (score > 0) hits.push({ ...item, score, matchedOn });
  }
  return hits
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ka = KIND_ORDER.indexOf(a.kind);
      const kb = KIND_ORDER.indexOf(b.kind);
      return ka !== kb ? ka - kb : a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function groupHits(hits: readonly SearchHit[]): Array<{ kind: SearchKind; label: string; items: SearchHit[] }> {
  return KIND_ORDER.map((kind) => ({ kind, label: KIND_LABELS[kind], items: hits.filter((h) => h.kind === kind) })).filter(
    (g) => g.items.length > 0,
  );
}
