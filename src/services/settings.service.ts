import { generalSettingsRepository, type GeneralSettingsRecord } from "../infra/repositories/generalSettingsRepository";

export type GeneralSettings = GeneralSettingsRecord;

export async function getGeneralSettings(tenantId: string) {
  return generalSettingsRepository.get(tenantId);
}

export async function setGeneralSettings(tenantId: string, partial: GeneralSettings) {
  await generalSettingsRepository.merge(tenantId, partial);
}
