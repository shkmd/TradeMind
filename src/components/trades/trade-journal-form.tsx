"use client";

import { useActionState } from "react";
import { saveTradeJournalAction, type SaveJournalState } from "@/server/actions/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const initialState: SaveJournalState = { status: "idle" };

export interface TradeJournalFormValues {
  tradeId: string;
  setupNotes: string | null;
  entryReason: string | null;
  plannedStopLoss: number | null;
  plannedTarget: number | null;
  confidenceLevel: number | null;
  exitReason: string | null;
  setupFollowed: boolean | null;
  stopLossFollowed: boolean | null;
  whatWentWell: string | null;
  whatWentWrong: string | null;
  lessonLearned: string | null;
  rating: number | null;
  emotionId: string | null;
  completedAt: string | null;
}

export function TradeJournalForm({
  values,
  emotions,
}: {
  values: TradeJournalFormValues;
  emotions: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(saveTradeJournalAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tradeId" value={values.tradeId} />

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pre-trade</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Setup" name="setupNotes" defaultValue={values.setupNotes ?? ""} textarea />
          <Field label="Entry reason" name="entryReason" defaultValue={values.entryReason ?? ""} textarea />
          <Field
            label="Planned stop-loss (₹)"
            name="plannedStopLoss"
            type="number"
            step="0.01"
            defaultValue={values.plannedStopLoss ?? ""}
          />
          <Field
            label="Planned target (₹)"
            name="plannedTarget"
            type="number"
            step="0.01"
            defaultValue={values.plannedTarget ?? ""}
          />
          <div className="space-y-2">
            <Label htmlFor="confidenceLevel">Confidence (1-5)</Label>
            <Input
              id="confidenceLevel"
              name="confidenceLevel"
              type="number"
              min={1}
              max={5}
              defaultValue={values.confidenceLevel ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emotionId">Emotional state</Label>
            <select
              id="emotionId"
              name="emotionId"
              defaultValue={values.emotionId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {emotions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post-trade</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Exit reason" name="exitReason" defaultValue={values.exitReason ?? ""} textarea />
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="setupFollowed" defaultChecked={values.setupFollowed ?? false} />
              Setup followed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="stopLossFollowed" defaultChecked={values.stopLossFollowed ?? false} />
              Stop-loss followed
            </label>
          </div>
          <Field label="What went well" name="whatWentWell" defaultValue={values.whatWentWell ?? ""} textarea />
          <Field label="What went wrong" name="whatWentWrong" defaultValue={values.whatWentWrong ?? ""} textarea />
          <Field label="Lesson learned" name="lessonLearned" defaultValue={values.lessonLearned ?? ""} textarea />
          <div className="space-y-2">
            <Label htmlFor="rating">Trade rating (1-5)</Label>
            <Input id="rating" name="rating" type="number" min={1} max={5} defaultValue={values.rating ?? ""} />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox name="markComplete" defaultChecked={Boolean(values.completedAt)} />
        Mark journal as complete
      </label>

      {state.status === "error" && state.message && (
        <p className="text-sm font-medium text-destructive">{state.message}</p>
      )}
      {state.status === "success" && <p className="text-sm font-medium text-success">Journal saved.</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save journal entry"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  textarea,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  textarea?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-1">
      <Label htmlFor={name}>{label}</Label>
      {textarea ? (
        <Textarea id={name} name={name} defaultValue={defaultValue} rows={2} />
      ) : (
        <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} />
      )}
    </div>
  );
}
