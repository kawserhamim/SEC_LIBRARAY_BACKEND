import { askLibraryAssistant, indexRagDocuments } from "../services/student-rag-service.js";

/**
 * Smart Search (RAG Chatbot Controller)
 */
export const getSmartSearchResults = async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({
        success: false,
        message: "Input is required.",
      });
    }

    const answer = await askLibraryAssistant(input);

    return res.status(200).json({
      success: true,
      ai: answer,
    });
  } catch (error) {
    console.error("Smart search error:", error);

    return res.status(500).json({
      success: false,
      message: "Smart search failed.",
      error: error?.message || "Internal server error",
    });
  }
};

/**
 * Trigger RAG indexing / upload
 */
export const upload = async (req, res) => {
  try {
    const force = Boolean(req?.query?.force || req?.body?.force);
    const result = await indexRagDocuments(force);

    if (res && typeof res.status === "function") {
      return res.status(result.success ? 200 : 500).json(result);
    }
    return result;
  } catch (error) {
    console.error("Upload controller error:", error);
    if (res && typeof res.status === "function") {
      return res.status(500).json({
        success: false,
        message: "Upload failed",
        error: error?.message,
      });
    }
  }
};