import type { SuperPortalActionCard } from "../types";

type Input = {
  owner: boolean;
  isScopeAdmin: boolean;
  navigate: (path: string) => void;
};

export function buildSuperPortalCards(input: Input): SuperPortalActionCard[] {
  const cards: SuperPortalActionCard[] = [
    {
      key: "program",
      title: "الدخول للبرنامج",
      description: "الدخول إلى واجهة المدارس وتشغيل النظام مع إمكان اختيار المدرسة المناسبة.",
      cta: "دخول",
      onClick: () => input.navigate("/super/program"),
    },
  ];

  if (input.owner) {
    cards.push({
      key: "platform-owner",
      title: "لوحة مالك المنصة",
      description: "إدارة كاملة للمنصة: المستخدمون، المدارس، الصلاحيات العليا، والدعم الفني.",
      cta: "فتح لوحة مالك المنصة",
      onClick: () => input.navigate("/system"),
    });
  }

  if (input.owner || input.isScopeAdmin) {
    cards.push({
      key: "scope-admin",
      title: input.owner ? "إدارة المحافظات والمدارس" : "لوحة المحافظة",
      description: input.owner
        ? "الانتقال لإدارة المدارس والمستخدمين على مستوى المحافظات، مع الاحتفاظ بصلاحيات مالك المنصة الكاملة."
        : "إدارة مدارس محافظتك فقط، وإضافة وربط مسؤولي المدارس.",
      cta: input.owner ? "فتح إدارة المحافظات" : "فتح لوحة المحافظة",
      onClick: () => input.navigate("/super-system"),
    });
  }

  return cards;
}
