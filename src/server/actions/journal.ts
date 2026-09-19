"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/rbac";
import { tradeJournalSchema } from "@/lib/validation/journal";
import { saveTradeJournal } from "@/server/services/journal.service";

export type SaveJournalState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function saveTradeJournalAction(
  _prevState: SaveJournalState,
  formData: FormData
): Promise<SaveJournalState> {
  const session = await requireSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = tradeJournalSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  try {
    await saveTradeJournal(session.user.id, parsed.data);
    revalidatePath(`/trading/trades/${parsed.data.tradeId}`);
    revalidatePath("/trading/trades");
    revalidatePath("/dashboard");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save the journal entry.",
    };
  }
}
