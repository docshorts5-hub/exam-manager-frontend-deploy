import React from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";

const glass: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.68)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 22px 60px rgba(0,0,0,0.48)",
  borderRadius: 22,
};

const gold = "#fbbf24";
const goldSoft = "rgba(251,191,36,0.16)";
const glowGold = "0 0 28px rgba(251,191,36,0.24), 0 0 64px rgba(251,191,36,0.12)";
const textMain = "#f8fafc";
const textMuted = "rgba(248,250,252,0.78)";
const textSoft = "rgba(248,250,252,0.58)";
const DESIGNER_IMAGE = "https://i.imgur.com/hxc8yi9.jpeg";

const STR = {
  ar: {
    pageTitle: "مصمم البرنامج",
    pageSubtitle: "واجهة تعريف احترافية تليق بمنظومة إدارة الامتحانات المطورة",
    systemVersion: "إصدار النظام المتقدم",
    currentSchool: "المدرسة الحالية",
    employer: "جهة العمل",
    contact: "التواصل",
    jobTitle: "المسمى الوظيفي",
    schoolValue: "مدرسة عزان بن تميم",
    employerValue: "المديرية العامة للتعليم بمحافظة شمال الشرقية",
    contactValue: "97760020",
    jobTitleValue: "فني مختبرات مدارس",
    developerName: "يوسف راشد النعماني",
    developerRole: "مطور برمجيات متكامل",
    developerBio:
      "مطور متخصص في بناء الأنظمة المؤسسية الذكية، يركز على تحويل الإجراءات الإدارية المعقدة إلى حلول رقمية متكاملة، دقيقة، وقابلة للتوسع.",
    back: "العودة للصفحة السابقة",
    home: "الذهاب إلى لوحة التحكم",
    missionTitle: "رسالة هذا العمل",
    missionText:
      "هذا النظام ليس مجرد صفحة لإدارة بيانات الامتحانات، بل هو منظومة تشغيل متكاملة صُممت لتقديم تجربة احترافية تبدأ من إدخال الكادر وجدول الامتحانات والقاعات، وتمر عبر التوزيع الذكي والتقارير والإحصائيات، وتنتهي بإخراج كشوفات رسمية دقيقة تليق بالعمل المؤسسي في البيئة التعليمية.",
    professionalTitle: "البيانات المهنية",
    advancedTitle: "نبذة متقدمة عن النظام",
    advancedText:
      "تم تصميم نظام إدارة الامتحانات المطور ليخدم بيئة تشغيل حقيقية تحتاج إلى سرعة، موثوقية، عدالة في التوزيع، ووضوح كامل في التقارير. وتم الاهتمام بالتفاصيل التشغيلية الدقيقة مثل توزيع المراقبين، إدارة القاعات، كشف العجز، التنبيهات، الربط الذكي بين البيانات، والطباعة الرسمية المناسبة للاعتماد الإداري.",
    technologiesTitle: "التقنيات المستخدمة",
    technologiesText:
      "تم بناء النظام بأسلوب حديث يجمع بين واجهات الاستخدام المتقدمة، إدارة الحالة، التخزين السحابي، وقابلية التوسع مستقبلًا.",
    projectValueTitle: "قيمة المشروع",
    projectValueText:
      "هذا العمل يمثل منتجًا مؤسسيًا فعليًا، وليس مجرد نموذج تجريبي؛ إذ يجمع بين التصميم، المنطق التشغيلي، دقة البيانات، والتقارير التنفيذية في منصة واحدة متكاملة.",
    footerTitle: "نظام إدارة الامتحانات المطور",
    footerSubtitle: "صفحة تعريف احترافية بمصمم المنظومة ورؤية المشروع التقنية",
    footerBadge: "بُني برؤية ودقة وعناية",
    achievements: [
      { number: "100%", label: "منظومة متكاملة لإدارة الامتحانات" },
      { number: "24/24", label: "جاهزية تشغيل ومتابعة" },
      { number: "A4", label: "تقارير احترافية للطباعة والتسليم" },
      { number: "متعدد الأدوار", label: "صلاحيات متعددة وإدارة مركزية" },
    ],
    features: [
      "توزيع ذكي وعادل للمراقبين حسب القيود والجاهزية",
      "إدارة كاملة للمعلمين والامتحانات والقاعات والحظر",
      "تقارير وكشوفات رسمية للطباعة بصيغة احترافية",
      "إحصائيات توزيع فورية واكتشاف العجز تلقائيًا",
      "إدارة نسخ وأرشفة وتوثيق السجلات والنشاط",
      "قابلية توسع للمدارس والإدارات والصلاحيات متعددة الأدوار",
    ],
    technologies: [
      "ريأكت",
      "تايب سكربت",
      "فايربيس",
      "فايرستور",
      "الدوال السحابية",
      "قاعدة بيانات محلية",
      "استيراد وتصدير إكسل",
      "تكامل الذكاء الاصطناعي",
    ],
  },
  en: {
    pageTitle: "Program Designer",
    pageSubtitle: "A professional identity page worthy of the enhanced exam management platform",
    systemVersion: "Advanced System Edition",
    currentSchool: "Current School",
    employer: "Employer",
    contact: "Contact",
    jobTitle: "Job Title",
    schoolValue: "Azzan Bin Tamim School",
    employerValue: "Directorate General of Education in North Al Sharqiyah",
    contactValue: "97760020",
    jobTitleValue: "School Laboratory Technician",
    developerName: "Yousef Rashid Al-Numani",
    developerRole: "Full Stack Developer",
    developerBio:
      "A developer specialized in building smart institutional systems, focused on transforming complex administrative procedures into integrated, precise, and scalable digital solutions.",
    back: "Back to Previous Page",
    home: "Go to Dashboard",
    missionTitle: "Mission of This Work",
    missionText:
      "This system is not just a page for managing exam data. It is a fully integrated operational platform designed to deliver a professional experience that starts with staff, exams, and rooms, passes through smart distribution, reporting, and analytics, and ends with accurate official outputs suitable for institutional educational work.",
    professionalTitle: "Professional Information",
    advancedTitle: "Advanced Overview of the System",
    advancedText:
      "The enhanced exam management system was designed for a real operational environment that requires speed, reliability, fairness in distribution, and complete clarity in reporting. Great attention was given to operational details such as invigilator distribution, room management, shortage detection, alerts, smart data linkage, and official print-ready outputs.",
    technologiesTitle: "Technologies Used",
    technologiesText:
      "The system was built with a modern approach that combines advanced user interfaces, state management, cloud storage, and future scalability.",
    projectValueTitle: "Project Value",
    projectValueText:
      "This work represents a real institutional product, not just an experimental prototype. It combines design, operational logic, data accuracy, and executive reporting in one integrated platform.",
    footerTitle: "Enhanced Exam Management System",
    footerSubtitle: "A professional about page for the system designer and project vision",
    footerBadge: "Built with vision, precision, and care",
    achievements: [
      { number: "100%", label: "Integrated Exam Management Platform" },
      { number: "24/24", label: "Operational Readiness & Monitoring" },
      { number: "A4", label: "Professional Printable Reports" },
      { number: "Multi-Role", label: "Multi-role Access & Central Control" },
    ],
    features: [
      "Smart and fair invigilator distribution based on constraints and readiness",
      "Full management of teachers, exams, rooms, and blocking rules",
      "Official reports and sheets in a professional printable format",
      "Instant distribution analytics and automatic shortage detection",
      "Archiving, backup, and activity documentation management",
      "Scalable structure for schools, departments, and multi-role permissions",
    ],
    technologies: [
      "React",
      "TypeScript",
      "Firebase",
      "Firestore",
      "Cloud Functions",
      "IndexedDB",
      "Excel Import / Export",
      "AI Integration",
    ],
  },
} as const;

export default function About() {
  const navigate = useNavigate();
  const { lang, isRTL } = useI18n();
  const t = STR[lang as keyof typeof STR];
  const isAr = isRTL;

  const infoCards = [
    { icon: "🏫", title: t.currentSchool, value: t.schoolValue },
    { icon: "🏢", title: t.employer, value: t.employerValue },
    { icon: "📞", title: t.contact, value: t.contactValue },
    { icon: "💼", title: t.jobTitle, value: t.jobTitleValue },
  ];

  const technologies = t.technologies;

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    color: textMain,
    marginBottom: 18,
  };

  return (
    <div
      style={{
        direction: isAr ? "rtl" : "ltr",
        minHeight: "100vh",
        color: textMain,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: `
          radial-gradient(circle at 10% 10%, rgba(251,191,36,0.10), transparent 24%),
          radial-gradient(circle at 85% 20%, rgba(96,165,250,0.10), transparent 22%),
          linear-gradient(180deg, #08111f 0%, #060d18 45%, #040910 100%)
        `,
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @keyframes aboutFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aboutPulse {
          0%, 100% {
            box-shadow:
              0 0 0 rgba(251,191,36,0.0),
              0 0 28px rgba(251,191,36,0.16),
              0 18px 34px rgba(0,0,0,0.26);
          }
          50% {
            box-shadow:
              0 0 0 4px rgba(251,191,36,0.10),
              0 0 40px rgba(251,191,36,0.30),
              0 22px 40px rgba(0,0,0,0.32);
          }
        }
        @keyframes borderPulse {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(251,191,36,0.0),
              0 22px 60px rgba(0,0,0,0.48);
          }
          50% {
            box-shadow:
              0 0 0 4px rgba(251,191,36,0.10),
              0 0 34px rgba(251,191,36,0.16),
              0 26px 70px rgba(0,0,0,0.54);
          }
        }
        .about-card-hover {
          transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
        }
        .about-card-hover:hover {
          transform: translateY(-7px) scale(1.01);
          box-shadow: 0 24px 64px rgba(0,0,0,0.48), 0 0 28px rgba(251,191,36,0.16);
          border-color: rgba(251,191,36,0.30) !important;
        }
        .about-chip {
          transition: all 0.25s ease;
        }
        .about-chip:hover {
          transform: translateY(-2px);
          background: rgba(251,191,36,0.18) !important;
          border-color: rgba(251,191,36,0.5) !important;
        }
        @media (max-width: 1100px) {
          .about-hero-grid, .about-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          top: -120,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(251,191,36,0.16), transparent 70%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -90,
          top: 160,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.14), transparent 70%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "92%", maxWidth: 1500, margin: "0 auto", padding: "28px 0 42px", position: "relative", zIndex: 1 }}>

        <header
          style={{
            ...glass,
            padding: "28px 34px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.88), rgba(88,28,135,0.55), rgba(30,41,59,0.92))",
            border: "4px solid rgba(251,191,36,0.75)",
            boxShadow: glowGold,
            animation: "aboutFadeUp 0.7s ease, borderPulse 3.2s ease-in-out infinite",
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 86,
                height: 72,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#111827",
                boxShadow: glowGold,
                animation: "aboutPulse 2.8s ease-in-out infinite",
              }}
            >
              👨‍💻
            </div>

            <div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>{t.pageTitle}</div>
              <div style={{ marginTop: 6, fontSize: 15, color: textMuted }}>{t.pageSubtitle}</div>
            </div>
          </div>

          <div
            style={{
              padding: "12px 20px",
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
              color: "#fff",
              fontWeight: 800,
              border: "1px solid rgba(251,191,36,0.25)",
              boxShadow: glowGold,
            }}
          >
            {t.systemVersion}
          </div>
        </header>

        <section
          className="about-hero-grid"
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "minmax(320px, 380px) 1fr",
            gap: 28,
            alignItems: "stretch",
            animation: "aboutFadeUp 0.9s ease",
          }}
        >
          <div
            style={{
              ...glass,
              padding: "32px 26px",
              textAlign: "center",
              border: "4px solid rgba(251,191,36,0.78)",
              boxShadow: glowGold,
              animation: "borderPulse 3.4s ease-in-out infinite",
            }}
            className="about-card-hover"
          >
            <div
              style={{
                width: 188,
                height: 220,
                margin: "0 auto",
                borderRadius: 22,
                padding: 6,
                background: "linear-gradient(135deg, #fff1a8, #fbbf24, #f59e0b)",
                boxShadow: glowGold,
                animation: "aboutPulse 3s ease-in-out infinite",
                transform: "perspective(1200px) rotateX(4deg)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 18,
                  overflow: "hidden",
                  background: "linear-gradient(180deg, #0f172a, #111827)",
                }}
              >
                <img
                  src={DESIGNER_IMAGE}
                  alt={isAr ? "مصمم البرنامج" : "Program Designer"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>

            <div style={{ marginTop: 22, fontSize: 28, fontWeight: 900, color: "#fff" }}>
              {t.developerName}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "inline-block",
                padding: "8px 18px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#111827",
                fontWeight: 900,
                boxShadow: glowGold,
              }}
            >
              {t.developerRole}
            </div>

            <p style={{ marginTop: 18, lineHeight: 1.95, fontSize: 15, color: textMuted }}>
              {t.developerBio}
            </p>

            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 15,
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "#ffffff",
                  boxShadow: "0 16px 28px rgba(16,185,129,0.24)",
                }}
              >
                {t.back}
              </button>

              <button
                onClick={() => navigate("/")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 15,
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#fff",
                  boxShadow: "0 16px 28px rgba(37,99,235,0.24)",
                }}
              >
                {t.home}
              </button>
            </div>
          </div>

          <div
            style={{
              ...glass,
              padding: "30px",
              border: "1px solid rgba(251,191,36,0.14)",
            }}
            className="about-card-hover"
          >
            <div style={sectionTitleStyle}>{t.missionTitle}</div>

            <p style={{ lineHeight: 2, fontSize: 16, color: textMuted, margin: 0 }}>
              {t.missionText}
            </p>

            <div
              style={{
                marginTop: 26,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              {t.achievements.map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...glass,
                    padding: "18px 16px",
                    border: "1px solid rgba(251,191,36,0.12)",
                    textAlign: "center",
                    background: "rgba(255,255,255,0.03)",
                  }}
                  className="about-card-hover"
                >
                  <div style={{ fontSize: 28, fontWeight: 900, color: gold }}>{item.number}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: textMuted }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginTop: 30, animation: "aboutFadeUp 1.05s ease" }}>
          <div style={sectionTitleStyle}>{t.professionalTitle}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {infoCards.map((item) => (
              <div
                key={item.title}
                style={{
                  ...glass,
                  padding: "22px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                className="about-card-hover"
              >
                <div
                  style={{
                    width: 58,
                    height: 52,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                    color: "#111827",
                    fontSize: 22,
                    boxShadow: glowGold,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>

                <div>
                  <div style={{ fontSize: 13, color: textSoft }}>{item.title}</div>
                  <div style={{ marginTop: 5, fontWeight: 800, color: textMain }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="about-bottom-grid"
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 24,
            animation: "aboutFadeUp 1.2s ease",
          }}
        >
          <div
            style={{
              ...glass,
              padding: 28,
              border: "1px solid rgba(251,191,36,0.14)",
            }}
            className="about-card-hover"
          >
            <div style={sectionTitleStyle}>{t.advancedTitle}</div>

            <p style={{ lineHeight: 2, fontSize: 15.5, color: textMuted, margin: 0 }}>
              {t.advancedText}
            </p>

            <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
              {t.features.map((feature, i) => (
                <div
                  key={feature}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: goldSoft,
                      color: gold,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ lineHeight: 1.85, color: textMuted, fontSize: 14.5 }}>{feature}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              ...glass,
              padding: 28,
              border: "1px solid rgba(251,191,36,0.14)",
            }}
            className="about-card-hover"
          >
            <div style={sectionTitleStyle}>{t.technologiesTitle}</div>

            <p style={{ lineHeight: 1.9, color: textMuted, fontSize: 15 }}>
              {t.technologiesText}
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {technologies.map((tech) => (
                <div
                  key={tech}
                  className="about-chip"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 12,
                    background: "rgba(251,191,36,0.10)",
                    border: "1px solid rgba(251,191,36,0.28)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {tech}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 26,
                padding: "18px 16px",
                borderRadius: 20,
                background: "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(96,165,250,0.08))",
                border: "1px solid rgba(251,191,36,0.18)",
                boxShadow: glowGold,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 17, color: "#fff", marginBottom: 8 }}>
                {t.projectValueTitle}
              </div>
              <div style={{ color: textMuted, lineHeight: 1.9, fontSize: 14.5 }}>
                {t.projectValueText}
              </div>
            </div>
          </div>
        </section>

        <footer
          style={{
            ...glass,
            marginTop: 34,
            padding: "22px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            border: "1px solid rgba(251,191,36,0.14)",
            animation: "aboutFadeUp 1.35s ease",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>{t.footerTitle}</div>
            <div style={{ marginTop: 6, color: textSoft, fontSize: 13 }}>{t.footerSubtitle}</div>
          </div>

          <div
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(251,191,36,0.10)",
              border: "1px solid rgba(251,191,36,0.24)",
              color: gold,
              fontWeight: 800,
            }}
          >
            {t.footerBadge}
          </div>
        </footer>
      </div>
    </div>
  );
}
