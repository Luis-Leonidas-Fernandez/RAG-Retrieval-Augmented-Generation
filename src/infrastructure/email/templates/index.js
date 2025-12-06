// index.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Si querés usar una carpeta /templates, cambialo acá
const templatesDir = path.join(__dirname);

// Cache simple para evitar lecturas repetidas
const templateCache = new Map();

/**
 * Escapa caracteres especiales para usarlos en RegExp
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cargar template con cache
 */
async function loadTemplate(filePath) {
  if (templateCache.has(filePath)) {
    return templateCache.get(filePath);
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    templateCache.set(filePath, content);
    return content;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Renderizar template HTML + TEXT
 */
export async function renderEmailTemplate(templateName, variables = {}) {
  const htmlPath = path.join(templatesDir, `${templateName}.html`);
  const textPath = path.join(templatesDir, `${templateName}.text`);

  try {
    const [htmlTemplate, textTemplate] = await Promise.all([
      loadTemplate(htmlPath),
      loadTemplate(textPath),
    ]);

    if (!htmlTemplate && !textTemplate) {
      throw new Error(`No se encontró ningún template para: ${templateName}`);
    }

    // Variables extra
    const mergedVars = {
      year: new Date().getFullYear(),
      ...variables,
    };

    let html = htmlTemplate || '';
    let text = textTemplate || '';

    for (const [key, value] of Object.entries(mergedVars)) {
      const safeKey = escapeRegExp(key);
      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, 'g');
      html = html.replace(regex, String(value));
      text = text.replace(regex, String(value));
    }

    return { html, text };
  } catch (error) {
    console.error(`[Templates] Error al cargar template "${templateName}":`, error);
    throw new Error(`No se pudo cargar el template "${templateName}": ${error.message}`);
  }
}

