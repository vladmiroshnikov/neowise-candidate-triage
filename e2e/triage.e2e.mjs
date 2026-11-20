import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { chromium } from "playwright";
import { createTriageServer } from "../server.mjs";

test("clears the previous draft when triage needs manual review", async (t) => {
  const server = createTriageServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);

  const message = page.getByLabel("Текст заявки");
  const submit = page.getByRole("button", { name: "Разобрать заявку" });
  await message.fill("Когда будет доставка?");
  await submit.click();
  await page.getByText("Черновик готов.", { exact: true }).waitFor();
  assert.equal(await page.locator("#draft").textContent(), "Спасибо за обращение. Уточним детали заявки.");
  assert.equal(await page.locator("#result").isVisible(), true);

  await message.fill("[bad-topic]");
  await submit.click();
  await page.getByText("Требуется ручной разбор. Проверьте заявку и подготовьте ответ.", { exact: true }).waitFor();
  assert.equal(await page.locator("#draft").textContent(), "");
  assert.equal(await page.locator("#topic").textContent(), "");
  assert.equal(await page.locator("#result").isVisible(), false);
  assert.equal(await message.inputValue(), "[bad-topic]");
});
