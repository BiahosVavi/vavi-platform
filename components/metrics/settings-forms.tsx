"use client";

// Client components for the settings page: weekly revenue target form,
// metric definition editing (dialog), creation (dialog) and active toggle.

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createMetricDefinition,
  updateMetricDefinition,
  updateProjectTargets,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { MetricAggregation } from "@/types/db";

/** '' → null; otherwise a finite number, or undefined when invalid. */
function parseNullableNumber(raw: string): number | null | undefined {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------- Weekly revenue target ----------------

export function TargetForm({
  projectId,
  initialTarget,
}: {
  projectId: string;
  initialTarget: number | null;
}) {
  const [value, setValue] = useState(initialTarget?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseNullableNumber(value);
    if (parsed === undefined || (parsed !== null && parsed <= 0)) {
      toast.error("Target must be a positive number (or empty to clear).");
      return;
    }
    startTransition(async () => {
      const res = await updateProjectTargets(projectId, parsed);
      if (res.ok) toast.success(parsed === null ? "Target cleared." : "Target saved.");
      else toast.error(res.error ?? "Failed to save target.");
    });
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor={`target-${projectId}`}>Weekly revenue target (MAD)</Label>
        <Input
          id={`target-${projectId}`}
          type="number"
          min="0"
          step="any"
          placeholder="No target"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-44"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

// ---------------- Active toggle ----------------

export function MetricActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={pending}
      aria-label="Toggle metric active"
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const res = await updateMetricDefinition(id, { active: checked });
          if (res.ok) toast.success(checked ? "Metric activated." : "Metric deactivated.");
          else toast.error(res.error ?? "Failed to update metric.");
        })
      }
    />
  );
}

// ---------------- Edit metric dialog ----------------

export interface MetricDefForEdit {
  id: string;
  name: string;
  unit: string | null;
  weekly_target: number | null;
  quick_increment: number | null;
  active: boolean;
}

export function EditMetricDialog({ def }: { def: MetricDefForEdit }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(def.name);
  const [unit, setUnit] = useState(def.unit ?? "");
  const [weeklyTarget, setWeeklyTarget] = useState(def.weekly_target?.toString() ?? "");
  const [quickIncrement, setQuickIncrement] = useState(def.quick_increment?.toString() ?? "");
  const [active, setActive] = useState(def.active);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = parseNullableNumber(weeklyTarget);
    const increment = parseNullableNumber(quickIncrement);
    if (target === undefined || increment === undefined) {
      toast.error("Target and increment must be numbers (or empty).");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await updateMetricDefinition(def.id, {
        name,
        unit: unit.trim() || null,
        weeklyTarget: target,
        quickIncrement: increment,
        active,
      });
      if (res.ok) {
        toast.success("Metric updated.");
        setOpen(false);
      } else {
        toast.error(res.error ?? "Failed to update metric.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${def.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit metric</DialogTitle>
          <DialogDescription>Update “{def.name}”.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${def.id}`}>Name</Label>
            <Input
              id={`edit-name-${def.id}`}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-unit-${def.id}`}>Unit</Label>
              <Input
                id={`edit-unit-${def.id}`}
                placeholder="—"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-target-${def.id}`}>Weekly target</Label>
              <Input
                id={`edit-target-${def.id}`}
                type="number"
                step="any"
                placeholder="None"
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-inc-${def.id}`}>Quick +N</Label>
              <Input
                id={`edit-inc-${def.id}`}
                type="number"
                step="any"
                placeholder="None"
                value={quickIncrement}
                onChange={(e) => setQuickIncrement(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`edit-active-${def.id}`}
              checked={active}
              onCheckedChange={setActive}
            />
            <Label htmlFor={`edit-active-${def.id}`}>Active</Label>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Add metric dialog ----------------

export function AddMetricDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [aggregation, setAggregation] = useState<MetricAggregation>("sum");
  const [weeklyTarget, setWeeklyTarget] = useState("");
  const [quickIncrement, setQuickIncrement] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = parseNullableNumber(weeklyTarget);
    const increment = parseNullableNumber(quickIncrement);
    if (target === undefined || increment === undefined) {
      toast.error("Target and increment must be numbers (or empty).");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createMetricDefinition(projectId, {
        name,
        unit: unit.trim() || null,
        aggregation,
        weeklyTarget: target,
        quickIncrement: increment,
      });
      if (res.ok) {
        toast.success("Metric created.");
        setName("");
        setUnit("");
        setWeeklyTarget("");
        setQuickIncrement("");
        setAggregation("sum");
        setOpen(false);
      } else {
        toast.error(res.error ?? "Failed to create metric.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus data-icon="inline-start" />
          Add metric
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add metric</DialogTitle>
          <DialogDescription>
            The key is derived from the name automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`add-name-${projectId}`}>Name</Label>
            <Input
              id={`add-name-${projectId}`}
              required
              placeholder="e.g. Demos booked"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`add-unit-${projectId}`}>Unit</Label>
              <Input
                id={`add-unit-${projectId}`}
                placeholder="Optional"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`add-agg-${projectId}`}>Aggregation</Label>
              <Select
                value={aggregation}
                onValueChange={(v) => setAggregation(v as MetricAggregation)}
              >
                <SelectTrigger id={`add-agg-${projectId}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum (weekly total)</SelectItem>
                  <SelectItem value="last">Last (latest value)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`add-target-${projectId}`}>Weekly target</Label>
              <Input
                id={`add-target-${projectId}`}
                type="number"
                step="any"
                placeholder="None"
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`add-inc-${projectId}`}>Quick +N</Label>
              <Input
                id={`add-inc-${projectId}`}
                type="number"
                step="any"
                placeholder="None"
                value={quickIncrement}
                onChange={(e) => setQuickIncrement(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create metric"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
