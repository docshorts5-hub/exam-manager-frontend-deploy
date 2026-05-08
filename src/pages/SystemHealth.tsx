import React, { useEffect, useState } from "react";
import { getSystemHealth, Health } from "../utils/systemHealth";

export default function SystemHealth() {

  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {

    const update = () => {
      const data = getSystemHealth();
      setHealth(data);
    };

    update();

    const interval = setInterval(update, 5000);

    return () => clearInterval(interval);

  }, []);

  if (!health) return null;

  return (
    <div style={{ padding: 20 }}>

      <h2>System Health Monitor</h2>

      <p>المعلمون: {health.teachers}</p>

      <p>الاختبارات: {health.exams}</p>

      <p>الأرشيف: {health.archives}</p>

      <p>السحابة: {health.cloud}</p>

      <p>آخر نسخة احتياطية: {health.lastBackup}</p>

    </div>
  );
}
