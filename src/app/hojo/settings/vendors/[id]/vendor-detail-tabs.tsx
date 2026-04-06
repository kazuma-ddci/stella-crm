"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const VendorDetailForm = dynamic(() => import("./vendor-detail-form").then((mod) => mod.VendorDetailForm), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-muted-foreground">読み込み中...</div>,
});
import { ActivitiesCrudTable } from "@/app/hojo/consulting/activities/activities-crud-table";
import { PreApplicationTable } from "@/app/hojo/grant-customers/pre-application/pre-application-table";
import { PostApplicationTable } from "@/app/hojo/grant-customers/post-application/post-application-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addActivityForVendor,
  updateActivityForVendor,
  deleteActivityForVendor,
  addPreApplicationForVendor,
  updatePreApplicationForVendor,
  deletePreApplicationForVendor,
  addPostApplicationForVendor,
  updatePostApplicationForVendor,
  deletePostApplicationForVendor,
} from "./actions";

type ContactData = {
  id: number;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  lineFriendId: number | null;
  lineFriendName: string | null;
  joseiLineFriendId: number | null;
  joseiLineFriendName: string | null;
  isPrimary: boolean;
};

type Props = {
  vendor: {
    id: number;
    name: string;
    contractDate: string;
    caseStatusId: number | null;
    consultingStartDate: string;
    consultingEndDate: string;
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
    toolRegistrationStatusId: number | null;
    memo: string;
    vendorSharedMemo: string;
    assignedAsLineFriendId: number | null;
  };
  contacts: ContactData[];
  scLineFriendSelectOptions: { value: string; label: string }[];
  joseiLineFriendSelectOptions: { value: string; label: string }[];
  scWholesaleOptions: { value: string; label: string }[];
  consultingPlanOptions: { value: string; label: string }[];
  caseStatusOptions: { value: string; label: string }[];
  vendorRegistrationOptions: { value: string; label: string }[];
  toolRegistrationOptions: { value: string; label: string }[];
  activitiesData: Record<string, unknown>[];
  preApplicationData: Record<string, unknown>[];
  postApplicationData: Record<string, unknown>[];
  contractOptions: { value: string; label: string }[];
  scLabel: string;
  joseiLabel: string;
  staffOptions: { value: string; label: string }[];
  currentConsultingStaffIds: number[];
  assignedAsLineFriendId: number | null;
  assignedAsLineFriendLabel: string | null;
  autoDetectedAsLabel: string | null;
  autoDetectedAsLineFriendId: number | null;
  scLineFriendsForAs: { value: string; label: string }[];
  accessToken: string;
};

export function VendorDetailTabs({
  vendor,
  contacts,
  scLineFriendSelectOptions,
  joseiLineFriendSelectOptions,
  scWholesaleOptions,
  consultingPlanOptions,
  caseStatusOptions,
  vendorRegistrationOptions,
  toolRegistrationOptions,
  activitiesData,
  preApplicationData,
  postApplicationData,
  contractOptions,
  scLabel,
  joseiLabel,
  staffOptions,
  currentConsultingStaffIds,
  assignedAsLineFriendId,
  assignedAsLineFriendLabel,
  autoDetectedAsLabel,
  autoDetectedAsLineFriendId,
  scLineFriendsForAs,
  accessToken,
}: Props) {
  const vendorOptions = [
    { value: String(vendor.id), label: vendor.name },
  ];

  const [copied, setCopied] = useState(false);
  const [loanFormUrl, setLoanFormUrl] = useState(`/form/hojo-loan-application?v=${accessToken}`);

  useEffect(() => {
    setLoanFormUrl(`${window.location.origin}/form/hojo-loan-application?v=${accessToken}`);
  }, [accessToken]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(loanFormUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/hojo/settings/vendors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        ベンダー一覧に戻る
      </Link>
      <h1 className="text-2xl font-bold">ベンダー: {vendor.name}</h1>
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">基本情報</TabsTrigger>
          <TabsTrigger value="activities">コンサル履歴</TabsTrigger>
          <TabsTrigger value="customers">顧客管理</TabsTrigger>
          <TabsTrigger value="loan">貸金業社</TabsTrigger>
        </TabsList>

      <TabsContent value="basic">
        <VendorDetailForm
          vendor={vendor}
          contacts={contacts}
          scLineFriendSelectOptions={scLineFriendSelectOptions}
          joseiLineFriendSelectOptions={joseiLineFriendSelectOptions}
          scWholesaleOptions={scWholesaleOptions}
          consultingPlanOptions={consultingPlanOptions}
          caseStatusOptions={caseStatusOptions}
          vendorRegistrationOptions={vendorRegistrationOptions}
          toolRegistrationOptions={toolRegistrationOptions}
          scLabel={scLabel}
          joseiLabel={joseiLabel}
          staffOptions={staffOptions}
          currentConsultingStaffIds={currentConsultingStaffIds}
          assignedAsLineFriendId={assignedAsLineFriendId}
          assignedAsLineFriendLabel={assignedAsLineFriendLabel}
          autoDetectedAsLabel={autoDetectedAsLabel}
          autoDetectedAsLineFriendId={autoDetectedAsLineFriendId}
          scLineFriendsForAs={scLineFriendsForAs}
        />
      </TabsContent>

      <TabsContent value="activities">
        <Card>
          <CardHeader>
            <CardTitle>コンサル履歴一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivitiesCrudTable
              data={activitiesData}
              canEdit={true}
              vendorOptions={vendorOptions}
              contractOptions={contractOptions}
              onAddOverride={addActivityForVendor}
              onUpdateOverride={updateActivityForVendor}
              onDeleteOverride={(id) => deleteActivityForVendor(id, String(vendor.id))}
              hideVendorColumn={true}
              notesReadOnly={true}
              defaultVendorId={String(vendor.id)}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="customers">
        <Tabs defaultValue="pre">
          <TabsList>
            <TabsTrigger value="pre">~概要案内</TabsTrigger>
            <TabsTrigger value="post">交付申請~</TabsTrigger>
          </TabsList>
          <TabsContent value="pre">
            <Card>
              <CardHeader>
                <CardTitle>概要案内一覧</CardTitle>
              </CardHeader>
              <CardContent>
                <PreApplicationTable
                  data={preApplicationData}
                  canEdit={true}
                  vendorOptions={vendorOptions}
                  onAddOverride={addPreApplicationForVendor}
                  onUpdateOverride={updatePreApplicationForVendor}
                  onDeleteOverride={(id) => deletePreApplicationForVendor(id, String(vendor.id))}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="post">
            <Card>
              <CardHeader>
                <CardTitle>交付申請一覧</CardTitle>
              </CardHeader>
              <CardContent>
                <PostApplicationTable
                  data={postApplicationData}
                  canEdit={true}
                  vendorOptions={vendorOptions}
                  onAddOverride={addPostApplicationForVendor}
                  onUpdateOverride={updatePostApplicationForVendor}
                  onDeleteOverride={(id) => deletePostApplicationForVendor(id, String(vendor.id))}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </TabsContent>
      <TabsContent value="loan">
        <Card>
          <CardHeader>
            <CardTitle>借入申込フォームURL</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              このベンダー専用の借入申込フォームURLです。ベンダー様のお客様にこのURLをお送りください。
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 rounded px-3 py-2 break-all">
                {loanFormUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyUrl} className="shrink-0">
                {copied ? (
                  <><Check className="h-4 w-4 mr-1 text-green-500" />コピー済</>
                ) : (
                  <><Copy className="h-4 w-4 mr-1" />コピー</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    </div>
  );
}
