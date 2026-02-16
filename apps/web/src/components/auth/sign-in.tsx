"use client";

import { signIn } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async () => {
    setLoading(true);
    await signIn.email({
      email,
      password,
      fetchOptions: {
        onSuccess: () => {
          router.push("/dashboard");
        },
        onError: (ctx) => {
          alert(ctx.error.message);
          setLoading(false);
        },
      },
    });
  };

  const handleGoogleSignIn = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: window.location.origin + "/dashboard",
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-2xl font-bold text-center">Sign In</h2>
      <div className="flex flex-col gap-2">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />
      </div>
      <button
        onClick={handleSignIn}
        disabled={loading}
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
        className="flex items-center justify-center gap-2 border p-2 rounded hover:bg-gray-50"
      >
        Google
      </button>
    </div>
  );
}
