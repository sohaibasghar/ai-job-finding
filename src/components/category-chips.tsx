"use client";

import type { ReactNode } from "react";

import { ToggleChip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { JOB_CATEGORIES, type JobCategory } from "@/lib/job-categories";

/** Job categories as chips to switch on and off, at most `max` at once; the rest are disabled once that many are on. */
export function CategoryChips({
  value,
  onChange,
  max,
  hint,
  className,
}: {
  value: readonly JobCategory[];
  onChange: (categories: JobCategory[]) => void;
  max?: number;
  hint?: ReactNode;
  className?: string;
}) {
  const full = max !== undefined && value.length >= max;
  const toggle = (id: JobCategory) =>
    onChange(value.includes(id) ? value.filter((category) => category !== id) : JOB_CATEGORIES.map((category) => category.id).filter((category) => category === id || value.includes(category)));
  return (
    <fieldset className={cn("flex flex-col gap-[7px]", className)}>
      <legend className="mb-[7px] text-label font-medium text-ink">Categories</legend>
      <div className="flex flex-wrap gap-2">
        {JOB_CATEGORIES.map((category) => {
          const selected = value.includes(category.id);
          return (
            <ToggleChip key={category.id} selected={selected} check disabled={!selected && full} onClick={() => toggle(category.id)}>
              {category.label}
            </ToggleChip>
          );
        })}
      </div>
      {hint && <p className="text-label text-muted">{hint}</p>}
    </fieldset>
  );
}
