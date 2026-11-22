"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { apiPost } from "@/lib/client/api";
import { errorMessage } from "@/lib/utils";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not reset your password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={done ? "Password updated — redirecting you to sign in." : "Minimum 8 characters."}
      footer={
        <Link href="/login" className="hover:text-white">
          Back to sign in
        </Link>
      }
    >
      <FormError message={token ? error : "This link is missing its token. Request a new email."} />
      {done ? (
        <div className="rounded-xl border border-mint-400/25 bg-mint-400/10 px-3.5 py-3 text-[12.5px] text-mint-200">
          Your password has been changed and all existing sessions were signed out.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" loading={busy} disabled={!token} icon={<KeyRound className="size-4" />}>
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
