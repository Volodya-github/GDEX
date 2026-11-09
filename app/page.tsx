
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
