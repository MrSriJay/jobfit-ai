import assert from "node:assert/strict";
import test from "node:test";

import { jobUrlProblem, linkedInJobId, normalizeJobUrl, parseJobHtml } from "./jobPage.js";

test("rejects local and non-web links before any fetch", () => {
  assert.match(jobUrlProblem("not a link") ?? "", /https/);
  assert.match(jobUrlProblem("file:///C:/secret.txt") ?? "", /https/);
  assert.equal(jobUrlProblem("http://127.0.0.1/admin"), "That link cannot be read.");
  assert.equal(jobUrlProblem("http://localhost:8787/api/status"), "That link cannot be read.");
  assert.equal(jobUrlProblem("http://10.1.2.3/job"), "That link cannot be read.");
  assert.equal(jobUrlProblem("http://192.168.0.8/job"), "That link cannot be read.");
  assert.equal(jobUrlProblem("http://[::1]/job"), "That link cannot be read.");
  assert.equal(jobUrlProblem("https://jobs.example.com/role"), null);
});

test("adds https when the pasted link has no scheme", () => {
  assert.equal(normalizeJobUrl("jobs.example.com/role"), "https://jobs.example.com/role");
  assert.equal(normalizeJobUrl("https://jobs.example.com/role"), "https://jobs.example.com/role");
});

test("reads a LinkedIn job id from a public job link", () => {
  assert.equal(linkedInJobId("https://www.linkedin.com/jobs/view/associate-technical-lead-3812345678"), "3812345678");
  assert.equal(linkedInJobId("https://www.linkedin.com/jobs/view/3812345678/?trk=public"), "3812345678");
  assert.equal(linkedInJobId("https://boards.greenhouse.io/example/jobs/1"), null);
});

test("reads a structured job posting from the page", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {"@type":"JobPosting","title":"Associate Technical Lead","hiringOrganization":{"@type":"Organization","name":"Sysco LABS"},"description":"<p>Lead the platform.</p><ul><li>Build reliable systems.</li></ul>"}
      </script>
    </head><body><h1>Careers</h1></body></html>`;
  const job = parseJobHtml(html);
  assert.equal(job.company, "Sysco LABS");
  assert.equal(job.title, "Associate Technical Lead");
  const encoded = parseJobHtml('<script type="application/ld+json">{"@type":"JobPosting","title":"Head of Measurement &amp; Advertising","hiringOrganization":{"name":"Spotify"},"description":"<p>Build measurement products for advertisers across audio and video.</p>"}</script>');
  assert.equal(encoded.title, "Head of Measurement & Advertising");
  assert.match(job.description, /Lead the platform/);
  assert.match(job.description, /Build reliable systems/);
});

test("reads a LinkedIn guest page when structured data is absent", () => {
  const html = `
    <h2 class="top-card-layout__title"><span>Associate Technical Lead</span></h2>
    <a class="topcard__org-name-link">Sysco LABS Sri Lanka</a>
    <div class="show-more-less-html__markup"><p>About the job</p><p>You will guide engineers and own delivery.</p><div><p>Requirements include TypeScript.</p></div></div>`;
  const job = parseJobHtml(html);
  assert.equal(job.title, "Associate Technical Lead");
  assert.equal(job.company, "Sysco LABS Sri Lanka");
  assert.match(job.description, /guide engineers/);
  assert.match(job.description, /TypeScript/);
});
