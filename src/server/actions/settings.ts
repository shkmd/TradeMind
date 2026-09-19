"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/rbac";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validation/settings";
import { updateProfile, changePassword, IncorrectPasswordError } from "@/server/services/settings.service";

export type SettingsActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const idle: SettingsActionState = { status: "idle" };

export async function updateProfileAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const session = await requireSession();
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  await updateProfile(session.user.id, parsed.data);
  revalidatePath("/settings");
  return { status: "success", message: "Profile updated." };
}

export async function changePasswordAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const session = await requireSession();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  try {
    await changePassword(session.user.id, parsed.data);
    return { status: "success", message: "Password changed." };
  } catch (error) {
    if (error instanceof IncorrectPasswordError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Could not change password." };
  }
}

export { idle as settingsIdleState };
