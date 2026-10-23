// A codec turns a state value into the string AsyncStorage keeps and back.
//   parse(raw)      -> the value, or undefined when `raw` is not valid for
//                      this state (the caller then keeps its default).
//   serialize(value) -> the string to store, or null to delete the key.
// Parsing never throws, so one corrupt key can't break startup.

/** JSON, accepted only when `validate(parsed)` is true. `revive` post-processes. */
export function jsonCodec(validate = () => true, revive = (value) => value) {
  return {
    parse(raw) {
      try {
        const value = JSON.parse(raw);
        return validate(value) ? revive(value) : undefined;
      } catch {
        return undefined;
      }
    },
    serialize: (value) => JSON.stringify(value),
  };
}

export const arrayCodec = jsonCodec(Array.isArray);

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** A JSON object whose saved fields are laid over `defaults` (new fields keep their default). */
export const objectCodec = (defaults) =>
  jsonCodec(isPlainObject, (saved) => ({ ...defaults, ...saved }));

/** A plain string, accepted only when `validate(raw)` is true (default: any string). */
export function textCodec(validate = () => true) {
  return {
    parse: (raw) => (validate(raw) ? raw : undefined),
    serialize: (value) => String(value),
  };
}

/** One of a fixed set of strings. */
export const enumCodec = (...allowed) => textCodec((raw) => allowed.includes(raw));

/** A positive whole number stored as text. */
export const positiveIntCodec = {
  parse(raw) {
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  },
  serialize: (value) => String(value),
};

/** A one-time flag: stored as "true", deleted when false. */
export const flagCodec = {
  parse: (raw) => (raw === "true" ? true : undefined),
  serialize: (value) => (value ? "true" : null),
};

/** A boolean stored as "true" / "false". */
export const booleanCodec = {
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : undefined),
  serialize: (value) => (value ? "true" : "false"),
};
