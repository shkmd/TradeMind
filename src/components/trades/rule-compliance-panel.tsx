import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { formatINR } from "@/lib/utils";

export interface RuleEvaluationRow {
  id: string;
  ruleName: string;
  result: "PASS" | "FAIL" | "NOT_APPLICABLE";
  violationCost: number | null;
}

export function RuleCompliancePanel({ evaluations }: { evaluations: RuleEvaluationRow[] }) {
  if (evaluations.length === 0) {
    return <p className="text-sm text-muted-foreground">No trading rules are configured yet.</p>;
  }

  return (
    <ul className="divide-y divide-surface-border">
      {evaluations.map((evaluation) => (
        <li key={evaluation.id} className="flex items-center justify-between py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <ResultIcon result={evaluation.result} />
            <span>{evaluation.ruleName}</span>
          </div>
          {evaluation.violationCost !== null && (
            <span className="text-xs font-medium text-danger">Cost: {formatINR(evaluation.violationCost)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ResultIcon({ result }: { result: RuleEvaluationRow["result"] }) {
  if (result === "PASS") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (result === "FAIL") return <XCircle className="h-4 w-4 text-danger" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
}
