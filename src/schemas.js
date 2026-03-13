const { z } = require("zod");

const ConfidenceEnum = z.enum(["low", "medium", "high"]);

const PreviewSchema = z.object({
  headline: z.string(),
  estimated_savings_min: z.number(),
  estimated_savings_max: z.number(),
  top_findings: z
    .array(
      z.object({
        title: z.string(),
        short_description: z.string()
      })
    )
    .max(3)
});

const PotentialIssueSchema = z.object({
  title: z.string(),
  description: z.string(),
  why_it_might_be_a_problem: z.string(),
  evidence_from_bill: z.string(),
  estimated_savings_min: z.number(),
  estimated_savings_max: z.number(),
  confidence: ConfidenceEnum
});

const NegotiationOpportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  why_it_applies: z.string(),
  estimated_savings_min: z.number(),
  estimated_savings_max: z.number(),
  confidence: ConfidenceEnum
});

const NegotiationPlanStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  why: z.string()
});

const FullReportSchema = z.object({
  summary: z.string(),
  analysis_confidence: ConfidenceEnum, // <-- MELHORAR AQUI
  potential_issues: z.array(PotentialIssueSchema),
  negotiation_opportunities: z.array(NegotiationOpportunitySchema),
  estimated_savings_range: z.object({
    min: z.number(),
    max: z.number(),
    methodology_note: z.string()
  }),
  negotiation_plan: z.array(NegotiationPlanStepSchema),
  negotiation_tips: z.array(z.string()),
  expected_outcome: z.string(),
  call_script: z.string(),
  email_template: z.string()
});

module.exports = {
  PreviewSchema,
  FullReportSchema
};