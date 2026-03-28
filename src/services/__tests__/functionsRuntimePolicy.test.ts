import { describe, expect, it } from "vitest";
import {
  canRetryFunctionLocally,
  isCloudPreferredFunction,
  isStrictCloudRuntimeFunction,
  toCloudRuntimeActionError,
} from "../functionsRuntimePolicy";

describe("functionsRuntimePolicy", () => {
  it("marks platform owner functions as strict cloud runtime", () => {
    expect(isStrictCloudRuntimeFunction("adminUpsertTenant")).toBe(true);
    expect(isStrictCloudRuntimeFunction("tenantUpsertDoc")).toBe(false);
  });

  it("marks audit writes as cloud-preferred but locally retryable", () => {
    expect(isCloudPreferredFunction("writeActivityLog")).toBe(true);
    expect(canRetryFunctionLocally("writeActivityLog")).toBe(true);
  });

  it("wraps strict runtime errors with Arabic guidance", () => {
    const err = toCloudRuntimeActionError({ code: "permission-denied" }, "adminDeleteTenant", "حذف المدرسة");
    expect(err.message).toContain("مالك المنصة");
  });
});
