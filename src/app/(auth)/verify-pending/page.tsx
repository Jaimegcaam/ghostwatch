import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requiresEmailVerification } from "@/lib/auth-email";
import { db } from "@/lib/db";
import { VerifyPendingClient } from "./verify-pending-client";

export default async function VerifyPendingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });

  if (!user?.email) {
    redirect("/api/auth/signout?callbackUrl=/");
  }

  if (!requiresEmailVerification() || user.emailVerified) {
    redirect("/dashboard");
  }

  return <VerifyPendingClient email={user.email} />;
}
