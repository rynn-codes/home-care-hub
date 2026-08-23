import { ReactNode } from "react";

/**
 * Every module screen's title, to the approved mocks' shared treatment:
 * 24px/600 with a light one-line purpose under it, actions on the right.
 */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-[5px]">
        <h1 className="m-0 text-2xl font-semibold tracking-[-.02em]">{title}</h1>
        {description && <p className="m-0 text-[13.5px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
