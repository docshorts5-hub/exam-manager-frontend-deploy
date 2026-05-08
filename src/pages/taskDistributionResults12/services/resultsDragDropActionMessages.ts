export function dragDropUnsupportedMessage() {
  return "السحب والإفلات متاح فقط لـ (مراقبة / احتياط / مراقب دور).";
}

export function getResultsDragDropUnsupportedMessage() {
  return dragDropUnsupportedMessage();
}

export function getResultsDragDropTypeMismatchMessage() {
  return "لا يمكن تبديل نوعين مختلفين من المهام. يمكن السحب والإفلات فقط بين مهام متوافقة.";
}

export function getResultsEmptyCellOccupiedMessage() {
  return "لا يمكن النقل إلى هذه الخلية لأنها تحتوي على مهمة بالفعل.";
}

export function getResultsDropTargetUnavailableMessage(reason?: string | null) {
  const text = String(reason || "").trim();
  return text || "لا يمكن النقل إلى هذه الخلية بسبب عدم توفر المعلم أو وجود تعارض.";
}

export function getResultsSameCellMessage() {
  return "المهمة موجودة بالفعل في هذه الخلية.";
}

export function getResultsInvalidDropMessage() {
  return "لا يمكن تنفيذ عملية السحب والإفلات هنا.";
}

export function getResultsTaskConflictMessage() {
  return "يوجد تعارض في هذه المهمة.";
}

export function getResultsCellBlockedMessage(reason?: string | null) {
  const text = String(reason || "").trim();
  return text || "هذه الخلية غير متاحة.";
}

export function getResultsCannotMoveMessage(reason?: string | null) {
  const text = String(reason || "").trim();
  return text || "لا يمكن نقل هذه المهمة.";
}

export function getResultsCannotSwapMessage(reason?: string | null) {
  const text = String(reason || "").trim();
  return text || "لا يمكن تبديل هذه المهمة.";
}

export function getResultsAddTaskUnavailableMessage(reason?: string | null) {
  const text = String(reason || "").trim();
  return text || "لا يمكن إضافة مهمة لهذا المعلم في هذه الخلية.";
}
