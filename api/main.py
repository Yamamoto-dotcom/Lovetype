from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
# 相対インポート -> 絶対インポート（/api を作業ルートで起動するため）
from classifier import (
    get_types,
    classify_pair,
    health_status,
)

app = FastAPI(title="Lovetype Compatibility API", version="0.1.0")

# CORS: MVPでは全許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScoreRequest(BaseModel):
    typeA: str
    typeB: str

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", **health_status()}

@app.get("/types")
def types() -> List[str]:
    types_list = get_types()
    if not types_list:
        return []
    return types_list

@app.post("/score")
def score(req: ScoreRequest) -> Dict[str, Any]:
    try:
        result = classify_pair(req.typeA, req.typeB)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
