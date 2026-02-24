import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyProjectReportsPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/projects/${id}?tab=reports`);
}
