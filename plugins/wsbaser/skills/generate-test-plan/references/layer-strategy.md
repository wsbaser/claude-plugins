# Layer Strategy: Integration, E2E, and Contract Tests

Read this when deciding which layer a given behavior belongs in, especially for
the "do we need an E2E test for every API request?" question.

## The default allocation

Put the bulk of coverage in integration tests with a mocked backend. They are
fast, deterministic, and can exhaustively cover branches, edge cases, and error
paths (500s, timeouts, empty data, permission-denied) that are hard to trigger
against a real backend. Prioritize for integration tests: data-fetching / API
clients, auth and token-refresh logic, complex state (stores, reducers,
selectors, multi-async components), forms with validation, and error/edge states.

Reserve E2E tests (real backend) for a thin cap of business-critical journeys —
login, checkout, payment, signup→activation — the handful of flows that must
never break. These act as a release gate. Keep the set small; E2E is slow and
flaky, and a flaky critical-path test everyone ignores is worse than no test.

Rule: if an integration test can catch it, do not duplicate it in E2E.

## "Don't we need E2E to verify every API request?"

No. Separate the two decisions: "verify every request" and "do it via E2E."

Verify request/response SHAPE at the integration layer or with contract tests —
not with one E2E test per endpoint. One-E2E-per-endpoint is the slowest, flakiest
way to buy that confidence: you must stand up real data for every branch and
still cannot easily force a 500 or timeout.

What integration mocks with a handwritten payload CANNOT verify is that the mock
matches reality — that the endpoint exists, auth works, and the real response
shape matches what you mocked. Mocks drift. That gap is closed by contract tests,
not by exhaustive E2E.

Coverage target:
- Every request is verified at the integration layer (correct method, URL,
  headers, payload; handles each response variant).
- Every mock assumption is checked against the real backend by a contract test.
- Critical paths run against the real backend end-to-end.
An endpoint used only off the critical path needs integration + contract
coverage, not its own E2E.

## Contract testing (Pact) and how it relates to your mocks

Pact is consumer-driven contract testing. The consumer writes a test declaring
the requests it makes and the responses it expects; Pact runs that against its
own mock server and emits a JSON contract. The provider then verifies its real
implementation satisfies that contract (via the Pact Broker / can-i-deploy in
CI). Both sides are checked against one pinned definition, without running both
services together.

The key relationship: your handwritten integration mocks (e.g. Playwright
`page.route`, or MSW handlers) and Pact's mock both fake the same API boundary,
but your integration mock is UNVERIFIED while Pact's shape is VERIFIED against the
real provider. If they define the response shape independently, they drift and
your integration tests stay green against a fiction.

Fix: one definition of each response shape, reused everywhere.

1. **Shared fixture (start here).** Define each payload once in a plain module.
   The Pact test wraps it in matchers (`like()`, `eachLike()`) asserting shape,
   not exact values; the integration mock returns the raw fixture. When provider
   verification fails in CI, edit the fixture once and both follow.
2. **Contract-derived mocks (scale up).** Point integration mocks at Pact's stub
   server / recorded contract so the mock literally IS the verified contract —
   zero drift, more plumbing. Worth it with many endpoints.
3. **Types from OpenAPI (complementary).** Generate types from the backend spec
   so shape changes break compilation. Complements the above; doesn't replace it.

Caveat: Pact is consumer-driven, so it shines when your team or a cooperating
backend team runs provider verification. For a third-party API you can't ask to
verify, use schema validation against their OpenAPI spec (openapi-cop, Specmatic)
as the substitute for the provider-verification half.

## When to change course

- Defect escape rate to production stays high (>~10%) → stop adding breadth;
  deepen coverage on the modules leaking bugs.
- E2E suite gets flaky → cut to fewer, more stable critical paths; push scenarios
  down to mocked integration tests.
- A tested hotspot keeps breaking → assertions are too weak; strengthen them.
