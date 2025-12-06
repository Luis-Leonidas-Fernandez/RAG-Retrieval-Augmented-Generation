"""
Microservicio FastAPI para procesamiento de documentos con Docling
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import ProcessDocRequest, ProcessDocResponse, HealthResponse
from app.processor import process_document
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crear aplicación FastAPI
app = FastAPI(
    title="Docling Document Processor",
    description="Microservicio para procesar documentos (PDF, DOCX, XLSX, imágenes, etc.) usando Docling",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Endpoint de health check
    """
    return {"status": "ok"}


@app.post("/process", response_model=ProcessDocResponse)
async def process_doc_endpoint(request: ProcessDocRequest):
    """
    Procesa un documento usando Docling y retorna texto limpio, markdown, TOC y metadata.
    
    Args:
        request: Request con doc_path (ruta absoluta al documento) y file_type opcional
        
    Returns:
        ProcessDocResponse con cleaned_text, markdown, toc y metadata
    """
    try:
        logger.info(f"Procesando documento: {request.doc_path} (tipo: {request.file_type or 'auto'})")
        
        result = process_document(request.doc_path, request.file_type)
        
        logger.info(f"Documento procesado exitosamente: {request.doc_path}")
        
        return ProcessDocResponse(
            cleaned_text=result["cleaned_text"],
            markdown=result.get("markdown"),
            toc=result.get("toc"),
            metadata=result["metadata"]
        )
        
    except FileNotFoundError as e:
        logger.error(f"Documento no encontrado: {request.doc_path}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error al procesar documento {request.doc_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar documento: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

