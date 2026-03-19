"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const DashboardNavSlotsContext = createContext<{
  center: ReactNode;
  setCenter: (node: ReactNode) => void;
  rightExtra: ReactNode;
  setRightExtra: (node: ReactNode) => void;
}>({
  center: null,
  setCenter: () => {},
  rightExtra: null,
  setRightExtra: () => {},
});

export function DashboardNavSlotsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [center, setCenter] = useState<ReactNode>(null);
  const [rightExtra, setRightExtra] = useState<ReactNode>(null);
  return (
    <DashboardNavSlotsContext.Provider
      value={{ center, setCenter, rightExtra, setRightExtra }}
    >
      {children}
    </DashboardNavSlotsContext.Provider>
  );
}

export function useDashboardNavCenter() {
  const { center, setCenter } = useContext(DashboardNavSlotsContext);
  return { center, setCenter };
}

export function useDashboardNavRightExtra() {
  const { rightExtra, setRightExtra } = useContext(DashboardNavSlotsContext);
  return { rightExtra, setRightExtra };
}
