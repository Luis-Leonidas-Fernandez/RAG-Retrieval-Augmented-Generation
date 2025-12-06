#!/bin/bash
# Script para limpiar el cache de modelos de Docling

echo "🧹 Limpiando cache de modelos de Docling..."

# Eliminar cache de Hugging Face
if [ -d ".cache/huggingface" ]; then
    echo "   Eliminando .cache/huggingface..."
    rm -rf .cache/huggingface
    echo "   ✅ Cache eliminado"
else
    echo "   ℹ️  No existe directorio .cache/huggingface"
fi

# Recrear directorio vacío
echo "   Creando directorio cache vacío..."
mkdir -p .cache/huggingface
echo "   ✅ Directorio recreado"

echo "✅ Cache limpiado correctamente. Ahora puedes reconstruir el contenedor con: npm run docker:docling:recreate"

