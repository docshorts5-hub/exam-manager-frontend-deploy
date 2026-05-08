export function buildResultsRunSubtitle(runId: string, createdAtISO?: string) {
  return `Run ID: ${runId} • ${String(createdAtISO || "").slice(0, 10) || "—"}`;
}

export function buildArchiveSnapshotName(now: Date) {
  const iso = now.toISOString();
  const label = now.toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return {
    iso,
    name: `${iso.slice(0, 10)} ${label}`,
    archiveId: `arch-${iso}`,
  };
}
