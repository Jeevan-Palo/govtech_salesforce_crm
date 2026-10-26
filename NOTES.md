# NOTES

## Part B — API / response validation (bonus)

`ConvertLeadPage.convertAndCaptureResponse()` captures the network response
for the Convert action and the tests assert on it in `tests/lead-conversion.spec.ts`.

The field names currently asserted (`success`, `opportunityId`, `accountId`)
are based on Salesforce's documented `Database.LeadConvertResult` shape,
which is what the standard Lead Convert action's backend call returns.

> TODO once you have a live org: capture the actual request in DevTools →
> Network while clicking Convert, paste the real JSON payload below, and
> update `ConvertLeadPage.convertAndCaptureResponse()`'s response matcher
> (currently matching on `/convert/i` or `/LeadConvert/i` in the URL) plus
> the assertions in `lead-conversion.spec.ts` to match exactly what you
> observed.

```
<paste the captured request URL + response JSON here>
```

## Part C.a — Shadow DOM / dynamic Lightning component evidence

> TODO once you have a live org: add the DevTools screenshot here (or a
> path/link to it) showing the element whose naive `page.locator()` call
> didn't work, plus 2-3 sentences on the locator strategy used instead and
> why it's stable.

## Debugging narrative (framework setup)

Two real issues hit while standing up this scaffold, kept here as the
"one thing that broke" process evidence:

1. **`@faker-js/faker` broke module loading.** The project is CommonJS
   (Playwright's default TS transform), but `@faker-js/faker@10.x` ships
   ESM-only output — `npx playwright test --list` failed with
   `require() of ES Module ... not supported`. Downgrading to the last `9.x`
   line didn't fully resolve it cleanly either, so the random Lead data
   generator was rewritten with zero dependencies (`crypto.randomBytes` +
   small local word lists in `src/data/testDataFactory.ts`), removing the
   dependency and the ESM/CJS conflict entirely.
2. **`tsconfig.json`'s `baseUrl` is rejected by the installed TypeScript
   version.** `tsc --noEmit` failed with `TS5102: Option 'baseUrl' has been
   removed`. Fixed by dropping `baseUrl` and using a relative `paths` entry
   (`"@src/*": ["./src/*"]`) instead, which is now the supported form.
