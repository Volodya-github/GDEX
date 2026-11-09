    if (Buffer.byteLength(decodedData, "utf8") > MAX_DECODED_BYTES ||
        !decodedData.includes(",") || !decodedData.includes(";")) {
      return NextResponse.json(
        { error: "Imported data is not a valid GD editor string" },
        { status: 400 }
      );
    }
  } else {
    try {
      const metaResponse = await fetch(
        `https://gdbrowser.com/api/level/${levelId}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (metaResponse.ok) {
        const data = await metaResponse.json();
        if (data && !data.error) levelInfo = data;
      }
    } catch {
      // Metadata is optional; downloads can succeed without it.
    }

    const downloadServers = GD_SERVERS.filter((s) => s.type !== "api");
    const orderedServers = serverId
      ? [
          ...downloadServers.filter((s) => s.id === serverId),
          ...downloadServers.filter((s) => s.id !== serverId),
        ]
      : downloadServers;

    if (orderedServers.length === 0) {
      return NextResponse.json({ error: "No download server configured" }, { status: 503 });
    }

    for (const srv of orderedServers) {
      const text = await tryServer(srv, levelId);
      if (text) {
        rawResponse = text;
        usedServer = srv.name;
        break;
      }
    }

    if (!rawResponse) {
      return NextResponse.json(
        { error: "No upstream server returned level data. This does not mean the level is missing." },
        { status: 502 }
      );
    }

    parts = rawResponse.split("#");
    kv = parseKV(parts[0]);
    const levelString = kv["4"];
    if (!levelString || kv["1"] !== levelId) {
      return NextResponse.json({ error: "Invalid level response from upstream" }, { status: 502 });
    }
    try {
      decodedData = decodeLevelData(levelString);
    } catch {
      return NextResponse.json({ error: "Invalid or oversized upstream level data" }, { status: 502 });
    }
  }

  const objectsParsed = parseObjects(decodedData);
  const stats = computeStats(objectsParsed.objects);

  let songInfo = null;
  for (const part of parts) {
    if (part.includes("~|~")) {
      songInfo = parseSongKV(part);
      break;
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
      header: objectsParsed.header,
      object_count: objectsParsed.object_count,
      objects_preview: objectsParsed.objects.slice(0, 100),
    },
    stats,
    songInfo: songInfo
      ? {
          id: songInfo["1"],
          name: songInfo["2"],
          artistID: songInfo["3"],
          artistName: songInfo["4"],
          size: songInfo["5"],
          url: songInfo["10"] ? decodeURIComponent(songInfo["10"]) : null,
        }
      : null,
    rawSize: isImport ? Buffer.byteLength(levelData!, "utf8") : rawResponse.length,
    decodedSize: decodedData.length,
  });
}
