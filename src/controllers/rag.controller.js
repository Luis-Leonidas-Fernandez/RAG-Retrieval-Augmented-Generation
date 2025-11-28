import { queryRag } from "../services/rag.service.js";

export const ragQuery = async (req, res) => {
  try {
    const { pdfId, question } = req.body;

    if (!pdfId || !question) {
      return res.status(400).json({
        ok: false,
        message: "pdfId y question son requeridos",
      });
    }

    const response = await queryRag(pdfId, question);

    return res.json({
      ok: true,
      answer: response.answer,
      context: response.context,
    });

  } catch (err) {
    console.error("RAG error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
