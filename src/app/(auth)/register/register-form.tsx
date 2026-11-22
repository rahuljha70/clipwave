"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthDivider, FormError, GoogleButton } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { apiPost } from "@/lib/client/api";
import { errorMessage } from "@/lib/utils";

export default function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const plan = params.get("plan");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/auth/register", { name, email, password });
      if (plan && plan !== "free") {
        await apiPost("/api/billing/change", { plan }).catch(() => {});
      }
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not create your account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create your workspace"
      subtitle={
        <>
          30 processing minutes free every month. No card, no watermark on Pro trials.
          {plan && plan !== "free" ? (
            <span className="mt-2 block text-violet-300">Selected plan: {plan}</span>
          ) : null}
        </>
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
            Sign in
          </Link>
        </>
      }
    >
      {googleEnabled ? (
        <>
          <GoogleButton label="Sign up with Google" />
          <AuthDivider />
        </>
      ) : null}
      <FormError message={error} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Creator name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
          />
        </div>
        <div>
          <Label htmlFor="password" hint="8+ characters">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full" loading={busy} icon={<Sparkles className="size-4" />}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-white/30">
        By creating an account you agree to only import media you have the right to use. Clipwave
        never bypasses DRM or access restrictions.
      </p>
    </AuthCard>
  );
}
