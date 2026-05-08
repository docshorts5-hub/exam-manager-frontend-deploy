import { useNavigate } from "react-router-dom";

export default function Report() {
  const nav = useNavigate();
  return (
    <div style={{ direction: "rtl", padding: 16 }}>
      <button onClick={() => nav("/")} style={{ padding: 10, borderRadius: 10 }}>لوحة التحكم</button>
      <h2 style={{ marginTop: 12 }}>التقارير</h2>
      <p>صفحة التقارير جاهزة لاحقًا للطباعة والتصدير.</p>
    </div>
  );
}
