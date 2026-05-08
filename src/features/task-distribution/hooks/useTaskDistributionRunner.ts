import { useState } from "react";
import { runTaskDistributionOptimized, type DistributionEngine, type DistributionNormalize, type DistributionTransform } from "../services/taskDistributionRunner";

function tr(ar: string, en: string) {
  if (typeof document !== "undefined") {
    const lang = String(document.documentElement?.lang || "").toLowerCase();
    if (lang.startsWith("en")) return en;
  }
  return ar;
}

export function useTaskDistributionRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  async function executeDistribution(params: {
    teachers: any[];
    exams: any[];
    constraints: any;
    validate: () => string[];
    onValidationErrors: (errors: string[]) => void;
    engine: DistributionEngine;
    normalize?: DistributionNormalize;
    rebalanceReserve?: DistributionTransform;
    rebalanceInvigilations?: DistributionTransform;
    rebalanceFairness?: DistributionTransform;
  }) {
    setRuntimeError(null);
    const errs = params.validate();
    params.onValidationErrors(errs);
    if (errs.length) return null;

    setIsRunning(true);
    try {
      const latestTeachers = params.teachers || [];
      const latestExams = params.exams || [];

      if (!latestTeachers.length) {
        throw new Error(tr(
          "لا يوجد معلمين. تأكد من إضافة الكادر التعليمي (داخل المدرسة الحالية).",
          "No teachers found. Make sure the teaching staff has been added for the current school."
        ));
      }
      if (!latestExams.length) {
        throw new Error(tr(
          "لا يوجد امتحانات. تأكد من إضافة جدول الامتحانات (داخل المدرسة الحالية).",
          "No exams found. Make sure the exams schedule has been added for the current school."
        ));
      }

      const roomsSum = latestExams.reduce((a: number, e: any) => a + (Number(e.roomsCount) || 0), 0);
      if (roomsSum <= 0) {
        throw new Error(tr(
          "مجموع عدد القاعات = 0. تأكد أن لكل امتحان roomsCount أكبر من صفر.",
          "Total rooms count = 0. Make sure each exam has roomsCount greater than zero."
        ));
      }

      return runTaskDistributionOptimized({
        teachers: latestTeachers,
        exams: latestExams,
        constraints: params.constraints,
        engine: params.engine,
        normalize: params.normalize,
        rebalanceReserve: params.rebalanceReserve,
        rebalanceInvigilations: params.rebalanceInvigilations,
        rebalanceFairness: params.rebalanceFairness,
      });
    } catch (e: any) {
      setRuntimeError(
        e?.message
          ? String(e.message)
          : tr("حدث خطأ غير معروف أثناء التشغيل", "An unknown error occurred while running")
      );
      return null;
    } finally {
      setIsRunning(false);
    }
  }

  return {
    isRunning,
    runtimeError,
    setRuntimeError,
    executeDistribution,
  };
}
