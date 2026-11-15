import assert from "node:assert/strict";
import test from "node:test";

import { buildEml } from "./eml.ts";

test("mail draft includes the address, subject, body, and CV", () => {
  const eml = buildEml({
    to: "careers@slt.lk",
    subject: "Application",
    body: "I would welcome the opportunity.",
    file: { name: "Resume.pdf", type: "application/pdf", bytes: Uint8Array.from([1, 2, 3, 4]).buffer },
  });
  assert.match(eml, /^X-Unsent: 1/);
  assert.match(eml, /To: careers@slt\.lk/);
  assert.match(eml, /Subject: Application/);
  assert.match(eml, /Content-Disposition: attachment; filename="Resume.pdf"/);
  assert.match(eml, /SSB3b3VsZCB3ZWxjb21lIHRoZSBvcHBvcnR1bml0eS4=/);
});
