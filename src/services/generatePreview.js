const { openai, OPENAI_MODEL } = require("./openaiClient");
const { buildPreviewPrompt } = require("./prompts");
const { PreviewSchema } = require("../schemas");

function now() {
  return new Date().toISOString();
}

function buildMockPreview() {
  return {
    headline: "We found potential savings opportunities in your hospital bill",
    estimated_savings_min: 1800,
    estimated_savings_max: 5200,
    top_findings: [
      {
        title: "Possible high hospital charges",
        short_description:
          "Some billed services appear expensive enough to justify a billing review."
      },
      {
        title: "Additional bill reduction options may apply",
        short_description:
          "Prompt-pay discounts, itemized bill review, or financial assistance may be worth checking."
      }
    ]
  };
}

function extractMoneyValues(billText) {
  const matches = [...billText.matchAll(/\$([\d,]+\.\d{2})/g)];

  return matches
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function extractLargestVisibleAmount(billText) {
  const values = extractMoneyValues(billText).sort((a, b) => b - a);
  return values[0] || null;
}

function cleanText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();

  return cleaned || fallback;
}

function buildBetterHeadline(currentHeadline, billText) {
  const fallback = "We found potential savings opportunities in your hospital bill";

  const cleaned = cleanText(currentHeadline, fallback);

  const badHeadlines = new Set([
    "Potential Billing Issues Identified",
    "Billing Issues Found",
    "Hospital Billing Issues Detected",
    "Potential Issues Found",
    "Potential Savings Found"
  ]);

  if (badHeadlines.has(cleaned)) {
    return fallback;
  }

  const largestVisibleAmount = extractLargestVisibleAmount(billText);

  if (!currentHeadline || cleaned.length < 12) {
    if (largestVisibleAmount && largestVisibleAmount >= 1000) {
      return `This bill may contain charges worth reviewing before you pay`;
    }

    return fallback;
  }

  return cleaned;
}

function normalizeFindingTitle(title, index) {
  const fallbackTitles = [
    "Possible high hospital charges",
    "Additional bill reduction options may apply",
    "This bill may deserve a closer review"
  ];

  const cleaned = cleanText(title, fallbackTitles[index] || fallbackTitles[2]);

  if (cleaned.length < 8) {
    return fallbackTitles[index] || fallbackTitles[2];
  }

  return cleaned;
}

function normalizeFindingDescription(description, index) {
  const fallbackDescriptions = [
    "Some billed services appear expensive enough to justify a billing review.",
    "Prompt-pay discounts, itemized bill review, or financial assistance may be worth checking.",
    "There may be details on this bill that deserve clarification before payment."
  ];

  const cleaned = cleanText(
    description,
    fallbackDescriptions[index] || fallbackDescriptions[2]
  );

  if (cleaned.length < 20) {
    return fallbackDescriptions[index] || fallbackDescriptions[2];
  }

  return cleaned;
}

function normalizeFindings(topFindings) {
  const fallback = buildMockPreview().top_findings;

  if (!Array.isArray(topFindings) || topFindings.length === 0) {
    return fallback;
  }

  const cleaned = topFindings
    .slice(0, 3)
    .map((finding, index) => ({
      title: normalizeFindingTitle(finding?.title, index),
      short_description: normalizeFindingDescription(
        finding?.short_description,
        index
      )
    }))
    .filter(
      (finding) =>
        typeof finding.title === "string" &&
        finding.title.trim() &&
        typeof finding.short_description === "string" &&
        finding.short_description.trim()
    );

  if (cleaned.length === 0) {
    return fallback;
  }

  if (cleaned.length === 1) {
    cleaned.push(fallback[1]);
  }

  return cleaned.slice(0, 3);
}

function normalizeSavings(preview, billText) {
  const largestVisibleAmount = extractLargestVisibleAmount(billText);

  let min = Number(preview?.estimated_savings_min);
  let max = Number(preview?.estimated_savings_max);

  if (largestVisibleAmount && largestVisibleAmount >= 10000) {
    const conservativeMin = Math.round(largestVisibleAmount * 0.06);
    const conservativeMax = Math.round(largestVisibleAmount * 0.18);

    if (!Number.isFinite(min) || min <= 0) {
      min = conservativeMin;
    }

    if (!Number.isFinite(max) || max <= min) {
      max = conservativeMax;
    }

    if (min < 500) {
      min = 500;
    }

    if (max <= min) {
      max = min + 1000;
    }

    if (max > largestVisibleAmount * 0.35) {
      max = Math.round(largestVisibleAmount * 0.35);
    }

    if (max <= min) {
      max = min + 1000;
    }

    return { min, max };
  }

  if (!Number.isFinite(min) || min <= 0) {
    min = 500;
  }

  if (!Number.isFinite(max) || max <= min) {
    max = min + 2000;
  }

  return { min, max };
}

function normalizePreview(preview, billText) {
  const savings = normalizeSavings(preview, billText);

  return {
    headline: buildBetterHeadline(preview?.headline, billText),
    estimated_savings_min: savings.min,
    estimated_savings_max: savings.max,
    top_findings: normalizeFindings(preview?.top_findings)
  };
}

async function generatePreview(billText) {
  const startedAt = Date.now();

  console.log(`[${now()}] PREVIEW - generation started`, {
    model: OPENAI_MODEL,
    billTextLength: billText.length,
    billTextPreview: billText.slice(0, 500)
  });

  try {
    const prompt = buildPreviewPrompt(billText);

    console.log(`[${now()}] PREVIEW - prompt built`, {
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 1000)
    });

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

    console.log(`[${now()}] PREVIEW - OpenAI response received`, {
      hasContent: !!content,
      contentPreview: content ? content.slice(0, 1000) : null
    });

    if (!content) {
      throw new Error("OpenAI returned empty preview content.");
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(`[${now()}] PREVIEW - invalid JSON from OpenAI`);
      console.error(content);
      throw new Error("Invalid JSON returned from OpenAI");
    }

    console.log(`[${now()}] PREVIEW - JSON parsed`, parsed);

    const validated = PreviewSchema.parse(parsed);
    const normalized = normalizePreview(validated, billText);

    const durationMs = Date.now() - startedAt;

    console.log(`[${now()}] PREVIEW - validation success`, {
      durationMs,
      mocked: false,
      headline: normalized.headline,
      estimated_savings_min: normalized.estimated_savings_min,
      estimated_savings_max: normalized.estimated_savings_max,
      top_findings: normalized.top_findings
    });

    return {
      data: normalized,
      mocked: false
    };
  } catch (error) {
    const isQuotaError =
      error?.status === 429 ||
      error?.code === "insufficient_quota" ||
      error?.type === "insufficient_quota";

    console.error(`[${now()}] PREVIEW - generation error`, {
      message: error.message,
      code: error.code,
      type: error.type,
      status: error.status,
      stack: error.stack,
      isQuotaError
    });

    if (isQuotaError) {
      const mocked = PreviewSchema.parse(buildMockPreview());
      const normalized = normalizePreview(mocked, billText);
      const durationMs = Date.now() - startedAt;

      console.log(`[${now()}] PREVIEW - falling back to MOCK`, {
        durationMs,
        mocked: true,
        headline: normalized.headline,
        estimated_savings_min: normalized.estimated_savings_min,
        estimated_savings_max: normalized.estimated_savings_max
      });

      return {
        data: normalized,
        mocked: true
      };
    }

    throw error;
  }
}

module.exports = {
  generatePreview
};