import { Suspense } from "react";
import { env } from "@/lib/env";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const googleEnabled = Boolean(env.googleClientId.trim() && env.googleClientSecret.trim());

  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
