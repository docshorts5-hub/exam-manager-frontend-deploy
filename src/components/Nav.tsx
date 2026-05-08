import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/", label: "لوحة التحكم" },
  { to: "/teachers", label: "المعلمين" },
  { to: "/unavailability", label: "عدم التوفر" },
  { to: "/rooms", label: "القاعات" },
  { to: "/room-blocks", label: "حجز القاعات" },
  { to: "/exams", label: "الامتحانات" },
  { to: "/task-distribution/run", label: "التوزيع" },
  { to: "/reports", label: "التقارير" },
  { to: "/archive", label: "الأرشيف" },
  { to: "/sync", label: "المزامنة" },
  { to: "/settings", label: "الإعدادات" },
  { to: "/audit", label: "Audit" },
];

export default function Nav() {
  const loc = useLocation();
  return (
    <div style={{ padding: 12, borderRight: "1px solid #eee", minWidth: 220 }}>
      {items.map((x) => (
        <div key={x.to} style={{ marginBottom: 8 }}>
          <Link to={x.to} style={{ fontWeight: loc.pathname === x.to ? "bold" : "normal" }}>
            {x.label}
          </Link>
        </div>
      ))}
    </div>
  );
}
