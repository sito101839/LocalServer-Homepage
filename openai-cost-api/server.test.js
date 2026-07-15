const test = require("node:test");
const assert = require("node:assert/strict");

const { currentMonthRange, summarizeCosts } = require("./server");

test("currentMonthRange uses UTC month boundaries", () => {
  const range = currentMonthRange(new Date("2026-07-15T03:04:05.000Z"));

  assert.deepEqual(range, {
    startTime: 1782864000,
    endTime: 1784084645,
    period: "2026-07",
  });
});

test("summarizeCosts totals all results across pages", () => {
  const result = summarizeCosts(
    [
      {
        data: [
          {
            results: [
              { amount: { value: 1.25, currency: "usd" } },
              { amount: { value: 0.5, currency: "usd" } },
            ],
          },
        ],
      },
      {
        data: [{ results: [{ amount: { value: 2, currency: "usd" } }] }],
      },
    ],
    "2026-07",
    new Date("2026-07-15T03:04:05.000Z"),
  );

  assert.deepEqual(result, {
    service: "OpenAI",
    is_available: true,
    currency: "USD",
    month_spend: "3.75",
    period: "2026-07",
    fetched_at: "2026-07-15T03:04:05.000Z",
  });
});
