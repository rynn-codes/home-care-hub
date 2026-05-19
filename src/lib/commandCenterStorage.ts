import type { UIMessage } from "ai";

export interface StoredThread {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
}

const KEY = "cc.threads.v1";

function read(): StoredThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredThread[]) : [];
  } catch {
    return [];
  }
}

function write(threads: StoredThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(threads));
}

export const threadStore = {
  list(): StoredThread[] {
    return read().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): StoredThread | undefined {
    return read().find((t) => t.id === id);
  },
  upsert(thread: StoredThread) {
    const all = read();
    const idx = all.findIndex((t) => t.id === thread.id);
    if (idx >= 0) all[idx] = thread;
    else all.push(thread);
    write(all);
  },
  remove(id: string) {
    write(read().filter((t) => t.id !== id));
  },
  create(): StoredThread {
    const id = (crypto?.randomUUID?.() ?? `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const thread: StoredThread = {
      id,
      title: "New chat",
      updatedAt: Date.now(),
      messages: [],
    };
    const all = read();
    all.push(thread);
    write(all);
    return thread;
  },
};

export function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.parts
    ?.map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join(" ")
    .trim();
  if (!text) return "New chat";
  return text.length > 48 ? text.slice(0, 45) + "..." : text;
}
