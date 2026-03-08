export interface Team {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  role: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
  _debug?: boolean;
}

export interface TeamDetail extends Omit<Team, "role"> {
  members: TeamMember[];
  role: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  createdAt: string;
}
