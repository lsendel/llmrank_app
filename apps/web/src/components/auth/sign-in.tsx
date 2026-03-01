"use client";

import { signIn } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/telemetry";
import {
  clearPendingAuthRedirect,
  setPendingAuthRedirect,
} from "@/components/auth-redirect-tracker";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTarget = (() => {
    const redirect = searchParams.get("redirect");
    if (!redirect || !redirect.startsWith("/")) return "/dashboard";
    return redirect;
  })();

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      await signIn.email({
        email,
        password,
        fetchOptions: {
          onSuccess: () => {
            setPendingAuthRedirect(redirectTarget, "sign-in", "email");
            track("auth.sign_in_success", {
              auth_method: "email",
              redirect_target: redirectTarget,
            });
            router.push(redirectTarget);
          },
          onError: (ctx) => {
            track("auth.sign_in_failed", {
              auth_method: "email",
              error: ctx.error.message,
            });
            setError(ctx.error.message);
            setLoading(false);
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSocialLoading(true);

    try {
      setPendingAuthRedirect(redirectTarget, "sign-in", "google");
      track("auth.sign_in_started", {
        auth_method: "google",
        redirect_target: redirectTarget,
      });
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin + redirectTarget,
      });
    } catch (err) {
      clearPendingAuthRedirect();
      track("auth.sign_in_failed", {
        auth_method: "google",
        error: err instanceof Error ? err.message : "google_sign_in_failed",
      });
      setError(err instanceof Error ? err.message : "Google sign in failed.");
      setSocialLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-2xl font-bold text-center">Sign In</h2>
      <div className="flex flex-col gap-2">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />
      </div>
      <button
        onClick={handleSignIn}
        disabled={loading || socialLoading}
        className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading || socialLoading}
        className="flex items-center justify-center gap-2 border p-2 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {socialLoading ? "Connecting..." : "Google"}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
