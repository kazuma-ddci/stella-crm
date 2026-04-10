"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateSidebarPreference } from "./actions";
import { toast } from "sonner";

type Project = {
  key: string;
  name: string;
  hidden: boolean;
};

export function SidebarCustomizer({ projects }: { projects: Project[] }) {
  const [items, setItems] = useState(projects);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (key: string, checked: boolean) => {
    const updated = items.map((item) =>
      item.key === key ? { ...item, hidden: !checked } : item
    );
    setItems(updated);

    const hiddenItems = updated.filter((i) => i.hidden).map((i) => i.key);
    startTransition(async () => {
      const result = await updateSidebarPreference(hiddenItems);
      if (result.ok) {
        toast.success("サイドバー設定を更新しました");
      } else {
        toast.error(result.error || "更新に失敗しました");
        // ロールバック
        setItems(items);
      }
    });
  };

  return (
    <div className="space-y-4">
      {items.map((project) => (
        <div key={project.key} className="flex items-center justify-between">
          <Label htmlFor={`sidebar-${project.key}`} className="text-sm">
            {project.name}
          </Label>
          <Switch
            id={`sidebar-${project.key}`}
            checked={!project.hidden}
            onCheckedChange={(checked) => handleToggle(project.key, checked)}
            disabled={isPending}
          />
        </div>
      ))}
    </div>
  );
}
