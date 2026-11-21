"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthDivider, FormError, GoogleButton } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { apiPost } from "@/lib/client/api";

export default function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const oauthError = googleEnabled ? params.get("error") : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(oauthError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/auth/login", { email, password });
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to pick up where your clips left off."
      footer={
        <>
          New to Clipwave?{" "}
          <Link href="/register" className="font-medium text-violet-300 hover:text-violet-200">
            Create an account
          </Link>
        </>
      }
    >
      {googleEnabled ? (
        <>
          <GoogleButton />
          <AuthDivider />
        </>
      ) : null}
      <FormError message={error} />
      <form onSubmit={submit} className="space-y-4">
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
          <Label
            htmlFor="password"
            hint={<Link href="/forgot-password" className="text-violet-300 hover:text-violet-200">Forgot password?</Link>}
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/40 hover:text-white"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={busy} icon={<LogIn className="size-4" />}>
          Sign in
        </Button>
      </form>

    </AuthCard>
  );
}
