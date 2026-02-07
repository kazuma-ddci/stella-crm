import React from "react";

interface CompanyCodeLabelProps {
  code: string;
  name: string;
}

export function CompanyCodeLabel({ code, name }: CompanyCodeLabelProps) {
  return (
    <span className="inline-flex items-baseline">
      <span className="font-mono text-muted-foreground shrink-0 mr-2" style={{ minWidth: "7ch" }}>
        {code}
      </span>
      <span>{name}</span>
    </span>
  );
}
