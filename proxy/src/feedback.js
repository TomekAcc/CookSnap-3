// Feedback from Help & Feedback: validation of what the app sends, and the page the owner reads it on.

export const FEEDBACK_KINDS = ["bug", "idea", "recipe", "other"];
export const MAX_FEEDBACK_BYTES = 8 * 1024;
export const MAX_MESSAGE = 2000;
const PLATFORMS = ["ios", "android", "web"];

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Returns { problem } for a bad body, or { record } with only the fields we keep, trimmed to size. */
export function validateFeedback(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { problem: "Body must be an object" };
  if (!FEEDBACK_KINDS.includes(body.kind)) return { problem: "Unknown kind" };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { problem: "Message is empty" };
  if (message.length > MAX_MESSAGE) return { problem: "Message is too long" };
  const id = typeof body.id === "string" && /^[a-f0-9]{16,40}$/.test(body.id) ? body.id : "";
  return {
    record: {
      id,
      kind: body.kind,
      message,
      contact: text(body.contact, 120),
      recipeTitle: text(body.recipeTitle, 120),
      appVersion: text(body.appVersion, 20),
      platform: PLATFORMS.includes(body.platform) ? body.platform : "other",
      language: text(body.language, 10),
    },
  };
}

/**
 * Sends text to the owner's Telegram chat (used for a copy of each new message, and by the test button on /admin), so it arrives on the phone at once and exists in a
 * second place. Optional (needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID) and never allowed to break saving: any
 * failure is swallowed, the message is already stored.
 */
export async function sendTelegram(env, text, fetchFn = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set on the server" };
  }
  // Secrets pasted from notes often carry a stray space, a line break, quotes or a leading "bot"; clean those off
  // and say plainly when what is left still has the wrong shape (Telegram itself only answers "404 Not Found").
  const token = String(env.TELEGRAM_BOT_TOKEN).trim().replace(/^["']|["']$/g, "").replace(/^bot(?=\d)/i, "");
  const chat = String(env.TELEGRAM_CHAT_ID).trim().replace(/^["']|["']$/g, "");
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return { ok: false, description: `TELEGRAM_BOT_TOKEN has the wrong shape (${token.length} characters, ${token.includes(":") ? "has" : "has no"} a colon). It must be digits, a colon, then letters and digits: copy it again from BotFather.` };
  }
  if (!/^-?\d+$/.test(chat)) {
    return { ok: false, description: "TELEGRAM_CHAT_ID must be only digits (the number after \"chat\":{\"id\": from getUpdates)." };
  }
  try {
    const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return { ok: true, description: "Sent. Look in your chat with the bot." };
    // Telegram's own wording ("Unauthorized", "Bad Request: chat not found", ...); it never contains the token.
    const body = await res.json().catch(() => ({}));
    return { ok: false, description: `Telegram answered ${res.status}: ${body.description || "no details"}` };
  } catch (err) {
    return { ok: false, description: `Could not reach Telegram: ${err?.message || err}` };
  }
}

// Only a "something new arrived" ping is sent, never the message itself, the reply address or the recipe title: nothing a
// user wrote leaves our own server, so Telegram is not a recipient of personal data. Read the message on the /admin page.
export async function notifyTelegram(env, record, fetchFn = fetch) {
  const text = `CookSnap: new feedback (${record.kind}, ${record.platform} ${record.appVersion || "?"}). Open the /admin page to read it.`;
  return (await sendTelegram(env, text, fetchFn)).ok;
}

/** Constant-time comparison, so the response time does not reveal how much of a guess was right. */
export function tokenMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || expected.length < 24) return false;
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return diff === 0;
}

// The reading page. Everything user-written is put on the page with textContent, never as HTML.
export const ADMIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>CookSnap feedback</title>
<style>
:root{--bg:#f5f6f8;--card:#fff;--ink:#14161a;--soft:#5b6270;--line:#e3e6ec;--accent:#059669}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171b22;--ink:#eef0f4;--soft:#9aa3b2;--line:#262c36;--accent:#34d399}}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:0 0 4px}
.soft{color:var(--soft)}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}
input,button{font:inherit;border-radius:10px;border:1px solid var(--line);padding:9px 12px;background:var(--card);color:var(--ink)}
button{cursor:pointer}button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:10px 0}
.meta{display:flex;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--soft);margin-bottom:6px}
.tag{border-radius:99px;padding:1px 9px;background:var(--line);color:var(--ink);font-weight:600}
.msg{white-space:pre-wrap;word-break:break-word}#tgout{flex-basis:100%;font-weight:600}.del{margin-top:8px;font-size:13px}
</style></head><body><main>
<h1>CookSnap feedback</h1><div class="soft" id="status">Enter your access token.</div>
<div class="row" id="login"><input id="token" type="password" placeholder="Access token" autocomplete="current-password"><button id="go">Open</button></div>
<div class="row" id="filters" hidden></div><div class="row" id="tools" hidden><button id="tg">Send Telegram test</button><div id="tgout" class="soft"></div></div><div id="list"></div></main>
<script>
const KINDS=["all","bug","idea","recipe","other"];let items=[],kind="all",token=sessionStorage.getItem("t")||"";
const $=(id)=>document.getElementById(id);
async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}});
if(r.status===401){sessionStorage.removeItem("t");throw new Error("Wrong token");}if(!r.ok)throw new Error("Error "+r.status);return r.json();}
function draw(){const box=$("list");box.textContent="";const shown=items.filter(i=>kind==="all"||i.kind===kind);
$("status").textContent=shown.length+" of "+items.length+" messages (newest first, kept 90 days)";
for(const i of shown){const d=document.createElement("div");d.className="item";const m=document.createElement("div");m.className="meta";
const tag=document.createElement("span");tag.className="tag";tag.textContent=i.kind;m.append(tag);
for(const part of [new Date(i.at).toLocaleString(),i.platform+" "+i.appVersion,i.language,i.recipeTitle?"recipe: "+i.recipeTitle:"",i.contact?"contact: "+i.contact:""]){if(part.trim()){const s=document.createElement("span");s.textContent=part;m.append(s);}}
const t=document.createElement("div");t.className="msg";t.textContent=i.message;
const b=document.createElement("button");b.className="del";b.textContent="Delete";b.onclick=async()=>{if(!confirm("Delete this message?"))return;await api("/admin/delete",{method:"POST",body:JSON.stringify({id:i.id})});items=items.filter(x=>x.id!==i.id);draw();};
d.append(m,t,b);box.append(d);}}
function filters(){const f=$("filters");f.hidden=false;f.textContent="";for(const k of KINDS){const b=document.createElement("button");b.textContent=k;b.className=k===kind?"on":"";b.onclick=()=>{kind=k;filters();draw();};f.append(b);}}
$("tg").onclick=async()=>{const out=$("tgout");out.textContent="Sending test...";try{const r=await api("/admin/telegram-test",{method:"POST",body:"{}"});out.textContent=(r.ok?"OK: ":"Problem: ")+r.description;}catch(e){out.textContent="Problem: "+e.message;}};
async function load(){try{items=(await api("/admin/list")).items;$("login").hidden=true;$("tools").hidden=false;filters();draw();}catch(e){$("status").textContent=e.message;$("login").hidden=false;}}
$("go").onclick=()=>{token=$("token").value.trim();sessionStorage.setItem("t",token);load();};
if(token)load();
</script></body></html>`;
