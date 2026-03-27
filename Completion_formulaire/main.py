from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import ExtractionRequest, ExtractionResponse
from .extractor import FormExtractor
from .llm_client import LLMClient
import traceback

app = FastAPI()

app.add_middleware(          
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

llm_client = LLMClient()
extractor = FormExtractor(llm_client)

@app.post("/extract", response_model=ExtractionResponse)
async def extract_form(req: ExtractionRequest):
    try:
        data = await extractor.extract(req.form, req.text)
        return {"data": data}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
