import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Servicio para generar completions usando OpenAI
 */
export class LLMService {
  /**
   * Genera una respuesta usando OpenAI
   * @param {string} prompt - Prompt del usuario
   * @param {string} model - Modelo a usar (default: gpt-4o-mini)
   * @returns {Promise<{answer: string, usage: object}>}
   */
  async generateCompletion(prompt, model = "gpt-4o-mini") {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `
Eres un asistente que responde SOLO usando la información que aparece en el contexto del documento.

REGLAS:
1. No uses conocimiento externo: todo debe derivarse del contexto.
2. Puedes resumir, reorganizar o parafrasear el contenido del documento,
   pero sin inventar datos nuevos ni agregar conceptos que no aparezcan.
3. Si la información clave que pide el usuario NO está en el contexto,
   responde ÚNICAMENTE con la siguiente frase (sin nada más antes ni después):
   "He realizado una búsqueda pero lamentablemente no hay información suficiente para una respuesta adecuada."
4. Si hay poca información pero algo relacionada, responde de forma breve y deja claro
   que la explicación está basada solo en lo que dice el documento.
`
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    return {
      answer: completion.choices[0].message.content,
      usage: completion.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }
}

