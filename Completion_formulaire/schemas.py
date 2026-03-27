from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class FormField(BaseModel):
    name: str
    label: str
    type: str
    required: bool = False
    semantic_hint: Optional[str] = None


class FormSchema(BaseModel):
    fields: List[FormField]


class ExtractionRequest(BaseModel):
    form: FormSchema
    text: str


class ExtractionResponse(BaseModel):
    data: Dict[str, Optional[str]]
