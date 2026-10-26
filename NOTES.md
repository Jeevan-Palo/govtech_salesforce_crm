# NOTES

## Part B — API / response validation (bonus)

`ConvertLeadPage.convertAndCaptureResponse()` captures the network response
for the Convert action and the tests assert on it in `tests/lead-conversion.spec.ts`.

Salesforce Lightning Experience doesn't call a REST-style `/convert` endpoint
from the client - Convert Lead is a Lightning/Aura component action, batched
through the single generic Aura endpoint. Captured directly from this org via
a `page.on('response', ...)` listener while running the "creates a new
Account and Contact" conversion test:

**Request** (`POST`, decoded `message` form field):
```
URL: https://orgfarm-db3300f49e-dev-ed.develop.lightning.force.com/aura?r=97&ui-lead-runtime-components-controllers.LeadConvertDesktop.convertLeadServer=1

message={"actions":[{"id":"2504;a","descriptor":"serviceComponent://ui.lead.runtime.components.controllers.LeadConvertDesktopController/ACTION$convertLeadServer","callingDescriptor":"UNKNOWN","params":{
  "leadId":"00Qak00000yVGE1EAO",
  "newAccountRecord":{"sobjectType":"Account","Name":"Lim Ventures cd9b416a","IsPersonAccount":false},
  "newContactRecord":{"sobjectType":"Contact","Salutation":"","FirstName":"Drew","LastName":"Tan-cd9b416a"},
  "newOpportunityRecord":{"sobjectType":"Opportunity","Name":"Lim Ventures cd9b416a-"},
  "ownerId":"005ak00000lzoknAAA",
  "convertedStatus":"Closed - Converted",
  "overwriteLeadSource":false,
  "doNotCreateOpportunity":false,
  "bypassAccountDedupeCheck":false,
  "bypassContactDedupeCheck":false,
  "recordSaveParams":{"bypassDedupeCheck":false}
}}]}
```

**Response** (`200`, JSON body):
```json
{
  "actions": [
    {
      "id": "2504;a",
      "state": "SUCCESS",
      "returnValue": {
        "accountId": "001ak000041ENBpAAO",
        "opportunityId": "006ak00000gGrPxAAK",
        "contactId": "003ak00002JZaMPAA1",
        "isPersonAccount": false,
        "hasError": false
      },
      "error": []
    }
  ]
}
```

The `returnValue` object matches Salesforce's documented
`Database.LeadConvertResult` shape. `ConvertLeadPage.convertAndCaptureResponse()`
matches the response by URL (`/convertLeadServer/i`) and parses this
`returnValue` out as `leadConvertResult`; `tests/lead-conversion.spec.ts`
asserts 2 deep properties observed above:
`leadConvertResult.hasError === false` and
`leadConvertResult.opportunityId` matching the 15-char Opportunity Id prefix
(`006`) format.

## Part C.a — Shadow DOM / dynamic Lightning component evidence

See [`docs/shadow-dom-evidence.png`](docs/shadow-dom-evidence.png) and the
full write-up in [README.md](README.md#part-ca--shadow-dom--dynamic-lightning-component-evidence).

Short version: the New Lead form's "Lead Status" combobox renders with a
runtime-generated `id` (`combobox-button-947`) and an LWC scoping class
(`lwc-4kb6kaqheak`) that both change between sessions/builds, so a naive
`#combobox-button-947` or `.slds-combobox__input` locator isn't durable. The
component does expose a stable accessible contract, though -
`role="combobox"` + `aria-label="Lead Status"` - which is what
`BasePage.selectCombobox()` targets via `getByRole('combobox', { name: ... })`.

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
