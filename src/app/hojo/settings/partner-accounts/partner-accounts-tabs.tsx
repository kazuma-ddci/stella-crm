"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BbsTab } from "./bbs-tab";
import { VendorTab } from "./vendor-tab";
import { Badge } from "@/components/ui/badge";

type BbsAccountData = {
  id: number;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  passwordResetRequestedAt: string | null;
  approvedAt: string | null;
  approverName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type VendorAccountData = {
  id: number;
  vendorId: number;
  vendorName: string;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  passwordResetRequestedAt: string | null;
  approvedAt: string | null;
  approverName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type VendorInfo = {
  id: number;
  name: string;
  accessToken: string;
};

type Props = {
  bbsData: BbsAccountData[];
  vendorData: VendorAccountData[];
  vendorList: VendorInfo[];
  staffId: number;
  bbsPendingCount: number;
  vendorPendingCount: number;
};

export function PartnerAccountsTabs({
  bbsData,
  vendorData,
  vendorList,
  staffId,
  bbsPendingCount,
  vendorPendingCount,
}: Props) {
  return (
    <Tabs defaultValue="bbs">
      <TabsList>
        <TabsTrigger value="bbs" className="gap-2">
          BBS社アカウント管理
          {bbsPendingCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
              {bbsPendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="vendor" className="gap-2">
          ベンダーアカウント管理
          {vendorPendingCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
              {vendorPendingCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bbs" className="mt-4">
        <BbsTab data={bbsData} staffId={staffId} />
      </TabsContent>
      <TabsContent value="vendor" className="mt-4">
        <VendorTab data={vendorData} vendorList={vendorList} staffId={staffId} />
      </TabsContent>
    </Tabs>
  );
}
