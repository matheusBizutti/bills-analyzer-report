function normalizeSavingsRange(report) {
    const range = report.estimated_savings_range || {};
  
    let min = Number(range.min);
    let max = Number(range.max);
  
    if (!Number.isFinite(min) || min < 0) min = 0;
    if (!Number.isFinite(max) || max <= min) max = min + 1000;
    if (max > 0 && min === 0) min = Math.round(max * 0.25);
  
    return {
      ...report,
      estimated_savings_range: {
        ...range,
        min,
        max
      }
    };
  }
  
  function cleanText(value) {
    if (typeof value !== "string") return value;
    return value.replace(/\\+/g, "").replace(/\s+/g, " ").trim();
  }
  
  function stripTrailingPeriod(value) {
    if (typeof value !== "string") return value;
    return value.replace(/\.+$/, "").trim();
  }
  
  function normalizeSavingsItems(items) {
    if (!Array.isArray(items)) return [];
  
    return items.map((item) => {
      let min = Number(item.estimated_savings_min);
      let max = Number(item.estimated_savings_max);
  
      if (!Number.isFinite(min) || min < 0) min = 0;
      if (!Number.isFinite(max) || max <= min) max = min + 500;
      if (max > 0 && min === 0) min = Math.round(max * 0.25);
  
      return {
        ...item,
        title: cleanText(item.title),
        description: cleanText(item.description),
        why_it_might_be_a_problem: cleanText(item.why_it_might_be_a_problem),
        why_it_applies: cleanText(item.why_it_applies),
        evidence_from_bill: cleanText(item.evidence_from_bill),
        estimated_savings_min: min,
        estimated_savings_max: max
      };
    });
  }
  
  function formatEvidenceForHumanSpeech(evidence) {
    if (!evidence || typeof evidence !== "string") return "";
  
    let clean = stripTrailingPeriod(cleanText(evidence));
  
    if (clean.includes("Insurance Payments Received: $0.00")) {
      return "no insurance payments reflected on the statement";
    }
  
    return clean;
  }
  
  function buildHumanEvidenceList(report) {
    const issues = Array.isArray(report.potential_issues) ? report.potential_issues : [];
  
    return issues
      .map((issue) => formatEvidenceForHumanSpeech(issue.evidence_from_bill))
      .filter(Boolean)
      .slice(0, 2);
  }
  
  function strengthenCallScript(report) {
    const evidenceList = buildHumanEvidenceList(report);
  
    let evidenceText = "";
    if (evidenceList.length === 1) evidenceText = evidenceList[0];
    if (evidenceList.length === 2) evidenceText = `${evidenceList[0]} and ${evidenceList[1]}`;
  
    const improvedScript = evidenceText
      ? `Hello, I'm reviewing my hospital bill and noticed charges such as ${evidenceText}. Before making payment, I would like to request an itemized review of these charges to confirm they reflect standard billing and that no duplicate, excessive, or missing adjustments apply. Could someone from the billing department help clarify this?`
      : `Hello, I'm reviewing my hospital bill and would like to request an itemized statement and a billing review before making payment. Could someone help me understand whether any discounts, adjustments, or reductions may apply to this balance?`;
  
    return {
      ...report,
      call_script: improvedScript
    };
  }
  
  function strengthenExpectedOutcome(report) {
    const range = report.estimated_savings_range || {};
    const min = Number(range.min) || 0;
    const max = Number(range.max) || 0;
  
    if (!max) return report;
  
    return {
      ...report,
      expected_outcome: `For hospital bills with similar charge patterns, negotiated reductions often fall between $${min.toLocaleString()} and $${max.toLocaleString()} depending on billing review results and available discounts.`
    };
  }
  
  function improveSummary(report) {
    const evidence = report?.potential_issues?.[0]?.evidence_from_bill;
    if (!evidence) return report;
  
    const cleanEvidence = stripTrailingPeriod(cleanText(evidence));
  
    return {
      ...report,
      summary: `This hospital bill includes charges such as ${cleanEvidence}, which may deserve review before payment. Hospital bills with charges at this level often contain negotiable items, billing adjustments, or additional discounts that can reduce the final balance.`
    };
  }
  
  function strengthenEmailTemplate(report) {
    const primaryEvidence = stripTrailingPeriod(
      cleanText(report?.potential_issues?.[0]?.evidence_from_bill || "a large hospital charge")
    );
  
    const hasInsuranceIssue = Array.isArray(report?.potential_issues)
      ? report.potential_issues.some(
          (issue) =>
            typeof issue?.evidence_from_bill === "string" &&
            issue.evidence_from_bill.includes("Insurance Payments Received: $0.00")
        )
      : false;
  
    const insuranceParagraph = hasInsuranceIssue
      ? `I also noticed that no insurance payments are reflected on the statement, and I would appreciate confirmation on whether any insurance processing or adjustments are still pending.
  
  `
      : "";
  
    return {
      ...report,
      email_template: `Subject: Request for Itemized Bill Review
  
  Dear Billing Department,
  
  I am writing to request an itemized review of my hospital bill.
  
  In reviewing the statement, I noticed charges such as ${primaryEvidence}, and I would like to better understand whether these charges are accurate and whether any additional discounts, adjustments, or review options may apply.
  
  ${insuranceParagraph}Before making payment, I would appreciate clarification on the charges and information about any available discounts, financial assistance, or payment options.
  
  Thank you for your help.
  
  Best regards,
  [Your Name]
  [Your Contact Information]`
    };
  }
  
  function postProcessFullReport(report) {
    let updated = report;
  
    updated = normalizeSavingsRange(updated);
  
    updated = {
      ...updated,
      summary: cleanText(updated.summary),
      potential_issues: normalizeSavingsItems(updated.potential_issues),
      negotiation_opportunities: normalizeSavingsItems(updated.negotiation_opportunities),
      negotiation_tips: Array.isArray(updated.negotiation_tips)
        ? updated.negotiation_tips.map((tip) => cleanText(tip))
        : []
    };
  
    updated = strengthenCallScript(updated);
    updated = strengthenExpectedOutcome(updated);
    updated = improveSummary(updated);
    updated = strengthenEmailTemplate(updated);
  
    return updated;
  }
  
  module.exports = {
    postProcessFullReport
  };