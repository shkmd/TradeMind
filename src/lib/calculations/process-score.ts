import type { RuleEvalResult } from "@prisma/client";

const RULE_WEIGHT = 0.7;
const JOURNAL_WEIGHT = 0.3;

export interface ProcessScoreInput {
  ruleEvaluations: { result: RuleEvalResult }[];
  journalCompleted: boolean;
}

export interface ProcessScoreOutput {
  /** null means there was nothing to score — never a fabricated number. */
  score: number | null;
  breakdown: {
    ruleCompliancePercent: number | null;
    journalComponent: number;
    applicableRuleCount: number;
  };
}

/**
 * Weighted composite of rule compliance and journal completion. Degrades
 * gracefully: if a trade has no applicable rules, the score is journal-only;
 * if there's no journal but rules apply, it's rule-only. Only returns null
 * when genuinely neither exists — that must render as "—", never as 0.
 */
export function computeProcessScore(input: ProcessScoreInput): ProcessScoreOutput {
  const applicable = input.ruleEvaluations.filter((r) => r.result !== "NOT_APPLICABLE");
  const passCount = applicable.filter((r) => r.result === "PASS").length;

  const ruleCompliancePercent = applicable.length > 0 ? (passCount / applicable.length) * 100 : null;
  const journalComponent = input.journalCompleted ? 100 : 0;

  if (ruleCompliancePercent === null && !input.journalCompleted) {
    return {
      score: null,
      breakdown: { ruleCompliancePercent: null, journalComponent, applicableRuleCount: 0 },
    };
  }

  const score =
    ruleCompliancePercent === null
      ? journalComponent
      : RULE_WEIGHT * ruleCompliancePercent + JOURNAL_WEIGHT * journalComponent;

  return {
    score: Math.round(score),
    breakdown: {
      ruleCompliancePercent,
      journalComponent,
      applicableRuleCount: applicable.length,
    },
  };
}
