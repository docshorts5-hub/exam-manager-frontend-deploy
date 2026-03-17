import React from "react";

export default function RoomBlocks() {
  return (
    <div style={{ padding: 20, direction: "rtl" }}>
      <h1>حظر القاعات</h1>
      <p>تستخدم هذه الصفحة لحظر قاعات معينة في أيام أو فترات محددة.</p>

      <ul>
        <li>اختيار القاعة</li>
        <li>تحديد التاريخ</li>
        <li>الفترة (الأولى / الثانية)</li>
      </ul>
    </div>
  );
}
