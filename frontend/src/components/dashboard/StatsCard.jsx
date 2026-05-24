import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, color = "indigo" }) {
  const colorClasses = {
    indigo: "bg-[hsl(var(--feedback-info-bg))] text-[hsl(var(--feedback-info-fg))]",
    emerald: "bg-[hsl(var(--feedback-success-bg))] text-[hsl(var(--feedback-success-fg))]",
    amber: "bg-[hsl(var(--feedback-warning-bg))] text-[hsl(var(--feedback-warning-fg))]",
    rose: "bg-[hsl(var(--feedback-danger-bg))] text-[hsl(var(--feedback-danger-fg))]",
    blue: "bg-[hsl(var(--accent))] text-primary",
    purple: "bg-[hsl(var(--accent))] text-[hsl(var(--chart-4))]",
  };

  return (
    <Card className="app-metric-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "mt-3 flex items-center gap-1 text-sm font-medium",
              trendUp
                ? "text-[hsl(var(--feedback-success-fg))]"
                : "text-[hsl(var(--feedback-danger-fg))]"
            )}>
              <span>{trendUp ? "↑" : "↓"} {trend}</span>
              <span className="text-muted-foreground">vs período anterior</span>
            </div>
          )}
        </div>
        <div className={cn("rounded-2xl p-3.5 shadow-[var(--shadow-soft)]", colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}
