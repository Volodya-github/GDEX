
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url =
    "https://www.boomlings.com/database/downloadGJLevel22.php";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "",
      },
      body: new URLSearchParams({
        levelID: "128",
        secret: "Wmfd2893gb7",
        gameVersion: "22",
        binaryVersion: "51",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const body = await response.text();

    return NextResponse.json({
      status: response.status,
      contentType: response.headers.get("content-type"),
      validLevelResponse:
        response.ok &&
        body.startsWith("1:128:"),
      responsePreview: body.slice(0, 120),
    });
  } catch (error) {
    return NextResponse.json({
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    }, { status: 502 });
  }
}
