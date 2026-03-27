from .prompt_builder import build_prompt_for_field, build_prompt
from .llm_client import LLMClient
import json
import re
import asyncio
from typing import Dict, Optional

class FormExtractor:
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def extract(self, form, text: str):
        prompt = build_prompt(form, text)

        raw_output = await self.llm.generate(prompt)

        data = self.parse_llm_output(raw_output)

        # Garantir que TOUS les champs existent
        result = {}
        for field in form.fields:
            result[field.name] = data.get(field.name)

        return result
    
    def parse_llm_output(self, raw_output: str) -> dict:
        """
        Transforme la sortie brute du LLM en dict Python SAFE
        """
        if not raw_output:
            return {}

        # 1️⃣ Extraire le JSON (au cas où le LLM parle)
        match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if not match:
            return {}

        json_str = match.group(0)

        # 2️⃣ Parser le JSON
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            return {}

        # 3️⃣ Normaliser les valeurs → string ou None
        normalized = {}
        for key, value in data.items():
            if value is None:
                normalized[key] = None
            else:
                normalized[key] = str(value)

        return normalized

    
    async def extract_parallele(self, form, text: str):
        # Créer les tâches parallèles pour chaque champ
        tasks = [
            self._extract_field(field, text)
            for field in form.fields
        ]
        
        # Exécuter toutes les requêtes en parallèle
        results = await asyncio.gather(*tasks)
        
        # Construire le résultat final
        result = {}
        for field, value in zip(form.fields, results):
            result[field.name] = value
        
        return result
    
    async def _extract_field(self, field, text: str) -> Optional[str]:
        """Extrait la valeur pour un champ unique"""
        try:
            # Prompt optimisé pour un seul champ
            prompt = build_prompt_for_field(field, text)
            raw_output = await self.llm.generate(prompt)
            value = self.parse_llm_output_parallele(raw_output)
            
            # Retourner la valeur directement (pas un dict)
            return value.get("value")
        except Exception as e:
            # Logger l'erreur si tu veux, mais continuer
            print(f"Erreur pour le champ {field.name}: {e}")
            return None
    
    def parse_llm_output_parallele(self, raw_output: str) -> dict:
        """
        Parse la réponse du LLM pour un seul champ
        """
        if not raw_output:
            return {"value": None}
        
        # Chercher du JSON
        match = re.search(r"\{.*\}", raw_output, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
                value = data.get("value") or data.get("result") or data.get("data")
                if value:
                    return {"value": str(value).strip()}
            except json.JSONDecodeError:
                pass
        
        # Sinon, traiter comme du texte brut
        cleaned = raw_output.strip()
        if cleaned and cleaned.lower() not in ["none", "null", "n/a", ""]:
            return {"value": cleaned}
        
        return {"value": None}