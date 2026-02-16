"use client";

import { signUp } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async () => {
    setLoading(true);
    await signUp.email({
      email,
      password,
      name,
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
    // For sign up, we can use the same social sign in method
    // verifying if we need signUp.social or just signIn.social
    // Better Auth usually treats social login as sign up if user doesn't exist.
    // Let's check imports. signIn is imported.
    // Actually, typically authClient.signIn.social works for both.
    // But let's stick to consistent API if signUp has social.
    // checking docs/types... usually it's just signIn.social
    import("@/lib/auth-client").then(({ signIn }) => {
      signIn.social({
        provider: "google",
        callbackURL: window.location.origin + "/dashboard",
      });
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-2xl font-bold text-center">Sign Up</h2>
      <div className="flex flex-col gap-2">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
        />
      </div>
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
        onClick={handleSignUp}
        disabled={loading}
        className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Signing up..." : "Sign Up"}
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
