const express = require("express");
const multer = require("multer");

const { extractBillText } = require("./services/extractBillText");
const { generatePreview } = require("./services/generatePreview");
const { generateFullReport } = require("./services/generateFullReport");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

function now() {
  return new Date().toISOString();
}

router.get("/health", (_req, res) => {
  console.log(`[${now()}] GET /health - ok`);
  return res.json({ ok: true });
});

router.post("/analyze", upload.single("file"), async (req, res) => {
  const startedAt = Date.now();

  console.log(`\n[${now()}] ==============================`);
  console.log(`[${now()}] POST /analyze - request started`);

  try {
    if (!req.file) {
      console.log(`[${now()}] POST /analyze - no file received`);

      return res.status(400).json({
        success: false,
        error: "File is required.",
      });
    }

    console.log(`[${now()}] POST /analyze - file received`, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      sizeBytes: req.file.size,
      hasBuffer: !!req.file.buffer,
    });

    const extraction = await extractBillText({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    console.log(`[${now()}] POST /analyze - OCR extraction complete`, {
      extractionMethod: extraction.extractionMethod,
      extractedTextLength: extraction.text.length,
      extractedTextPreview: extraction.text.slice(0, 500),
    });

    const previewResult = await generatePreview(extraction.text);

    console.log(`[${now()}] POST /analyze - preview generation complete`, {
      mocked: previewResult.mocked,
      headline: previewResult.data.headline,
      estimated_savings_min: previewResult.data.estimated_savings_min,
      estimated_savings_max: previewResult.data.estimated_savings_max,
      top_findings_count: previewResult.data.top_findings.length,
      top_findings: previewResult.data.top_findings,
    });

    const durationMs = Date.now() - startedAt;

    console.log(`[${now()}] POST /analyze - success`, {
      durationMs,
    });
    console.log(`[${now()}] ==============================\n`);

    return res.json({
      success: true,
      extractionMethod: extraction.extractionMethod,
      extractedTextLength: extraction.text.length,
      mocked: previewResult.mocked,
      preview: previewResult.data,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    console.error(`[${now()}] POST /analyze - ERROR`, {
      durationMs,
      message: error.message,
      stack: error.stack,
    });
    console.log(`[${now()}] ==============================\n`);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
});

router.post("/report", upload.single("file"), async (req, res) => {
  const startedAt = Date.now();

  console.log(`\n[${now()}] ==============================`);
  console.log(`[${now()}] POST /report - request started`);

  try {
    if (!req.file) {
      console.log(`[${now()}] POST /report - no file received`);

      return res.status(400).json({
        success: false,
        error: "File is required.",
      });
    }

    console.log(`[${now()}] POST /report - file received`, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      sizeBytes: req.file.size,
      hasBuffer: !!req.file.buffer,
    });

    const extraction = await extractBillText({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    console.log(`[${now()}] POST /report - OCR extraction complete`, {
      extractionMethod: extraction.extractionMethod,
      extractedTextLength: extraction.text.length,
      extractedTextPreview: extraction.text.slice(0, 500),
    });

    const reportResult = await generateFullReport(extraction.text);

    console.log(`[${now()}] POST /report - report generation complete`, {
      mocked: reportResult.mocked,
      summary: reportResult.data.summary,
      issueCount: reportResult.data.potential_issues.length,
      opportunityCount: reportResult.data.negotiation_opportunities.length,
      estimatedSavingsRange: reportResult.data.estimated_savings_range,
      negotiationPlanSteps: reportResult.data.negotiation_plan.length,
    });

    console.log(`[${now()}] POST /report - potential issues`, reportResult.data.potential_issues);
    console.log(
      `[${now()}] POST /report - negotiation opportunities`,
      reportResult.data.negotiation_opportunities
    );
    console.log(`[${now()}] POST /report - negotiation plan`, reportResult.data.negotiation_plan);
    console.log(`[${now()}] POST /report - call script`, reportResult.data.call_script);
    console.log(`[${now()}] POST /report - email template`, reportResult.data.email_template);

    const durationMs = Date.now() - startedAt;

    console.log(`[${now()}] POST /report - success`, {
      durationMs,
    });
    console.log(`[${now()}] ==============================\n`);

    return res.json({
      success: true,
      extractionMethod: extraction.extractionMethod,
      extractedTextLength: extraction.text.length,
      mocked: reportResult.mocked,
      report: reportResult.data,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    console.error(`[${now()}] POST /report - ERROR`, {
      durationMs,
      message: error.message,
      stack: error.stack,
    });
    console.log(`[${now()}] ==============================\n`);

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
});

module.exports = router;