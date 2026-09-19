"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { registerAction, type RegisterActionState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: RegisterActionState = { status: "idle" };

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  // Controlled, not read from the DOM after submit: React 19 resets
  // uncontrolled <form action={fn}> fields as soon as the action succeeds,
  // which happens before this effect runs — reading form.elements at that
  // point silently returns "", so the auto sign-in below always failed.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const credentialsRef = useRef({ email: "", password: "" });
  credentialsRef.current = { email, password };

  useEffect(() => {
    if (state.status !== "success") return;
    const { email, password } = credentialsRef.current;
    if (!email || !password) return;

    signIn("credentials", { email, password, redirect: false }).then(() => {
      router.push("/onboarding");
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0">
        <CardTitle className="font-serif text-2xl font-normal text-foreground">
          Create your account
        </CardTitle>
        <CardDescription>Start with manual accounts, or import your Zerodha tradebook.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form id="register-form" action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" placeholder="Aarav Sharma" required />
            {state.fieldErrors?.name && (
              <p className="text-xs font-medium text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {state.fieldErrors?.email && (
              <p className="text-xs font-medium text-destructive">{state.fieldErrors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters, with one uppercase letter and one number.
            </p>
            {state.fieldErrors?.password && (
              <p className="text-xs font-medium text-destructive">{state.fieldErrors.password}</p>
            )}
          </div>
          {state.message && <p className="text-xs font-medium text-destructive">{state.message}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
