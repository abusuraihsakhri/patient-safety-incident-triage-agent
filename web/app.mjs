/* Browser-only evaluator mirroring agents/workers.py; illustrative thresholds only. */
const IDENTIFIERS = [
  /\b(?:MRN)[:#\s-]*\d{4,10}\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b(?:DOB|Date of Birth)[:\s]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i,
  /\b(?:Patient\s+Name|Patient:)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/i
];

export function evaluateTask(input) {
  const taskId = String(input.task_id ?? "").trim();
  const targetId = String(input.target_identifier ?? "").trim();
  const status = String(input.status_descriptor ?? "NOMINAL").trim();
  if (input.primary_metric === "" || input.primary_metric == null) throw new Error("Primary measurement is required.");
  const primary = Number(input.primary_metric);
  if (input.secondary_metric === "") throw new Error("Secondary measurement must be numeric.");
  const secondary = Number(input.secondary_metric ?? 0);
  const critical = input.is_critical_flag === true;
  if (!taskId || !targetId || !status) throw new Error("Task ID, target ID and status are required.");
  if (!Number.isFinite(primary) || !Number.isFinite(secondary)) {
    throw new Error("Measurements must be finite numbers.");
  }
  if ([taskId, targetId, status].some(value => IDENTIFIERS.some(pattern => pattern.test(value)))) {
    throw new Error("Potential direct identifier detected. Use synthetic identifiers only.");
  }
  const alerts = [];
  if (primary > 25) alerts.push({
    origin_worker: "InvariantQCWorker", urgency: "ELEVATED_RISK",
    summary: "Primary Metric Threshold Exceeded",
    technical_details: `Primary measurement (${primary.toFixed(2)}) exceeds demonstration threshold (25.00).`,
    actionable_remediation: "Review the input and its context; do not treat the threshold as a clinical rule."
  });
  if (critical || secondary > 12) alerts.push({
    origin_worker: "SafetyEscalationWorker",
    urgency: critical ? "CRITICAL_STAT_PANIC" : "ELEVATED_RISK",
    summary: "Safety Flag or Secondary Threshold Triggered",
    technical_details: `CriticalFlag=${critical} with secondary index ${secondary.toFixed(2)}.`,
    actionable_remediation: "Use institutional safety escalation procedures for real incidents."
  });
  if (["DISCORDANT", "ANOMALY", "MUTANT", "VIOLATION", "FAIL", "REJECT"].some(x => status.toUpperCase().includes(x))) {
    alerts.push({
      origin_worker: "ProtocolConformanceWorker", urgency: "ELEVATED_RISK",
      summary: "Descriptor Review Flag",
      technical_details: `Status descriptor: ${status}`,
      actionable_remediation: "Review the descriptor and any applicable local protocol."
    });
  }
  const criticalAlerts = alerts.filter(a => a.urgency === "CRITICAL_STAT_PANIC").length;
  const urgency = criticalAlerts ? "CRITICAL_STAT_PANIC" : alerts.length ? "ELEVATED_RISK" : "ROUTINE";
  const integrity = criticalAlerts ? "RECALIBRATION_REQUIRED" : alerts.length ? "DISCORDANT_ANOMALY" : "VALIDATED_OPTIMAL";
  return {
    mode: "LOCAL_DEMONSTRATION", task_id: taskId, target_identifier: targetId,
    primary_metric: primary, secondary_metric: secondary, status_descriptor: status,
    is_critical_flag: critical, overall_urgency: urgency,
    integrity_status: integrity, total_alerts: alerts.length,
    critical_alerts_count: criticalAlerts, alerts,
    disclaimer: "Illustrative generic rules, not a validated patient-safety triage or SAC score."
  };
}

if (typeof document !== "undefined") {
  const form = document.getElementById("audit-form");
  const output = document.getElementById("output");
  const error = document.getElementById("error");
  const counter = document.getElementById("processed");
  const lastUrgency = document.getElementById("urgency");
  const exportButton = document.getElementById("export");
  let lastResult = null;
  let processed = 0;

  form.addEventListener("submit", event => {
    event.preventDefault();
    error.textContent = "";
    try {
      const formData = new FormData(form);
      const result = evaluateTask({
        task_id: formData.get("task_id"),
        target_identifier: formData.get("target_identifier"),
        primary_metric: formData.get("primary_metric"),
        secondary_metric: formData.get("secondary_metric"),
        status_descriptor: formData.get("status_descriptor"),
        is_critical_flag: formData.get("is_critical_flag") === "on"
      });
      lastResult = result;
      processed += 1;
      counter.textContent = String(processed);
      lastUrgency.textContent = result.overall_urgency;
      output.textContent = JSON.stringify(result, null, 2);
      exportButton.disabled = false;
    } catch (cause) {
      lastResult = null;
      exportButton.disabled = true;
      output.textContent = "No result — correct the input and try again.";
      error.textContent = cause.message || "Unable to evaluate the form.";
    }
  });
  document.getElementById("example").addEventListener("click", () => {
    form.elements.task_id.value = "TASK-DEMO-01";
    form.elements.target_identifier.value = "SYNTHETIC-01";
    form.elements.primary_metric.value = "29.4";
    form.elements.secondary_metric.value = "14.8";
    form.elements.status_descriptor.value = "DISCORDANT_ANOMALY";
    form.elements.is_critical_flag.checked = true;
    error.textContent = "";
  });
  exportButton.addEventListener("click", () => {
    if (!lastResult) return;
    const blob = new Blob([JSON.stringify(lastResult, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "triage-demonstration.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}
