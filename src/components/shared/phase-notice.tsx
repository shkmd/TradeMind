import { Sparkles } from "lucide-react";

export function PhaseNotice({ feature, phase }: { feature: string; phase: number }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-insight/30 bg-insight-muted px-4 py-3 text-sm text-insight-foreground">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-medium">{feature}</span> is shown with illustrative demo data. Full{" "}
        {feature.toLowerCase()} logic ships in a later build phase (Phase {phase}).
      </p>
    </div>
  );
}
