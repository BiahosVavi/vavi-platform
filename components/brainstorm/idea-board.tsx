"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  convertIdeaToTask,
  createIdea,
  deleteIdea,
  updateIdea,
} from "@/app/actions/ideas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_STAGE_LABELS, IDEA_STAGES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Idea, IdeaStage } from "@/types/db";

const BOARD_STAGES: IdeaStage[] = ["raw", "evaluating", "validated", "executing"];
const SCORES = ["1", "2", "3", "4", "5"] as const;
const NONE = "none";

interface IdeaFormValues {
  title: string;
  description: string;
  impact: string; // '1'..'5' | 'none'
  effort: string;
}

function toScore(value: string): number | null {
  return value === NONE ? null : Number(value);
}

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} (1–5)</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {SCORES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function IdeaFormFields({
  values,
  onChange,
}: {
  values: IdeaFormValues;
  onChange: (values: IdeaFormValues) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="idea-title" className="text-xs">
          Title
        </Label>
        <Input
          id="idea-title"
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="What's the idea?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idea-description" className="text-xs">
          Description
        </Label>
        <Textarea
          id="idea-description"
          value={values.description}
          onChange={(e) => onChange({ ...values, description: e.target.value })}
          placeholder="Why it matters, how it could work…"
          className="min-h-24"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ScoreSelect
          label="Impact"
          value={values.impact}
          onChange={(impact) => onChange({ ...values, impact })}
        />
        <ScoreSelect
          label="Effort"
          value={values.effort}
          onChange={(effort) => onChange({ ...values, effort })}
        />
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  slug,
  onEdit,
}: {
  idea: Idea;
  slug: string;
  onEdit: (idea: Idea) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function move(stage: IdeaStage) {
    startTransition(async () => {
      const { error } = await updateIdea(idea.id, { stage });
      if (error) toast.error(error);
      else toast.success(`Moved to ${IDEA_STAGE_LABELS[stage]}`);
    });
  }

  function remove() {
    if (!window.confirm(`Delete idea "${idea.title}"?`)) return;
    startTransition(async () => {
      const { error } = await deleteIdea(idea.id);
      if (error) toast.error(error);
      else toast.success("Idea deleted");
    });
  }

  function convert() {
    startTransition(async () => {
      const { error } = await convertIdeaToTask(idea.id);
      if (error) toast.error(error);
      else toast.success("Task created from idea");
    });
  }

  const canConvert =
    (idea.stage === "validated" || idea.stage === "executing") && !idea.converted_task_id;

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs",
        isPending && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{idea.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Idea actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {IDEA_STAGES.filter((s) => s !== idea.stage).map((stage) => (
              <DropdownMenuItem key={stage} onClick={() => move(stage)}>
                {IDEA_STAGE_LABELS[stage]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(idea)}>
              <Pencil className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(idea.impact != null || idea.effort != null) && (
        <Badge variant="outline" className="font-mono text-[10px]">
          I{idea.impact ?? "?"} · E{idea.effort ?? "?"}
        </Badge>
      )}

      {idea.description && (
        <p className="line-clamp-3 text-xs text-muted-foreground">{idea.description}</p>
      )}

      {idea.converted_task_id ? (
        <Link
          href={`/p/${slug}/tasks`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <CheckCircle2 className="size-3" />
          → task created
        </Link>
      ) : (
        canConvert && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={isPending}
            onClick={convert}
          >
            <ArrowRight className="size-3" />
            Convert to task
          </Button>
        )
      )}
    </div>
  );
}

export function IdeaBoard({
  ideas,
  projectId,
  slug,
  showArchived,
}: {
  ideas: Idea[];
  projectId: string;
  slug: string;
  showArchived: boolean;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const [newValues, setNewValues] = useState<IdeaFormValues>({
    title: "",
    description: "",
    impact: NONE,
    effort: NONE,
  });
  const [editing, setEditing] = useState<Idea | null>(null);
  const [editValues, setEditValues] = useState<IdeaFormValues>({
    title: "",
    description: "",
    impact: NONE,
    effort: NONE,
  });
  const [isPending, startTransition] = useTransition();

  function openEdit(idea: Idea) {
    setEditing(idea);
    setEditValues({
      title: idea.title,
      description: idea.description ?? "",
      impact: idea.impact != null ? String(idea.impact) : NONE,
      effort: idea.effort != null ? String(idea.effort) : NONE,
    });
  }

  function submitNew() {
    startTransition(async () => {
      const { error } = await createIdea(projectId, {
        title: newValues.title,
        description: newValues.description || null,
        impact: toScore(newValues.impact),
        effort: toScore(newValues.effort),
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Idea captured");
      setNewOpen(false);
      setNewValues({ title: "", description: "", impact: NONE, effort: NONE });
    });
  }

  function submitEdit() {
    if (!editing) return;
    const id = editing.id;
    startTransition(async () => {
      const { error } = await updateIdea(id, {
        title: editValues.title,
        description: editValues.description || null,
        impact: toScore(editValues.impact),
        effort: toScore(editValues.effort),
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Idea updated");
      setEditing(null);
    });
  }

  const archived = ideas.filter((i) => i.stage === "archived");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              New idea
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New idea</DialogTitle>
            </DialogHeader>
            <IdeaFormFields values={newValues} onChange={setNewValues} />
            <DialogFooter>
              <Button onClick={submitNew} disabled={isPending || !newValues.title.trim()}>
                Capture idea
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {BOARD_STAGES.map((stage) => {
          const stageIdeas = ideas.filter((i) => i.stage === stage);
          return (
            <div key={stage} className="rounded-lg bg-muted/50 p-2">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {IDEA_STAGE_LABELS[stage]}
                </p>
                <span className="text-xs text-muted-foreground">{stageIdeas.length}</span>
              </div>
              <div className="space-y-2">
                {stageIdeas.length === 0 ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-6 text-xs text-muted-foreground">
                    <Lightbulb className="size-3.5" />
                    Empty
                  </div>
                ) : (
                  stageIdeas.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} slug={slug} onEdit={openEdit} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showArchived && (
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {IDEA_STAGE_LABELS.archived} ({archived.length})
          </p>
          {archived.length === 0 ? (
            <p className="px-1 pb-2 text-xs text-muted-foreground">No archived ideas.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {archived.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} slug={slug} onEdit={openEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit idea</DialogTitle>
          </DialogHeader>
          <IdeaFormFields values={editValues} onChange={setEditValues} />
          <DialogFooter>
            <Button onClick={submitEdit} disabled={isPending || !editValues.title.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
