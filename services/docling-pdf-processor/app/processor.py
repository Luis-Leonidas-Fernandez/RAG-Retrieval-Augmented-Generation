"""
Procesador de documentos usando Docling (soporta PDF, DOCX, XLSX, imágenes, etc.)
"""
import os
from typing import Optional
from docling.document_converter import DocumentConverter
import logging

logger = logging.getLogger(__name__)

# Instancia global del converter (lazy initialization)
# Esto permite reutilizar la instancia y que los modelos se descarguen solo una vez
_converter = None

def get_converter():
    """
    Obtiene la instancia del DocumentConverter, inicializándola si es necesario.
    Esto permite que los modelos se descarguen automáticamente la primera vez.
    Los modelos se guardarán en el cache de Hugging Face persistido en el volumen.
    """
    global _converter
    if _converter is None:
        try:
            logger.info("Inicializando DocumentConverter (esto puede tardar si es la primera vez, descargando modelos)...")
            logger.info("Los modelos se descargarán automáticamente y se guardarán en el cache persistido.")
            _converter = DocumentConverter()
            logger.info("✅ DocumentConverter inicializado correctamente")
        except Exception as e:
            logger.error(f"❌ Error al inicializar DocumentConverter: {str(e)}")
            logger.error("Asegúrate de que el contenedor tenga acceso a internet para descargar los modelos.")
            raise
    return _converter

def _detect_file_type(file_path: str) -> str:
    """Detecta el tipo de archivo basándose en la extensión."""
    ext = os.path.splitext(file_path)[1].lower()
    type_map = {
        '.pdf': 'pdf',
        '.docx': 'docx',
        '.doc': 'doc',
        '.xlsx': 'xlsx',
        '.xls': 'xls',
        '.txt': 'txt',
        '.md': 'markdown',
        '.markdown': 'markdown',
        '.png': 'image',
        '.jpg': 'image',
        '.jpeg': 'image',
        '.gif': 'image',
        '.bmp': 'image',
        '.tiff': 'image',
        '.tif': 'image',
        '.webp': 'image',
        '.pptx': 'pptx',
        '.ppt': 'ppt',
    }
    return type_map.get(ext, 'unknown')

def process_document(doc_path: str, file_type: str = None) -> dict:
    """
    Procesa un documento usando Docling y extrae texto limpio, markdown, TOC y metadata.
    
    Args:
        doc_path: Ruta absoluta al archivo documento
        file_type: Tipo de archivo (opcional, se detecta automáticamente si no se proporciona)
        
    Returns:
        dict con cleaned_text, markdown, toc y metadata
    """
    # Verificar que el archivo existe
    if not os.path.exists(doc_path):
        raise FileNotFoundError(f"Archivo no encontrado: {doc_path}")
    
    # Verificar que es un archivo (no un directorio)
    if not os.path.isfile(doc_path):
        raise ValueError(f"La ruta no es un archivo: {doc_path}")
    
    # Detectar tipo de archivo si no se proporciona
    detected_type = file_type or _detect_file_type(doc_path)
    
    # Verificar tamaño del archivo
    file_size = os.path.getsize(doc_path)
    logger.info(f"Archivo encontrado: {doc_path}, tamaño: {file_size / 1024 / 1024:.2f} MB, tipo: {detected_type}")
    
    # Obtener límites configurables desde variables de entorno
    # max_num_pages: límite de páginas (default: 500 páginas)
    max_num_pages = int(os.getenv("DOCLING_MAX_NUM_PAGES", "500"))
    
    # max_file_size: límite de tamaño en bytes (default: basado en PDF_MAX_FILE_SIZE_MB o 50MB)
    pdf_max_size_mb = int(os.getenv("PDF_MAX_FILE_SIZE_MB", "50"))
    max_file_size_bytes = int(os.getenv("DOCLING_MAX_FILE_SIZE_BYTES", str(pdf_max_size_mb * 1024 * 1024)))
    
    # Verificar que el archivo no exceda el límite
    if file_size > max_file_size_bytes:
        raise ValueError(
            f"El archivo excede el tamaño máximo permitido: "
            f"{file_size / 1024 / 1024:.2f} MB > {max_file_size_bytes / 1024 / 1024:.2f} MB"
        )
    
    # Obtener el conversor (se inicializará la primera vez y descargará modelos si es necesario)
    converter = get_converter()
    
    # Convertir el documento con límites configurados
    logger.info(f"Procesando documento: {doc_path} (tipo: {detected_type}, límites: max_pages={max_num_pages}, max_size={max_file_size_bytes/1024/1024:.1f}MB)")
    
    try:
        result = converter.convert(doc_path, max_num_pages=max_num_pages, max_file_size=max_file_size_bytes)
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_type = type(e).__name__
        error_traceback = traceback.format_exc()
        
        logger.error(f"Error de Docling al procesar {doc_path}")
        logger.error(f"Tipo de error: {error_type}")
        logger.error(f"Mensaje: {error_msg}")
        logger.error(f"Traceback completo:\n{error_traceback}")
        
        # Proporcionar mensajes de error más claros
        if "is not valid" in error_msg or "not valid" in error_msg.lower():
            raise ValueError(
                f"El archivo no es válido o está corrupto: {os.path.basename(doc_path)}. "
                f"Verifica que el archivo sea válido y no esté dañado. "
                f"Tipo de error: {error_type}. Detalles: {error_msg}"
            )
        elif "exceeds" in error_msg.lower() or "too large" in error_msg.lower():
            raise ValueError(f"El archivo excede los límites permitidos: {error_msg}")
        else:
            raise RuntimeError(f"Error al procesar documento con Docling ({error_type}): {error_msg}")
    
    # Extraer texto limpio
    cleaned_text = result.document.export_to_markdown() if hasattr(result.document, 'export_to_markdown') else ""
    
    # Si no hay markdown, intentar extraer texto plano
    if not cleaned_text and hasattr(result.document, 'text'):
        cleaned_text = result.document.text
    elif not cleaned_text:
        # Fallback: extraer todo el texto de los elementos
        cleaned_text = _extract_text_from_document(result.document)
    
    # Extraer markdown si está disponible
    markdown = None
    if hasattr(result.document, 'export_to_markdown'):
        try:
            markdown = result.document.export_to_markdown()
        except:
            markdown = None
    
    # Extraer TOC si existe
    toc = None
    if hasattr(result.document, 'toc') and result.document.toc:
        toc = _extract_toc_text(result.document.toc)
    elif hasattr(result.document, 'table_of_contents'):
        toc = _extract_toc_text(result.document.table_of_contents)
    
    # Extraer metadata
    metadata = {
        "total_pages": _get_total_pages(result.document),
        "title": _get_title(result.document),
        "author": _get_author(result.document),
        "file_type": detected_type
    }
    
    logger.info(f"Documento procesado exitosamente: {doc_path}")
    
    return {
        "cleaned_text": cleaned_text or "",
        "markdown": markdown,
        "toc": toc,
        "metadata": metadata
    }


def _extract_text_from_document(document) -> str:
    """Extrae texto plano del documento."""
    text_parts = []
    
    if hasattr(document, 'sections'):
        for section in document.sections:
            if hasattr(section, 'text'):
                text_parts.append(section.text)
            elif hasattr(section, 'content'):
                text_parts.append(str(section.content))
    
    if hasattr(document, 'text'):
        text_parts.append(document.text)
    
    return "\n\n".join(text_parts)


def _extract_toc_text(toc) -> Optional[str]:
    """Extrae texto del TOC."""
    if not toc:
        return None
    
    toc_lines = []
    
    def extract_toc_items(items, level=0):
        """Recursivamente extrae items del TOC."""
        for item in items:
            if hasattr(item, 'title'):
                indent = "  " * level
                toc_lines.append(f"{indent}{item.title}")
            elif isinstance(item, dict):
                if 'title' in item:
                    indent = "  " * level
                    toc_lines.append(f"{indent}{item['title']}")
                if 'children' in item:
                    extract_toc_items(item['children'], level + 1)
            elif isinstance(item, str):
                toc_lines.append(item)
    
    if isinstance(toc, list):
        extract_toc_items(toc)
    elif hasattr(toc, 'items'):
        extract_toc_items(toc.items)
    else:
        toc_lines.append(str(toc))
    
    return "\n".join(toc_lines) if toc_lines else None


def _get_total_pages(document) -> int:
    """Obtiene el número total de páginas."""
    if hasattr(document, 'page_count'):
        return document.page_count
    elif hasattr(document, 'pages'):
        return len(document.pages)
    elif hasattr(document, 'metadata') and hasattr(document.metadata, 'page_count'):
        return document.metadata.page_count
    return 1


def _get_title(document) -> Optional[str]:
    """Obtiene el título del documento."""
    if hasattr(document, 'title'):
        return document.title
    elif hasattr(document, 'metadata') and hasattr(document.metadata, 'title'):
        return document.metadata.title
    return None


def _get_author(document) -> Optional[str]:
    """Obtiene el autor del documento."""
    if hasattr(document, 'author'):
        return document.author
    elif hasattr(document, 'metadata') and hasattr(document.metadata, 'author'):
        return document.metadata.author
    return None

