import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { SplitAuthLayout } from "@/components/auth/split-auth-layout";
import { getCurrentUser } from "@/lib/auth-utils";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <SplitAuthLayout>
      <Suspense
        fallback={
          <div className="py-8 text-center text-sm text-gw-fg-subtle">
            Loading...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </SplitAuthLayout>
  );
}