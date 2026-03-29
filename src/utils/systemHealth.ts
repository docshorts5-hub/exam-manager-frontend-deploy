export type Health = {
  teachers: number;
  exams: number;
  archives: number;
  cloud: string;
  lastBackup: string;
};

export function getSystemHealth(): Health {
  return {
    teachers: 120,
    exams: 35,
    archives: 500,
    cloud: "Online",
    lastBackup: new Date().toLocaleString()
  };
}
