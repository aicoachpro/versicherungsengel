import Link from "next/link";
import { Clock, Package, ClipboardList, TrendingUp } from "lucide-react";

export interface Insight {
  type: "warning" | "info" | "danger" | "success";
  icon: "clock" | "package" | "clipboard" | "trending";
  text: string;
  href?: string;
}

const iconMap = {
  clock: Clock,
  package: Package,
  clipboard: ClipboardList,
  trending: TrendingUp,
};

const colorMap = {
  warning: {
    border: "border-l-amber-400",
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    icon: "text-amber-600",
  },
  info: {
    border: "border-l-blue-400",
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    icon: "text-blue-600",
  },
  danger: {
    border: "border-l-red-400",
    bg: "bg-red-50/50 dark:bg-red-950/20",
    icon: "text-red-600",
  },
  success: {
    border: "border-l-emerald-400",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    icon: "text-emerald-600",
  },
};

function InsightCard({ insight }: { insight: Insight }) {
  const Icon = iconMap[insight.icon];
  const colors = colorMap[insight.type];

  const content = (
    <div
      className={`flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 ${colors.border} ${colors.bg} transition-colors hover:opacity-80`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${colors.icon}`} />
      <p className="text-sm text-foreground/80">{insight.text}</p>
    </div>
  );

  if (insight.href) {
    return <Link href={insight.href}>{content}</Link>;
  }

  return content;
}

interface SmartInsightsProps {
  insights: Insight[];
}

export function SmartInsights({ insights }: SmartInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight, i) => (
        <InsightCard key={i} insight={insight} />
      ))}
    </div>
  );
}
