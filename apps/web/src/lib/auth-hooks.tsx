"use client";

import React, { type ReactNode } from "react";
import { useSession, signOut as betterSignOut } from "./auth-client";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAuth() {
  const { data: session, isPending } = useSession();
  return {
    userId: session?.user?.id ?? null,
    isLoaded: !isPending,
    isSignedIn: !!session?.user,
    signOut: async () => {
      await betterSignOut().catch(() => {});
      window.location.href = "/sign-in?clear_auth=1";
    },
  };
}

export function useUser() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  return {
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image:
            user.image ??
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        }
      : null,
    isLoaded: !isPending,
    isSignedIn: !!user,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function SignedIn({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return session?.user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return !session?.user ? <>{children}</> : null;
}

export function UserButton() {
  const { user } = useUser();
  const router = useRouter();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img
            src={user.image}
            alt={user.name ?? "User"}
            className="h-8 w-8 rounded-full border"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await betterSignOut().catch(() => {});
            window.location.href = "/sign-in?clear_auth=1";
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
