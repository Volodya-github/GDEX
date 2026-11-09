"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, ProgressBar, Tabs } from "@/components/ui";
import {
  AlertCircleIcon, BarChartIcon, BookIcon, CheckCircleIcon, CubeIcon, DownloadIcon,
  ExcelIcon, FileIcon, GamepadIcon, GDCoinIcon, GDDiamondIcon, GDDownloadIcon,
  GDLikeIcon, GDStarIcon, GitHubIcon, HeartIcon, JsonIcon, MoonIcon, MusicIcon,
  QueueIcon, SearchIcon, ServerIcon, ShieldIcon, SparkleIcon, SunIcon, TableIcon,
  UserIcon
} from "@/components/icons";
import { Footer } from "@/components/Footer";
import { ServersStatus } from "@/components/ServersStatus";
import { DownloadQueue } from "@/components/DownloadQueue";
import { useTheme } from "@/components/ThemeProvider";
import { DifficultyIcon } from "@/components/DifficultyIcon";
import type { DownloadedFile, LevelInfo } from "@/lib/types";
import { EXPORT_FORMATS, GITHUB_URL, OFFICIAL_SONGS, type ExportFormat } from "@/lib/constants";
import { downloadFile, generateFile, makeSafeName, type DownloadResponse } from "@/lib/exporters";
import { useDownloadQueue } from "@/lib/hooks/useDownloadQueue";
import { formatCompact, useCountUp } from "@/lib/hooks/useCountUp";

const FORMAT_ICONS: Record<ExportFormat, React.ReactElement> = {
  gmd: <FileIcon className="w-4 h-4" />,
  json: <JsonIcon className="w-4 h-4" />,
  csv: <TableIcon className="w-4 h-4" />,
  xls: <ExcelIcon className="w-4 h-4" />,
  meta: <FileIcon className="w-4 h-4" />,
  mp3: <MusicIcon className="w-4 h-4" />,
};

const TABS = [
  { id: "single", label: "Download", icon: <DownloadIcon className="w-4 h-4" /> },
  { id: "batch", label: "Batch", icon: <QueueIcon className="w-4 h-4" /> },
  { id: "guide", label: "Guide", icon: <BookIcon className="w-4 h-4" /> },
  { id: "support", label: "Support", icon: <HeartIcon className="w-4 h-4" /> },
];

interface LevelStatsProps {
  info: LevelInfo;
}

function LevelStats({ info }: LevelStatsProps): React.ReactElement {
  const stars = useCountUp(info.stars ?? 0);
  const likes = useCountUp(info.likes ?? 0);
  const downloads = useCountUp(info.downloads ?? 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
      <div className="p-2 bg-[var(--bg-input)] rounded-xl text-center animate-scaleIn stagger-1 min-w-0">
        <div className="flex items-center justify-center gap-1 text-base sm:text-lg gd-title text-yellow-400">
          <GDStarIcon className="w-4 h-4 flex-shrink-0 animate-gd-bounce-in" />
          <span className="truncate">{stars}</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">Stars</div>
      </div>

      <div className="p-2 bg-[var(--bg-input)] rounded-xl text-center animate-scaleIn stagger-2 min-w-0">
        <div className="flex items-center justify-center gap-1 text-base sm:text-lg gd-title text-pink-400">
          <GDLikeIcon className="w-4 h-4 flex-shrink-0 animate-gd-bounce-in" />
          <span className="truncate">{formatCompact(likes)}</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">Likes</div>
      </div>

      <div className="p-2 bg-[var(--bg-input)] rounded-xl text-center animate-scaleIn stagger-3 min-w-0">
        <div className="flex items-center justify-center gap-1 text-base sm:text-lg gd-title text-[var(--accent)]">
          <GDDownloadIcon className="w-4 h-4 flex-shrink-0 animate-gd-bounce-in" />
          <span className="truncate">{formatCompact(downloads)}</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">Downloads</div>
      </div>

      <div className="p-2 bg-[var(--bg-input)] rounded-xl text-center animate-scaleIn stagger-4 min-w-0">
        <DifficultyIcon difficulty={info.difficulty} className="w-8 h-8 mx-auto" />
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">{info.difficulty}</div>
      </div>
    </div>
  );
}

export default function Home(): React.ReactElement {
  const { theme, toggleTheme } = useTheme();

  const [levelId, setLevelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [errorShake, setErrorShake] = useState(0);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFile[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("boomlings");
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>(["gmd", "json"]);

  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedFiles, setImportedFiles] = useState<DownloadedFile[]>([]);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  const queue = useDownloadQueue(selectedServer);

  const flagError = useCallback((msg: string): void => {
    setError(msg);
    setErrorShake((k) => k + 1);
  }, []);

  const checkLevel = useCallback(async (): Promise<void> => {
    if (!levelId.trim()) return;

    setChecking(true);
    setError("");
    setLevelInfo(null);
    setDownloadedFiles([]);

    try {
      const response = await fetch(`/api/check?id=${encodeURIComponent(levelId.trim())}`);
      const data = await response.json();
      if (data.found) {
        setLevelInfo(data.info);
      } else {
        flagError(data.error || "Level not found");
      }
    } catch {
      flagError("Failed to check level");
    } finally {
      setChecking(false);
    }
  }, [levelId, flagError]);

  const downloadLevel = useCallback(async (): Promise<void> => {
    if (!levelId.trim() || exportFormats.length === 0) return;

    setLoading(true);
    setError("");
    setDownloadProgress(0);
    setDownloadedFiles([]);

    try {
      setDownloadProgress(20);

      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: levelId.trim(), serverId: selectedServer }),
      });

      setDownloadProgress(60);

      const data: DownloadResponse & { error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Download failed");
      }

      setDownloadProgress(80);

      const safeName = makeSafeName(data.info?.name, levelId.trim());
      const files: DownloadedFile[] = [];
      for (const format of exportFormats) {
        const file = await generateFile(format, data, safeName);
        if (file) files.push(file);
      }

      setDownloadedFiles(files);
      setDownloadProgress(100);

      if (!levelInfo && data.info) setLevelInfo(data.info);
    } catch (err) {
      flagError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [levelId, selectedServer, exportFormats, levelInfo, flagError]);

  const importLevel = useCallback(async (): Promise<void> => {
    if (!importData.trim()) {
      setImportError("Paste GD editor data first.");
      return;
    }
    if (exportFormats.length === 0) {
      setImportError("Select at least one export format.");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportSuccess("");
    setImportedFiles([]);

    try {
      const importId = /^\d{1,12}$/.test(levelId.trim()) ? levelId.trim() : "0";
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId: importId, levelData: importData.trim() }),
      });

      const data: DownloadResponse & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");

      const safeName = makeSafeName(data.info?.name, importId);
      const files: DownloadedFile[] = [];
      for (const format of exportFormats) {
        const file = await generateFile(format, data, safeName);
        if (file) files.push(file);
      }
      if (files.length === 0) throw new Error("No files could be generated.");

      setImportedFiles(files);
      setImportSuccess(`Imported ${data.parsed?.object_count ?? 0} objects successfully!`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [importData, levelId, exportFormats]);

  const toggleFormat = useCallback((format: ExportFormat): void => {
    setExportFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  }, []);

  return (
    <div className="min-h-screen flex flex-col transition-theme">
      <header className="border-b-2 border-[var(--border)] bg-[var(--bg-secondary)]/60 backdrop-blur-md sticky top-0 z-50">
        <div
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-60"
        />
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Image
                src="/logo.svg"
                alt="GDEX Logo"
                width={80}
                height={80}
                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0"
                priority
              />
              <div className="hidden sm:flex flex-col leading-tight min-w-0">
                <span className="gd-title text-[11px] uppercase tracking-widest text-[var(--accent)]">
                  Geometry Dash
                </span>
                <span className="text-sm text-[var(--text-secondary)] truncate">
                  Level Extractor
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                title="View source on GitHub"
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border border-transparent hover:border-[var(--border)]"
              >
                <GitHubIcon className="w-5 h-5" />
              </a>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border border-transparent hover:border-[var(--border)]"
                aria-label="Toggle theme"
                suppressHydrationWarning
              >
                {theme === "dark" ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        <Tabs tabs={TABS} defaultTab="single">
          {(activeTab) => (
            <div>
              {activeTab === "single" && (
                <div className="grid lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 space-y-5">
                    <Card className="animate-fadeInUp">
                      <CardHeader icon={<SearchIcon className="w-5 h-5" />}>
                        <CardTitle>Find Level</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div key={`row-${errorShake}`} className={`flex gap-3 ${error ? "animate-shake" : ""}`}>
                          <Input
                            placeholder="Enter Level ID (e.g. 128, 1234567...)"
                            value={levelId}
                            onChange={(e) => setLevelId(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && checkLevel()}
                            className="flex-1"
                          />
                          <Button
                            onClick={checkLevel}
                            loading={checking}
                            disabled={!levelId.trim()}
                            variant="secondary"
                            icon={<SearchIcon className="w-4 h-4" />}
                          >
                            Check
                          </Button>
                        </div>

                        {error && (
                          <div
                            key={`err-${errorShake}`}
                            className="mt-3 p-3 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl flex items-center gap-2 text-[var(--error)] text-sm animate-gd-slide-up"
                          >
                            <AlertCircleIcon className="w-4 h-4 flex-shrink-0" />
                            {error}
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-[var(--border)]">
                          <div className="text-sm text-[var(--text-muted)] mb-2">Export Formats:</div>
                          <div className="flex flex-wrap gap-2">
                            {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((format) => (
                              <button
                                key={format}
                                onClick={() => toggleFormat(format)}
                                className={`
                                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                  transition-all duration-200 border-2 animate-scaleIn hover:scale-[1.03]
                                  ${
                                    exportFormats.includes(format)
                                      ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/60 shadow-[inset_0_0_8px_var(--accent-glow)]"
                                      : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]/40"
                                  }
                                `}
                              >
                                {FORMAT_ICONS[format]}
                                {EXPORT_FORMATS[format].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="animate-fadeInUp">
                      <CardHeader icon={<FileIcon className="w-5 h-5" />}>
                        <CardTitle>Import Level</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-[var(--text-muted)] mb-3">
                          Paste Geometry Dash editor data to export it without contacting online GD servers.
                        </p>
                        <textarea
                          value={importData}
                          onChange={(e) => {
                            setImportData(e.target.value);
                            setImportedFiles([]);
                            setImportSuccess("");
                            setImportError("");
                          }}
                          placeholder="kA2,0,kA3,0;1,1,2,150,3,150;"
                          rows={5}
                          maxLength={10000000}
                          className="w-full p-3 rounded-xl bg-[var(--bg-input)] border-2 border-[var(--border)] text-[var(--text-primary)] text-sm font-mono resize-y focus:outline-none focus:border-[var(--accent)]"
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-2 mb-3">
                          Uses the export formats selected above. The level ID is optional for local imports.
                        </p>
                        <Button
                          onClick={importLevel}
                          loading={importing}
                          disabled={!importData.trim() || exportFormats.length === 0}
                          icon={<DownloadIcon className="w-4 h-4" />}
                          className="w-full"
                        >
                          Import &amp; Export
                        </Button>
                        {importError && (
                          <div className="mt-3 p-3 rounded-xl bg-[var(--error)]/10 text-[var(--error)] text-sm">
                            {importError}
                          </div>
                        )}
                        {importSuccess && (
                          <div className="mt-3 p-3 rounded-xl bg-[var(--success)]/10 text-[var(--success)] text-sm">
                            {importSuccess}
                          </div>
                        )}
                        {importedFiles.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {importedFiles.map((file) => (
                              <Button
                                key={file.format}
                                variant="secondary"
                                size="sm"
                                onClick={() => downloadFile(file)}
                              >
                                {file.filename}
                              </Button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {levelInfo && (
                      <Card key={levelInfo.id} className="animate-gd-slide-up stagger-2">
                        <CardHeader icon={<GamepadIcon className="w-5 h-5" />}>
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle subtitle={`by ${levelInfo.author}`}>
                              {levelInfo.name}
                            </CardTitle>
                            <span className="px-2 py-1 bg-[var(--success)]/15 text-[var(--success)] text-xs rounded-md gd-title flex items-center gap-1">
                              <CheckCircleIcon className="w-3.5 h-3.5" />
                              Found
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <LevelStats info={levelInfo} />

                          <div className="grid grid-cols-2 gap-2 text-xs mb-4 animate-fadeIn stagger-5">
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                              <UserIcon className="w-3.5 h-3.5" />
                              {levelInfo.author}
                            </div>
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                              <BarChartIcon className="w-3.5 h-3.5" />
                              {levelInfo.length}
                            </div>
                            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                              <MusicIcon className="w-3.5 h-3.5" />
                              {levelInfo.song || (levelInfo.officialSong !== undefined ? OFFICIAL_SONGS[levelInfo.officialSong] : "N/A")}
                            </div>
                            {levelInfo.objects && (
                              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                <CubeIcon className="w-3.5 h-3.5" />
                                {levelInfo.objects.toLocaleString()} obj
                              </div>
                            )}
                            {levelInfo.coins > 0 && (
                              <div className="flex items-center gap-1.5 text-[var(--text-muted)] col-span-2">
                                <span>Coins:</span>
                                {Array.from({ length: Math.min(levelInfo.coins, 3) }).map((_, i) => (
                                  <GDCoinIcon
                                    key={i}
                                    className={`w-4 h-4 ${levelInfo.verifiedCoins ? "" : "grayscale opacity-50"}`}
                                  />
                                ))}
                                {!levelInfo.verifiedCoins && <span className="text-[10px]">(unverified)</span>}
                              </div>
                            )}
                          </div>

                          {loading && <ProgressBar progress={downloadProgress} showPercent className="mb-4" />}

                          <Button
                            onClick={downloadLevel}
                            loading={loading}
                            disabled={exportFormats.length === 0}
                            size="lg"
                            className="w-full"
                            icon={<DownloadIcon className="w-5 h-5" />}
                          >
                            Download ({exportFormats.length} {exportFormats.length === 1 ? "format" : "formats"})
                          </Button>

                          {downloadedFiles.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-[var(--border)] animate-gd-slide-up">
                              <div className="flex items-center gap-2 text-[var(--success)] text-sm mb-2 gd-title">
                                <CheckCircleIcon className="w-4 h-4" />
                                Ready to download
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {downloadedFiles.map((file) => (
                                  <Button
                                    key={file.format}
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => downloadFile(file)}
                                  >
                                    {file.filename}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div>
                    <ServersStatus
                      selectedServer={selectedServer}
                      onServerSelect={setSelectedServer}
                    />
                  </div>
                </div>
              )}

              {activeTab === "batch" && (
                <div className="grid lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2">
                    <DownloadQueue
                      queue={queue.queue}
                      isProcessing={queue.isProcessing}
                      onAddToQueue={queue.addToQueue}
                      onRemoveFromQueue={queue.removeFromQueue}
                      onRetry={queue.retryItem}
                      onClearQueue={queue.clearQueue}
                      onStartQueue={queue.startQueue}
                      onPauseQueue={queue.pauseQueue}
                      onDownloadFile={queue.downloadQueueFile}
                    />
                  </div>

                  <div>
                    <ServersStatus
                      selectedServer={selectedServer}
                      onServerSelect={setSelectedServer}
                    />
                  </div>
                </div>
              )}

              {activeTab === "guide" && (
                <div className="max-w-3xl mx-auto">
                  <Card className="animate-fadeInUp">
                    <CardHeader icon={<BookIcon className="w-5 h-5" />}>
                      <CardTitle>GDEX Guide</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <section>
                        <h3 className="gd-title text-base text-[var(--text-primary)] mb-2">What is GDEX?</h3>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                          GDEX (Geometry Dash Level Extractor) is a powerful tool for downloading and exporting Geometry Dash levels
                          in multiple formats. Perfect for level creators, researchers, and neural network training.
                        </p>
                      </section>

                      <section>
                        <h3 className="gd-title text-base text-[var(--text-primary)] mb-3">Export Formats</h3>
                        <div className="space-y-3">
                          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <FileIcon className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)]">.gmd — Import to Geometry Dash</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] ml-6">
                              Import levels directly back into Geometry Dash. Compatible with the game&apos;s native format.
                            </p>
                          </div>

                          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <JsonIcon className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)]">.json — Neural Networks</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] ml-6">
                              Structured data format with objects sorted by X position. Ideal for sequence models, CNNs, and transformers.
                            </p>
                          </div>

                          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <TableIcon className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)]">.csv — Object Analysis</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] ml-6">
                              Spreadsheet format with all object properties. Great for statistical analysis and data visualization.
                            </p>
                          </div>

                          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <ExcelIcon className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)]">.xls — Excel Format</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] ml-6">
                              Microsoft Excel compatible format. Opens directly in spreadsheet applications.
                            </p>
                          </div>

                          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <FileIcon className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)]">Meta — Metadata</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] ml-6">
                              Complete level information including author, difficulty, statistics, and upload details.
                            </p>
                          </div>

                          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <MusicIcon className="w-4 h-4 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)]">.mp3 — Background Music</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] ml-6">
                              Downloads the custom song used in the level (if available and accessible).
                            </p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="gd-title text-base text-[var(--text-primary)] mb-2">How to Use</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-muted)]">
                          <li>Enter a Geometry Dash level ID (found in-game or on Geometry Dash servers)</li>
                          <li>Select your desired export formats</li>
                          <li>Click &quot;Check&quot; to verify the level exists</li>
                          <li>Review level information and statistics</li>
                          <li>Click &quot;Download&quot; to export the level</li>
                          <li>For batch downloads, use the Batch tab to add multiple levels to a queue</li>
                        </ol>
                      </section>

                      <section>
                        <h3 className="gd-title text-base text-[var(--text-primary)] mb-2">Tips</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-sm text-[var(--text-muted)]">
                          <li>Use batch mode to download multiple levels at once</li>
                          <li>Check server status before downloading to ensure availability</li>
                          <li>JSON format is recommended for machine learning applications</li>
                          <li>GMD format allows you to import levels back into the game</li>
                          <li>Custom songs may not always be available due to hosting restrictions</li>
                        </ul>
                      </section>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "support" && (
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="gd-title text-2xl sm:text-3xl text-[var(--text-primary)]">Support GDEX</h2>
                    <p className="text-sm text-[var(--text-muted)]">Keep the project alive</p>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <a
                      href="#boosty-placeholder"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gd-button-boosty inline-flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg rounded-2xl gd-title active:scale-[0.98] hover:scale-[1.02] w-full sm:w-auto"
                    >
                      <HeartIcon className="w-5 h-5" />
                      Support on Boosty
                    </a>

                    <a
                      href="#github-placeholder"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)]/50 bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors duration-150 w-full sm:w-auto"
                    >
                      <GitHubIcon className="w-4 h-4" />
                      View Source on GitHub
                    </a>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
                    <Card hover className="text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 mx-auto mb-3 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                        <ServerIcon className="w-6 h-6" />
                      </div>
                      <h3 className="gd-title text-sm text-[var(--text-primary)] mb-1">Keep Servers Running</h3>
                      <p className="text-xs text-[var(--text-muted)]">Hosting costs money. Your support keeps GDEX online.</p>
                    </Card>

                    <Card hover className="text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 mx-auto mb-3 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                        <SparkleIcon className="w-6 h-6" />
                      </div>
                      <h3 className="gd-title text-sm text-[var(--text-primary)] mb-1">Fund New Features</h3>
                      <p className="text-xs text-[var(--text-muted)]">Vote on roadmap features. Supporters shape what gets built.</p>
                    </Card>

                    <Card hover className="text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 mx-auto mb-3 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                        <ShieldIcon className="w-6 h-6" />
                      </div>
                      <h3 className="gd-title text-sm text-[var(--text-primary)] mb-1">Open Source Forever</h3>
                      <p className="text-xs text-[var(--text-muted)]">GDEX will always be free and open source.</p>
                    </Card>
                  </div>

                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[var(--border)]" />
                    <GDStarIcon className="w-4 h-4" />
                    <GDDiamondIcon className="w-4 h-4" />
                    <GDStarIcon className="w-4 h-4" />
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>

                  <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span>Already a supporter? You&apos;re awesome.</span>
                    <HeartIcon className="w-3.5 h-3.5 text-pink-500" />
                  </p>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
