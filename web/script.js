const qs = (sel) => document.querySelector(sel);

// ここで既定のAPI URLを埋め込む（あなたのRender URL）
const DEFAULT_API_BASE = "https://lovetype.onrender.com";

const state = {
  apiBase: localStorage.getItem("apiBase") || DEFAULT_API_BASE,
  chart: null,
  types: [],
};

function setNote(msg) {
  const el = qs("#inputNote");
  if (!el) return;
  el.textContent = msg || "";
}

function toggleApiCard() {
  const card = qs("#apiCard");
  if (!card) return;
  card.classList.toggle("hidden");
  if (!card.classList.contains("hidden")) {
    qs("#apiBase").value = state.apiBase;
  }
}

function saveApi() {
  const val = qs("#apiBase").value.trim().replace(/\/+$/, "");
  if (!val) {
    setNote("API URL を入力してください。");
    return;
  }
  state.apiBase = val;
  localStorage.setItem("apiBase", state.apiBase);
  setNote("API URL を保存しました。");
  // 保存後はカードを閉じる
  toggleApiCard();
  // すぐにタイプ一覧を再読込
  loadTypes();
}

async function loadTypes() {
  const selA = qs("#typeA");
  const selB = qs("#typeB");
  selA.innerHTML = `<option>読み込み中...</option>`;
  selB.innerHTML = `<option>読み込み中...</option>`;
  try {
    const res = await fetch(`${state.apiBase}/types`);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      selA.innerHTML = `<option value="">（タイプが読み込めません。APIを確認してください）</option>`;
      selB.innerHTML = selA.innerHTML;
      setNote("タイプ一覧が取得できません。/types を確認してください。");
      return;
    }
    state.types = arr;
    const opts = arr.map(t => `<option value="${t}">${t}</option>`).join("");
    selA.innerHTML = opts;
    selB.innerHTML = opts;
    setNote("");
  } catch (e) {
    selA.innerHTML = `<option value="">（通信エラー）</option>`;
    selB.innerHTML = `<option value="">（通信エラー）</option>`;
    setNote("APIに接続できません。URLやCORS、Renderの稼働を確認してください。");
  }
}

function ensureChart(data) {
  const ctx = qs("#radar").getContext("2d");
  if (state.chart) {
    state.chart.data = data;
    state.chart.update();
    return;
  }
  state.chart = new Chart(ctx, {
    type: "radar",
    data,
    options: {
      responsive: true,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 200,
          grid: { color: "#30364a" },
          angleLines: { color: "#30364a" },
          pointLabels: { color: "#aab1c5", font: { size: 12 } },
          ticks: { color: "#aab1c5", backdropColor: "transparent", showLabelBackdrop: false }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderResult(payload) {
  qs("#result").classList.remove("hidden");

  const labels = ["共感","調和","依存","刺激","信頼"];
  const dataset = {
    labels,
    datasets: [{
      label: "合算スコア",
      data: [payload.scores["共感"], payload.scores["調和"], payload.scores["依存"], payload.scores["刺激"], payload.scores["信頼"]],
      borderWidth: 2,
      fill: true
    }]
  };
  ensureChart(dataset);

  qs("#macroTop").textContent = payload.macro.top || "-";
  const second = payload.macro.second;
  const margin = payload.macro.margin;
  qs("#macroHybrid").textContent = (second && margin !== null && margin <= 0.06) ? `（ハイブリッド傾向: ${second} / Δ=${margin}）` : "";
  const candStr = (payload.macro.candidates || []).map(c => `${c.name}:${c.distance}`).join(" / ");
  qs("#candidates").textContent = candStr || "-";

  qs("#microType").textContent = payload.micro.type || "-";
  qs("#quadrant").textContent = payload.micro.quadrant ? `象限 ${payload.micro.quadrant}` : "";
  qs("#catch").textContent = payload.copy.catch || "";
  qs("#body").textContent = payload.copy.body || "";

  let conf = Number(payload.confidence || 0);
  conf = Math.max(0, Math.min(100, conf));
  qs("#barFill").style.width = conf + "%";
  qs("#confNum").textContent = conf + "%";
}

async function runScore() {
  const a = qs("#typeA").value;
  const b = qs("#typeB").value;
  if (!a || !b) { setNote("タイプA/Bを選択してください。"); return; }
  setNote("診断中…");
  try {
    const res = await fetch(`${state.apiBase}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeA: a, typeB: b })
    });
    const payload = await res.json();
    if (!res.ok) {
      setNote(`エラー: ${payload.detail || "unknown"}`);
      return;
    }
    setNote("");
    renderResult(payload);
  } catch (e) {
    setNote("通信エラーです。API URL や Render の稼働状況を確認してください。");
  }
}

function init() {
  // 既定URLをそのまま使ってタイプを読み込む
  const apiInput = qs("#apiBase");
  if (apiInput) apiInput.value = state.apiBase;

  const toggleBtn = qs("#toggleApi");
  if (toggleBtn) toggleBtn.addEventListener("click", toggleApiCard);

  const saveBtn = qs("#saveApi");
  if (saveBtn) saveBtn.addEventListener("click", saveApi);

  qs("#run").addEventListener("click", runScore);

  loadTypes();
}

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("DOMContentLoaded", init);
