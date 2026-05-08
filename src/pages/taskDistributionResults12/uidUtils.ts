// src/pages/taskDistributionResults/uidUtils.ts

export function genUid() {
  const anyCrypto: any = (globalThis as any).crypto;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `uid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ensureUidsOnRun(r: any) {
  if (!r) return r;
  const list = Array.isArray(r.assignments) ? r.assignments : [];
  let changed = false;
  const next = list.map((a: any) => {
    if (a?.__uid) return a;
    changed = true;
    return { ...a, __uid: genUid() };
  });
  if (!changed) return r;
  return { ...r, assignments: next };
}
