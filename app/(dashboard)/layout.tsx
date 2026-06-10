import { AppSidebar } from "@/components/app-sidebar";
import { QuickLog } from "@/components/quick-log";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, slug, name, color")
    .eq("active", true)
    .order("sort_order");

  return (
    <div className="flex min-h-screen">
      <AppSidebar projects={projects ?? []} />
      <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      <QuickLog />
    </div>
  );
}
