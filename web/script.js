const qs = (sel) => document.querySelector(sel);

// 固定API（ユーザーには見せません）
const API_BASE = "https://lovetype.onrender.com";

const state = {
  apiBase: API_BASE,
  chart: null,
  types: [],
};

function setNote(msg) {
  const el = qs("#inputNote");
  if (!el) return;
  el.textContent = msg || "";
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
      selA.innerHTML = `<option value="">（タイプを読み込めませんでした）</option>`;
      selB.innerHTML = selA.innerHTML;
      setNote("タイプ一覧が取得できません。時間をおいてお試しください。");
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
    setNote("通信に失敗しました。時間をおいて再実行してください。");
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

  // レーダー
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

  // ベース気質（数値は出さず、ハイブリッドはやわらか表現のみ）
  qs("#macroTop").textContent = payload.macro.top || "-";
  const second = payload.macro.second;
  qs("#macroHybrid").textContent = second ? "（ハイブリッド気味）" : "";

  // タイプ名＋本文（象限は表示しない）
  qs("#microType").textContent = payload.micro.type || "-";
  qs("#catch").textContent = payload.copy.catch || "";
  qs("#body").textContent = payload.copy.body || "";

  // 自信度
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
    setNote("通信に失敗しました。時間をおいて再実行してください。");
  }
}

function init() {
  qs("#run").addEventListener("click", runScore);
  loadTypes();
}

document.addEventListener("DOMContentLoaded", init);
