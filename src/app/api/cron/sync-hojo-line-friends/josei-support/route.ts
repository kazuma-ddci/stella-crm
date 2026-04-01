import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { syncVendorIdFromFree1 } from "@/lib/hojo/sync-vendor-id";

interface FriendData {
  snsname?: string | null;
  password?: string | null;
  emailLine?: string | null;
  emailRenkei?: string | null;
  emailLine2?: string | null;
  email?: string | null;
  uid: string;
  friendAddedDate?: string | null;
  activeStatus?: string | null;
  lastActivityDate?: string | null;
  sei?: string | null;
  mei?: string | null;
  nickname?: string | null;
  phone?: string | null;
  postcode?: string | null;
  address1?: string | null;
  address2?: string | null;
  address3?: string | null;
  nenrei?: string | null;
  nendai?: string | null;
  seibetu?: string | null;
  free1?: string | null;
  free2?: string | null;
  free3?: string | null;
  free4?: string | null;
  free5?: string | null;
  free6?: string | null;
  scenarioPos1?: string | null;
  scenarioPos2?: string | null;
  scenarioPos3?: string | null;
  scenarioPos4?: string | null;
  scenarioPos5?: string | null;
}

function toStringOrNull(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const friends: FriendData[] = body.friends;

    if (!Array.isArray(friends)) {
      return NextResponse.json({ error: "friends array is required" }, { status: 400 });
    }

    const existingRecords = await prisma.hojoLineFriendJoseiSupport.findMany({
      where: { deletedAt: null },
    });
    const existingMap = new Map(existingRecords.map((r) => [r.uid, r]));

    let created = 0;
    let updated = 0;
    const processedUids = new Set<string>();

    for (let i = 0; i < friends.length; i++) {
      const f = friends[i];
      if (!f.uid) continue;

      processedUids.add(f.uid);

      const data = {
        snsname: toStringOrNull(f.snsname),
        password: toStringOrNull(f.password),
        emailLine: toStringOrNull(f.emailLine),
        emailRenkei: toStringOrNull(f.emailRenkei),
        emailLine2: toStringOrNull(f.emailLine2),
        email: toStringOrNull(f.email),
        friendAddedDate: f.friendAddedDate ? new Date(f.friendAddedDate) : null,
        activeStatus: toStringOrNull(f.activeStatus),
        lastActivityDate: toStringOrNull(f.lastActivityDate),
        sei: toStringOrNull(f.sei),
        mei: toStringOrNull(f.mei),
        nickname: toStringOrNull(f.nickname),
        phone: toStringOrNull(f.phone),
        postcode: toStringOrNull(f.postcode),
        address1: toStringOrNull(f.address1),
        address2: toStringOrNull(f.address2),
        address3: toStringOrNull(f.address3),
        nenrei: toStringOrNull(f.nenrei),
        nendai: toStringOrNull(f.nendai),
        seibetu: toStringOrNull(f.seibetu),
        free1: toStringOrNull(f.free1),
        free2: toStringOrNull(f.free2),
        free3: toStringOrNull(f.free3),
        free4: toStringOrNull(f.free4),
        free5: toStringOrNull(f.free5),
        free6: toStringOrNull(f.free6),
        scenarioPos1: toStringOrNull(f.scenarioPos1),
        scenarioPos2: toStringOrNull(f.scenarioPos2),
        scenarioPos3: toStringOrNull(f.scenarioPos3),
        scenarioPos4: toStringOrNull(f.scenarioPos4),
        scenarioPos5: toStringOrNull(f.scenarioPos5),
      };

      const existing = existingMap.get(f.uid);
      if (existing) {
        await prisma.hojoLineFriendJoseiSupport.update({ where: { uid: f.uid }, data });
        updated++;
      } else {
        await prisma.hojoLineFriendJoseiSupport.create({ data: { uid: f.uid, ...data } });
        created++;
      }
    }

    const webhookOnlyCount = existingRecords.filter((r) => !processedUids.has(r.uid)).length;
    const total = friends.length + webhookOnlyCount;

    // free1が変更された可能性があるので、vendorIdを全件同期（初回のみ自動設定）
    const { updatedCount: vendorIdSynced } = await syncVendorIdFromFree1();
    console.log(`[Cron] sync-hojo-josei-support: created=${created}, updated=${updated}, total=${total}, vendorIdSynced=${vendorIdSynced}`);
    return NextResponse.json({ success: true, created, updated, total });
  } catch (err) {
    console.error("[Cron] sync-hojo-josei-support failed:", err);
    await logAutomationError({
      source: "cron/sync-hojo-line-friends/josei-support",
      message: err instanceof Error ? err.message : "不明なエラー",
      detail: { error: String(err) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
