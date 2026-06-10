// Placeholder — replaced in Phase 2 with health-score project cards.
import { createClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description")
    .eq("active", true)
    .order("sort_order");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <p className="text-sm text-muted-foreground">
        {projects?.length ?? 0} active projects. Health dashboard coming in Phase 2.
      </p>
    </div>
  );
}
