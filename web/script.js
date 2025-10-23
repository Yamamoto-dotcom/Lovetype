// 状態
const state = {
  apiBase: localStorage.getItem("apiBase") || "",
  chart: null,
  types: []
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function setNote(msg) { const el = $("#note"); if (el) el.textContent = msg || ""; }

// API URL 保存
function saveApi() {
  const val = $("#apiBase").value.trim().replace(/\/+$/, "");
  state.apiBase = val;
  localStorage.setItem("apiBase", state.apiBase);
  setNote("API URL を保存しました。");
  if (state.apiBase) loadTypes();
}

// タイプ一覧の読み込み
async function loadTypes() {
  if (!state.apiBase) { setNote("API URL を設定してください。"); return; }
  const selA = $("#typeA"), selB = $("#typeB");
  selA.innerHTML = `<option value="" disabled selected>読み込み中...</option>`;
  selB.innerHTML = selA.innerHTML;
  try {
    const res = await fetch(`${state.apiBase}/types`);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      selA.innerHTML = `<option value="" disabled selected>（タイプが読み込めません）</option>`;
      selB.innerHTML = selA.innerHTML;
      setNote("Step3 のデータ設置・Render再起動を確認してください。");
      return;
    }
    state.types = arr;
    const opts = [`<option value="" disabled selected>あなたのラブタイプを選択</option>`]
      .concat(arr.map(t => `<option value="${t}">${t}</option>`)).join("");
    selA.innerHTML = opts;
    selB.innerHTML = [`<option value="" disabled selected>お相手のラブタイプを選択</option>`]
      .concat(arr.map(t => `<option value="${t}">${t}</option>`)).join("");
    setNote("");
  } catch (e) {
    setNote("APIに接続できません。URLやCORS、Renderの稼働を確認してください。");
  }
}

// レーダーチャート
function ensureRadar(scores) {
  const ctx = $("#radarCanvas");
  const data = {
    labels: ["共感","調和","依存","刺激","信頼"],
    datasets: [{
      label: "合算スコア",
      data: [scores["共感"], scores["調和"], scores["依存"], scores["刺激"], scores["信頼"]],
      borderWidth: 2,
      fill: true,
      borderColor: "rgba(255,106,165,0.9)",
      backgroundColor: "rgba(255,106,165,0.25)",
      pointBackgroundColor: "rgba(255,106,165,1)"
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        suggestedMin: 0, suggestedMax: 200,
        grid: { color: "rgba(0,0,0,.14)" },
        angleLines: { color: "rgba(0,0,0,.18)" },
        pointLabels: { color: "rgba(0,0,0,.55)", font: { size: 12 } },
        ticks: { backdropColor: "transparent", showLabelBackdrop: false, color: "rgba(0,0,0,.55)" }
      }
    },
    plugins: { legend: { display: false } }
  };
  if (state.chart) {
    state.chart.data = data;
    state.chart.update();
  } else {
    state.chart = new Chart(ctx, { type: "radar", data, options });
  }
}

// 本文を「強み/注意」にざっくり分割（記号や改行で分ける。なければ前半/後半）
function splitBody(text) {
  if (!text) return ["", ""];
  const dividers = ["\n—\n", "\n---\n", "\n◇\n", "\n■注意", "注意：", "【注意】"];
  for (const d of dividers) {
    const idx = text.indexOf(d);
    if (idx > 0) return [text.slice(0, idx).trim(), text.slice(idx).replace(d, "").trim()];
  }
  if (text.length <= 140) return [text, ""];
  const mid = Math.floor(text.length / 2);
  return [text.slice(0, mid).trim(), text.slice(mid).trim()];
}

function renderResult(payload) {
  // タイトル＆キャッチ
  const macroTop = payload?.macro?.top || "-";
  const micro = payload?.micro?.type || "-";
  $("#summaryTitle").textContent = `${macroTop} / ${micro}`;
  $("#summaryCatch").textContent = payload?.copy?.catch || "";

  // ハイブリッドと候補
  const second = payload?.macro?.second;
  const margin = payload?.macro?.margin;
  const cand = (payload?.macro?.candidates || []).map(c => `${c.name}:${c.distance}`).join(" / ");
  $("#summaryMeta").textContent = (second && margin !== null && margin <= 0.06)
    ? `ハイブリッド傾向：${second}（Δ=${margin}）｜候補 ${cand}`
    : `候補 ${cand}`;

  // レーダー
  ensureRadar(payload.scores || {共感:0,調和:0,依存:0,刺激:0,信頼:0});

  // 本文 → 強み/注意
  const body = payload?.copy?.body || "";
  const [strongs, cautions] = splitBody(body);
  $("#cardStrengths").textContent = strongs || "—";
  $("#cardCautions").textContent = cautions || "—";

  // 確信度
  let conf = Number(payload?.confidence || 0);
  conf = Math.max(0, Math.min(100, conf));
  $("#barFill").style.width = conf + "%";
  $("#confNum").textContent = conf + "%";
  $("#hybrid").textContent = (second && margin !== null && margin <= 0.06) ? "（ハイブリッド）" : "";
}

async function runScore() {
  const a = $("#typeA").value, b = $("#typeB").value;
  if (!state.apiBase) { setNote("API URL を設定してください。"); return; }
  if (!a || !b) { setNote("タイプA/Bを選択してください。"); return; }
  setNote("診断中…");
  try {
    const res = await fetch(`${state.apiBase}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeA: a, typeB: b })
    });
    const payload = await res.json();
    if (!res.ok) { setNote(`エラー: ${payload.detail || "unknown"}`); return; }
    setNote("");
    renderResult(payload);
  } catch {
    setNote("通信エラーです。API URL や Render の稼働状況を確認してください。");
  }
}

function init() {
  $("#apiBase").value = state.apiBase;
  $("#saveApi").addEventListener("click", saveApi);
  $("#run").addEventListener("click", runScore);
  if (state.apiBase) loadTypes();
}

document.addEventListener("DOMContentLoaded", init);
