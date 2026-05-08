import React from "react";
import { Button, Card, Input } from "../ui";

export default function AdminOwnerToolsSection(props: any) {
  const { ownerTenantId, setOwnerTenantId, ownerEmail, setOwnerEmail, inviteSingleOwner, loadOwnerForTenant, ownerDocLoading, ownerDoc } = props;
  return (
    <Card title="معالج مالك واحد لكل مدرسة (meta/owner)">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>TenantId (المدرسة)</div><Input value={ownerTenantId} onChange={(e) => setOwnerTenantId(e.target.value)} placeholder="مثال: azaan-9-12" /></div>
        <div><div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Owner Email (بريد المالك)</div><Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@school.com" /></div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Button onClick={inviteSingleOwner}>دعوة المالك</Button>
        <Button variant="ghost" onClick={() => loadOwnerForTenant(ownerTenantId)}>فحص meta/owner</Button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>سيتم إنشاء <code>tenants/&lt;tenantId&gt;/meta/owner</code> تلقائياً عند أول تسجيل دخول للمالك.</div>
      </div>
      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(2,6,23,0.55)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontWeight: 800 }}>حالة المالك</div>{ownerDocLoading ? <span style={{ opacity: 0.85 }}>جاري التحميل…</span> : null}</div>
        {ownerDoc ? (
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.8 }}><div><b>email:</b> {ownerDoc.email}</div><div><b>uid:</b> {ownerDoc.uid}</div><div style={{ opacity: 0.85 }}>تمت الملكية بنجاح. أي محاولة لإنشاء owner جديد ستفشل تلقائياً (One Owner).</div></div>
        ) : <div style={{ marginTop: 10, opacity: 0.85 }}>لا يوجد owner بعد. بعد دعوة المالك، اطلب منه تسجيل الدخول مرة واحدة لإتمام إنشاء meta/owner.</div>}
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={() => (window.location.href = "/activity-logs")}>سجلات النشاط</Button>
          <Button variant="ghost" onClick={() => { const tid = String(ownerTenantId || "").trim(); if (!tid) return alert("أدخل tenantId أولاً"); alert("SecurityAudit يتم حفظه في Firestore: tenants/{tenantId}/securityAudit."); }}>SecurityAudit</Button>
        </div>
      </div>
    </Card>
  );
}