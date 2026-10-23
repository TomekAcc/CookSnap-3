// Daily request counters, one per device plus one for the whole app. A single Durable Object
// holds them all so the check-and-count is atomic (no two requests can both take the last slot).
// Counters are keyed by UTC day; older days are deleted the first time a new day is seen.

export class Limiter {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const { device, day, deviceLimit, globalLimit } = await request.json();
    const globalKey = `g:${day}`;
    const deviceKey = `d:${day}:${device}`;

    const [globalCount = 0, deviceCount = 0, lastDay] = await Promise.all([
      this.storage.get(globalKey),
      this.storage.get(deviceKey),
      this.storage.get("lastDay"),
    ]);

    if (globalCount >= globalLimit) return Response.json({ ok: false, reason: "global" });
    if (deviceCount >= deviceLimit) return Response.json({ ok: false, reason: "device" });

    await this.storage.put({ [globalKey]: globalCount + 1, [deviceKey]: deviceCount + 1 });

    if (lastDay !== day) {
      await this.storage.put("lastDay", day);
      const stale = [...(await this.storage.list({ prefix: "d:" })).keys()].filter((k) => !k.startsWith(`d:${day}:`));
      const staleGlobal = [...(await this.storage.list({ prefix: "g:" })).keys()].filter((k) => k !== globalKey);
      const doomed = [...stale, ...staleGlobal];
      for (let i = 0; i < doomed.length; i += 128) await this.storage.delete(doomed.slice(i, i + 128));
    }
    return Response.json({ ok: true, deviceCount: deviceCount + 1, globalCount: globalCount + 1 });
  }
}
