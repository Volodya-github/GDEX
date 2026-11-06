
import { NextRequest, NextResponse } from "next/server";
import { GD_SERVERS, GD_CLIENT_SECRET } from "@/lib/constants";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import type { ServerStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TEST_LEVEL_ID = "128";

function isValidGDLevel(text: string): boolean {
  // GD's download endpoint returns colon-separated key/value pairs.
  // Key 1 = level ID; key 4 = encoded level data.
  const parts = text.split(":");
  const fields = new Map<string, string>();

  for (let i = 0; i + 1 < parts.length; i += 2) {
    fields.set(parts[i], parts[i + 1]);
  }

  return (
    fields.get("1") === TEST_LEVEL_ID &&
    Boolean(fields.get("4"))
  );
}

async function checkServer(
  server: (typeof GD_SERVERS)[number]
): Promise<ServerStatus> {
  const startTime = Date.now();

  const result = (online: boolean): ServerStatus => ({
    id: server.id,
    name: server.name,
    status: online ? "online" : "offline",
    latency: Date.now() - startTime,
  });

  try {
    if (server.type === "api") {
      const response = await fetch(
        `${server.url}${TEST_LEVEL_ID}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        console.warn(
          `[GDEX] ${server.id}: HTTP ${response.status}`
        );
        return result(false);
      }

      const data: unknown = await response.json();

      const valid =
        typeof data === "object" &&
        data !== null &&
        "id" in data &&
        String(data.id) === TEST_LEVEL_ID &&
        "name" in data &&
        typeof data.name === "string";

      return result(valid);
    }

    const formData = new URLSearchParams({
      levelID: TEST_LEVEL_ID,
      secret: GD_CLIENT_SECRET,
      gameVersion: "22",
      binaryVersion: "35",
    });

    const response = await fetch(server.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "",
      },
      body: formData.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(
        `[GDEX] ${server.id}: HTTP ${response.status}`
      );
      return result(false);
    }

    const text = await response.text();
    const valid = isValidGDLevel(text);

    if (!valid) {
      console.warn(
        `[GDEX] ${server.id}: Invalid GD level response`
      );
    }

    return result(valid);
  } catch (error) {
    console.warn(
      `[GDEX] ${server.id}: Request failed`,
      error instanceof Error ? error.message : "Unknown error"
    );

    return result(false);
  }
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const limit = checkRateLimit(request, "servers", {
    windowMs: 60_000,
    max: 12,
  });

  if (!limit.ok) {
    return rateLimitResponse(limit);
  }

  try {
    const results = await Promise.all(
      GD_SERVERS.map(checkServer)
    );

    return NextResponse.json({
      success: true,
      servers: results,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to check servers" },
      { status: 500 }
    );
  }
}
