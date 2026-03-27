export type TenantNavItem = {
  key: string;
  path: string;
  icon: string;
  ar: string;
  en: string;
  adminOnly?: boolean;
  systemOnly?: boolean;
  superOnly?: boolean;
  dashboardOnly?: boolean;
};

export const TENANT_NAV_ITEMS: TenantNavItem[] = [
  { key: 'dashboard', path: '', icon: '📊', ar: 'لوحة التحكم', en: 'Dashboard' },
  { key: 'teachers', path: 'teachers', icon: '👥', ar: 'الكادر التعليمي', en: 'Teachers' },
  { key: 'exams', path: 'exams', icon: '📅', ar: 'جدول الامتحانات', en: 'Exam Schedule' },
  { key: 'rooms', path: 'rooms', icon: '🏫', ar: 'القاعات', en: 'Rooms' },
  { key: 'roomBlocks', path: 'room-blocks', icon: '⛔', ar: 'حظر القاعات', en: 'Room Blocks' },
  { key: 'distributionRun', path: 'task-distribution/run', icon: '🔀', ar: 'توزيع المهام', en: 'Task Distribution' },
  { key: 'distributionResults', path: 'task-distribution/results', icon: '🧾', ar: 'الجدول الشامل', en: 'Master Table' },
  { key: 'distributionPrint', path: 'task-distribution/print', icon: '📑', ar: 'التقارير والكشوفات', en: 'Reports & Sheets' },
  { key: 'distributionStats', path: 'settings', icon: '⚙️', ar: 'تقرير إحصائية التوزيع', en: 'Distribution Statistics' },
  { key: 'analytics', path: 'analytics', icon: '📈', ar: 'التحليلات الذكية', en: 'Smart Analytics' },
  { key: 'unavailability', path: 'unavailability', icon: '🕒', ar: 'الغياب', en: 'Unavailability' },
  { key: 'schoolProfile', path: 'settings1', icon: '🏷️', ar: 'بيانات المدرسة', en: 'School Profile' },
  { key: 'gallery', path: 'gallery', icon: '🖼️', ar: 'مكتبة الصور', en: 'Gallery' },
  { key: 'about', path: 'about', icon: '🛠️', ar: 'مصمم البرنامج', en: 'About Developer' },
  { key: 'archive', path: 'archive', icon: '📦', ar: 'الأرشيف', en: 'Archive', adminOnly: true },
  { key: 'audit', path: 'audit', icon: '🧩', ar: 'السجلات', en: 'Audit', adminOnly: true },
  { key: 'activityLogs', path: 'activity-logs', icon: '🧾', ar: 'سجل النشاط', en: 'Activity Logs', adminOnly: true },
  { key: 'sync', path: 'sync', icon: '💾', ar: 'قاعدة البيانات', en: 'Database', adminOnly: true },
  { key: 'versioning', path: 'versioning', icon: '🗂️', ar: 'إدارة الإصدارات', en: 'Versioning', adminOnly: true },
  { key: 'multiRole', path: 'multi-role', icon: '🔐', ar: 'صلاحيات Multi-Role', en: 'Multi-Role Permissions', adminOnly: true },
  { key: 'migrate', path: '/system/migrate', icon: '🚚', ar: 'ترحيل البيانات', en: 'Data Migration', superOnly: true },
  { key: 'systemAdmin', path: '/system', icon: '🧠', ar: 'مدير النظام', en: 'System Admin', systemOnly: true },
];

export function tenantPath(tenantId: string | null | undefined, path = '') {
  const base = tenantId ? `/t/${tenantId}` : '';
  const clean = String(path || '').trim();
  if (!clean) return base || '/';
  if (clean.startsWith('/system')) return clean;
  return `${base}${clean.startsWith('/') ? clean : `/${clean}`}`;
}

export const LEGACY_TENANT_PATHS = [
  'teachers',
  'team-members',
  'exams',
  'rooms',
  'room-blocks',
  'report',
  'unavailability',
  'settings',
  'settings1',
  'gallery',
  'about',
  'archive',
  'audit',
  'activity-logs',
  'sync',
  'analytics',
  'versioning',
  'multi-role',
  'run-details',
  'task-distribution',
  'task-distribution/run',
  'task-distribution/results',
  'task-distribution/versions',
  'task-distribution/print',
  'task-distribution/suggestions',
];
