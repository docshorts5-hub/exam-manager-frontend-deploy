import React from "react";
import { useNavigate } from "react-router-dom";
import OwnerDashboardShell, { OWNER_MINISTRY_LOGO_URL } from "./OwnerDashboardShell";
import {
  DiplomaCentersIcon,
  ExamSupersIcon,
  GovernoratesIcon,
  GovernorateSupersIcon,
  SchoolsIcon,
  UsersIcon,
} from "./OwnerManagementIcons";

type SectionKey = "management" | "security" | "operations";

type Action = {
  key?: string;
  title: string;
  description: string;
  route: string;
  tone?: "gold" | "green" | "blue" | "red" | "violet" | "teal" | "orange";
  note?: string;
};

const sections: Record<
  SectionKey,
  {
    title: string;
    subtitle: string;
    tone: "gold" | "green" | "blue";
    actions: Action[];
  }
> = {
  management: {
    title: "الإدارة الرئيسية",
    subtitle: "المحافظات والمدارس ومراكز الدبلوم والمستخدمون والمشرفون",
    tone: "gold",
    actions: [
      {
        key: "governorates",
        title: "المحافظات",
        description: "إدارة المحافظات والتنظيم الإداري والوصول إلى بواباتها.",
        route: "/system/management/governorates",
        tone: "green",
      },
      {
        key: "schools",
        title: "المدارس",
        description: "عرض المدارس وإدارتها حسب المحافظات.",
        route: "/system/management/schools",
        tone: "blue",
      },
      {
        key: "diploma-centers",
        title: "مراكز الدبلوم",
        description: "عرض مراكز الدبلوم حسب المحافظات.",
        route: "/system/management/diploma-centers",
        tone: "gold",
        note: "انتقالي",
      },
      {
        key: "users",
        title: "المستخدمون",
        description: "إدارة الحسابات الإشرافية والصلاحيات وربطها بالجهات.",
        route: "/system/management/users",
        tone: "violet",
      },
      {
        key: "governorate-supers",
        title: "مشرفو المحافظات",
        description: "عرض وإدارة مشرفي المحافظات وصلاحياتهم.",
        route: "/platform-governorate-supers",
        tone: "green",
      },
      {
        key: "exam-supers",
        title: "البوابة التشغيلية",
        description: "الدخول إلى البوابة التشغيلية للنظام.",
        route: "/programs-gateway",
        tone: "blue",
      },
    ],
  },
  security: {
    title: "الأمن والرقابة",
    subtitle: "الصلاحيات والمصادقة والسجلات والتدقيق",
    tone: "green",
    actions: [
      {
        title: "فحص الصلاحيات والربط",
        description: "مراجعة صلاحيات الحسابات وربطها بالنطاق الصحيح.",
        route: "/system/permissions-audit",
        tone: "violet",
      },
      {
        title: "إدارة TOTP",
        description: "إدارة إعادة تهيئة المصادقة الثنائية وفق الصلاحيات.",
        route: "/security/totp-reset",
        tone: "green",
      },
      {
        title: "سجل العمليات",
        description: "مراجعة العمليات والأنشطة المسجلة.",
        route: "/system/audit-log",
        tone: "blue",
      },
      {
        title: "سجل الأخطاء",
        description: "مراجعة الأخطاء والتحذيرات المركزية.",
        route: "/system/error-log",
        tone: "red",
      },
    ],
  },
  operations: {
    title: "النظام والتطوير",
    subtitle: "المراقبة والصيانة والجاهزية والإصدارات والاختبارات",
    tone: "blue",
    actions: [
      {
        title: "رسائل التطوير",
        description: "مراجعة الرسائل والمقترحات التشغيلية.",
        route: "/super/suggestions",
        tone: "violet",
      },
      {
        title: "لوحة الجاهزية التجارية",
        description: "مراجعة حالة الجاهزية والتسليم.",
        route: "/system/commercial-readiness",
        tone: "gold",
      },
      {
        title: "مركز مراقبة النظام",
        description: "متابعة حالة النظام والمؤشرات التشغيلية.",
        route: "/system/monitoring",
        tone: "blue",
      },
      {
        title: "مركز صيانة النظام",
        description: "أدوات الصيانة الآمنة وإدارة الحالة المحلية.",
        route: "/system/maintenance",
        tone: "green",
      },
      {
        title: "مركز الإصدارات والتطوير",
        description: "متابعة الإصدارات ومراحل التطوير.",
        route: "/system/release-center",
        tone: "violet",
      },
      {
        title: "حزمة الاختبار التجاري",
        description: "تشغيل ومراجعة قائمة الاختبارات النهائية.",
        route: "/system/commercial-test-suite",
        tone: "blue",
      },
    ],
  },
};

function renderManagementIcon(key?: string) {
  const className = "owner-hub__managementIconSvg";

  if (key === "governorates") {
    return (
      <img
        src={OWNER_MINISTRY_LOGO_URL}
        alt=""
        className="owner-hub__managementLogoIcon"
      />
    );
  }
  if (key === "schools") return <SchoolsIcon className={className} />;
  if (key === "diploma-centers") return <DiplomaCentersIcon className={className} />;
  if (key === "users") return <UsersIcon className={className} />;
  if (key === "governorate-supers") return <GovernorateSupersIcon className={className} />;
  if (key === "exam-supers") return <ExamSupersIcon className={className} />;

  return null;
}

export default function OwnerDashboardSection({
  section,
}: {
  section: SectionKey;
}) {
  const navigate = useNavigate();
  const config = sections[section];
  const management = section === "management";

  return (
    <OwnerDashboardShell backTo="/system">
      <section
        className={
          "owner-hub__sectionHero owner-hub__sectionHero--" + config.tone
        }
      >
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </section>

      <section
        className={
          "owner-hub__actionGrid" +
          (management ? " owner-hub__actionGrid--management" : "")
        }
      >
        {config.actions.map((action) => (
          <button
            type="button"
            key={action.key || action.title}
            className={
              "owner-hub__actionCard owner-hub__actionCard--" +
              (action.tone || config.tone) +
              (management ? " owner-hub__managementCard" : "")
            }
            onClick={() => navigate(action.route)}
          >
            {management ? (
              <span className="owner-hub__managementIcon" aria-hidden="true">
                {renderManagementIcon(action.key)}
              </span>
            ) : null}

            {management ? (
              <div className="owner-hub__managementTitleRow">
                <strong>{action.title}</strong>
                {action.note ? (
                  <span className="owner-hub__statusPill">{action.note}</span>
                ) : null}
              </div>
            ) : (
              <strong>{action.title}</strong>
            )}

            <p>{action.description}</p>

            {!management && action.note ? (
              <span className="owner-hub__statusPill">{action.note}</span>
            ) : null}

            <span className="owner-hub__actionArrow">←</span>
          </button>
        ))}
      </section>
    </OwnerDashboardShell>
  );
}



