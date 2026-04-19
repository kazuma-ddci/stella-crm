"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineFriendsTable } from "./line-friends-table";
import { UserInfoTable } from "./user-info-table";
import { AsTable } from "./as-table";
import type { AgencyTreeNode } from "@/lib/slp/company-resolution";

type AsRow = {
  id: number;
  name: string;
  lineFriendId: number | null;
  lineFriendLabel: string | null;
  staffId: number | null;
  staffName: string | null;
};

type Props = {
  data: Record<string, unknown>[];
  userData: {
    id: number;
    displayNo: number;
    snsname: string | null;
    referrer: string;
    agencyPrimary: string;
    agencyTrees: AgencyTreeNode[];
    agencyClickable: boolean;
    agencyWarning: boolean;
    memberStatus: string;
  }[];
  lastSyncAt: string | null;
  asData: AsRow[];
  lineFriendOptions: { id: number; label: string }[];
  staffOptions: { id: number; name: string }[];
};

export function LineFriendsPageTabs({
  data,
  userData,
  lastSyncAt,
  asData,
  lineFriendOptions,
  staffOptions,
}: Props) {
  return (
    <Tabs defaultValue="line-friends">
      <TabsList>
        <TabsTrigger value="line-friends">公式LINE友達情報</TabsTrigger>
        <TabsTrigger value="user-info">ユーザー情報</TabsTrigger>
        <TabsTrigger value="as">AS管理</TabsTrigger>
      </TabsList>
      <TabsContent value="line-friends">
        <LineFriendsTable data={data} lastSyncAt={lastSyncAt} />
      </TabsContent>
      <TabsContent value="user-info">
        <UserInfoTable data={userData} />
      </TabsContent>
      <TabsContent value="as">
        <AsTable
          data={asData}
          lineFriendOptions={lineFriendOptions}
          staffOptions={staffOptions}
        />
      </TabsContent>
    </Tabs>
  );
}
