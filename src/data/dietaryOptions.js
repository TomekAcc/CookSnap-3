export const FULL_DIETARY_OPTIONS = [
  {
    id: "vegetarian",
    name: "Vegetarian",
    icon: "🥬",
    desc: "No meat or poultry",
  },
  {
    id: "vegan",
    name: "Vegan",
    icon: "🌿",
    desc: "100% plant-based food",
  },
  {
    id: "gluten_free",
    name: "Gluten-Free",
    icon: "🌾",
    desc: "No wheat, barley or rye",
  },
  {
    id: "lactose_free",
    name: "Lactose-Free",
    icon: "🥛",
    desc: "No dairy milk sugars",
  },
  {
    id: "dairy_free",
    name: "Dairy-Free",
    icon: "🧀",
    desc: "Zero milk products",
  },
  {
    id: "keto",
    name: "Keto & Low-Carb",
    icon: "🥑",
    desc: "High fat, minimal carbs",
  },
  {
    id: "nut_free",
    name: "Nut-Free",
    icon: "🥜",
    desc: "Safe from tree nuts & peanuts",
  },
  {
    id: "pescatarian",
    name: "Pescatarian",
    icon: "🐟",
    desc: "Fish & plant-based diet",
  },
  {
    id: "diabetic",
    name: "Diabetic Friendly",
    icon: "🍏",
    desc: "Low glycemic index meals",
  },
];

/** Default map: every diet id → false */
export const DIETARY_OPTIONS_DEFAULT = FULL_DIETARY_OPTIONS.reduce(
  (acc, item) => {
    acc[item.id] = false;
    return acc;
  },
  {}
);
