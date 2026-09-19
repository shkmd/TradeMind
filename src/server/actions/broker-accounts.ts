"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/rbac";
import { createBrokerAccountSchema } from "@/lib/validation/broker-account";
import { createBrokerAccount, deleteBrokerAccount } from "@/server/services/broker-account.service";
import { getBrokerAdapter } from "@/lib/brokers/registry";

export type CreateBrokerAccountState = {
  status: "idle" | "error";
  message?: string;
};

export async function createBrokerAccountAction(
  _prevState: CreateBrokerAccountState,
  formData: FormData
): Promise<CreateBrokerAccountState> {
  const session = await requireSession();

  const parsed = createBrokerAccountSchema.safeParse({
    brokerCode: formData.get("brokerCode"),
    nickname: formData.get("nickname"),
    startingCapital: formData.get("startingCapital") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const account = await createBrokerAccount(session.user.id, parsed.data);

  if (getBrokerAdapter(parsed.data.brokerCode)) {
    redirect(`/imports/new?brokerAccountId=${account.id}`);
  }

  redirect(`/broker-accounts/${account.id}`);
}

export type DeleteBrokerAccountState = {
  // "success" is unreachable in practice (the action redirects on success),
  // included so this matches ConfirmDeleteButton's generic action signature.
  status: "idle" | "error" | "success";
  message?: string;
};

export async function deleteBrokerAccountAction(
  _prevState: DeleteBrokerAccountState,
  formData: FormData
): Promise<DeleteBrokerAccountState> {
  const session = await requireSession();
  const brokerAccountId = formData.get("brokerAccountId");
  if (typeof brokerAccountId !== "string" || !brokerAccountId) {
    return { status: "error", message: "Missing broker account." };
  }

  try {
    await deleteBrokerAccount(session.user.id, brokerAccountId);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not delete this broker account.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/trading/trades");
  revalidatePath("/imports");
  revalidatePath("/broker-accounts");
  redirect("/broker-accounts");
}
