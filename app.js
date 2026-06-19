import { Recipe } from "https://esm.sh/@cooklang/cooklang-ts";
import { CLIENT_ID, API_KEY, APP_ID } from "./config.js";

const SCOPE = "https://www.googleapis.com/auth/drive.file";

const els = {
  pickBtn: document.getElementById("pick-btn"),
  localInput: document.getElementById("local-input"),
  empty: document.getElementById("empty"),
  recipe: document.getElementById("recipe"),
  configWarn: document.getElementById("config-warn"),
  toast: document.getElementById("toast"),
};

let accessToken = null;
let tokenClient = null;
let pickerReady = false;

// ---------- Google bootstrap (only if configured) ----------

function isConfigured() {
  return Boolean(CLIENT_ID && API_KEY);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function initGoogle() {
  if (!isConfigured()) {
    els.configWarn.hidden = false;
    return;
  }
  try {
    await loadScript("https://apis.google.com/js/api.js");
    await new Promise((resolve) => gapi.load("picker", resolve));
    pickerReady = true;

    await loadScript("https://accounts.google.com/gsi/client");
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          toast(`Auth error: ${resp.error}`);
          return;
        }
        accessToken = resp.access_token;
        createPicker();
      },
    });
  } catch (err) {
    toast(err.message);
  }
}

function requestPick() {
  if (!isConfigured()) {
    toast("Set CLIENT_ID and API_KEY in config.js first.");
    return;
  }
  if (!pickerReady || !tokenClient) {
    toast("Google libraries are still loading — try again in a moment.");
    return;
  }
  if (accessToken) {
    createPicker();
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function createPicker() {
  const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setMode(google.picker.DocsViewMode.LIST)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const builder = new google.picker.PickerBuilder()
    .setDeveloperKey(API_KEY)
    .setOAuthToken(accessToken)
    .addView(view)
    .setCallback(onPicked);

  if (APP_ID) builder.setAppId(APP_ID);
  builder.build().setVisible(true);
}

async function onPicked(data) {
  if (data.action !== google.picker.Action.PICKED) return;
  const doc = data.docs[0];
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`Drive returned ${res.status}`);
    const source = await res.text();
    renderRecipe(source, doc.name);
  } catch (err) {
    toast(`Couldn't load file: ${err.message}`);
  }
}

// ---------- Local file fallback ----------

els.localInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const source = await file.text();
  renderRecipe(source, file.name);
  e.target.value = "";
});

// ---------- Rendering ----------

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function qty(item) {
  const q = item.quantity;
  const u = item.units;
  const hasQ = q !== undefined && q !== null && q !== "" && q !== "some";
  if (hasQ && u) return `${esc(q)} ${esc(u)}`;
  if (hasQ) return esc(q);
  if (u) return esc(u);
  return "";
}

function renderRecipe(source, filename) {
  let recipe;
  try {
    recipe = new Recipe(source);
  } catch (err) {
    toast(`Parse error: ${err.message}`);
    return;
  }

  const meta = recipe.metadata ?? {};
  const title = meta.title || filename.replace(/\.cook$/i, "");

  const metaRows = Object.entries(meta)
    .filter(([k]) => k !== "title")
    .map(
      ([k, v]) =>
        `<div class="meta-item"><span class="meta-key">${esc(k)}</span><span>${esc(v)}</span></div>`,
    )
    .join("");

  const ingredients = (recipe.ingredients ?? [])
    .map(
      (i) =>
        `<li><span class="ing-name">${esc(i.name)}</span>${
          qty(i) ? `<span class="ing-qty">${qty(i)}</span>` : ""
        }</li>`,
    )
    .join("");

  const cookware = (recipe.cookwares ?? [])
    .map((c) => `<li>${esc(c.name)}</li>`)
    .join("");

  const steps = (recipe.steps ?? [])
    .map((step, idx) => {
      const body = step
        .map((item) => {
          switch (item.type) {
            case "text":
              return esc(item.value);
            case "ingredient":
              return `<span class="tok ing" title="${qty(item)}">${esc(item.name)}</span>`;
            case "cookware":
              return `<span class="tok cw">${esc(item.name)}</span>`;
            case "timer":
              return `<span class="tok timer">${qty(item) || esc(item.name)}</span>`;
            default:
              return "";
          }
        })
        .join("");
      return `<li><span class="step-num">${idx + 1}</span><p>${body}</p></li>`;
    })
    .join("");

  els.recipe.innerHTML = `
    <h1>${esc(title)}</h1>
    ${metaRows ? `<div class="meta">${metaRows}</div>` : ""}
    <div class="cols">
      <aside class="panel">
        ${ingredients ? `<h2>Ingredients</h2><ul class="ingredients">${ingredients}</ul>` : ""}
        ${cookware ? `<h2>Cookware</h2><ul class="cookware">${cookware}</ul>` : ""}
      </aside>
      <section class="panel steps-panel">
        <h2>Method</h2>
        <ol class="steps">${steps}</ol>
      </section>
    </div>
  `;
  els.empty.hidden = true;
  els.recipe.hidden = false;
}

// ---------- Toast ----------

let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 4000);
}

// ---------- Wire up ----------

els.pickBtn.addEventListener("click", requestPick);
initGoogle();

// Demo / deep-link: ?demo loads the bundled sample, ?file=<url> loads any .cook URL.
const params = new URLSearchParams(location.search);
const fileUrl = params.has("demo") ? "./recipes/pancakes.cook" : params.get("file");
if (fileUrl) {
  fetch(fileUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.text();
    })
    .then((text) => renderRecipe(text, fileUrl.split("/").pop()))
    .catch((err) => toast(`Couldn't load ${fileUrl}: ${err.message}`));
}
