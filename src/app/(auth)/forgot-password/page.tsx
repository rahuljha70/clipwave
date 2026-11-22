"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthCard, FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { apiPost } from "@/lib/client/api";
import { errorMessage } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ devResetUrl?: string }>("/api/auth/forgot-password", { email });
      setSent(true);
      if (res.devResetUrl) setDevLink(res.devResetUrl);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not send the reset link."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your account email and we’ll send a one-hour reset link."
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 hover:text-white">
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      }
    >
      <FormError message={error} />
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-mint-400/25 bg-mint-400/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-mint-200">
            If <span className="font-semibold">{email}</span> is registered, a reset link is on its
              way. Check your spam folder if it doesn’t arrive within a minute.
          </div>
          {devLink ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-white/50">
              <p className="font-semibold text-white/70">Development mode</p>
              <p className="mt-1">
                No email provider configured, so the mail was written to{" "}
                <code className="text-violet-300">data/outbox/</code>. Open the link directly:
              </p>
              <Link href={devLink} className="mt-1 block break-all text-violet-300 hover:underline">
                {devLink}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </div>
          <Button type="submit" className="w-full" loading={busy} icon={<Mail className="size-4" />}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
