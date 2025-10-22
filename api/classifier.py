from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple
import math
import pandas as pd

# ルート: このファイル(api/)の場所
BASE_DIR = Path(__file__).resolve().parent

# ファイル名の候補（大文字/小文字ゆらぎ対応）
FILE_CANDIDATES = {
    "params": ["love_params.csv"],
    "centroids": ["centroids.json", "Centroids.json"],
    "mapping": ["mapping.json", "Mapping.json"],
    "copy": ["copy.json", "Copy.json"],
    "constants": ["constants.json", "Constants.json"],
}

# デフォルト定数（constants.json があれば上書き）
DEFAULTS = {
    "weights": {"w_dyn": 1.0, "w_sta": 1.0, "w_bond": 1.0, "w_trust": 0.4},
    "trust_high": 0.55,
    "margin_hybrid": 0.06,
    # 受け入れ例に合わせ、合算(0〜200)を [0,1] に正規化
    "trust_divisor": 200.0,
}

# 共有キャッシュ
_CACHE: Dict[str, Any] = {}


def _find_first_exists(names: List[str]) -> Path | None:
    for name in names:
        p = BASE_DIR / name
        if p.exists():
            return p
    return None


def _load_constants() -> Dict[str, Any]:
    if "constants" in _CACHE:
        return _CACHE["constants"]
    p = _find_first_exists(FILE_CANDIDATES["constants"])
    consts = DEFAULTS.copy()
    if p:
        try:
            loaded = json.loads(p.read_text(encoding="utf-8"))
            # 浅いマージ（主要キーのみ）
            if "weights" in loaded:
                consts["weights"].update(loaded["weights"])
            for k in ("trust_high", "margin_hybrid", "trust_divisor"):
                if k in loaded:
                    consts[k] = float(loaded[k])
        except Exception:
            pass
    _CACHE["constants"] = consts
    return consts


def _load_params_df() -> pd.DataFrame:
    if "params_df" in _CACHE:
        return _CACHE["params_df"]
    p = _find_first_exists(FILE_CANDIDATES["params"])
    if not p:
        raise FileNotFoundError("love_params.csv が /api にありません（Step3でアップしてください）")
    df = pd.read_csv(p)
    required = ["type", "共感", "調和", "依存", "刺激", "信頼"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"love_params.csv に列 '{col}' が見つかりません")
    _CACHE["params_df"] = df
    return df


def _load_centroids() -> Dict[str, Dict[str, float]]:
    if "centroids" in _CACHE:
        return _CACHE["centroids"]
    p = _find_first_exists(FILE_CANDIDATES["centroids"])
    if not p:
        raise FileNotFoundError("centroids.json が /api にありません（Step3でアップしてください）")
    data = json.loads(p.read_text(encoding="utf-8"))
    _CACHE["centroids"] = data
    return data


def _load_mapping() -> Dict[str, Dict[str, str]]:
    if "mapping" in _CACHE:
        return _CACHE["mapping"]
    p = _find_first_exists(FILE_CANDIDATES["mapping"])
    if not p:
        raise FileNotFoundError("mapping.json が /api にありません（Step3でアップしてください）")
    data = json.loads(p.read_text(encoding="utf-8"))
    _CACHE["mapping"] = data
    return data


def _load_copy() -> Dict[str, Dict[str, str]]:
    if "copy" in _CACHE:
        return _CACHE["copy"]
    p = _find_first_exists(FILE_CANDIDATES["copy"])
    if not p:
        # copy.json が無い場合は空でOK（本文は空文字に）
        _CACHE["copy"] = {}
        return _CACHE["copy"]
    data = json.loads(p.read_text(encoding="utf-8"))
    _CACHE["copy"] = data
    return data


def _score_of_type(df: pd.DataFrame, tname: str) -> Dict[str, int]:
    row = df.loc[df["type"] == tname]
    if row.empty:
        raise ValueError(f"type '{tname}' が love_params.csv に見つかりません")
    r = row.iloc[0]
    # 1〜10 を 0〜100 に
    return {
        "共感": int(r["共感"]) * 10,
        "調和": int(r["調和"]) * 10,
        "依存": int(r["依存"]) * 10,
        "刺激": int(r["刺激"]) * 10,
        "信頼": int(r["信頼"]) * 10,
    }


def _weighted_distance(p: Dict[str, float], c: Dict[str, float], w: Dict[str, float]) -> float:
    return math.sqrt(
        w["w_dyn"] * (p["dyn"] - c["dyn"]) ** 2
        + w["w_sta"] * (p["sta"] - c["sta"]) ** 2
        + w["w_bond"] * (p["bond"] - c["bond"]) ** 2
        + w["w_trust"] * (p["trust"] - c["trust"]) ** 2
    )


def _confidence_from_distance(top_d: float, margin: float) -> int:
    # 素朴なヒューリスティック：距離が小さいほど自信大、marginが小さいと減点
    base = max(0.0, 1.0 - min(1.0, top_d)) * 100.0
    if margin <= 0.06:
        base -= 15
    elif margin <= 0.10:
        base -= 7
    return int(round(max(0.0, min(100.0, base))))


def health_status() -> Dict[str, str]:
    # データ在否を返すだけの軽いヘルス
    status = {}
    for key in ("params", "centroids", "mapping", "copy"):
        p = _find_first_exists(FILE_CANDIDATES[key] if key in FILE_CANDIDATES else [])
        status[key] = "ok" if p else "missing"
    return status


# ===== 公開関数 =====

def get_types() -> List[str]:
    try:
        df = _load_params_df()
    except FileNotFoundError:
        return []
    return df["type"].tolist()


def classify_pair(typeA: str, typeB: str) -> Dict[str, Any]:
    consts = _load_constants()
    weights = consts["weights"]
    trust_high = float(consts["trust_high"])
    margin_hybrid = float(consts["margin_hybrid"])
    trust_div = float(consts["trust_divisor"])

    df = _load_params_df()
    centroids = _load_centroids()
    mapping = _load_mapping()
    copybook = _load_copy()

    sA = _score_of_type(df, typeA)
    sB = _score_of_type(df, typeB)

    # 合算（0〜200）
    scores = {k: sA[k] + sB[k] for k in ["共感", "調和", "依存", "刺激", "信頼"]}

    # 比率（Tは信頼を含めない）
    T = max(1e-9, scores["共感"] + scores["調和"] + scores["依存"] + scores["刺激"])
    ratios = {
        "動": round(scores["刺激"] / T, 4),
        "静": round((scores["共感"] + scores["調和"]) / T, 4),
        "絆": round(scores["依存"] / T, 4),
        # 受け入れ例に準拠（0〜1程度に収まるよう200で割る）
        "信頼": round(scores["信頼"] / trust_div, 4),
    }

    # マクロ（8種）: 重み付き距離が最小のもの
    point = {"dyn": ratios["動"], "sta": ratios["静"], "bond": ratios["絆"], "trust": ratios["信頼"]}

    cand: List[Tuple[str, float]] = []
    for macro, c in centroids.items():
        d = _weighted_distance(point, c, weights)
        cand.append((macro, d))
    cand.sort(key=lambda x: x[1])

    top_macro, top_d = cand[0]
    second_macro, second_d = cand[1]
    margin = round(second_d - top_d, 6)
    is_hybrid = margin <= margin_hybrid

    # 4象限: dyn vs sta / trust 高低
    dyn_ge_sta = ratios["動"] >= ratios["静"]
    trust_is_high = ratios["信頼"] >= trust_high
    if dyn_ge_sta and trust_is_high:
        quad = "A"
    elif dyn_ge_sta and not trust_is_high:
        quad = "B"
    elif (not dyn_ge_sta) and trust_is_high:
        quad = "C"
    else:
        quad = "D"

    micro_type = mapping.get(top_macro, {}).get(quad)
    if not micro_type:
        raise ValueError(f"mapping.json に '{top_macro}' × '{quad}' の定義がありません")

    copy_item = copybook.get(micro_type, {"catch": "", "body": ""})

    candidates = [{"name": n, "distance": round(d, 6)} for n, d in cand[:3]]
    confidence = _confidence_from_distance(top_d, margin)
    known_types = sorted(list(copybook.keys())) if copybook else []

    result = {
        "scores": scores,
        "ratios": {"動": ratios["動"], "静": ratios["静"], "絆": ratios["絆"], "信頼": ratios["信頼"]},
        "macro": {
            "top": top_macro,
            "second": second_macro if is_hybrid else None,
            "margin": round(margin, 6),
            "candidates": candidates,
        },
        "micro": {"quadrant": quad, "type": micro_type},
        "copy": {"catch": copy_item.get("catch", ""), "body": copy_item.get("body", "")},
        "confidence": confidence,
        "known_types": known_types,
    }
    return result
