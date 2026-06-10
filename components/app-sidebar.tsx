"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProject {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

const MAIN_NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/report", label: "Weekly Report", icon: BarChart3 },
  { href: "/inbox", label: "Telegram Inbox", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Vavi
        </Link>
        <p className="text-xs text-muted-foreground">Business cockpit</p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <div className="space-y-1">
          {MAIN_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                pathname === href && "bg-accent font-medium"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>

        <div>
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Projects
          </p>
          <div className="space-y-1">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/p/${project.slug}/tasks`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  pathname.startsWith(`/p/${project.slug}`) && "bg-accent font-medium"
                )}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: project.color ?? "#999" }}
                />
                {project.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t p-3">
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
