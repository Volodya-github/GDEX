import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const MAX_LEVEL_ID_LENGTH = 12;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limit = checkRateLimit(request, "check", { windowMs: 60_000, max: 30 });
  if (!limit.ok) return rateLimitResponse(limit);

  const levelId = request.nextUrl.searchParams.get("id");

  if (!levelId || !/^\d+$/.test(levelId) || levelId.length > MAX_LEVEL_ID_LENGTH) {
    return NextResponse.json({ error: "Invalid level ID" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://gdbrowser.com/api/level/${levelId}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json({
        found: false,
        levelId,
        error: "Level not found",
      });
    }

    const data = await response.json();

    if (data.error || data === -1) {
      return NextResponse.json({
        found: false,
        levelId,
        error: "Level not found",
      });
    }

    return NextResponse.json({
      found: true,
      levelId,
      info: {
        id: data.id || levelId,
        name: data.name || "Unknown",
        author: data.author || data.creator || "Unknown",
        playerID: data.playerID,
        accountID: data.accountID,
        difficulty: data.difficulty || "N/A",
        stars: data.stars ?? data.orbs ?? 0,
        downloads: data.downloads ?? 0,
        likes: data.likes ?? data.rating ?? 0,
        length: data.length || "Unknown",
        song: data.songName || data.song,
        songID: data.songID,
        customSongID: data.customSong,
        songLink: data.songLink,
        officialSong:
          typeof data.officialSong === "number" ? data.officialSong : undefined,
        coins: data.coins ?? data.userCoins ?? 0,
        verifiedCoins: data.verifiedCoins ?? false,
        featured: data.featured ?? false,
        epic: data.epic ?? false,
        gameVersion: data.gameVersion || "Unknown",
        objects: data.objects,
        description: data.description,
        uploadDate: data.uploaded,
        updateDate: data.updated,
        copiedID: data.copiedID,
        twoPlayer: data.twoPlayer,
        ldm: data.ldm,
      },
    });
  } catch {
    return NextResponse.json({
      found: false,
      levelId,
      error: "Failed to check level",
    });
  }
}
