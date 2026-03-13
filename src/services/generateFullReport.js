const { openai, OPENAI_MODEL } = require("./openaiClient");
const { buildFullReportPrompt } = require("./prompts");
const { FullReportSchema } = require("../schemas");
const { postProcessFullReport } = require("./reportPostProcessor");

function now() {
  return new Date().toISOString();
}

function normalizeConfidence(value) {
  if (!value || typeof value !== "string") {
    return "medium";
  }

  const v = value.trim().toLowerCase();

  if (["low", "medium", "high"].includes(v)) {
    return v;
  }

  if (["possible", "potential", "maybe", "uncertain"].includes(v)) {
    return "low";
  }

  if (["moderate", "reasonable", "plausible"].includes(v)) {
    return "medium";
  }

  if (["strong", "likely", "clear"].includes(v)) {
    return "high";
  }

  return "medium";
}

function normalizeFullReport(report) {
  const normalized = {
    ...report
  };

  normalized.analysis_confidence = normalizeConfidence(
    report.analysis_confidence
  );

  if (Array.isArray(report.potential_issues)) {
    normalized.potential_issues = report.potential_issues.map((issue) => ({
      ...issue,
      confidence: normalizeConfidence(issue.confidence)
    }));
  } else {
    normalized.potential_issues = [];
  }

  if (Array.isArray(report.negotiation_opportunities)) {
    normalized.negotiation_opportunities =
      report.negotiation_opportunities.map((opportunity) => ({
        ...opportunity,
        confidence: normalizeConfidence(opportunity.confidence)
      }));
  } else {
    normalized.negotiation_opportunities = [];
  }

  return normalized;
}

async function generateFullReport(billText) {
  const startedAt = Date.now();

  console.log(`[${now()}] REPORT - generation started`);

  try {
    const prompt = buildFullReportPrompt(billText);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty report");
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(`[${now()}] REPORT - invalid JSON from OpenAI`);
      console.error(content);
      throw new Error("Invalid JSON returned from OpenAI");
    }

    const normalized = normalizeFullReport(parsed);

    const validated = FullReportSchema.parse(normalized);

    const improved = postProcessFullReport(validated);

    const duration = Date.now() - startedAt;

    console.log(`[${now()}] REPORT - success (${duration}ms)`);

    return {
      data: improved,
      mocked: false
    };
  } catch (error) {
    console.error(`[${now()}] REPORT ERROR`, error);
    throw error;
  }
}

module.exports = {
  generateFullReport
};