const path = require("path");
const { DocumentProcessorServiceClient } = require("@google-cloud/documentai").v1;

function now() {
  return new Date().toISOString();
}

function getGoogleCredentials() {
  console.log(`[${now()}] OCR - loading Google credentials from env`);

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing.");
  }

  const credentials = JSON.parse(raw);

  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  console.log(`[${now()}] OCR - Google credentials loaded`, {
    project_id: credentials.project_id,
    client_email: credentials.client_email,
  });

  return credentials;
}

function resolveMimeType(originalname, mimetype) {
  if (
    mimetype &&
    ["application/pdf", "image/png", "image/jpeg"].includes(mimetype)
  ) {
    console.log(`[${now()}] OCR - mime type resolved from uploaded mimetype`, {
      mimetype,
    });

    return mimetype;
  }

  const ext = path.extname(originalname || "").toLowerCase();

  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";

  console.log(`[${now()}] OCR - unknown mime type, defaulting to application/pdf`, {
    originalname,
    mimetype,
    ext,
  });

  return "application/pdf";
}

function isProbablyUsefulText(text) {
  if (!text) return false;

  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length >= 80;
}

async function extractBillText({ buffer, originalname, mimetype }) {
  const startedAt = Date.now();

  console.log(`[${now()}] OCR - extraction started`, {
    originalname,
    mimetype,
    bufferSizeBytes: buffer?.length || 0,
  });

  const projectId = process.env.GOOGLE_PROJECT_ID;
  const location = process.env.GOOGLE_LOCATION || "us";
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error(
      "Missing Google OCR env vars. Check GOOGLE_PROJECT_ID and GOOGLE_DOCUMENT_AI_PROCESSOR_ID."
    );
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid file buffer.");
  }

  console.log(`[${now()}] OCR - environment resolved`, {
    projectId,
    location,
    processorId,
  });

  const credentials = getGoogleCredentials();

  const client = new DocumentProcessorServiceClient({
    credentials,
  });

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  const mimeType = resolveMimeType(originalname, mimetype);

  console.log(`[${now()}] OCR - sending document to Google Document AI`, {
    processorName: name,
    mimeType,
  });

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: buffer.toString("base64"),
      mimeType,
    },
  });

  const text = result?.document?.text?.trim() || "";

  console.log(`[${now()}] OCR - raw extraction finished`, {
    extractedLength: text.length,
    textPreview: text.slice(0, 500),
  });

  if (!isProbablyUsefulText(text)) {
    throw new Error("Could not extract useful text from file with Google OCR.");
  }

  const durationMs = Date.now() - startedAt;

  console.log(`[${now()}] OCR - extraction success`, {
    durationMs,
    extractedLength: text.length,
  });

  return {
    text,
    extractionMethod: "google-document-ai",
  };
}

module.exports = {
  extractBillText,
};