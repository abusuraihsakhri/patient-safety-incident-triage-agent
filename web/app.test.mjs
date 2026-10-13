import test from "node:test";
import assert from "node:assert/strict";
import {evaluateTask} from "./app.mjs";

const base = {task_id:"SYN-1",target_identifier:"SYN-2",primary_metric:10,secondary_metric:2,status_descriptor:"NOMINAL",is_critical_flag:false};

test("routine outcome has no alerts", () => {
  const result = evaluateTask(base);
  assert.equal(result.overall_urgency, "ROUTINE");
  assert.equal(result.total_alerts, 0);
});
test("critical flag overrides other tiers", () => {
  const result = evaluateTask({...base,is_critical_flag:true});
  assert.equal(result.overall_urgency, "CRITICAL_STAT_PANIC");
  assert.equal(result.critical_alerts_count, 1);
});
test("numeric and descriptor thresholds match worker rules", () => {
  const result = evaluateTask({...base,primary_metric:26,secondary_metric:13,status_descriptor:"DISCORDANT"});
  assert.equal(result.overall_urgency, "ELEVATED_RISK");
  assert.equal(result.total_alerts, 3);
});
test("boundary values do not trigger", () => {
  assert.equal(evaluateTask({...base,primary_metric:25,secondary_metric:12}).total_alerts, 0);
});
test("reject nonfinite input and potential direct identifiers", () => {
  assert.throws(()=>evaluateTask({...base,primary_metric:"NaN"}),/finite/);
  assert.throws(()=>evaluateTask({...base,target_identifier:"MRN-12345678"}),/identifier/);
});
test("does not claim validated clinical scoring or browser audit signature", () => {
  const result=evaluateTask(base);
  assert.match(result.disclaimer,/not a validated/i);
  assert.equal(result.audit_hash,undefined);
});
