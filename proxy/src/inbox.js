// The feedback inbox: one Durable Object that keeps messages for a limited time and counts how many a
// phone may send per day (so a script cannot fill it). Keys sort by time, so a list is already ordered.

export const RETENTION_DAYS = 90;
export const MAX_MESSAGES = 2000;

export class Inbox {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const req = await request.json();
    if (req.op === "add") return Response.json(await this.add(req));
    if (req.op === "list") return Response.json({ items: await this.list() });
    if (req.op === "delete") {
      await this.storage.delete([req.id]);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false }, { status: 400 });
  }

  async add({ device, day, now, record, deviceLimit, globalLimit }) {
    const deviceKey = `rl:${day}:${device}`;
    const globalKey = `rg:${day}`;
    const [deviceCount = 0, globalCount = 0, lastDay] = await Promise.all([
      this.storage.get(deviceKey),
      this.storage.get(globalKey),
      this.storage.get("lastDay"),
    ]);
    if (globalCount >= globalLimit) return { ok: false, reason: "global" };
    if (deviceCount >= deviceLimit) return { ok: false, reason: "device" };

    const id = `m:${now}:${Math.random().toString(36).slice(2, 8)}`;
    await this.storage.put({ [id]: { id, at: now, ...record }, [deviceKey]: deviceCount + 1, [globalKey]: globalCount + 1 });

    if (lastDay !== day) {
      await this.storage.put("lastDay", day);
      const stale = [...(await this.storage.list({ prefix: "rl:" })).keys(), ...(await this.storage.list({ prefix: "rg:" })).keys()].filter(
        (k) => !k.startsWith(`rl:${day}:`) && k !== globalKey
      );
      for (let i = 0; i < stale.length; i += 128) await this.storage.delete(stale.slice(i, i + 128));
    }
    await this.trim(now);
    return { ok: true };
  }

  async list() {
    const all = [...(await this.storage.list({ prefix: "m:" })).values()];
    return all.sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  // Old messages and anything beyond the cap go, so the inbox cannot grow without limit.
  async trim(now) {
    const cutoff = new Date(new Date(now).getTime() - RETENTION_DAYS * 86400000).toISOString();
    const keys = [...(await this.storage.list({ prefix: "m:" })).keys()].sort();
    const doomed = keys.filter((k, i) => k.slice(2, 26) < cutoff || i < keys.length - MAX_MESSAGES);
    for (let i = 0; i < doomed.length; i += 128) await this.storage.delete(doomed.slice(i, i + 128));
  }
}
