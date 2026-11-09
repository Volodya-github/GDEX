
import { NextRequest, NextResponse } from "next/server";
import {
  GD_SERVERS,
  GD_CLIENT_SECRET,
  OBJ_KEYS,
  HEADER_KEYS,
} from "@/lib/constants";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import zlib from "node:zlib";

export const runtime = "nodejs";

const MAX_LEVEL_ID_LENGTH = 12;
const MAX_RAW_BYTES = 10 * 1024 * 1024;
const MAX_DECODED_BYTES = 64 * 1024 * 1024;

type GDObject = Record<string, string | number>;

function parseKV(raw: string, separator = ":"): Record<string, string> {
  const parts = raw.split(separator);
  const result: Record<string, string> = {};

  for (let i = 0; i + 1 < parts.length; i += 2) {
    result[parts[i]] = parts[i + 1];
  }

  return result;
}

function parseSongKV(raw: string): Record<string, string> {
  return parseKV(raw, "~|~");
}

function isEditorData(data: string): boolean {
  return (
    data.length > 0 &&
    data.includes(",") &&
    data.includes(";")
  );
}

function decodeLevelData(raw: string): string {
  let encoded = raw
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s/g, "");

  encoded += "=".repeat((4 - (encoded.length % 4)) % 4);

  const buffer = Buffer.from(encoded, "base64");

  if (buffer.length > MAX_RAW_BYTES) {
    throw new Error("Level data exceeds size limit");
  }

  for (const windowBits of [47, 15, -15, 31]) {
    try {
      const output = zlib.inflateSync(buffer, {
        windowBits,
        maxOutputLength: MAX_DECODED_BYTES,
      });

      return output.toString("utf8");
    } catch {
      // Try another compression format.
    }
  }

  const fallback = buffer.toString("utf8");

  if (!isEditorData(fallback)) {
    throw new Error("Invalid compressed level data");
  }

  return fallback;
}

function parseObjects(levelData: string): {
  header: Record<string, string>;
  objects: GDObject[];
  object_count: number;
} {
  const parts = levelData.split(";");
  const header: Record<string, string> = {};

  const headerParts = (parts[0] || "").split(",");

  for (let i = 0; i + 1 < headerParts.length; i += 2) {
    const key = HEADER_KEYS[headerParts[i]] || headerParts[i];
    header[key] = headerParts[i + 1];
  }

  const objects: GDObject[] = [];

  for (let i = 1; i < parts.length; i++) {
    const rawObject = parts[i].trim();
    if (!rawObject) continue;

    const objectParts = rawObject.split(",");
    const object: GDObject = {};

    for (let j = 0; j + 1 < objectParts.length; j += 2) {
      const key = OBJ_KEYS[objectParts[j]] || `p${objectParts[j]}`;
      const rawValue = objectParts[j + 1];

      const numericValue = Number(rawValue);
      object[key] =
        rawValue.trim() !== "" && Number.isFinite(numericValue)
          ? numericValue
          : rawValue;
    }

    if (Object.keys(object).length > 0) {
      objects.push(object);
    }
  }

  objects.sort((a, b) => {
    const ax = typeof a.x === "number" ? a.x : 0;
    const bx = typeof b.x === "number" ? b.x : 0;
    return ax - bx;
  });

  return {
    header,
    objects,
    object_count: objects.length,
  };
}

function computeStats(objects: GDObject[]) {
  const xs = objects
    .map((object) => object.x)
    .filter((value): value is number => typeof value === "number");

  const ys = objects
    .map((object) => object.y)
    .filter((value): value is number => typeof value === "number");

  const ids = objects
    .map((object) => object.obj_id)
    .filter((value): value is number => typeof value === "number");

  const frequencies = new Map<number, number>();

  for (const id of ids) {
    frequencies.set(id, (frequencies.get(id) || 0) + 1);
  }

  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 0;
  const yMin = ys.length ? Math.min(...ys) : 0;
  const yMax = ys.length ? Math.max(...ys) : 0;

  return {
    total: objects.length,
    unique_types: new Set(ids).size,
    x_min: xMin,
    x_max: xMax,
    y_min: yMin,
    y_max: yMax,
    width: xMax - xMin,
    height: yMax - yMin,
    top_objects: [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25),
    with_rotation: objects.filter(
      (object) =>
        typeof object.rotation === "number" &&
        object.rotation !== 0
    ).length,
    with_scale: objects.filter(
      (object) => "scale" in object
    ).length,
    with_groups: objects.filter(
      (object) => "groups" in object
    ).length,
  };
}

function validServerResponse(text: string, levelId: string): boolean {
  if (!text || text.startsWith("-1")) return false;

  const mainPart = text.split("#")[0];
  const data = parseKV(mainPart);

  return (
    data["1"] === levelId &&
    typeof data["4"] === "string" &&
    data["4"].length > 0
  );
}

async function tryServer(
  server: (typeof GD_SERVERS)[number],
  levelId: string
): Promise<string | null> {
  const formData = new URLSearchParams({
    levelID: levelId,
    secret: GD_CLIENT_SECRET,
    gameVersion: "22",
    binaryVersion: "35",
    gdw: "0",
  });

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "",
      },
      body: formData.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(
        `[GDEX] ${server.id}: HTTP ${response.status}`
      );
      return null;
    }

    const text = await response.text();

    if (!validServerResponse(text, levelId)) {
      console.warn(
        `[GDEX] ${server.id}: Invalid level response`
      );
      return null;
    }

    return text;
  } catch (error) {
    console.warn(
      `[GDEX] ${server.id}:`,
      error instanceof Error ? error.message : "Request failed"
    );
    return null;
  }
}

interface DownloadBody {
  levelId: string;
  serverId?: string;
  levelData?: string;
}

function parseBody(body: unknown): DownloadBody | null {
  if (!body || typeof body !== "object") return null;

  const input = body as Record<string, unknown>;

  const levelId =
    typeof input.levelId === "string"
      ? input.levelId
      : String(input.levelId ?? "");

  if (
    !/^\d+$/.test(levelId) ||
    levelId.length > MAX_LEVEL_ID_LENGTH
  ) {
    return null;
  }

  const serverId =
    typeof input.serverId === "string" &&
    GD_SERVERS.some((server) => server.id === input.serverId)
      ? input.serverId
      : undefined;

  if (
    input.levelData !== undefined &&
    typeof input.levelData !== "string"
  ) {
    return null;
  }

  return {
    levelId,
    serverId,
    levelData: input.levelData as string | undefined,
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const limit = checkRateLimit(request, "download", {
    windowMs: 60_000,
    max: 10,
  });

  if (!limit.ok) {
    return rateLimitResponse(limit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = parseBody(body);

  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid level ID or level data" },
      { status: 400 }
    );
  }

  const { levelId, serverId, levelData } = parsed;

  let decodedData = "";
  let rawResponse = "";
  let usedServer = "";
  let kv: Record<string, string> = {};
  let songInfo: Record<string, string> | null = null;

  if (levelData !== undefined) {
    if (
      Buffer.byteLength(levelData, "utf8") > MAX_DECODED_BYTES ||
      !isEditorData(levelData)
    ) {
      return NextResponse.json(
        { error: "Imported data is not a valid GD editor string" },
        { status: 400 }
      );
    }

    decodedData = levelData;
    usedServer = "Local import";
  } else {
    const downloadServers = GD_SERVERS.filter(
      (server) => server.type !== "api"
    );

    const orderedServers = serverId
      ? [
          ...downloadServers.filter(
            (server) => server.id === serverId
          ),
          ...downloadServers.filter(
            (server) => server.id !== serverId
          ),
        ]
      : downloadServers;

    if (orderedServers.length === 0) {
      return NextResponse.json(
        { error: "No download server configured" },
        { status: 503 }
      );
    }

    for (const server of orderedServers) {
      const response = await tryServer(server, levelId);

      if (response) {
        rawResponse = response;
        usedServer = server.name;
        break;
      }
    }

    if (!rawResponse) {
      return NextResponse.json(
        {
          error:
            "Level download servers are unavailable or rejected the request.",
        },
        { status: 502 }
      );
    }

    const parts = rawResponse.split("#");
    kv = parseKV(parts[0]);

    const encodedLevel = kv["4"];

    if (!encodedLevel) {
      return NextResponse.json(
        { error: "Level response contains no level data" },
        { status: 502 }
      );
    }

    try {
      decodedData = decodeLevelData(encodedLevel);
    } catch {
      return NextResponse.json(
        { error: "Unable to decode downloaded level data" },
        { status: 502 }
      );
    }

    for (const part of parts) {
      if (part.includes("~|~")) {
        songInfo = parseSongKV(part);
        break;
      }
    }
  }

  if (!isEditorData(decodedData)) {
    return NextResponse.json(
      { error: "Invalid decoded level data" },
      { status: 422 }
    );
  }

  const parsedObjects = parseObjects(decodedData);
  const stats = computeStats(parsedObjects.objects);

  let levelInfo: Record<string, unknown> | null = null;

  if (levelData === undefined) {
    try {
      const response = await fetch(
        `https://gdbrowser.com/api/level/${levelId}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }
      );

      if (response.ok) {
        const data: unknown = await response.json();

        if (
          typeof data === "object" &&
          data !== null &&
          !("error" in data)
        ) {
          levelInfo = data as Record<string, unknown>;
        }
      }
    } catch {
      // Metadata is optional.
    }
  }

  return NextResponse.json({
    success: true,
    levelId,
    server: usedServer,
    info: levelInfo || {
      id: levelId,
      name: kv["2"] || `Level_${levelId}`,
      author: "Unknown",
    },
    levelData: decodedData,
    parsed: {
      header: parsedObjects.header,
      object_count: parsedObjects.object_count,
      objects_preview: parsedObjects.objects.slice(0, 100),
    },
    stats,
    songInfo: songInfo
      ? {
          id: songInfo["1"],
          name: songInfo["2"],
          artistID: songInfo["3"],
          artistName: songInfo["4"],
          size: songInfo["5"],
          url: songInfo["10"] || null,
        }
      : null,
    rawSize: rawResponse.length,
    decodedSize: Buffer.byteLength(decodedData, "utf8"),
  });
}
