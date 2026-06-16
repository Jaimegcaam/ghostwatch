import type { ReactNode } from "react";

import { SplitAuthLayout } from "@/components/auth/split-auth-layout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <SplitAuthLayout>{children}</SplitAuthLayout>;
}
