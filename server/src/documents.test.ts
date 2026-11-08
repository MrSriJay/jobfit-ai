import assert from "node:assert/strict";
import test from "node:test";

import { parseDocument } from "./documents.js";

test("rejects legacy doc files and unknown types", async () => {
  await assert.rejects(parseDocument(Buffer.from("hello"), "cv.doc"), /DOCX or PDF/);
  await assert.rejects(parseDocument(Buffer.from("hello"), "notes.txt"), /PDF or DOCX/);
  await assert.rejects(parseDocument(Buffer.alloc(0), "cv.pdf"), /empty/);
});

test("reads text from a PDF", async () => {
  const pdf = Buffer.from(
    "JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxMzEKPj4Kc3RyZWFtCnicJYqxCgJBDET7fEVq4TDZyya7IBaud1jYCPkBkVNOtFDE7791ZZqZ9+YFOwfCX943WB+mx3f6zJdzZ5STJLKUkQP6FYKgH4HblTESGhH6EzbCKsqBpOhoqlGLsvYaK9krm2iq7N9y5bnaIVAky82NbfWRpWzR7+ArGBxOsABwLyGDCmVuZHN0cmVhbQplbmRvYmoKCjcgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA1Ci9GaXJzdCAyNgovTGVuZ3RoIDM2OAo+PgpzdHJlYW0KeJzVUt9LwzAQfs9fcY/64JKmP9LKGGxrqyDi2ARF8aFrw6iMRNpU5n/vXds59iA+S/lI7u675Evv80CAhCAAH1QMAYS+hBCUp2A6Zfzx60MDXxU73TJ+V1ctvCJHwBreGF/azjjw2GzGTtxl4Yq93bGhCTwiHxmrxlZdqRuY5lmeC6GEEFGAiISQKa5LRIKQGGNNxrhHqGAE5pQvhD/HWj4gUkMP1XtuOPZnuCI3Ik46cIN4iH/upbuy4Qz5l55kxvi9rdLCabhIr6WQkeeJWCQy8P2XS/wdjS6c/b+P6/XX1vz6wrM503hpyI0mD/RT5mvd2q4pcezEyy1WaHOr95/a1WVxpUQSo04VJ+ix0Rj8+WH7rsueSmF2cDcbRxqGBOXudVUXC3tA9wn8wiScyBjiwJvgSejEuTHWkTd7VxqHmiiKRqeeCSdZjG+6retDSnqML4pW94JPalGKKW1Vmx3wp9rMTVsfE3TiN5nMxzQKZW5kc3RyZWFtCmVuZG9iagoKOCAwIG9iago8PAovU2l6ZSA5Ci9Sb290IDIgMCBSCi9JbmZvIDMgMCBSCi9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9UeXBlIC9YUmVmCi9MZW5ndGggNDIKL1cgWyAxIDIgMiBdCi9JbmRleCBbIDAgOSBdCj4+CnN0cmVhbQp4nGNgYPj/n4mBnYEBRDCCCCYQwQwiWBgZBBgYGBnuAAmmTQwMAGKYA9kKZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjY5MAolJUVPRg==",
    "base64",
  );
  const text = await parseDocument(pdf, "cv.pdf");
  assert.match(text, /Ada Lovelace/);
  assert.match(text, /Python/);
});
