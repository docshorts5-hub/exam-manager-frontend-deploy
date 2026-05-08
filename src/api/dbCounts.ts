import { STORES, count } from "./db";

export type DashboardCounts = {
  teachers: number;
  exams: number;
  tasks: number;
};

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [teachers, exams, tasks] = await Promise.all([
    count(STORES.teachers).catch(() => 0),
    count(STORES.exams).catch(() => 0),
    count(STORES.tasks).catch(() => 0)
  ]);
  return { teachers, exams, tasks };
}
