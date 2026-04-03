"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ComboTextSelectInput } from "@/components/combo-text-select-input";
import { VendorStatusManagementModal } from "../vendor-status-management-modal";
import { ArrowLeft, Settings, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateVendorDetail } from "./actions";
import type { StatusType } from "../vendor-status-management-modal";

type Props = {
  vendor: {
    id: number;
    name: string;
    representativeName: string;
    representativeLineFriendId: number | null;
    contactPersonName: string;
    contactPersonLineFriendId: number | null;
    email: string;
    phone: string;
    scWholesaleStatusId: number | null;
    scWholesaleKickoffMtg: string;
    scWholesaleContractUrl: string;
    consultingPlanStatusId: number | null;
    consultingPlanKickoffMtg: string;
    consultingPlanContractUrl: string;
    grantApplicationBpo: boolean;
    grantApplicationBpoKickoffMtg: string;
    grantApplicationBpoContractUrl: string;
    subsidyConsulting: boolean;
    subsidyConsultingKickoffMtg: string;
    loanUsage: boolean;
    loanUsageKickoffMtg: string;
    loanUsageContractUrl: string;
    vendorRegistrationStatusId: number | null;
    memo: string;
  };
  lineFriendOptions: { id: number; label: string }[];
  scWholesaleOptions: { value: string; label: string }[];
  consultingPlanOptions: { value: string; label: string }[];
  vendorRegistrationOptions: { value: string; label: string }[];
};

const UNSET_VALUE = "__unset__";

export function VendorDetailForm({
  vendor,
  lineFriendOptions,
  scWholesaleOptions,
  consultingPlanOptions,
  vendorRegistrationOptions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 基本情報
  const [representativeName, setRepresentativeName] = useState(vendor.representativeName);
  const [representativeLineFriendId, setRepresentativeLineFriendId] = useState<number | null>(
    vendor.representativeLineFriendId
  );
  const [contactPersonName, setContactPersonName] = useState(vendor.contactPersonName);
  const [contactPersonLineFriendId, setContactPersonLineFriendId] = useState<number | null>(
    vendor.contactPersonLineFriendId
  );
  const [email, setEmail] = useState(vendor.email);
  const [phone, setPhone] = useState(vendor.phone);

  // サービス契約状況
  const [scWholesaleStatusId, setScWholesaleStatusId] = useState<string>(
    vendor.scWholesaleStatusId ? String(vendor.scWholesaleStatusId) : ""
  );
  const [scWholesaleKickoffMtg, setScWholesaleKickoffMtg] = useState(vendor.scWholesaleKickoffMtg);
  const [scWholesaleContractUrl, setScWholesaleContractUrl] = useState(vendor.scWholesaleContractUrl);

  const [consultingPlanStatusId, setConsultingPlanStatusId] = useState<string>(
    vendor.consultingPlanStatusId ? String(vendor.consultingPlanStatusId) : ""
  );
  const [consultingPlanKickoffMtg, setConsultingPlanKickoffMtg] = useState(vendor.consultingPlanKickoffMtg);
  const [consultingPlanContractUrl, setConsultingPlanContractUrl] = useState(vendor.consultingPlanContractUrl);

  const [grantApplicationBpo, setGrantApplicationBpo] = useState(vendor.grantApplicationBpo);
  const [grantApplicationBpoKickoffMtg, setGrantApplicationBpoKickoffMtg] = useState(
    vendor.grantApplicationBpoKickoffMtg
  );
  const [grantApplicationBpoContractUrl, setGrantApplicationBpoContractUrl] = useState(
    vendor.grantApplicationBpoContractUrl
  );

  const [subsidyConsulting, setSubsidyConsulting] = useState(vendor.subsidyConsulting);
  const [subsidyConsultingKickoffMtg, setSubsidyConsultingKickoffMtg] = useState(
    vendor.subsidyConsultingKickoffMtg
  );

  const [loanUsage, setLoanUsage] = useState(vendor.loanUsage);
  const [loanUsageKickoffMtg, setLoanUsageKickoffMtg] = useState(vendor.loanUsageKickoffMtg);
  const [loanUsageContractUrl, setLoanUsageContractUrl] = useState(vendor.loanUsageContractUrl);

  const [vendorRegistrationStatusId, setVendorRegistrationStatusId] = useState<string>(
    vendor.vendorRegistrationStatusId ? String(vendor.vendorRegistrationStatusId) : ""
  );

  // ステータス管理モーダル
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalType, setStatusModalType] = useState<StatusType>("scWholesale");

  const openStatusModal = (type: StatusType) => {
    setStatusModalType(type);
    setStatusModalOpen(true);
  };

  // その他
  const [memo, setMemo] = useState(vendor.memo);

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateVendorDetail(vendor.id, {
          representativeName,
          representativeLineFriendId,
          contactPersonName,
          contactPersonLineFriendId,
          email,
          phone,
          scWholesaleStatusId: scWholesaleStatusId ? Number(scWholesaleStatusId) : null,
          scWholesaleKickoffMtg,
          scWholesaleContractUrl,
          consultingPlanStatusId: consultingPlanStatusId ? Number(consultingPlanStatusId) : null,
          consultingPlanKickoffMtg,
          consultingPlanContractUrl,
          grantApplicationBpo,
          grantApplicationBpoKickoffMtg,
          grantApplicationBpoContractUrl,
          subsidyConsulting,
          subsidyConsultingKickoffMtg,
          loanUsage,
          loanUsageKickoffMtg,
          loanUsageContractUrl,
          vendorRegistrationStatusId: vendorRegistrationStatusId
            ? Number(vendorRegistrationStatusId)
            : null,
          memo,
        });
        toast.success("保存しました");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/hojo/settings/vendors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          ベンダー一覧に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold">ベンダー: {vendor.name}</h1>

      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>代表者名</Label>
              <ComboTextSelectInput
                value={representativeName}
                linkedId={representativeLineFriendId}
                onChange={(val, id) => {
                  setRepresentativeName(val);
                  setRepresentativeLineFriendId(id);
                }}
                options={lineFriendOptions}
                placeholder="テキスト入力またはLINE友達を選択"
              />
            </div>
            <div className="space-y-2">
              <Label>担当者名</Label>
              <ComboTextSelectInput
                value={contactPersonName}
                linkedId={contactPersonLineFriendId}
                onChange={(val, id) => {
                  setContactPersonName(val);
                  setContactPersonLineFriendId(id);
                }}
                options={lineFriendOptions}
                placeholder="テキスト入力またはLINE友達を選択"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03-xxxx-xxxx"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* サービス契約状況 */}
      <Card>
        <CardHeader>
          <CardTitle>サービス契約状況</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* セキュリティクラウド卸 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">セキュリティクラウド卸</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("scWholesale")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>プラン</Label>
                <Select
                  value={scWholesaleStatusId || UNSET_VALUE}
                  onValueChange={(v) => setScWholesaleStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {scWholesaleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={scWholesaleKickoffMtg}
                  onChange={(e) => setScWholesaleKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={scWholesaleContractUrl}
                  onChange={(e) => setScWholesaleContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* コンサルティングプラン */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">コンサルティングプラン</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("consultingPlan")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>プラン</Label>
                <Select
                  value={consultingPlanStatusId || UNSET_VALUE}
                  onValueChange={(v) => setConsultingPlanStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {consultingPlanOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={consultingPlanKickoffMtg}
                  onChange={(e) => setConsultingPlanKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={consultingPlanContractUrl}
                  onChange={(e) => setConsultingPlanContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* 交付申請BPO */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">交付申請BPO</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={grantApplicationBpo}
                  onCheckedChange={setGrantApplicationBpo}
                />
                <Label>利用</Label>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={grantApplicationBpoKickoffMtg}
                  onChange={(e) => setGrantApplicationBpoKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={grantApplicationBpoContractUrl}
                  onChange={(e) => setGrantApplicationBpoContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* 助成金コンサルティング */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">助成金コンサルティング</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={subsidyConsulting}
                  onCheckedChange={setSubsidyConsulting}
                />
                <Label>利用</Label>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={subsidyConsultingKickoffMtg}
                  onChange={(e) => setSubsidyConsultingKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div>{/* 助成金コンサルティングには契約書URLなし */}</div>
            </div>
          </div>

          <hr />

          {/* 貸金利用の有無 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">貸金利用の有無</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={loanUsage}
                  onCheckedChange={setLoanUsage}
                />
                <Label>利用</Label>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={loanUsageKickoffMtg}
                  onChange={(e) => setLoanUsageKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={loanUsageContractUrl}
                  onChange={(e) => setLoanUsageContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* ベンダー登録の有無 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">ベンダー登録の有無</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("vendorRegistration")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-w-xs space-y-2">
              <Label>ステータス</Label>
              <Select
                value={vendorRegistrationStatusId || UNSET_VALUE}
                onValueChange={(v) =>
                  setVendorRegistrationStatusId(v === UNSET_VALUE ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {vendorRegistrationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* その他 */}
      <Card>
        <CardHeader>
          <CardTitle>その他</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="memo">備考</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="メモ"
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存
        </Button>
      </div>

      {/* ステータス管理モーダル */}
      <VendorStatusManagementModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        type={statusModalType}
      />
    </div>
  );
}
