"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface RevenueChartRow {
  name: string;
  thisWeek: number;
  lastWeek: number;
}

const chartConfig = {
  thisWeek: { label: "This week", color: "var(--chart-1)" },
  lastWeek: { label: "Last week", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** One minimal bar chart: revenue per project, this week vs last week (MAD). */
export function RevenueChart({ data }: { data: RevenueChartRow[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="lastWeek" fill="var(--color-lastWeek)" radius={4} />
        <Bar dataKey="thisWeek" fill="var(--color-thisWeek)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
