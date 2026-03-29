import { describe, expect, it, vi } from "vitest";
import { buildSuperPortalCards } from "../services/superPortalService";

describe("buildSuperPortalCards", () => {
  it("always includes the program entry card", () => {
    const navigate = vi.fn();
    const cards = buildSuperPortalCards({ owner: false, isScopeAdmin: false, navigate });
    expect(cards.map((card) => card.key)).toEqual(["program"]);
    cards[0].onClick();
    expect(navigate).toHaveBeenCalledWith("/super/program");
  });

  it("adds owner and scope-management cards for platform owner", () => {
    const navigate = vi.fn();
    const cards = buildSuperPortalCards({ owner: true, isScopeAdmin: true, navigate });
    expect(cards.map((card) => card.key)).toEqual(["program", "platform-owner", "scope-admin"]);
  });

  it("adds only scope-management card for regional super user", () => {
    const navigate = vi.fn();
    const cards = buildSuperPortalCards({ owner: false, isScopeAdmin: true, navigate });
    expect(cards.map((card) => card.key)).toEqual(["program", "scope-admin"]);
  });
});
