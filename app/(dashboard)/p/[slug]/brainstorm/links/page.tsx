import { notFound } from "next/navigation";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { createLink, deleteLink } from "@/app/actions/links";
import { BrainstormSubnav } from "@/components/brainstorm/subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

export default async function LinksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { slug } = await params;
  const { tag } = await searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (!project) notFound();

  let query = supabase
    .from("links")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: links } = await query;

  // Collect all unique tags for filter chips
  const allTags = Array.from(
    new Set((links ?? []).flatMap((l) => l.tags))
  ).sort();

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BrainstormSubnav slug={slug} />
      </div>

      {/* Add-link form */}
      <form
        className="rounded-lg border bg-card p-4 space-y-3"
        action={async (fd: FormData) => {
          "use server";
          const url = (fd.get("url") as string) ?? "";
          const title = (fd.get("title") as string) ?? "";
          const description = (fd.get("description") as string) ?? "";
          const tagsRaw = (fd.get("tags") as string) ?? "";
          const tags = tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          await createLink(project.id, url, title || undefined, description || undefined, tags);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="link-url" className="text-xs">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="link-url"
              name="url"
              required
              placeholder="https://example.com"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-title" className="text-xs">
              Title
            </Label>
            <Input
              id="link-title"
              name="title"
              placeholder="Optional title"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-tags" className="text-xs">
              Tags (comma-separated)
            </Label>
            <Input
              id="link-tags"
              name="tags"
              placeholder="research, tool, reference"
              className="text-sm"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="link-desc" className="text-xs">
              Description
            </Label>
            <Input
              id="link-desc"
              name="description"
              placeholder="Short note about this link"
              className="text-sm"
            />
          </div>
        </div>
        <Button size="sm" type="submit">
          Save link
        </Button>
      </form>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <a
            href={`/p/${slug}/brainstorm/links`}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted ${
              !tag ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            All
          </a>
          {allTags.map((t) => (
            <a
              key={t}
              href={`/p/${slug}/brainstorm/links?tag=${encodeURIComponent(t)}`}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted ${
                tag === t ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {t}
            </a>
          ))}
        </div>
      )}

      {/* Links list */}
      {!links?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <Link2 className="size-6" />
          {tag ? `No links tagged "${tag}".` : "No links yet. Save your first resource."}
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            let host = "";
            try {
              host = new URL(link.url).hostname;
            } catch {
              host = link.url;
            }

            return (
              <Card key={link.id} className="py-3">
                <CardContent className="px-4 flex items-start gap-3">
                  {/* Favicon */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                    alt=""
                    width={16}
                    height={16}
                    className="mt-0.5 shrink-0 rounded-sm"
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {link.title || host}
                      </a>
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                    </div>
                    {link.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {link.description}
                      </p>
                    )}
                    {link.title && (
                      <p className="text-[10px] text-muted-foreground/70 truncate">{host}</p>
                    )}
                    {link.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {link.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <form
                    action={async () => {
                      "use server";
                      await deleteLink(link.id);
                    }}
                  >
                    <button
                      type="submit"
                      title="Delete link"
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
