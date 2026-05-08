Patch package v2
Fixes:
- Adds missing export: mergeArchivedRuns (used by autoCloudSync.ts)
- Keeps previous fixes: clearRun, getArchivedRun, clearArchive

How to apply:
1) Replace your file at: src/utils/taskDistributionStorage.ts
2) Restart Vite dev server (Ctrl+C then npm run dev)
