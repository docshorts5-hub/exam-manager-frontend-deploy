export function resolveResultsSameTypeDropTargetUid(
  dstCellList: any[],
  srcTaskType: string,
  isDraggableTaskType: (taskType: any) => boolean
): string | null {
  const normalizedType = String(srcTaskType || "");
  if (!isDraggableTaskType(normalizedType)) return null;

  const sameTypeTarget = (dstCellList || []).find((x: any) => {
    const targetType = String(x?.taskType || "");
    return isDraggableTaskType(targetType) && targetType === normalizedType;
  });

  const uid = String(sameTypeTarget?.__uid || "").trim();
  return uid || null;
}
