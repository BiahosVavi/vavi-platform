"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Eye, Pencil, Pin, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteNote, updateNote } from "@/app/actions/notes";
import { Markdown } from "@/components/brainstorm/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/db";

export function NoteEditor({ note, slug }: { note: Note; slug: string }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content_md);
  const [tagsInput, setTagsInput] = useState(note.tags.join(", "));
  const [pinned, setPinned] = useState(note.pinned);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function save() {
    startSaving(async () => {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { error } = await updateNote(note.id, {
        title: title.trim() || "Untitled note",
        content_md: content,
        pinned,
        tags,
      });
      if (error) toast.error(`Could not save note: ${error}`);
      else toast.success("Note saved");
    });
  }

  function remove() {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    startDeleting(async () => {
      try {
        await deleteNote(note.id, slug);
      } catch {
        toast.error("Could not delete note");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/p/${slug}/brainstorm/notes`}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to notes
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button size="sm" onClick={save} disabled={isSaving}>
            <Save className="size-4" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0 md:text-xl"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted-foreground",
              mode === "edit" && "bg-background font-medium text-foreground shadow-sm"
            )}
          >
            <Pencil className="size-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted-foreground",
              mode === "preview" && "bg-background font-medium text-foreground shadow-sm"
            )}
          >
            <Eye className="size-3" />
            Preview
          </button>
        </div>
        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Pin className="size-3.5" />
          Pinned
          <Switch checked={pinned} onCheckedChange={setPinned} />
        </Label>
      </div>

      {mode === "edit" ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write in markdown… # headings, - lists, tables, [links](https://)"
          className="min-h-[50vh] resize-y font-mono text-sm"
        />
      ) : (
        <div className="min-h-[50vh] rounded-md border p-4">
          {content.trim() ? (
            <Markdown content={content} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="note-tags" className="text-xs text-muted-foreground">
          Tags (comma-separated)
        </Label>
        <Input
          id="note-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="strategy, marketing"
          className="max-w-sm"
        />
      </div>
    </div>
  );
}
