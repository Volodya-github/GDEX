import { NextRequest, NextResponse } from "next/server";
import { GD_SERVERS, GD_CLIENT_SECRET, OBJ_KEYS, HEADER_KEYS } from "@/lib/constants";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import zlib from "zlib";

const MAX_LEVEL_ID_LENGTH = 12;
const MAX_RAW_BYTES = 10 * 1024 * 1024;
const MAX_DECODED_BYTES = 64 * 1024 * 1024;

function decodeLevelData(raw: string): string {
  let s = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  s += "=".repeat((4 - (s.length % 4)) % 4);

  const buffer = Buffer.from(s, "base64");
  if (buffer.length > MAX_RAW_BYTES) {
    throw new Error("Level data exceeds size limit");
  }

  for (const windowBits of [47, 15, -15, 31]) {
    try {
      const decompressed = zlib.inflateSync(buffer, {
        windowBits,
        maxOutputLength: MAX_DECODED_BYTES,
      });
      return decompressed.toString("utf-8");
    } catch {
      continue;
    }
  }

  return buffer.toString("utf-8");
}

function parseKV(raw: string, separator: string = ":"): Record<string, string> {
  const parts = raw.split(separator);
  const result: Record<string, string> = {};
  for (let i = 0; i < parts.length - 1; i += 2) {
    result[parts[i]] = parts[i + 1];
  }
  return result;
}

function parseSongKV(raw: string): Record<string, string> {
  const parts = raw.split("~|~");
  const result: Record<string, string> = {};
  for (let i = 0; i < parts.length - 1; i += 2) {
    result[parts[i]] = parts[i + 1];
  }
  return result;
}

function parseObjects(levelData: string): {
  header: Record<string, string>;
  objects: Record<string, string | number>[];
  object_count: number;
} {
  const parts = levelData.split(";");

  const header: Record<string, string> = {};
  if (parts.length > 0) {
    const hp = parts[0].split(",");
    for (let i = 0; i < hp.length - 1; i += 2) {
      const key = HEADER_KEYS[hp[i]] || hp[i];
      header[key] = hp[i + 1];
    }
  }

  const objects: Record<string, string | number>[] = [];
  for (let i = 1; i < parts.length; i++) {
    const objStr = parts[i].trim();
    if (!objStr) continue;

    const op = objStr.split(",");
    const obj: Record<string, string | number> = {};

    for (let j = 0; j < op.length - 1; j += 2) {
      const key = OBJ_KEYS[op[j]] || `p${op[j]}`;
      let val: string | number = op[j + 1];

      if (val.includes(".")) {
        const floatVal = parseFloat(val);
        if (!isNaN(floatVal)) val = floatVal;
      } else {
        const intVal = parseInt(val, 10);
        if (!isNaN(intVal)) val = intVal;
      }

      obj[key] = val;
    }

    if (Object.keys(obj).length > 0) {
      objects.push(obj);
    }
  }

  objects.sort((a, b) => {
