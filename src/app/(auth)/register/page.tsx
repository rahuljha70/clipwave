import { Suspense } from "react";
import { env } from "@/lib/env";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const googleEnabled = Boolean(env.googleClientId.trim() && env.googleClientSecret.trim());

  return (
    <Suspense fallback={null}>
      <RegisterForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
