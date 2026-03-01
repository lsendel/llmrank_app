import { redirect } from "next/navigation";

export default function LegacyTeamPage() {
  redirect("/dashboard/settings?tab=team");
}
