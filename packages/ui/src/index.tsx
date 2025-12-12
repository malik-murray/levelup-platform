// packages/ui/index.tsx
import React from "react";

type UiBadgeProps = {
  label: string;
};

export const UiBadge: React.FC<UiBadgeProps> = ({ label }) => (
  <span className="inline-flex items-center rounded-full px-3 py-1 text-sm border">
    {label}
  </span>
);
