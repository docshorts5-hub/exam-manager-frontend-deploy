const CONSTRAINTS_KEY = "exam-manager:task-distribution:constraints:v2";

export function loadDistributionConstraints<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(CONSTRAINTS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function saveDistributionConstraints<T>(value: T) {
  try {
    localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(value));
  } catch {}
}

export function clearDistributionConstraints() {
  try {
    localStorage.removeItem(CONSTRAINTS_KEY);
  } catch {}
}
