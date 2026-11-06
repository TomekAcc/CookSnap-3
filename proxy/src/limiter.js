// Daily counters, one per device plus one for the whole app, for two things:
//   - requests (how many calls), and
//   - "cost units" (what the calls cost Google: tokens in + COST_WEIGHT_OUT x tokens out), recorded after each reply.
// A single Durable Object holds them all so the check-and-count is atomic (no two requests can both take the last
// slot). Counters are keyed by UTC day; older days are deleted the first time a new day is seen.
//
// The cost-unit budget is the real ceiling on spend: a phone can make few requests that are each very large, or
// many small ones, and only the units add that up fairly. It is enforced here, on the server, so no edit to the app
// (or a hand-made client) can lift it.

/** Output tokens cost several times what input tokens do (about 4-8x on the Flash models); 6 is a middle weight. */
export const COST_WEIGHT_OUT = 6;

export const costUnits = (usage) => {
  const inT = Number(usage?.promptTokenCount) || 0;
  const outT = (Number(usage?.candidatesTokenCount) || 0) + (Number(usage?.thoughtsTokenCount) || 0);
  return Math.round(inT + COST_WEIGHT_OUT * outT);
};

export class Limiter {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const payload = await request.json();
    if (payload.op === "record") return this.record(payload);
    return this.hit(payload);
  }

  // Called before a request is forwarded: counts it, unless a limit has been reached.
  async hit({ device, day, deviceLimit, globalLimit, deviceUnitLimit = Infinity, globalUnitLimit = Infinity }) {
    const globalKey = `g:${day}`;
    const deviceKey = `d:${day}:${device}`;

    const [globalCount = 0, deviceCount = 0, deviceUnits = 0, globalUnits = 0, lastDay] = await Promise.all([
      this.storage.get(globalKey),
      this.storage.get(deviceKey),
      this.storage.get(`u:${day}:${device}`),
      this.storage.get(`ug:${day}`),
      this.storage.get("lastDay"),
    ]);

    if (globalCount >= globalLimit || globalUnits >= globalUnitLimit) return Response.json({ ok: false, reason: "global" });
    if (deviceCount >= deviceLimit) return Response.json({ ok: false, reason: "device" });
    if (deviceUnits >= deviceUnitLimit) return Response.json({ ok: false, reason: "budget" });

    await this.storage.put({ [globalKey]: globalCount + 1, [deviceKey]: deviceCount + 1 });

    if (lastDay !== day) {
      await this.storage.put("lastDay", day);
      const keep = (k) => k === globalKey || k === `ug:${day}` || k.startsWith(`d:${day}:`) || k.startsWith(`u:${day}:`);
      const doomed = [];
      for (const prefix of ["d:", "g:", "u:", "ug:"]) for (const k of (await this.storage.list({ prefix })).keys()) if (!keep(k)) doomed.push(k);
      for (let i = 0; i < doomed.length; i += 128) await this.storage.delete(doomed.slice(i, i + 128));
    }
    return Response.json({ ok: true, deviceCount: deviceCount + 1, globalCount: globalCount + 1, deviceUnits, globalUnits });
  }

  // Called after Google answered: adds what the call actually cost to today's totals.
  async record({ device, day, units }) {
    const n = Math.max(0, Math.round(Number(units) || 0));
    if (!n) return Response.json({ ok: true });
    const [deviceUnits = 0, globalUnits = 0] = await Promise.all([this.storage.get(`u:${day}:${device}`), this.storage.get(`ug:${day}`)]);
    await this.storage.put({ [`u:${day}:${device}`]: deviceUnits + n, [`ug:${day}`]: globalUnits + n });
    return Response.json({ ok: true, deviceUnits: deviceUnits + n, globalUnits: globalUnits + n });
  }
}
