import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  tone = "neutral",
  sublabel,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral" | "warning";
  sublabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "financial-figure text-2xl",
            tone === "positive" && "text-success",
            tone === "negative" && "text-danger",
            tone === "warning" && "text-warning",
            tone === "neutral" && "text-foreground"
          )}
        >
          {value}
        </p>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}
