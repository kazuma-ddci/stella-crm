"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinkRequestsTab } from "./link-requests-tab";
import type { LinkRequestRow } from "./link-resolve-modal";

type Props = {
  membersTable: React.ReactNode;
  linkRequests: LinkRequestRow[];
};

export function MembersTabs({ membersTable, linkRequests }: Props) {
  const needsActionCount = linkRequests.filter(
    (r) => r.status === "pending_staff_review" || r.status === "email_not_found"
  ).length;

  return (
    <Tabs defaultValue="members" className="w-full">
      <TabsList>
        <TabsTrigger value="members">組合員一覧</TabsTrigger>
        <TabsTrigger value="link-requests">
          LINE紐付け申請
          {needsActionCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold">
              {needsActionCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="members" className="mt-4">
        {membersTable}
      </TabsContent>
      <TabsContent value="link-requests" className="mt-4">
        <LinkRequestsTab requests={linkRequests} />
      </TabsContent>
    </Tabs>
  );
}
