"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function RunChecksButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/checks/run-all", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setResult(data.error || "Failed");
        return;
      }

      if (data.ran === 0) {
        setResult("No enabled checks to run");
      } else {
        setResult(`Ran ${data.ran} check${data.ran > 1 ? "s" : ""} (${data.succeeded} ok, ${data.failed} failed)`);
      }

      router.refresh();
    } catch {
      setResult("Error running checks");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {loading ? "Running..." : "Run checks now"}
      </button>
      {result && (
        <span className="text-sm text-gw-fg-muted">{result}</span>
      )}
    </div>
  );
}
