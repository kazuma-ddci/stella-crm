import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const shortUrl = await prisma.shortUrl.findUnique({
      where: { shortCode: code },
    });

    if (!shortUrl) {
      return NextResponse.json(
        { error: "Short URL not found" },
        { status: 404 }
      );
    }

    return NextResponse.redirect(shortUrl.originalUrl, 302);
  } catch (error) {
    console.error("Short URL redirect error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
