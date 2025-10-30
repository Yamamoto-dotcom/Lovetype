(function(){
  const API_BASE = (typeof window.API_BASE !== "undefined" && window.API_BASE) ? window.API_BASE : null;

  function $(sel){ return document.querySelector(sel); }
  function setText(sel, txt){ const el = typeof sel === 'string' ? $(sel) : sel; if(el) el.textContent = txt ?? ""; }
  function has(obj, k){ return obj && Object.prototype.hasOwnProperty.call(obj, k); }

  async function fetchTypes(){
    if(!API_BASE) throw new Error("API_BASE not set");
    const r = await fetch(`${API_BASE}/types`, {cache:"no-store"});
    if(!r.ok) throw new Error("/types error");
    return await r.json(); // ["敏腕マネージャー", ...]
  }

  async function fetchScore(typeA, typeB){
    if(!API_BASE) throw new Error("API_BASE not set");
    const headers = {"Content-Type":"application/json"};
    // 1) 推奨: {typeA,typeB}
    let r = await fetch(`${API_BASE}/score`, {method:"POST", headers, body:JSON.stringify({typeA, typeB})});
    if(!r.ok){
      // 2) 互換: {a,b}
      r = await fetch(`${API_BASE}/score`, {method:"POST", headers, body:JSON.stringify({a:typeA, b:typeB})});
    }
    if(!r.ok){
      // 3) 互換: GET クエリ
      r = await fetch(`${API_BASE}/score?typeA=${encodeURIComponent(typeA)}&typeB=${encodeURIComponent(typeB)}`);
    }
    if(!r.ok){
      const txt = await r.text();
      throw new Error(`/score error: ${r.status} ${txt}`);
    }
    return await r.json();
  }

  function storeResult(res){
    sessionStorage.setItem("lv_result", JSON.stringify(res));
  }
  function loadResult(){
    const s = sessionStorage.getItem("lv_result");
    return s ? JSON.parse(s) : null;
  }

  function ensureMicroTypeName(name){
    if(!name) return "";
    return name.endsWith("タイプ") ? name : (name + "タイプ");
  }

  function pickFeatureAdvice(copy){
    // 新仕様: {feature, advice} を優先。なければ {catch, body} を採用。
    const feature = has(copy,"feature") ? copy.feature : (has(copy,"catch") ? copy.catch : "");
    const advice  = has(copy,"advice")  ? copy.advice  : (has(copy,"body")  ? copy.body  : "");
    return {feature, advice};
  }

  async function initIndex(){
    if(!API_BASE){ alert("API URLが設定されていません。/web/config.js の window.API_BASE を確認してください。"); return; }
    const mine = $('#mine'), partner = $('#partner'), btn = $('#diagnoseBtn');
    try{
      const types = await fetchTypes();
      [mine, partner].forEach(sel=>{
        sel.innerHTML = `<option value="" disabled selected>ラブタイプを選択</option>` + types.map(t=>`<option>${t}</option>`).join('');
      });
    }catch(e){
      console.error(e);
      alert("タイプ一覧の取得に失敗しました。APIのURLとRender稼働を確認してください。");
      return;
    }
    btn.addEventListener('click', async ()=>{
      const a = mine.value, b = partner.value;
      if(!a || !b) return alert("ふたりのタイプを選んでください。");
      try{
        const res = await fetchScore(a,b);
        storeResult(res);
        location.href = "result.html";
      }catch(e){
        console.error(e);
        alert("診断に失敗しました。/score のログを確認してください。");
      }
    });
  }

  function drawRadar(canvasId, scores){
    // scores: {共感,調和,依存,刺激,信頼} 0-200
    const labels = ["共感","調和","依存","刺激","信頼"];
    const data = labels.map(k => scores[k] ?? 0);
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: '合算スコア',
          data,
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: { r: { beginAtZero:true, min:0, max:200, ticks:{ stepSize:50 } } },
        plugins: { legend: { display:false } }
      }
    });
  }

  function renderHybrid(macro){
    if(!macro) return "";
    const secName = macro.second || "";
    const margin = (typeof macro.margin==="number") ? macro.margin : 1;
    if(secName && margin <= 0.06){ return `ハイブリッド傾向 / ${secName}`; }
    return "";
  }

  function initResult(){
    const res = loadResult();
    if(!res){ location.replace("index.html"); return; }

    // タイトル・ハイブリッド
    setText('#typeName', ensureMicroTypeName(res?.micro?.type || ""));
    setText('#hybrid', renderHybrid(res?.macro));

    // レーダー
    drawRadar('radar', res.scores || {});

    // 特徴・アドバイス
    const {feature, advice} = pickFeatureAdvice(res.copy || {});
    setText('#feature', feature || "—");
    setText('#advice', advice || "—");

    // 詳細へ
    $('#goDetail').addEventListener('click', ()=> location.href = 'detail.html');
  }

  function initDetail(){
    const res = loadResult();
    if(!res){ location.replace("index.html"); return; }
    setText('#titleDetail', ensureMicroTypeName(res?.micro?.type || ""));
    const {feature, advice} = pickFeatureAdvice(res.copy || {});
    setText('#featureBig', feature || "—");
    setText('#adviceBig', advice || "—");
  }

  // ページ振り分け
  document.addEventListener('DOMContentLoaded', ()=>{
    const page = document.body.getAttribute('data-page');
    if(page === 'index'){ initIndex(); }
    if(page === 'result'){ initResult(); }
    if(page === 'detail'){ initDetail(); }
  });

  // debug
  window.__lv = { fetchTypes, fetchScore, loadResult };
})();
