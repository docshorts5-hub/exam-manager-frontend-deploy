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

let wired = false;
function getWiredFunctions() {
  const fns = getFunctions(app, REGION);
  if (!wired && (isDev() || isLocalhost()) && useEmulator()) {
    connectFunctionsEmulator(fns, "localhost", 5001);
    wired = true;
    console.info("[functionsClient] Connected to Functions Emulator: localhost:5001");
  }
  return fns;
}

function shouldUseCloudRuntime(name: string) {
  if (functionsDisabled()) return false;
  if ((isDev() || isLocalhost()) && useEmulator()) return true;
  const spec = getCloudFunctionSpec(name);
  if ((isDev() || isLocalhost()) && !spec?.preferCloudRuntime) return false;
  return true;
}

function buildLocalFallbackError(name: string) {
  const spec = getCloudFunctionSpec(name);
  const descriptor = spec?.platformOwnerOnly ? "platform-owner operation" : "cloud function";
  return Object.assign(new Error(`CLOUD_RUNTIME_REQUIRED:${name}`), {
    code: "CLOUD_RUNTIME_REQUIRED",
    functionName: name,
    descriptor,
  });
}

export async function invokeLocalFallback<TRes = unknown>(name: string, data?: unknown): Promise<TRes> {
  const spec = getCloudFunctionSpec(name);
  if (!spec?.allowLocalFallback || !hasLocalFunction(name)) {
    throw buildLocalFallbackError(name);
  }
  return (await runLocalFunction(name, data)) as TRes;
}

export function callFn<TReq = any, TRes = any>(name: string) {
  return async (data?: TReq): Promise<TRes> => {
    if (!shouldUseCloudRuntime(name)) {
      return invokeLocalFallback<TRes>(name, data);
    }

    const functions = getWiredFunctions();
    const fn = httpsCallable<TReq, TRes>(functions, name);
    const res = await fn((data ?? {}) as TReq);
    return res.data;
  };
}
