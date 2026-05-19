import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Plus, Send, Sparkles, Trash2, X, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { threadStore, deriveTitle, type StoredThread } from "@/lib/commandCenterStorage";
import { useData } from "@/context/DataProvider";
import type { Shift, ShiftStatus } from "@/lib/mockData";
import { formatDistanceToNow } from "date-fns";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/command-center-chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ---------- Tool execution against the in-browser mock store ----------
function useToolRunner() {
  const { clients, employees, shifts, setShifts } = useData();

  function findEmployeeByName(name: string) {
    const n = name.toLowerCase();
    return employees.find((e) => e.name.toLowerCase() === n) ||
      employees.find((e) => e.name.toLowerCase().includes(n));
  }
  function findClientByName(name: string) {
    const n = name.toLowerCase();
    return clients.find((c) => c.name.toLowerCase() === n) ||
      clients.find((c) => c.name.toLowerCase().includes(n));
  }
  function windowRange(when: string): [Date, Date] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    switch (when) {
      case "today": end.setDate(end.getDate() + 1); break;
      case "tomorrow":
        start.setDate(start.getDate() + 1);
        end.setDate(start.getDate() + 1);
        break;
      case "this-week":
        start.setDate(start.getDate() - start.getDay());
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 7);
        break;
      case "next-week":
        start.setDate(start.getDate() - start.getDay() + 7);
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 7);
        break;
      case "past-week":
        end.setDate(end.getDate());
        start.setDate(start.getDate() - 7);
        break;
    }
    return [start, end];
  }

  function readonlyRun(name: string, input: any): unknown {
    if (name === "query_clients") {
      let list = clients;
      if (input?.status) list = list.filter((c) => c.status === input.status);
      if (input?.search) {
        const s = input.search.toLowerCase();
        list = list.filter((c) => c.name.toLowerCase().includes(s));
      }
      if (input?.caregiverName) {
        const cg = findEmployeeByName(input.caregiverName);
        if (cg) list = list.filter((c) => c.primaryCaregiverId === cg.id);
        else list = [];
      }
      return {
        count: list.length,
        clients: list.slice(0, 20).map((c) => ({
          id: c.id, name: c.name, status: c.status, carePlan: c.carePlan,
          hoursPerWeek: c.hoursPerWeek,
          primaryCaregiver: employees.find((e) => e.id === c.primaryCaregiverId)?.name ?? null,
        })),
      };
    }
    if (name === "query_employees") {
      let list = employees;
      if (input?.role) list = list.filter((e) => e.role === input.role);
      if (input?.status) list = list.filter((e) => e.status === input.status);
      if (input?.search) {
        const s = input.search.toLowerCase();
        list = list.filter((e) => e.name.toLowerCase().includes(s));
      }
      return {
        count: list.length,
        employees: list.slice(0, 20).map((e) => ({
          id: e.id, name: e.name, role: e.role, status: e.status,
          hoursThisWeek: e.hoursThisWeek, assignedClients: e.assignedClientIds.length,
        })),
      };
    }
    if (name === "query_shifts") {
      const [from, to] = windowRange(input?.when ?? "today");
      let list = shifts.filter((s) => {
        const t = new Date(s.start).getTime();
        return t >= from.getTime() && t < to.getTime();
      });
      if (input?.status) list = list.filter((s) => s.status === input.status);
      if (input?.caregiverName) {
        const cg = findEmployeeByName(input.caregiverName);
        list = cg ? list.filter((s) => s.caregiverId === cg.id) : [];
      }
      if (input?.clientName) {
        const cl = findClientByName(input.clientName);
        list = cl ? list.filter((s) => s.clientId === cl.id) : [];
      }
      return {
        count: list.length,
        window: { from: from.toISOString(), to: to.toISOString() },
        shifts: list.slice(0, 30).map((s) => ({
          id: s.id,
          caregiver: employees.find((e) => e.id === s.caregiverId)?.name,
          client: clients.find((c) => c.id === s.clientId)?.name,
          start: s.start, end: s.end, status: s.status,
        })),
      };
    }
    return { error: `Unknown tool: ${name}` };
  }

  function approveAddShift(input: any) {
    const cg = findEmployeeByName(input.caregiverName);
    const cl = findClientByName(input.clientName);
    if (!cg) return { ok: false, error: `Caregiver "${input.caregiverName}" not found` };
    if (!cl) return { ok: false, error: `Client "${input.clientName}" not found` };
    const newShift: Shift = {
      id: `id_${Date.now()}`,
      caregiverId: cg.id,
      clientId: cl.id,
      start: input.startISO,
      end: input.endISO,
      status: "scheduled",
      notes: input.notes,
    };
    setShifts([...shifts, newShift]);
    return { ok: true, shiftId: newShift.id, message: `Scheduled ${cg.name} with ${cl.name}.` };
  }

  function approveUpdateShift(input: any) {
    const idx = shifts.findIndex((s) => s.id === input.shiftId);
    if (idx < 0) return { ok: false, error: `Shift ${input.shiftId} not found` };
    const next = [...shifts];
    const s = { ...next[idx] };
    if (input.newStartISO) s.start = input.newStartISO;
    if (input.newEndISO) s.end = input.newEndISO;
    if (input.newStatus) s.status = input.newStatus as ShiftStatus;
    if (input.newCaregiverName) {
      const cg = findEmployeeByName(input.newCaregiverName);
      if (!cg) return { ok: false, error: `Caregiver "${input.newCaregiverName}" not found` };
      s.caregiverId = cg.id;
    }
    if (input.notes !== undefined) s.notes = input.notes;
    next[idx] = s;
    setShifts(next);
    return { ok: true, message: "Shift updated." };
  }

  return { readonlyRun, approveAddShift, approveUpdateShift };
}

// ---------- Chat thread (UI for one conversation) ----------
function ChatThread({ thread }: { thread: StoredThread }) {
  const runner = useToolRunner();
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: ENDPOINT,
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
      }),
    []
  );

  const { messages, sendMessage, status, addToolResult } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      const name = toolCall.toolName;
      if (name === "query_clients" || name === "query_employees" || name === "query_shifts") {
        const output = runner.readonlyRun(name, toolCall.input);
        addToolResult({ tool: name, toolCallId: toolCall.toolCallId, output });
      }
      // add_shift / update_shift wait for human approval in the UI
    },
  });

  // Persist on every change
  useEffect(() => {
    if (messages.length > 0) {
      threadStore.upsert({
        ...thread,
        title: deriveTitle(messages),
        updatedAt: Date.now(),
        messages: messages as UIMessage[],
      });
    }
  }, [messages, thread]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    sendMessage({ text });
  }

  function approveTool(toolCallId: string, toolName: string, input: any) {
    const output =
      toolName === "add_shift"
        ? runner.approveAddShift(input)
        : runner.approveUpdateShift(input);
    addToolResult({ tool: toolName, toolCallId, output });
  }
  function declineTool(toolCallId: string, toolName: string) {
    addToolResult({
      tool: toolName,
      toolCallId,
      output: { ok: false, error: "User declined the action." },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 && (
          <EmptyState onPick={(p) => sendMessage({ text: p })} />
        )}
        <div className="space-y-4">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onApprove={approveTool}
              onDecline={declineTool}
            />
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="border-t bg-background p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            placeholder="Ask anything, or say: 'Schedule Jordan with Harold tomorrow 9-11am'"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none px-2 py-1.5 max-h-32"
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || status === "streaming" || status === "submitted"}
            className="shrink-0"
          >
            {status === "streaming" || status === "submitted" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (p: string) => void }) {
  const prompts = [
    "Who's working today?",
    "Show me clients with no caregiver assigned",
    "Schedule Sofia Ramirez with Eleanor Whitfield tomorrow 9am-12pm",
    "Which caregivers have credentials expiring soon?",
  ];
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">Command Center</h3>
      <p className="mx-auto mb-5 mt-1 max-w-xs text-sm text-muted-foreground">
        Ask about your agency, or tell me to schedule and reassign shifts.
      </p>
      <div className="mx-auto grid max-w-sm gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="text-left text-sm rounded-lg border bg-card px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onApprove,
  onDecline,
}: {
  message: UIMessage;
  onApprove: (id: string, name: string, input: any) => void;
  onDecline: (id: string, name: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={cn("max-w-[85%] space-y-2", isUser && "items-end")}>
        {message.parts?.map((part, i) => {
          if (part.type === "text") {
            return (
              <div
                key={i}
                className={cn(
                  "text-sm whitespace-pre-wrap leading-relaxed",
                  isUser
                    ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2"
                    : "text-foreground"
                )}
              >
                {(part as any).text}
              </div>
            );
          }
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            const toolName = part.type.slice("tool-".length);
            const p = part as any;
            const needsApproval =
              (toolName === "add_shift" || toolName === "update_shift") &&
              p.state === "input-available";
            return (
              <ToolCard
                key={i}
                name={toolName}
                state={p.state}
                input={p.input}
                output={p.output}
                onApprove={
                  needsApproval ? () => onApprove(p.toolCallId, toolName, p.input) : undefined
                }
                onDecline={
                  needsApproval ? () => onDecline(p.toolCallId, toolName) : undefined
                }
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ToolCard({
  name, state, input, output, onApprove, onDecline,
}: {
  name: string;
  state: string;
  input: any;
  output: any;
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label: Record<string, string> = {
    query_clients: "Looked up clients",
    query_employees: "Looked up employees",
    query_shifts: "Looked up shifts",
    add_shift: "Schedule new shift",
    update_shift: "Update shift",
  };
  const isMutating = name === "add_shift" || name === "update_shift";
  const failed = output && typeof output === "object" && output.ok === false;
  return (
    <div className={cn(
      "rounded-lg border bg-card text-card-foreground text-sm overflow-hidden",
      failed && "border-destructive/50"
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
      >
        <span className={cn(
          "h-2 w-2 rounded-full",
          state === "output-available" && !failed && "bg-[hsl(var(--success))]",
          failed && "bg-destructive",
          state === "input-streaming" && "bg-muted-foreground animate-pulse",
          state === "input-available" && "bg-[hsl(var(--warning))]",
        )} />
        <span className="font-medium">{label[name] ?? name}</span>
        {state === "output-available" && output?.count != null && (
          <span className="text-xs text-muted-foreground">({output.count} found)</span>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t bg-muted/30 px-3 py-2 text-xs">
          {input && (
            <>
              <div className="font-medium text-muted-foreground mb-1">Input</div>
              <pre className="overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(input, null, 2)}</pre>
            </>
          )}
          {output && (
            <>
              <div className="font-medium text-muted-foreground mt-2 mb-1">Output</div>
              <pre className="overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(output, null, 2)}</pre>
            </>
          )}
        </div>
      )}
      {isMutating && state === "input-available" && (
        <div className="border-t bg-[hsl(var(--warning)/0.08)] px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
          <span className="text-xs flex-1">Approve this action?</span>
          <Button size="sm" variant="ghost" onClick={onDecline}>Decline</Button>
          <Button size="sm" onClick={onApprove}>
            <Check className="h-3.5 w-3.5 mr-1" />Approve
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Panel with thread list + active chat ----------
function CommandCenterPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [threads, setThreads] = useState<StoredThread[]>(() => threadStore.list());
  const [activeId, setActiveId] = useState<string | null>(() => threadStore.list()[0]?.id ?? null);

  function refresh() {
    setThreads(threadStore.list());
  }

  function newThread() {
    const t = threadStore.create();
    setActiveId(t.id);
    refresh();
  }

  function deleteThread(id: string) {
    threadStore.remove(id);
    if (activeId === id) setActiveId(threadStore.list()[0]?.id ?? null);
    refresh();
  }

  const active = activeId ? threadStore.get(activeId) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0 w-full sm:max-w-[560px] flex flex-col gap-0">
        <div className="flex h-14 items-center gap-2 border-b px-4 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">Command Center</div>
            <div className="text-[11px] text-muted-foreground">AI ops assistant</div>
          </div>
          <Button size="sm" variant="outline" onClick={newThread}>
            <Plus className="h-3.5 w-3.5 mr-1" />New
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <aside className="w-44 border-r bg-muted/30 shrink-0 overflow-y-auto">
            {threads.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">No chats yet</p>
            )}
            <ul className="p-1.5 space-y-0.5">
              {threads.map((t) => (
                <li key={t.id} className="group relative">
                  <button
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      "w-full text-left rounded-md px-2 py-1.5 pr-7 text-xs transition-colors",
                      activeId === t.id ? "bg-background shadow-sm" : "hover:bg-background/60"
                    )}
                  >
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                    className="absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex-1 min-w-0">
            {active ? (
              <ChatThread key={active.id} thread={active} />
            ) : (
              <div className="h-full grid place-items-center p-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Start your first conversation.</p>
                  <Button onClick={newThread}><Plus className="h-4 w-4 mr-1" />New chat</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Floating launcher ----------
export function CommandCenter() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          if (threadStore.list().length === 0) threadStore.create();
          setOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 grid place-items-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Open Command Center"
      >
        <Sparkles className="h-6 w-6" />
      </button>
      <CommandCenterPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
