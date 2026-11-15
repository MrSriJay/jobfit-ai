import assert from "node:assert/strict";
import test from "node:test";

import { jobRecipient } from "./jobEmail.ts";

test("uses an application address from the job description", () => {
  const text = "Apply to Jane Doe jane@slt.lk or careers@slt.lk. Ignore noreply@slt.lk.";
  assert.equal(jobRecipient(text, "jane@slt.lk"), "careers@slt.lk");
});

test("skips the candidate address and keeps the first remaining one", () => {
  assert.equal(jobRecipient("Write to hiring.team@company.com.", "me@company.com"), "hiring.team@company.com");
  assert.equal(jobRecipient("Contact me@company.com for questions.", "me@company.com"), "");
});
