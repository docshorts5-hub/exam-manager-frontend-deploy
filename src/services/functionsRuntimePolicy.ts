import { getCloudFunctionSpec, type CloudFunctionName } from "./functionsCatalog";
import { callFn, invokeLocalFallback } from "./functionsClient";

export function isStrictCloudRuntimeFunction(name: CloudFunctionName): boolean {
  const spec = getCloudFunctionSpec(name);
  if (!spec) return false;
  return Boolean(spec.platformOwnerOnly || spec.category === "migration");
}

export function toCloudRuntimeActionError(
  error: unknown,
  name: CloudFunctionName,
  actionLabel?: string,
): Error {
  const spec = getCloudFunctionSpec(name);
  const title = actionLabel || spec?.description || name;
  const code = String((error as any)?.code || "");
  const originalMessage = String((error as any)?.message || "").trim();

  let message = `${title} يتطلب تشغيل Cloud Functions الفعلية لحساب مالك المنصة.`;

  if (code === "CLOUD_RUNTIME_REQUIRED" || originalMessage.startsWith("CLOUD_RUNTIME_REQUIRED:")) {
    message = `${title} يحتاج Cloud Functions مفعلة أو Emulator صحيح. تم إيقاف fallback المحلي لهذه العملية لأنها حساسة وتخص مالك المنصة.`;
  } else if (code === "functions/unavailable" || code === "unavailable") {
    message = `${title} تعذر الآن لأن خدمة Cloud Functions غير متاحة. تأكد من نشر الوظائف السحابية أو تشغيل الـ Emulator ثم أعد المحاولة.`;
  } else if (code === "functions/permission-denied" || code === "permission-denied") {
    message = `${title} فشل بسبب الصلاحيات. هذه العملية محصورة بمالك المنصة super_admin عبر Cloud Functions.`;
  } else if (originalMessage) {
    message = `${title} فشل عبر Cloud Functions: ${originalMessage}`;
  }

  const wrapped = new Error(message);
  (wrapped as any).code = code || "STRICT_CLOUD_RUNTIME";
  (wrapped as any).functionName = name;
  (wrapped as any).originalError = error;
  return wrapped;
}

export function getActionErrorMessage(error: unknown, fallback: string): string {
  return String((error as any)?.message || "").trim() || fallback;
}

export function canRetryFunctionLocally(name: CloudFunctionName): boolean {
  const spec = getCloudFunctionSpec(name);
  return Boolean(spec?.allowLocalFallback);
}

export function isCloudPreferredFunction(name: CloudFunctionName): boolean {
  const spec = getCloudFunctionSpec(name);
  return Boolean(spec?.preferCloudRuntime);
}

export type FunctionRuntimeOptions = {
  actionLabel?: string;
  bestEffort?: boolean;
  fallbackToLocalOnError?: boolean;
  wrapStrictErrors?: boolean;
};

export async function runFunctionWithRuntimePolicy<TReq = unknown, TRes = unknown>(
  name: CloudFunctionName,
  data?: TReq,
  options?: FunctionRuntimeOptions,
): Promise<TRes | null> {
  try {
    return await callFn<TReq, TRes>(name)(data);
  } catch (error) {
    const wrapStrict = options?.wrapStrictErrors !== false;
    if (wrapStrict && isStrictCloudRuntimeFunction(name)) {
      throw toCloudRuntimeActionError(error, name, options?.actionLabel);
    }

    if (options?.fallbackToLocalOnError && canRetryFunctionLocally(name)) {
      try {
        return await invokeLocalFallback<TRes>(name, data);
      } catch (fallbackError) {
        if (wrapStrict && isStrictCloudRuntimeFunction(name)) {
          throw toCloudRuntimeActionError(fallbackError, name, options?.actionLabel);
        }
        if (options?.bestEffort) return null;
        throw fallbackError;
      }
    }

    if (options?.bestEffort) return null;
    throw error;
  }
}
