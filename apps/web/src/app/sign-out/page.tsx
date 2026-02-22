"use client";

import { useEffect } from "react";
import { signOut } from "@/lib/auth-client";

export default function SignOutPage() {
  useEffect(() => {
    signOut().then(() => {
      window.location.href = "/sign-in";
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-muted-foreground">Signing out...</p>
    </div>
  );
}
