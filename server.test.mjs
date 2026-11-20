import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { createTriageServer } from "./server.mjs";

const server = createTriageServer();
let endpoint;

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  endpoint = `http://127.0.0.1:${server.address().port}/api/triage`;
});

after(() => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
}));

async function submit(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: response.status, body: await response.json() };
}

const manualReview = {
  status: 200,
  body: { status: "manual_review", topic: null, draft: null },
};

test("returns a topic and a draft for a valid request", async () => {
  const response = await submit(JSON.stringify({ text: "Когда будет доставка?" }));
  assert.deepEqual(response, {
    status: 200,
    body: {
      status: "ready",
      topic: "delivery",
      draft: "Спасибо за обращение. Уточним детали заявки.",
    },
  });
});

test("rejects malformed JSON and invalid input", async () => {
  for (const body of ["", "{", "null", "{}", '{"text":12}', '{"text":""}', '{"text":"   "}']) {
    assert.deepEqual(await submit(body), {
      status: 400,
      body: { status: "invalid_input" },
    }, `Request body: ${JSON.stringify(body)}`);
  }
});

test("routes provider errors and invalid model output to manual review", async () => {
  for (const text of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft]"]) {
    assert.deepEqual(await submit(JSON.stringify({ text })), manualReview, text);
  }
});

test("routes model timeouts to manual review", async () => {
  const start = performance.now();
  assert.deepEqual(await submit(JSON.stringify({ text: "[timeout]" })), manualReview);
  const elapsed = performance.now() - start;
  // Allow for test runner overhead while distinguishing the mock's 1200 ms delay.
  assert.ok(elapsed < 950, `Timeout response took ${Math.round(elapsed)} ms`);
});
