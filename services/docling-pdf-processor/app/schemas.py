from pydantic import BaseModel
from typing import Optional


class ProcessDocRequest(BaseModel):
    doc_path: str
    file_type: Optional[str] = None  # Opcional, se detecta automáticamente


class DocMetadata(BaseModel):
    total_pages: int
    title: Optional[str] = None
    author: Optional[str] = None
    file_type: Optional[str] = None


class ProcessDocResponse(BaseModel):
    cleaned_text: str
    markdown: Optional[str] = None
    toc: Optional[str] = None
    metadata: DocMetadata


class HealthResponse(BaseModel):
    status: str

