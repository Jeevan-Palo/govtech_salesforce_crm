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
asserts on the response observed above:
`leadConvertResult.hasError === false`,
`leadConvertResult.opportunityId` matching the 18-character Opportunity Id
format (`006` prefix + 15 more characters - NOT a 15-char id, the full Id is
18 characters), the envelope's own `actions[0].state === 'SUCCESS'`, and a
cross-check that this API `opportunityId` equals the Id in the Opportunity's
own record URL after `goToConvertedOpportunity()` navigates there.

## Part C.a — Shadow DOM / dynamic Lightning component evidence

See [`docs/path-component-evidence.png`](docs/path-component-evidence.png) and the
full write-up in [README.md](README.md#part-ca--shadow-dom--dynamic-lightning-component-evidence).

Short version: the Lead Status **Path** component (`LeadDetailPage.editStatus()`)
has no `id` at all - only an Aura render-counter (`data-aura-rendered-by`)
that's confirmed, via two live captures of the same component, to be
reassigned on every page load. `role="option"` + the stage's own label as
`aria-label` is the one thing that's both stable and unique, which is what
`getByRole('option', { name: newStatus, exact: true })` targets. (A static
class like `.slds-combobox__input` doesn't break, but it isn't unique either
- it matches 11 elements on the New Lead form alone - and shadow-piercing
isn't the differentiator, since Playwright's CSS engine pierces open shadow
roots the same way its role/text engines do.)

See also [`docs/shadow-dom-evidence.png`](docs/shadow-dom-evidence.png): a
DevTools capture of the sibling **Lead Status** combobox on the same form,
showing `id="combobox-button-947"` / `aria-controls="dropdown-element-947"`
- generated numeric suffixes reassigned every render, same instability class
as the Path's `data-aura-rendered-by`. `role="combobox"` + `aria-label` is
again the stable anchor, which is exactly what `BasePage.selectCombobox()`
uses for the Rating/Industry/Lead Source fields this suite drives.

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

## Debugging narrative (live-org test behavior)

These were more interesting than the setup issues above, since they're
Salesforce Lightning Experience behaviors rather than tooling problems, but
had previously only lived in code comments and commit messages:

1. **The "New Lead" quick-create modal randomly crashes right after opening.**
   Salesforce occasionally throws an uncaught LWC error ("Toast: please
   provide at least the 'label' property to show the toast") while
   initializing the quick-create panel - most likely a platform-side
   duplicate-detection toast with a missing label - which unmounts the whole
   modal within ~1s of it appearing, before any field is ever touched.
   `LeadFormPage.openNewLeadForm()` detects this (open → briefly check for an
   unexpected disappearance) and retries up to 3 times rather than failing
   the test outright.
2. **Salesforce's Convert Lead "Account Search" duplicate index lags by
   minutes, not seconds.** The same-named Account/Contact match used by the
   Convert Lead dialog's duplicate detection is backed by an asynchronous
   search index that can still be un-indexed 90+ seconds (observed up to
   ~15 minutes) after the record is actually created - a documented platform
   behavior, not a test bug. `tests/lead-conversion.spec.ts`'s two
   existing-match tests work around this by reusing a **fixed** Account/
   Contact identity across runs instead of creating-then-immediately-matching
   within a single run, and self-report a "bootstrap run, re-run me later"
   message the first time the fixture doesn't exist yet.
3. **The Lead Status Path component has no stable `id`.** It only exposes an
   Aura render-counter (`data-aura-rendered-by`) that's reassigned on every
   page load - confirmed via two live captures of the same component. See
   [Part C.a above](#part-ca--shadow-dom--dynamic-lightning-component-evidence)
   for the full evidence and the `role="option"` + label-based fix.
4. **WebKit-only toast interception and render lag.** Three distinct WebKit
   specific symptoms surfaced only once the suite was run cross-browser:
   (a) the App Launcher's search-results list re-renders asynchronously after
   typing, slower on WebKit, so clicking the matching option before it
   settles misses; (b) a lingering post-save toast can sit over the Lead
   Status Path component long enough to intercept a click on one of its
   options; (c) after a status edit, the Details tab's "Lead Status" field
   briefly still reflects the pre-save value, lagging behind the Path
   component's own UI update. Fixed respectively by a short settle wait
   before clicking the App Launcher option, clearing the toast before
   clicking a Path option (`LeadDetailPage.editStatus()`), and polling
   (`expect.poll(...)`) the Details tab field instead of reading it once.
