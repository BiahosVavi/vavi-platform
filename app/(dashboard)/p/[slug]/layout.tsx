import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/project-tabs";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, name, color, description")
    .eq("slug", slug)
    .single();

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: project.color ?? "#999" }}
          />
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <ProjectTabs slug={project.slug} />
      <div>{children}</div>
    </div>
  );
}
