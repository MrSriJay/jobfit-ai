import assert from "node:assert/strict";
import test from "node:test";

import { jobImageType } from "./jobImage.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(6)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);

test("accepts a job post image and rejects anything else", () => {
  assert.equal(jobImageType("image/png", png), "image/png");
  assert.equal(jobImageType("image/jpg", jpeg), "image/jpeg");
  assert.equal(jobImageType("image/gif", gif), "image/gif");
  assert.equal(jobImageType("image/webp", webp), "image/webp");
  assert.equal(jobImageType("", png), "image/png");
  assert.equal(jobImageType("image/jpeg", png), null);
  assert.equal(jobImageType("image/png", Buffer.from("not an image!!")), null);
  assert.equal(jobImageType("application/pdf", png), null);
});
