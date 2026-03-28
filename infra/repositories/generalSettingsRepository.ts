import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { tenantDoc } from "../../services/tenantPaths";

export type GeneralSettingsRecord = {
  onboardingDone?: boolean;
  schoolName?: string;
  authority?: string;
  academicYear?: string;
  term?: string;
  phone?: string;
  logoUrl?: string;
} & Record<string, any>;

export const generalSettingsRepository = {
  async get(tenantId: string): Promise<GeneralSettingsRecord | null> {
    const ref = doc(db, tenantDoc(tenantId, "settings", "general"));
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as GeneralSettingsRecord) : null;
  },

  async merge(tenantId: string, partial: Partial<GeneralSettingsRecord>): Promise<void> {
    const ref = doc(db, tenantDoc(tenantId, "settings", "general"));
    await setDoc(ref, partial, { merge: true });
  },
};
