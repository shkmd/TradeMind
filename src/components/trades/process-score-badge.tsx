import { cn } from "@/lib/utils";

export function ProcessScoreBadge({ score, label }: { score: number | null; label: string }) {
  const tone =
    score === null ? "neutral" : score >= 80 ? "positive" : score >= 50 ? "warning" : "negative";

  return (
    <div className="flex flex-col items-center rounded-lg border border-surface-border bg-surface px-4 py-3">
      <p
        className={cn(
          "financial-figure text-3xl",
          tone === "positive" && "text-success",
          tone === "warning" && "text-warning",
          tone === "negative" && "text-danger",
          tone === "neutral" && "text-muted-foreground"
        )}
      >
        {score !== null ? score : "—"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
