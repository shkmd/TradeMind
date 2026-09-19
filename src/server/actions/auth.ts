"use server";

import { registerSchema } from "@/lib/validation/auth";
import { registerTrader, EmailAlreadyRegisteredError } from "@/server/services/auth.service";

export type RegisterActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
};

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: RegisterActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "name" | "email" | "password";
      if (key) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors };
  }

  try {
    await registerTrader(parsed.data);
    return { status: "success" };
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { status: "error", fieldErrors: { email: error.message } };
    }
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
