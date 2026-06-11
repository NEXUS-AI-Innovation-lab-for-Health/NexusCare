import os
import httpx


LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()  # "gemini" | "ollama"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")


class LLMClient:
    async def generate(self, prompt: str) -> str:
        if LLM_PROVIDER == "gemini":
            return await _gemini_generate(prompt)
        return await _ollama_generate(prompt)


async def _gemini_generate(prompt: str) -> str:
    from google import genai

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )
    return response.text.strip()


async def _ollama_generate(prompt: str) -> str:
    url = f"{OLLAMA_HOST}/api/generate"
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, json=payload)

    response.raise_for_status()
    return response.json()["response"].strip()
