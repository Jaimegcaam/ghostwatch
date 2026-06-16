"use client";

import { createContext, useContext } from "react";

type TeamContextValue = {
  teamId: string;
  role: string;
  canEdit: boolean;
  canAdmin: boolean;
};

const TeamContext = createContext<TeamContextValue>({
  teamId: "",
  role: "VIEWER",
  canEdit: false,
  canAdmin: false,
});

export function TeamProvider({
  teamId,
  role,
  children,
}: {
  teamId: string;
  role: string;
  children: React.ReactNode;
}) {
  const value: TeamContextValue = {
    teamId,
    role,
    canEdit: role === "ADMIN" || role === "EDITOR",
    canAdmin: role === "ADMIN",
  };

  return <TeamContext value={value}>{children}</TeamContext>;
}

export function useTeam() {
  return useContext(TeamContext);
}
