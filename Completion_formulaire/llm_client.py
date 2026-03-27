import httpx
import os

class LLMClient:
  def __init__(self, model="mistral"):
    self.model = model
    host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    self.url = f"{host}/api/generate"

  async def generate(self, prompt: str) -> str:
    payload = {
      "model": self.model,
      "prompt": prompt,
      "stream": False
    }

    async with httpx.AsyncClient(timeout=60) as client:
      response = await client.post(self.url, json=payload)

    response.raise_for_status()
    return response.json()["response"].strip()
