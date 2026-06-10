"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "tasks", label: "Tasks" },
  { segment: "metrics", label: "Metrics" },
  { segment: "brainstorm", label: "Brainstorm" },
];

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b">
      {TABS.map(({ segment, label }) => {
        const href = `/p/${slug}/${segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={segment}
            href={href}
            className={cn(
              "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "border-primary font-medium text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
