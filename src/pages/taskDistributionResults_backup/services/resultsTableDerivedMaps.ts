export type TotalsDetail = {
  inv: number;
  res: number;
  corr: number;
  total: number;
  deficit: number;
  committees: number;
  required?: number;
};

export function buildInvigilationDeficitBySubCol(
  totalsDetailBySubCol: Record<string, TotalsDetail>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(totalsDetailBySubCol).map(([k, v]) => [k, Math.max(0, (v.required || 0) - (v.inv || 0))])
  );
}

export function buildReserveCountBySubCol(
  totalsDetailBySubCol: Record<string, TotalsDetail>
): Record<string, number> {
  return Object.fromEntries(Object.entries(totalsDetailBySubCol).map(([k, v]) => [k, v.res || 0]));
}

export function buildRequiredBySubCol(
  totalsDetailBySubCol: Record<string, TotalsDetail>
): Record<string, number> {
  return Object.fromEntries(Object.entries(totalsDetailBySubCol).map(([k, v]) => [k, v.required || 0]));
}
