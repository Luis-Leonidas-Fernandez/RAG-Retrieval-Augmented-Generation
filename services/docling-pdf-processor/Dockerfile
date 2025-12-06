FROM python:3.10-slim

# Instalar dependencias del sistema necesarias para Docling y procesamiento de PDFs
# Incluyendo librerías gráficas para OpenCV (requeridas por docling_ibm_models/tableformer)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    libtesseract-dev \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Crear directorio para el cache de Hugging Face (los modelos de Docling se descargarán aquí)
RUN mkdir -p /root/.cache/huggingface && chmod 777 /root/.cache/huggingface

# Copiar requirements y instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY app/ ./app/

# Exponer puerto
EXPOSE 8000

# Comando para iniciar la aplicación
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "600"]

