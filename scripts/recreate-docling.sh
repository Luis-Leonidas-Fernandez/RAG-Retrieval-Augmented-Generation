#!/bin/bash

# Script para recrear el contenedor Docling con el volumen montado correctamente

set -e  # Salir si hay algún error

echo "🔄 Recreando contenedor Docling con volumen montado..."

# Verificar que el directorio uploads existe
if [ ! -d "uploads" ]; then
    echo "📁 Creando directorio uploads..."
    mkdir -p uploads
fi

# Verificar que el directorio .cache/huggingface existe para persistir modelos
if [ ! -d ".cache/huggingface" ]; then
    echo "📁 Creando directorio .cache/huggingface para modelos de Docling..."
    mkdir -p .cache/huggingface
fi

# Detener y eliminar el contenedor existente si existe
echo "🛑 Deteniendo y eliminando contenedor existente (si existe)..."
docker rm -f docling-rag 2>/dev/null || echo "   (No había contenedor existente)"

# Construir la imagen si no existe o necesita actualización
echo "🔨 Construyendo imagen docling-pdf-processor..."
docker build -t docling-pdf-processor ./services/docling-pdf-processor

# Crear y ejecutar el contenedor con los volúmenes montados
echo "🚀 Creando y ejecutando contenedor con volúmenes montados..."
docker run -d \
  --name docling-rag \
  -p 8000:8000 \
  -v "$(pwd)/uploads:/app/uploads:ro" \
  -v "$(pwd)/.cache/huggingface:/root/.cache/huggingface" \
  docling-pdf-processor

# Verificar que el contenedor está corriendo
echo "✅ Verificando estado del contenedor..."
sleep 2
if docker ps | grep -q docling-rag; then
    echo "✅ Contenedor Docling recreado y corriendo correctamente"
    echo "📋 Detalles del contenedor:"
    docker ps | grep docling-rag
    echo ""
    echo "🔍 Verificar logs con: docker logs docling-rag"
    echo "🔍 Verificar volumen montado con: docker inspect docling-rag | grep -A 5 Mounts"
else
    echo "❌ Error: El contenedor no está corriendo"
    echo "🔍 Ver logs con: docker logs docling-rag"
    exit 1
fi

