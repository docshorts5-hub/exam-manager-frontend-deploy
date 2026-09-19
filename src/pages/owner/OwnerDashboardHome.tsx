import React from "react";
import { useNavigate } from "react-router-dom";
import OwnerDashboardShell from "./OwnerDashboardShell";
import {
  AdministrationIcon,
  OperationsIcon,
  SecurityIcon,
} from "./OwnerDashboardIcons";

type Card = {
  key: "management" | "security" | "operations";
  title: string;
  description: string;
  route: string;
  tone: "gold" | "green" | "blue";
};

const cards: Card[] = [
  {
    key: "management",
    title: "الإدارة الرئيسية",
    description: "إدارة المحافظات والمدارس ومراكز الدبلوم والمستخدمين والمشرفين",
    route: "/system/management",
    tone: "gold",
  },
  {
    key: "security",
    title: "الأمن والرقابة",
    description: "إدارة الصلاحيات و TOTP والسجلات والتدقيق والمراقبة الأمنية",
    route: "/system/security",
    tone: "green",
  },
  {
    key: "operations",
    title: "النظام والتطوير",
    description: "المراقبة والصيانة والإصدارات والاختبارات والتطوير والجاهزية",
    route: "/system/operations",
    tone: "blue",
  },
];

function renderCardIcon(key: Card["key"]) {
  if (key === "management") {
    return <AdministrationIcon className="owner-hub__mainIconSvg" />;
  }

  if (key === "security") {
    return <SecurityIcon className="owner-hub__mainIconSvg" />;
  }

  return <OperationsIcon className="owner-hub__mainIconSvg" />;
}

export default function OwnerDashboardHome() {
  const navigate = useNavigate();

  return (
    <OwnerDashboardShell>
      <section className="owner-hub__hero">
        <div className="owner-hub__ornament" aria-hidden="true">◆</div>
        <h1>لوحة مالك المنصة</h1>
        <p>إدارة جميع أجزاء النظام من مكان واحد</p>
        <div
          className="owner-hub__ornament owner-hub__ornament--bottom"
          aria-hidden="true"
        >
          ◆
        </div>
      </section>

      <section
        className="owner-hub__mainCards"
        aria-label="أقسام لوحة مالك المنصة"
      >
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={"owner-hub__mainCard owner-hub__mainCard--" + card.tone}
            onClick={() => navigate(card.route)}
          >
            <span className="owner-hub__mainIcon" aria-hidden="true">
              {renderCardIcon(card.key)}
            </span>
            <strong>{card.title}</strong>
            <span className="owner-hub__divider" />
            <p>{card.description}</p>
            <span className="owner-hub__enter">
              دخول إلى {card.title}
              <b>←</b>
            </span>
          </button>
        ))}
      </section>
    </OwnerDashboardShell>
  );
}