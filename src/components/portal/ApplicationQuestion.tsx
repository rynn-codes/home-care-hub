import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ApplicationField } from "@/domain/portal/application";

/**
 * One question, rendered from its definition.
 *
 * §27's list is followed literally — large inputs, large touch targets,
 * generous whitespace, one obvious action, minimal colour. Joy blue appears on
 * the selected state and the focus ring and nowhere else, because §27 is
 * explicit that it should be "an accent, not the screen".
 *
 * Every control here is at least 3rem tall. That is not a style choice: this is
 * used one-handed, on a phone, by someone who may be between shifts, and the
 * standard 2.25rem shadcn input is a miss-tap generator at that size.
 */

const BASE_INPUT =
  "h-14 rounded-2xl border-border bg-surface px-4 text-base " +
  "focus-visible:ring-2 focus-visible:ring-ring";

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-base transition-colors",
        selected
          ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
          : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary bg-primary" : "border-border",
        )}
        aria-hidden="true"
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
      </span>
      {children}
    </button>
  );
}

export function ApplicationQuestion({
  field,
  value,
  onChange,
}: {
  field: ApplicationField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `q-${field.id}`;

  function control() {
    switch (field.kind) {
      case "longtext":
        return (
          <Textarea
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="rounded-2xl border-border bg-surface px-4 py-3 text-base"
          />
        );

      case "choice":
        return (
          <div className="space-y-2.5">
            {field.options?.map((o) => (
              <Option key={o.value} selected={value === o.value} onClick={() => onChange(o.value)}>
                {o.label}
              </Option>
            ))}
          </div>
        );

      case "multichoice":
      case "weekdays": {
        const list = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-2.5">
            {field.options?.map((o) => (
              <Option
                key={o.value}
                selected={list.includes(o.value)}
                onClick={() =>
                  onChange(
                    list.includes(o.value)
                      ? list.filter((v) => v !== o.value)
                      : [...list, o.value],
                  )
                }
              >
                {o.label}
              </Option>
            ))}
          </div>
        );
      }

      case "repeater":
        // Honest placeholder. A repeating employer block is a real piece of
        // work and pretending otherwise with a single text box would put
        // unstructured text where §4 wants structured data. This collects it
        // as written and flags that it still needs building properly.
        return (
          <div className="space-y-2">
            <Textarea
              id={id}
              value={
                Array.isArray(value) ? (value as unknown[]).map((v) => JSON.stringify(v)).join("\n") : ((value as string) ?? "")
              }
              onChange={(e) => onChange(e.target.value)}
              rows={6}
              className="rounded-2xl border-border bg-surface px-4 py-3 text-base"
              placeholder="One per line"
            />
            <p className="text-xs text-muted-foreground">
              Entered as free text for now — the structured version of this is still to build.
            </p>
          </div>
        );

      case "signature":
        return (
          <div className="space-y-2">
            <Input
              id={id}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={cn(BASE_INPUT, "font-display text-lg")}
              placeholder="Type your full name"
            />
            <p className="text-xs text-muted-foreground">
              Typing your name here counts as your signature. Joy records the date and time.
            </p>
          </div>
        );

      default:
        return (
          <Input
            id={id}
            type={
              field.kind === "date"
                ? "date"
                : field.kind === "number"
                  ? "number"
                  : field.kind === "email"
                    ? "email"
                    : field.kind === "phone"
                      ? "tel"
                      : "text"
            }
            inputMode={field.kind === "number" ? "numeric" : undefined}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={BASE_INPUT}
          />
        );
    }
  }

  const labelled = field.kind === "choice" || field.kind === "multichoice" || field.kind === "weekdays";

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{field.question}</legend>
      {/* A label rather than a legend visually, so single inputs get a real
          label association; grouped options use the fieldset. */}
      {labelled ? (
        <p className="text-lg font-medium leading-snug">{field.question}</p>
      ) : (
        <label htmlFor={id} className="block text-lg font-medium leading-snug">
          {field.question}
        </label>
      )}
      {field.helper && <p className="text-sm text-muted-foreground">{field.helper}</p>}
      {control()}
    </fieldset>
  );
}
