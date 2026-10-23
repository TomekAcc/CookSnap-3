import AsyncStorage from "@react-native-async-storage/async-storage";
import * as storage from "../src/storage/storage";
import {
  arrayCodec,
  booleanCodec,
  enumCodec,
  flagCodec,
  jsonCodec,
  objectCodec,
  positiveIntCodec,
  textCodec,
} from "../src/storage/codecs";
import { STORAGE_KEYS } from "../src/storage/keys";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("storage.getItem batching", () => {
  it("sends reads requested in the same tick as ONE multiGet", async () => {
    await AsyncStorage.setItem("a", "1");
    await AsyncStorage.setItem("b", "2");
    jest.clearAllMocks();
    const [a, b, missing] = await Promise.all([
      storage.getItem("a"),
      storage.getItem("b"),
      storage.getItem("nope"),
    ]);
    expect([a, b, missing]).toEqual(["1", "2", null]);
    expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.multiGet).toHaveBeenCalledWith(["a", "b", "nope"]);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it("answers every caller when the same key is requested twice", async () => {
    await AsyncStorage.setItem("a", "1");
    const [x, y] = await Promise.all([storage.getItem("a"), storage.getItem("a")]);
    expect([x, y]).toEqual(["1", "1"]);
  });

  it("rejects every waiting caller when the native read fails", async () => {
    AsyncStorage.multiGet.mockRejectedValueOnce(new Error("disk"));
    const results = await Promise.allSettled([storage.getItem("a"), storage.getItem("b")]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
  });

  it("starts a new batch for reads made later", async () => {
    await storage.getItem("a");
    await storage.getItem("b");
    expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(2);
  });

  it("writes and removes straight through", async () => {
    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");
    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });
});

describe("STORAGE_KEYS", () => {
  it("has unique, versioned, namespaced keys", () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(v).toMatch(/^cookai:[A-Za-z]+:v\d+$/);
  });

  it("keeps the exact key strings existing installs already wrote (renaming one silently loses user data)", () => {
    expect(STORAGE_KEYS).toMatchObject({
      favorites: "cookai:favorites:v1",
      savedRecipes: "cookai:savedRecipes:v1",
      pantryItems: "cookai:pantryItems:v1",
      isPro: "cookai:isPro:v1",
      dailyFridgeScans: "cookai:dailyFridgeScans:v1",
      dailyPantryScans: "cookai:dailyPantryScans:v1",
      dailyRecipeGenerations: "cookai:dailyRecipeGenCount:v1",
      recipeLanguage: "cookai:recipeLanguage:v1",
      dietaryRestrictions: "cookai:dietaryRestrictions:v1",
      onboardingComplete: "cookai:onboardingComplete:v1",
    });
  });
});

describe("codecs", () => {
  it("jsonCodec validates and never throws on bad input", () => {
    const codec = jsonCodec((v) => typeof v === "number");
    expect(codec.parse("5")).toBe(5);
    expect(codec.parse('"x"')).toBeUndefined();
    expect(codec.parse("{oops")).toBeUndefined();
    expect(codec.serialize(5)).toBe("5");
  });

  it("arrayCodec accepts only arrays", () => {
    expect(arrayCodec.parse("[1,2]")).toEqual([1, 2]);
    expect(arrayCodec.parse('{"a":1}')).toBeUndefined();
    expect(arrayCodec.parse("null")).toBeUndefined();
    expect(arrayCodec.parse("not json")).toBeUndefined();
  });

  it("objectCodec lays saved fields over the defaults and rejects arrays", () => {
    const codec = objectCodec({ vegan: false, keto: false });
    expect(codec.parse('{"vegan":true}')).toEqual({ vegan: true, keto: false });
    expect(codec.parse("[1,2]")).toBeUndefined();
    expect(codec.parse('"x"')).toBeUndefined();
  });

  it("textCodec / enumCodec accept only allowed strings", () => {
    expect(textCodec().parse("anything")).toBe("anything");
    expect(textCodec().parse("")).toBe("");
    const unit = enumCodec("us", "metric");
    expect(unit.parse("metric")).toBe("metric");
    expect(unit.parse("klingon")).toBeUndefined();
  });

  it("positiveIntCodec accepts whole numbers above zero", () => {
    expect(positiveIntCodec.parse("4")).toBe(4);
    expect(positiveIntCodec.parse("0")).toBeUndefined();
    expect(positiveIntCodec.parse("-2")).toBeUndefined();
    expect(positiveIntCodec.parse("abc")).toBeUndefined();
    expect(positiveIntCodec.serialize(4)).toBe("4");
  });

  it("flagCodec stores true and deletes the key for false; booleanCodec stores both", () => {
    expect(flagCodec.parse("true")).toBe(true);
    expect(flagCodec.parse("false")).toBeUndefined();
    expect(flagCodec.serialize(true)).toBe("true");
    expect(flagCodec.serialize(false)).toBeNull();
    expect(booleanCodec.parse("false")).toBe(false);
    expect(booleanCodec.parse("maybe")).toBeUndefined();
    expect(booleanCodec.serialize(false)).toBe("false");
  });
});
