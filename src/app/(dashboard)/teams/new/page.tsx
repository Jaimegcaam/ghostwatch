import { getCurrentUser } from "@/lib/auth-utils";
import { NewTeamForm } from "./new-team-form";

export default async function NewTeamPage() {
  const user = await getCurrentUser();
  const hasExistingTeams = (user?.teamMemberships.length ?? 0) > 0;

  return <NewTeamForm hasExistingTeams={hasExistingTeams} />;
}
