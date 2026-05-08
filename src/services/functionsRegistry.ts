import { getCloudFunctionSpec, type CloudFunctionName } from "./functionsCatalog";
import { localFunctionHandlers } from "./functionsLocalFallbacks";

export function hasLocalFunction(name: string): name is CloudFunctionName {
  return Boolean(getCloudFunctionSpec(name) && (localFunctionHandlers as Record<string, unknown>)[name]);
}

export async function runLocalFunction(name: string, data?: unknown) {
  if (!hasLocalFunction(name)) {
    throw Object.assign(new Error(`LOCAL_FUNCTION_NOT_IMPLEMENTED:${name}`), { code: "LOCAL_FUNCTION_NOT_IMPLEMENTED" });
  }
  return localFunctionHandlers[name](data);
}
