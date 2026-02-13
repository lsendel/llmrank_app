import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-md",
          },
        }}
      />
    </div>
  );
}
