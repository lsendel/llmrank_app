"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function ConnectFlow() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return;

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || "https://api.llmrank.app";

    window.location.href = `${apiBase}/connect/indices?token=${encodeURIComponent(token)}`;
  }, [token]);

  if (!token) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-800">Connection Error</h2>
        <p className="mt-2 text-sm text-red-700">Missing token parameter.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      <p className="mt-4 text-sm text-gray-600">
        Connecting to Families.care...
      </p>
    </div>
  );
}

export default function ConnectFamiliesCarePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense
        fallback={
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <p className="mt-4 text-sm text-gray-600">Loading...</p>
          </div>
        }
      >
        <ConnectFlow />
      </Suspense>
    </div>
  );
}
