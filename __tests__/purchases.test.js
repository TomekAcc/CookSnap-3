import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { EntitlementsProvider, useEntitlements } from "../src/context/EntitlementsContext";
import { PurchasesProvider, usePurchases } from "../src/context/PurchasesContext";
import { createMockProvider } from "../src/services/purchases/mockProvider";
import { createRevenueCatProvider } from "../src/services/purchases/revenueCatProvider";
import { createProvider } from "../src/services/purchases";
import { FALLBACK_PRICES } from "../src/services/purchases/catalog";

beforeEach(async () => {
  await AsyncStorage.clear();
});

const mount = async (provider) => {
  const wrapper = ({ children }) => (
    <EntitlementsProvider>
      <PurchasesProvider provider={provider}>{children}</PurchasesProvider>
    </EntitlementsProvider>
  );
  const utils = renderHook(() => ({ ent: useEntitlements(), pay: usePurchases() }), { wrapper });
  await act(async () => {});
  return utils;
};

describe("test (mock) provider", () => {
  it("a purchase turns PRO on and is remembered for a restore", async () => {
    const provider = createMockProvider({ delayMs: 0 });
    const { result } = await mount(provider);
    expect(result.current.ent.isPro).toBe(false);
    let res;
    await act(async () => (res = await result.current.pay.purchase("annual")));
    expect(res.status).toBe("success");
    expect(result.current.ent.isPro).toBe(true);
    expect((await provider.getStatus()).isPro).toBe(true);
    expect((await provider.restore()).status).toBe("restored");
  });

  it("restore finds nothing on a fresh install", async () => {
    const { result } = await mount(createMockProvider({ delayMs: 0 }));
    let res;
    await act(async () => (res = await result.current.pay.restore()));
    expect(res.status).toBe("none");
    expect(result.current.ent.isPro).toBe(false);
  });

  it("an expired subscription is not restored", async () => {
    let t = 1_000;
    const provider = createMockProvider({ delayMs: 0, now: () => t });
    await provider.purchase("monthly");
    t += 31 * 24 * 3600 * 1000;
    expect((await provider.getStatus()).isPro).toBe(false);
    expect((await provider.restore()).status).toBe("none");
  });

  it("in a build people download it grants nothing", async () => {
    const provider = createMockProvider({ delayMs: 0, allowFreeActivation: false });
    const { result } = await mount(provider);
    let res;
    await act(async () => (res = await result.current.pay.purchase("annual")));
    expect(res.status).toBe("unavailable");
    expect(result.current.ent.isPro).toBe(false);
    expect((await provider.restore()).status).toBe("unavailable");
  });
});

describe("PurchasesProvider", () => {
  const fake = (over = {}) => ({
    isReal: true,
    init: jest.fn().mockResolvedValue(),
    getOfferings: jest.fn().mockResolvedValue({ annual: { price: "49,99 zł", perMonth: "4,17 zł", anchor: "119,88 zł", trial: true }, monthly: { price: "9,99 zł", perMonth: "9,99 zł", anchor: null, trial: false } }),
    getStatus: jest.fn().mockResolvedValue({ isPro: false }),
    purchase: jest.fn().mockResolvedValue({ status: "success" }),
    restore: jest.fn().mockResolvedValue({ status: "restored" }),
    ...over,
  });

  it("shows the store's prices once they arrive, and the fallback before", async () => {
    const { result } = await mount(fake());
    await waitFor(() => expect(result.current.pay.offerings.annual.price).toBe("49,99 zł"));
    expect(FALLBACK_PRICES.annual.price).toBe("$29.99");
  });

  it("a cancelled purchase leaves PRO off and is not an error", async () => {
    const { result } = await mount(fake({ purchase: jest.fn().mockResolvedValue({ status: "cancelled" }) }));
    let res;
    await act(async () => (res = await result.current.pay.purchase("annual")));
    expect(res.status).toBe("cancelled");
    expect(result.current.ent.isPro).toBe(false);
  });

  it("a provider that throws becomes an error result, never a crash", async () => {
    const { result } = await mount(fake({ purchase: jest.fn().mockRejectedValue(new Error("boom")) }));
    let res;
    await act(async () => (res = await result.current.pay.purchase("monthly")));
    expect(res).toMatchObject({ status: "error" });
    expect(result.current.ent.isPro).toBe(false);
    expect(result.current.pay.busy).toBe(null);
  });

  it("ignores a second tap while one purchase is running", async () => {
    let release;
    const purchase = jest.fn(() => new Promise((r) => (release = () => r({ status: "success" }))));
    const { result } = await mount(fake({ purchase }));
    let first;
    act(() => {
      first = result.current.pay.purchase("annual");
    });
    await waitFor(() => expect(result.current.pay.busy).toBe("purchase"));
    let second;
    await act(async () => (second = await result.current.pay.purchase("annual")));
    expect(second.status).toBe("busy");
    await act(async () => {
      release();
      await first;
    });
    expect(purchase).toHaveBeenCalledTimes(1);
    expect(result.current.ent.isPro).toBe(true);
  });

  it("with a real store, PRO turns on when the store says it is active", async () => {
    const getStatus = jest.fn().mockResolvedValue({ isPro: true });
    const { result } = await mount(fake({ getStatus }));
    await waitFor(() => expect(result.current.ent.isPro).toBe(true));
  });

  it("with a real store, a lapsed subscription turns PRO back off", async () => {
    await AsyncStorage.setItem("cooksnap:isPro:v1", "true");
    const { result } = await mount(fake({ getStatus: jest.fn().mockResolvedValue({ isPro: false }) }));
    await waitFor(() => expect(result.current.ent.isPro).toBe(false));
  });

  it("with the test provider, the store check never switches the testing PRO toggle off", async () => {
    await AsyncStorage.setItem("cooksnap:isPro:v1", "true");
    const { result } = await mount(createMockProvider({ delayMs: 0 }));
    await act(async () => {});
    expect(result.current.ent.isPro).toBe(true);
  });
});

describe("RevenueCat provider", () => {
  const pkg = (identifier, price, priceString, introPrice = null) => ({ identifier, product: { price, priceString, currencyCode: "USD", introPrice } });
  const sdk = (overrides = {}) => ({
    configure: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: { availablePackages: [pkg("$rc_annual", 29.99, "$29.99", {}), pkg("$rc_monthly", 5.99, "$5.99")] } }),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    purchasePackage: jest.fn().mockResolvedValue({ customerInfo: { entitlements: { active: { pro: {} } } } }),
    restorePurchases: jest.fn().mockResolvedValue({ entitlements: { active: { pro: {} } } }),
    ...overrides,
  });

  it("maps the store's packages to our two plans, with a trial only where the store has an intro offer", async () => {
    const provider = createRevenueCatProvider({ apiKey: "k", Purchases: sdk() });
    await provider.init();
    const o = await provider.getOfferings();
    expect(o.annual).toMatchObject({ price: "$29.99", trial: true });
    expect(o.annual.perMonth).toMatch(/2\.50/);
    expect(o.annual.anchor).toMatch(/71\.88/);
    expect(o.monthly).toMatchObject({ price: "$5.99", trial: false, anchor: null });
  });

  it("buys the package for the chosen plan and reports success only when the entitlement is active", async () => {
    const Purchases = sdk();
    const provider = createRevenueCatProvider({ apiKey: "k", Purchases });
    await provider.getOfferings();
    expect((await provider.purchase("annual")).status).toBe("success");
    expect(Purchases.purchasePackage.mock.calls[0][0].identifier).toBe("$rc_annual");
    Purchases.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    expect((await provider.purchase("monthly")).status).toBe("error");
  });

  it("tells a cancelled purchase from a failed one", async () => {
    const Purchases = sdk({ purchasePackage: jest.fn().mockRejectedValue({ userCancelled: true }) });
    const provider = createRevenueCatProvider({ apiKey: "k", Purchases });
    await provider.getOfferings();
    expect((await provider.purchase("annual")).status).toBe("cancelled");
    Purchases.purchasePackage.mockRejectedValue(new Error("network"));
    expect(await provider.purchase("annual")).toMatchObject({ status: "error", message: "network" });
  });

  it("loads the prices itself when a purchase starts before they arrived", async () => {
    const Purchases = sdk();
    const provider = createRevenueCatProvider({ apiKey: "k", Purchases });
    expect((await provider.purchase("annual")).status).toBe("success");
    expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
  });

  it("answers 'unavailable' (never throws) while the store has no products, e.g. before Apple opens payments", async () => {
    const empty = createRevenueCatProvider({ apiKey: "k", Purchases: sdk({ getOfferings: jest.fn().mockResolvedValue({ current: null }) }) });
    expect((await empty.getOfferings()).annual).toEqual(FALLBACK_PRICES.annual);
    expect((await empty.purchase("annual")).status).toBe("unavailable");
    const down = createRevenueCatProvider({ apiKey: "k", Purchases: sdk({ getOfferings: jest.fn().mockRejectedValue(new Error("offline")) }) });
    expect((await down.purchase("monthly")).status).toBe("unavailable");
  });

  it("restore reports what the store has", async () => {
    const Purchases = sdk();
    const provider = createRevenueCatProvider({ apiKey: "k", Purchases });
    expect((await provider.restore()).status).toBe("restored");
    Purchases.restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
    expect((await provider.restore()).status).toBe("none");
  });
});

describe("createProvider", () => {
  it("uses RevenueCat only when this platform has a key and the package is there", () => {
    const load = () => ({ configure() {} });
    expect(createProvider({ platform: "ios", keys: { ios: "k" }, load }).kind).toBe("revenuecat");
    expect(createProvider({ platform: "android", keys: { ios: "k" }, load }).kind).toBe("mock");
    expect(createProvider({ platform: "ios", keys: { ios: "k" }, load: () => null }).kind).toBe("mock");
    expect(createProvider({ platform: "web", keys: {}, load }).kind).toBe("mock");
  });
});

describe("order of calls", () => {
  it("configures the provider before it is asked for anything", async () => {
    const calls = [];
    const provider = {
      isReal: true,
      init: jest.fn(async () => { await new Promise((r) => setTimeout(r, 20)); calls.push("init"); }),
      getOfferings: jest.fn(async () => (calls.push("offerings"), FALLBACK_PRICES)),
      getStatus: jest.fn(async () => (calls.push("status"), { isPro: false })),
    };
    await mount(provider);
    await waitFor(() => expect(calls).toContain("status"));
    expect(calls[0]).toBe("init");
  });
});

describe("plansFromOfferings", () => {
  const { plansFromOfferings } = require("../src/services/purchases/plans");
  it("replaces the fixed prices with the store's and keeps everything else", () => {
    const plans = plansFromOfferings({
      annual: { price: "29,99 zł", perMonth: "2,50 zł", anchor: "", trial: false },
      monthly: { price: "5,99 zł", perMonth: "", anchor: "", trial: false },
    });
    expect(plans.annual.price).toBe("29,99 zł");
    expect(plans.annual.perMonthPrice).toBe("2,50 zł");
    expect(plans.annual.trial).toBe(false);
    expect(plans.monthly.price).toBe("5,99 zł");
    expect(plans.annual.id).toBeDefined();
  });
  it("falls back to the built-in plans without offerings", () => {
    const plans = plansFromOfferings(null);
    expect(plans.annual.price).toBeTruthy();
    expect(plans.monthly.price).toBeTruthy();
  });
});
