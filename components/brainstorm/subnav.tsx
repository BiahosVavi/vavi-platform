"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, Link2, Sparkles, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { segment: "notes", label: "Notes", icon: StickyNote },
  { segment: "ideas", label: "Ideas", icon: Lightbulb },
  { segment: "links", label: "Links", icon: Link2 },
  { segment: "chat", label: "AI Chat", icon: Sparkles },
] as const;

export function BrainstormSubnav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full bg-muted p-1 w-fit">
      {ITEMS.map(({ segment, label, icon: Icon }) => {
        const href = `/p/${slug}/brainstorm/${segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={segment}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-background font-medium text-foreground shadow-sm"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
