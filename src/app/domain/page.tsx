import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Fallback 404 when a custom domain has no bound public status page. */
export default function CustomDomainEntry() {
  notFound();
}
