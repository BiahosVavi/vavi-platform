"use client";

// Minimal logging forms shared by the project metrics page and the global
// quick-log dialog. Each form has at most 2 required fields; the date input
// is prefilled with the Casablanca-local today and can be hidden entirely
// (quick-log) — the server actions default to localToday() anyway.

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { logMetric, logMoney, logPipelineEvent } from "@/app/actions/metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PIPELINE_EVENT_LABELS } from "@/lib/labels";
import { localToday } from "@/lib/time";
import type { MoneyType, PipelineEventType } from "@/types/db";

const PIPELINE_TYPES: PipelineEventType[] = [
  "lead_added",
  "proposal_sent",
  "deal_won",
  "deal_lost",
];

interface BaseFormProps {
  projectId: string;
  /** Show the (prefilled) date input. Quick-log hides it for speed. */
  showDate?: boolean;
  onSuccess?: () => void;
}

/** '' → undefined; otherwise a finite number or null (= invalid). */
function parseOptionalNumber(raw: string): number | undefined | null {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ---------------- Pipeline ----------------

export function PipelineEventForm({ projectId, showDate = true, onSuccess }: BaseFormProps) {
  const id = useId();
  const [type, setType] = useState<PipelineEventType>("lead_added");
  const [contact, setContact] = useState("");
  const [valueMad, setValueMad] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => localToday());
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseOptionalNumber(valueMad);
    if (value === null) {
      toast.error("Value must be a number.");
      return;
    }
    startTransition(async () => {
      const res = await logPipelineEvent(projectId, type, contact, value ?? null, note, date);
      if (res.ok) {
        toast.success(`${PIPELINE_EVENT_LABELS[type]} logged.`);
        setContact("");
        setValueMad("");
        setNote("");
        onSuccess?.();
      } else {
        toast.error(res.error ?? "Failed to log event.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-type`}>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as PipelineEventType)}>
            <SelectTrigger id={`${id}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {PIPELINE_EVENT_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-value`}>Value (MAD)</Label>
          <Input
            id={`${id}-value`}
            type="number"
            min="0"
            step="any"
            placeholder="Optional"
            value={valueMad}
            onChange={(e) => setValueMad(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-contact`}>Contact</Label>
        <Input
          id={`${id}-contact`}
          placeholder="Optional"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <div className={showDate ? "grid grid-cols-2 gap-3" : undefined}>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`}>Note</Label>
          <Input
            id={`${id}-note`}
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {showDate && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-date`}>Date</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging…" : "Log event"}
      </Button>
    </form>
  );
}

// ---------------- Money ----------------

export function MoneyForm({ projectId, showDate = true, onSuccess }: BaseFormProps) {
  const id = useId();
  const [type, setType] = useState<MoneyType>("revenue");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => localToday());
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Amount must be greater than 0.");
      return;
    }
    startTransition(async () => {
      const res = await logMoney(projectId, type, parsed, category, note, date);
      if (res.ok) {
        toast.success(`${type === "revenue" ? "Revenue" : "Expense"} logged.`);
        setAmount("");
        setCategory("");
        setNote("");
        onSuccess?.();
      } else {
        toast.error(res.error ?? "Failed to log money entry.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={type === "revenue" ? "default" : "outline"}
          onClick={() => setType("revenue")}
        >
          Revenue
        </Button>
        <Button
          type="button"
          variant={type === "expense" ? "default" : "outline"}
          onClick={() => setType("expense")}
        >
          Expense
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-amount`}>Amount (MAD)</Label>
          <Input
            id={`${id}-amount`}
            type="number"
            min="0"
            step="any"
            required
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-category`}>Category</Label>
          <Input
            id={`${id}-category`}
            placeholder="Optional"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </div>
      <div className={showDate ? "grid grid-cols-2 gap-3" : undefined}>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`}>Note</Label>
          <Input
            id={`${id}-note`}
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {showDate && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-date`}>Date</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging…" : "Log money"}
      </Button>
    </form>
  );
}

// ---------------- Metric ----------------

export interface MetricOption {
  id: string;
  name: string;
  unit: string | null;
}

export function MetricForm({
  projectId,
  metrics,
  showDate = true,
  onSuccess,
}: BaseFormProps & { metrics: MetricOption[] }) {
  const id = useId();
  const [metricId, setMetricId] = useState<string>(metrics[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => localToday());
  const [pending, startTransition] = useTransition();

  if (metrics.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No active metrics for this project. Add one in Settings.
      </p>
    );
  }

  const selected = metrics.find((m) => m.id === metricId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(value);
    if (!metricId || !value.trim() || !Number.isFinite(parsed)) {
      toast.error("Pick a metric and enter a numeric value.");
      return;
    }
    startTransition(async () => {
      const res = await logMetric(metricId, projectId, parsed, note, date);
      if (res.ok) {
        toast.success(`${selected?.name ?? "Metric"} logged.`);
        setValue("");
        setNote("");
        onSuccess?.();
      } else {
        toast.error(res.error ?? "Failed to log metric.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-metric`}>Metric</Label>
          <Select value={metricId} onValueChange={setMetricId}>
            <SelectTrigger id={`${id}-metric`} className="w-full">
              <SelectValue placeholder="Pick a metric" />
            </SelectTrigger>
            <SelectContent>
              {metrics.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.unit ? ` (${m.unit})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-value`}>
            Value{selected?.unit ? ` (${selected.unit})` : ""}
          </Label>
          <Input
            id={`${id}-value`}
            type="number"
            step="any"
            required
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      </div>
      <div className={showDate ? "grid grid-cols-2 gap-3" : undefined}>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`}>Note</Label>
          <Input
            id={`${id}-note`}
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {showDate && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-date`}>Date</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging…" : "Log metric"}
      </Button>
    </form>
  );
}
