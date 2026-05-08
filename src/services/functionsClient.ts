import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase";
import { getCloudFunctionSpec } from "./functionsCatalog";
import { hasLocalFunction, runLocalFunction } from "./functionsRegistry";

const REGION = String(import.meta.env.VITE_FUNCTIONS_REGION || "us-central1");

function envBool(v: unknown) {
  return String(v ?? "").toLowerCase() === "true";
}

function functionsDisabled() {
  try {
    return envBool(import.meta?.env?.VITE_DISABLE_FUNCTIONS);
  } catch {
    return false;
  }
}

function isDev() {
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
}

function isLocalhost() {
  try {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
  } catch {
    return false;
  }
}

function useEmulator() {
  try {
    return envBool(import.meta?.env?.VITE_USE_FUNCTIONS_EMULATOR);
  } catch {
    return false;
  }
}

function emulatorHost() {
  return String(import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || "localhost");
}

function emulatorPort() {
  const raw = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || 5001);
  return Number.isFinite(raw) && raw > 0 ? raw : 5001;
}

function safeFunctionName(name: string) {
  const fnName = String(name || "").trim();
  if (!fnName) throw new Error("Cloud Function name is required.");
  if (!/^[A-Za-z0-9_-]+$/.test(fnName)) {
    throw new Error(`Invalid Cloud Function name: ${fnName}`);
  }
  return fnName;
}

let wired = false;

function getWiredFunctions() {
  const fns = getFunctions(app, REGION);

  if (!wired && (isDev() || isLocalhost()) && useEmulator()) {
    connectFunctionsEmulator(fns, emulatorHost(), emulatorPort());
    wired = true;
    console.info(`[functionsClient] Connected to Functions Emulator: ${emulatorHost()}:${emulatorPort()}`);
  }

  return fns;
}

function shouldUseCloudRuntime(name: string) {
  const fnName = safeFunctionName(name);

  if (functionsDisabled()) return false;
  if ((isDev() || isLocalhost()) && useEmulator()) return true;

  const spec = getCloudFunctionSpec(fnName);
  if ((isDev() || isLocalhost()) && !spec?.preferCloudRuntime) return false;

  return true;
}

function buildLocalFallbackError(name: string) {
  const fnName = safeFunctionName(name);
  const spec = getCloudFunctionSpec(fnName);
  const descriptor = spec?.platformOwnerOnly ? "platform-owner operation" : "cloud function";

  return Object.assign(new Error(`CLOUD_RUNTIME_REQUIRED:${fnName}`), {
    code: "CLOUD_RUNTIME_REQUIRED",
    functionName: fnName,
    descriptor,
  });
}

export async function invokeLocalFallback<TRes = unknown>(name: string, data?: unknown): Promise<TRes> {
  const fnName = safeFunctionName(name);
  const spec = getCloudFunctionSpec(fnName);

  if (!spec?.allowLocalFallback || !hasLocalFunction(fnName)) {
    throw buildLocalFallbackError(fnName);
  }

  return (await runLocalFunction(fnName, data)) as TRes;
}

export function callFn<TReq = any, TRes = any>(name: string) {
  const fnName = safeFunctionName(name);

  return async (data?: TReq): Promise<TRes> => {
    if (!shouldUseCloudRuntime(fnName)) {
      return invokeLocalFallback<TRes>(fnName, data);
    }

    const functions = getWiredFunctions();
    const fn = httpsCallable<TReq, TRes>(functions, fnName);
    const res = await fn((data ?? {}) as TReq);
    return res.data;
  };
}
