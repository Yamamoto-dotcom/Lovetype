// web/script.js
// 共通ユーティリティ
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const api = () => {
  if (!window.API_BASE || typeof window.API_BASE !== "string" || !/^https?:\/\//.test(window.API_BASE)) {
    throw new Error("API URL が設定されていません（web/config.js を確認）");
  }
  return window.API_BASE;
};
const parseQS = () => Object.fromEntries(new URLSearchParams(location.search).entries());
const toQS = (obj) => new URLSearchParams(obj).toString();

async function getTypes(){
  const res = await fetch(`${api()}/types`);
  if(!res.ok) throw new Error(`/types 取得に失敗: ${res.status}`);
  return res.json();
}

async function postScore(a, b){
  const res = await fetch(`${api()}/score`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ a, b })
  });
  if(!res.ok) throw new Error(`/score 失敗: ${res.status}`);
  return res.json();
}

// ページごと初期化
document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;

  try{
    if(page === "index"){
      await initIndex();
    }else if(page === "result"){
      await initResult();
    }else if(page === "detail"){
      await initDetail();
    }
  }catch(e){
    console.error(e);
    const box = $("#errorBox");
    if(box){ box.textContent = String(e.message || e); box.style.display="block"; }
  }
});

// --- Index ---
async function initIndex(){
  const mine = $("#mine");
  const partner = $("#partner");
  const btn = $("#goBtn");

  // タイプ一覧をAPIから
  const types = await getTypes();
  for(const s of [mine, partner]){
    s.innerHTML = `<option value="" disabled selected>ラブタイプを選択</option>` +
      types.map(t=>`<option>${t}</option>`).join("");
  }

  // URLプリセット（任意）
  const qs = parseQS();
  if(qs.a) mine.value = qs.a;
  if(qs.b) partner.value = qs.b;

  btn.addEventListener("click", ()=>{
    const a = mine.value, b = partner.value;
    if(!a || !b){ alert("ふたりのラブタイプを選んでください"); return; }
    location.href = `result.html?${toQS({a,b})}`;
  });
}

// --- Result ---
async function initResult(){
  // 画像（差し替え自由）
  $("#kvImg").src = "./assets/char-angeldevil.png";

  const { a, b } = parseQS();
  if(!a || !b) { location.href = "index.html"; return; }

  $("#pair").textContent = `${a} × ${b}`;

  // 結果取得
  const data = await postScore(a, b);
  // タイトル
  const microType = ensureTypeSuffix(data?.micro?.type);
  $("#resultTitle").textContent = `${data?.macro?.top} / ${microType}`;

  // ハイブリッド（margin<=0.06 のときのみ表示）
  const margin = Number(data?.macro?.margin ?? 1);
  const second = data?.macro?.second || "";
  if(second && margin <= 0.06){
    $("#hybrid").classList.add("show");
    $("#hybrid").textContent = `ハイブリッド傾向 / ${second}`;
  }

  // チャート
  const scores = data?.scores || {};
  drawRadar([scores["共感"], scores["調和"], scores["依存"], scores["刺激"], scores["信頼"]]);

  // サマリ
  $("#confidence").textContent = `${data?.confidence ?? 0}%`;
  $("#macroTop").textContent = data?.macro?.top || "-";
  $("#microType").textContent = microType;

  // 本文（先頭数行だけ抜粋）
  const body = (data?.copy?.body || "").trim();
  const [feature, advice] = splitBody(body);
  $("#excerpt").textContent = feature.slice(0, 120) + (feature.length>120 ? "..." : "");

  // リンク：詳細へ
  $("#detailLink").href = `detail.html?${toQS({a,b})}`;
}

// --- Detail ---
async function initDetail(){
  // 画像（差し替え自由）
  $("#kvImg").src = "./assets/char-girl.png";

  const { a, b } = parseQS();
  if(!a || !b) { location.href = "index.html"; return; }

  const data = await postScore(a, b);
  const microType = ensureTypeSuffix(data?.micro?.type);
  $("#pair").textContent = `${a} × ${b}`;
  $("#resultTitle").textContent = `${data?.macro?.top} / ${microType}`;

  // ハイブリッド表示（任意）
  const margin = Number(data?.macro?.margin ?? 1);
  const second = data?.macro?.second || "";
  if(second && margin <= 0.06){
    $("#hybrid").classList.add("show");
    $("#hybrid").textContent = `ハイブリッド傾向 / ${second}`;
  }

  // 本文全量（特徴／アドバイスに分割）
  const body = (data?.copy?.body || "").trim();
  const [feature, advice] = splitBody(body);
  $("#feature").textContent = feature;
  $("#advice").textContent = advice;

  // レーダー（再掲）
  const scores = data?.scores || {};
  drawRadar([scores["共感"], scores["調和"], scores["依存"], scores["刺激"], scores["信頼"]]);
}

// ユーティリティ
function ensureTypeSuffix(name){
  if(!name) return "-";
  return /タイプ$/.test(name) ? name : `${name}タイプ`;
}

function splitBody(body){
  const idx = body.indexOf("アドバイス：");
  if(idx === -1) return [body, ""];
  return [ body.slice(0, idx).trim(), body.slice(idx + "アドバイス：".length).trim() ];
}

function drawRadar(vals){
  const ctx = $("#chart").getContext("2d");
  if(window.__chart) window.__chart.destroy();
  window.__chart = new Chart(ctx,{
    type:"radar",
    data:{
      labels:["共感","調和","依存","刺激","信頼"],
      datasets:[{
        label:"合算スコア（0-200）",
        data: vals.map(v=>Number(v||0)),
        fill:true
      }]
    },
    options:{
      responsive:true,
      scales:{
        r:{
          suggestedMin:0,suggestedMax:200,beginAtZero:true,
          angleLines:{ color:"rgba(0,0,0,.15)" },
          grid:{ color:"rgba(0,0,0,.12)" },
          pointLabels:{ font:{ size:12 } }
        }
      },
      plugins:{ legend:{ display:false } }
    }
  });
}
