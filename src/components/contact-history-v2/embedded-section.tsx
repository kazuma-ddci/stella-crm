import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listContactHistoriesV2ForEntity,
  countContactHistoriesV2ForEntity,
} from "@/lib/contact-history-v2/loaders";
import {
  getStatusLabel,
  getProviderLabel,
  getMeetingStateBadge,
} from "@/lib/contact-history-v2/types";

/**
 * 詳細ページ(企業詳細/ベンダー詳細/代理店詳細 等)の中に埋め込む
 * 接触履歴セクション(V2版)。
 *
 * 指定した顧客エンティティ (targetType + targetId) に紐づく接触履歴を表示し、
 * 「新規作成」ボタンから V2 新規作成ページへ、1件クリックで V2 詳細ページへ遷移。
 *
 * 各プロジェクト共通で使用する Server Component。旧プロジェクト別
 * セクションコンポーネント (VendorContactHistorySection等) の置き換え。
 */
type Props = {
  projectCode: string; // "stp" | "hojo" | "slp"
  targetType: string; // "stp_company" | "hojo_vendor" | "slp_company_record" 等
  targetId: number | null; // bbs/lender/other 等 targetId 不要な場合は null
  entityName: string; // 画面見出しに使用
  /** "新規作成" / 詳細 / 編集 ページのベースパス */
  basePath: string; // 例: "/hojo/records/contact-histories-v2"
  limit?: number; // 表示件数上限 (デフォルト 20)
};

export async function EmbeddedContactHistoryV2Section({
  projectCode,
  targetType,
  targetId,
  entityName,
  basePath,
  limit = 20,
}: Props) {
  const [histories, totalCount] = await Promise.all([
    listContactHistoriesV2ForEntity({
      projectCode,
      targetType,
      targetId,
      limit,
    }),
    countContactHistoriesV2ForEntity({
      projectCode,
      targetType,
      targetId,
    }),
  ]);

  const newHref = buildNewHref(basePath, targetType, targetId, entityName);

  return (
    <section className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          接触履歴
          {totalCount > 0 && (
            <span className="ml-2 text-sm text-gray-500">（{totalCount}件）</span>
          )}
        </h2>
        <div className="flex gap-2">
          <Link href={newHref}>
            <Button size="sm">新規作成</Button>
          </Link>
          {totalCount > limit && (
            <Link href={`${basePath}?targetType=${targetType}${targetId !== null ? `&targetId=${targetId}` : ""}`}>
              <Button size="sm" variant="outline">
                すべて表示
              </Button>
            </Link>
          )}
        </div>
      </div>

      {histories.length === 0 ? (
        <p className="text-sm text-gray-400">
          接触履歴はまだ登録されていません。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">状態</TableHead>
                <TableHead className="w-40">日時</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>先方参加者</TableHead>
                <TableHead>スタッフ</TableHead>
                <TableHead>接触方法</TableHead>
                <TableHead>会議</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {histories.map((h) => {
                const detailHref = `${basePath}/${h.id}`;
                const attendees = h.customerParticipants.flatMap((p) => p.attendees);
                return (
                  <TableRow key={h.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <Link href={detailHref} className="block">
                        <StatusBadge status={h.status} />
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link href={detailHref} className="block">
                        {formatDateTime(h.scheduledStartAt)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={detailHref} className="block hover:underline">
                        {h.title ?? <span className="text-gray-400">—</span>}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {attendees.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {attendees.slice(0, 3).map((a) => (
                            <Badge key={a.id} variant="secondary">
                              {a.name}
                            </Badge>
                          ))}
                          {attendees.length > 3 && (
                            <span className="text-xs text-gray-500">
                              他{attendees.length - 3}名
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {h.staffParticipants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {h.staffParticipants.map((p) => (
                            <Badge key={p.id} variant={p.isHost ? "default" : "outline"}>
                              {p.staff.name}
                              {p.isHost && <span className="ml-1 text-xs">(ホスト)</span>}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{h.contactMethod?.name ?? "—"}</TableCell>
                    <TableCell>
                      {h.meetings.length > 0 ? (
                        <div className="flex flex-col gap-1 text-xs">
                          {h.meetings.map((m) => (
                            <div key={m.id} className="flex items-center gap-1">
                              <Badge variant={m.isPrimary ? "default" : "outline"}>
                                {getProviderLabel(m.provider)}
                              </Badge>
                              {(() => {
                                const b = getMeetingStateBadge(m.state);
                                return (
                                  <Badge
                                    variant="outline"
                                    className={b.className}
                                    title={b.description}
                                  >
                                    {b.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = getStatusLabel(status);
  const variant: "default" | "secondary" | "outline" =
    status === "scheduled" ? "default" : status === "completed" ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * 「新規作成」ページへの遷移URLを構築。
 * クエリパラメータで作成対象のエンティティを事前設定する。
 */
function buildNewHref(
  basePath: string,
  targetType: string,
  targetId: number | null,
  entityName: string,
): string {
  const params = new URLSearchParams({ targetType, entityName });
  if (targetId !== null) {
    params.set("targetId", String(targetId));
  }
  return `${basePath}/new?${params.toString()}`;
}
