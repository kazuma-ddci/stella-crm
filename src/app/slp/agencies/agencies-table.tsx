"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Settings,
  ChevronRight,
  ChevronDown,
  Trash2,
  Eye,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createAgency, deleteAgency } from "./actions";
import { AgencyStatusModal } from "./agency-status-modal";

const ALL = "__all__";

type AgencyRow = {
  id: number;
  name: string;
  corporateName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contractStatusName: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  notes: string | null;
  parentId: number | null;
  parentName: string | null;
  contacts: {
    id: number;
    name: string;
    role: string | null;
    lineFriendLabel: string | null;
  }[];
  asResolutions: {
    contactId: number;
    contactName: string;
    asName: string | null;
  }[];
};

type TreeNode = AgencyRow & {
  depth: number;
  children: TreeNode[];
  hasChildren: boolean;
};

function buildTree(data: AgencyRow[]): TreeNode[] {
  const byParent = new Map<number | null, AgencyRow[]>();
  for (const row of data) {
    const key = row.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(row);
  }

  function build(parentId: number | null, depth: number): TreeNode[] {
    const children = byParent.get(parentId) ?? [];
    return children.map((row) => {
      const childNodes = build(row.id, depth + 1);
      return {
        ...row,
        depth,
        children: childNodes,
        hasChildren: childNodes.length > 0,
      };
    });
  }

  return build(null, 0);
}

function flattenTree(
  nodes: TreeNode[],
  expanded: Set<number>
): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.hasChildren && expanded.has(node.id)) {
      result.push(...flattenTree(node.children, expanded));
    }
  }
  return result;
}

export function AgenciesTable({
  data,
  contractStatusOptions,
}: {
  data: AgencyRow[];
  contractStatusOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState(ALL);
  const [filterLevel, setFilterLevel] = useState(ALL);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgencyRow | null>(null);
  const [creating, setCreating] = useState(false);

  const tree = useMemo(() => buildTree(data), [data]);

  const filteredTree = useMemo(() => {
    // フィルタ適用
    let filtered = data;

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter((row) => {
        const target = `${row.id} ${row.name} ${row.corporateName ?? ""} ${row.contacts.map((c) => c.name).join(" ")}`.toLowerCase();
        return target.includes(q);
      });
    }

    if (filterStatus !== ALL) {
      filtered = filtered.filter(
        (row) => row.contractStatusName === filterStatus
      );
    }

    if (filterLevel !== ALL) {
      if (filterLevel === "parent") {
        filtered = filtered.filter((row) => row.parentId === null);
      } else {
        filtered = filtered.filter((row) => row.parentId !== null);
      }
    }

    // フィルタ適用時はフラット表示
    if (
      searchText.trim() ||
      filterStatus !== ALL ||
      filterLevel !== ALL
    ) {
      return filtered.map((row) => ({
        ...row,
        depth: 0,
        children: [],
        hasChildren: data.some((d) => d.parentId === row.id),
      }));
    }

    return flattenTree(tree, expanded);
  }, [data, tree, searchText, filterStatus, filterLevel, expanded]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(data.filter((d) => data.some((c) => c.parentId === d.id)).map((d) => d.id));
    setExpanded(allIds);
  };

  const collapseAll = () => setExpanded(new Set());

  const handleCreate = async () => {
    setCreating(true);
    try {
      const agency = await createAgency({ name: "新規代理店" });
      router.push(`/slp/agencies/${agency.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAgency(deleteTarget.id);
    setDeleteTarget(null);
    router.refresh();
  };

  // 担当AS表示用
  const getAsDisplay = (row: AgencyRow) => {
    if (row.asResolutions.length === 0) return null;
    const unique = new Map<string, string[]>();
    for (const r of row.asResolutions) {
      const asName = r.asName ?? "なし";
      if (!unique.has(asName)) unique.set(asName, []);
      unique.get(asName)!.push(r.contactName);
    }
    if (unique.size === 1) {
      const [asName] = unique.keys();
      return asName;
    }
    // 複数AS
    return Array.from(unique.entries())
      .map(([asName, contacts]) => `${contacts.join("・")}→${asName}`)
      .join(", ");
  };

  const statusOptions = Array.from(
    new Set(
      data
        .map((r) => r.contractStatusName)
        .filter((v): v is string => !!v)
    )
  );

  return (
    <>
      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="代理店ID・名前・法人名・担当者で検索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-72"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="契約ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて（ステータス）</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="階層" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて（階層）</SelectItem>
            <SelectItem value="parent">親代理店のみ</SelectItem>
            <SelectItem value="child">子代理店のみ</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={expandAll}>
          すべて展開
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          すべて折りたたむ
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatusModalOpen(true)}
        >
          <Settings className="h-4 w-4 mr-1" />
          ステータス管理
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" />
          新規代理店
        </Button>
      </div>

      {/* テーブル */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">代理店ID</TableHead>
              <TableHead>代理店名</TableHead>
              <TableHead>法人名</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>契約ステータス</TableHead>
              <TableHead>担当AS</TableHead>
              <TableHead className="sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTree.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  代理店が登録されていません
                </TableCell>
              </TableRow>
            ) : (
              filteredTree.map((row) => (
                <TableRow key={row.id} className="group/row">
                  <TableCell className="font-mono text-sm">
                    {row.id}
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: `${row.depth * 24}px` }}
                    >
                      {row.hasChildren ? (
                        <button
                          onClick={() => toggleExpand(row.id)}
                          className="p-0.5 hover:bg-gray-100 rounded"
                        >
                          {expanded.has(row.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      ) : (
                        <span className="w-5" />
                      )}
                      <Link
                        href={`/slp/agencies/${row.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {row.name}
                      </Link>
                      {row.parentId !== null && (
                        <Badge variant="outline" className="text-xs ml-1">
                          子
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{row.corporateName ?? "-"}</TableCell>
                  <TableCell>
                    {row.contacts.length > 0 ? (
                      <div className="space-y-0.5">
                        {row.contacts.slice(0, 2).map((c) => (
                          <div key={c.id} className="text-sm">
                            {c.name}
                            {c.role && (
                              <span className="text-muted-foreground ml-1">
                                ({c.role})
                              </span>
                            )}
                          </div>
                        ))}
                        {row.contacts.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{row.contacts.length - 2}名
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.contractStatusName ? (
                      <Badge variant="secondary">
                        {row.contractStatusName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const display = getAsDisplay(row);
                      return display ? (
                        <span className="text-sm">{display}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        asChild
                      >
                        <Link href={`/slp/agencies/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ステータス管理モーダル */}
      <AgencyStatusModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
      />

      {/* 削除確認 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>代理店を削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除してよろしいですか？
              {deleteTarget?.parentId === null &&
                "この代理店に紐づく子代理店もすべて削除されます。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
