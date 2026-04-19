"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { AgencyTreeNode } from "@/lib/slp/company-resolution";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lineFriendLabel: string;
  trees: AgencyTreeNode[];
};

function tierLabel(depth: number): string {
  return `${depth + 1}次`;
}

function TreeNodeRow({
  node,
  depth,
}: {
  node: AgencyTreeNode;
  depth: number;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 text-sm"
        style={{ paddingLeft: depth * 20 }}
      >
        {depth > 0 && (
          <span className="text-muted-foreground select-none">└─</span>
        )}
        <Badge variant="outline" className="text-xs shrink-0">
          {tierLabel(depth)}代理店
        </Badge>
        <span className={node.isHit ? "font-semibold" : ""}>{node.name}</span>
        {node.isHit && (
          <Badge variant="default" className="text-xs">
            所属
          </Badge>
        )}
      </div>
      {node.children.map((child) => (
        <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function AgencyHierarchyModal({
  open,
  onOpenChange,
  lineFriendLabel,
  trees,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>代理店階層</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {lineFriendLabel}
            </span>{" "}
            の所属代理店階層
          </div>
          <div className="border rounded-md p-3 bg-muted/30">
            {trees.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                所属代理店なし
              </div>
            ) : (
              trees.map((tree) => (
                <TreeNodeRow key={tree.id} node={tree} depth={0} />
              ))
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            「所属」バッジが付いているのが、紹介者チェーン上で実際にヒットした代理店です。
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
