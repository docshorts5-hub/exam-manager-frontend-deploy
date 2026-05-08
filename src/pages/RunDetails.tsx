import React from "react";

export default function RunDetails() {
  return (
    <div style={{ padding: 20, direction: "rtl" }}>
      <h1>تفاصيل التشغيل</h1>

      <p>تعرض هذه الصفحة تفاصيل آخر تشغيل لخوارزمية التوزيع:</p>

      <ul>
        <li>تاريخ التشغيل</li>
        <li>عدد الكادر التعليمي</li>
        <li>عدد الاختبارات</li>
        <li>عدد اللجان الناقصة</li>
      </ul>
    </div>
  );
}
