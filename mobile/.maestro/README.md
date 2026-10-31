# Android Maestro tests

**Status: 259 scenarios authored, not executed. No emulator or Android Studio was used.** The original 84 scenarios have been expanded with 175 additional scenarios. Case count is not a pass count or proof of complete coverage.

The suite targets the React Native Android app, `com.kodofact.uddeepto`. [CASES.md](CASES.md) and [cases.json](cases.json) list every authored case with a stable ID. [COVERAGE.md](COVERAGE.md) maps features to the suite and records remaining gaps. Helpers, setup scripts and manual checks are not counted as test cases.

## Authored coverage

| Area | Scenarios |
| --- | ---: |
| Authentication and registration | 21 |
| Navigation, session and sign out | 10 |
| Search | 9 |
| Profile, active hirer jobs and interests | 27 |
| Education | 10 |
| Experience | 12 |
| Showcase and media | 23 |
| Course learning and original event flows | 17 |
| Additional contest and webinar cases | 11 |
| Jobs, applications and hiring | 28 |
| Messages and communities | 19 |
| Notifications | 6 |
| Settings and account changes | 10 |
| CV and AI | 24 |
| Leaderboard | 3 |
| Video checkpoint quizzes | 11 |
| Android permissions | 2 |
| Missing resources | 4 |
| Transport, session renewal and retry | 12 |
| **Total** | **259** |

Hirer profile regressions cover own and other profiles, opening job details, no deadline, future deadlines, empty profiles, and separate hirers with only closed, draft or expired jobs. Separate fixtures make exclusion assertions meaningful.

Media cases exercise native image, video, audio and PDF selection. The original picture regression publishes a real PNG, checks the server-loaded image and checks it after an app restart. The socket receiving case sends from a second account through the real REST API and waits at most 8 seconds, less than the connected chat's 25-second polling interval. Video cases use a nine-second local MP4 and nine seeded checkpoint questions, with no Gemini call.

## Static authoring checks

From `mobile/`:

```powershell
npm run maestro:check
npm run typecheck
npm run lint
```

`maestro:check` only parses YAML, checks file references, command names, catalog consistency and external flow variables. It never launches Maestro, ADB, a backend or a device. It is not the Maestro CLI runtime parser. Its YAML parser is already available through this project's ESLint dependencies.

At authoring time, YAML/reference checks and TypeScript passed, and the Maestro JavaScript files had no lint errors or warnings. App lint still reports 15 existing errors and 23 warnings, including React hook rules in CV, profile editing, quiz playback and realtime code. Static checks do not establish a device pass result. The fixture server and all 259 device cases also remain unexecuted.

## Isolated fixture environment for a later phone run

The opt-in fixture server reuses repository E2E migrations and seed data, starts the real `backendSimple` against **in-memory PGlite**, and clears the Gemini key. It does not use Supabase. These Maestro flows do not independently validate the `backend/` microservice deployment.

Prerequisites are the existing `e2e/` and `backendSimple/` Node dependencies. From `mobile/`, explicitly run this only when preparing a future test session:

```powershell
npm run maestro:fixtures
```

Keep it running. Required free ports are `4400` for the local fixture proxy, `4401` for backendSimple and `54329` for PGlite. Do not run the Selenium stack simultaneously. Stop and restart fixture preparation before a full suite run or rerunning an original mutating case. A restart creates a fresh in-memory database. Local upload files may remain in the ignored fixture directory.

Expanded cases create fresh accounts and prerequisite records through `prepare-case.js`. They do not need a different UI case to run first. Runtime setup checks that API_URL is exactly the local fixture URL. Original cases use separate seeded actors for state-changing operations. Account creation, uploads, enrollment and deletion still change fixture state, so use one sequential run and fresh fixtures for repeat runs.

Credentials, IDs, a random local control token and API_URL are written to the ignored `.maestro/local/env.json`. This file is not a results report.

### Deterministic failure scenarios

The test-only proxy forwards REST, upload streams, Socket.IO polling and WebSocket upgrades to backendSimple. Only the fixture server imports it. Network cases configure temporary 401, 413 or 503 responses, or dropped connections, on explicit API paths. A random header token protects control requests. Rules have bounded request counts and are cleared by flow start and completion hooks.

The 401 cases model the client renewal contract; they do not wait for a real JWT to expire. Dropped-connection cases model a failed HTTP request; they do not toggle the phone's Wi-Fi or prove offline database support. Do not shard these cases: fault rules belong to the single local proxy.

## App prerequisite for a later run

Use a fresh **debug build from this source** configured with:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:4400/api/v1'
```

Expo bundles that setting. Maestro environment arguments do not change an APK's backend. The older production APK points at production and lacks the new native test IDs. The Android debug manifest permits local HTTP; the release manifest does not. Keep the debug build's Metro server reachable over USB, including port 8081 when needed. Building or installing an APK is a separate action.

Test IDs are invisible selectors on existing controls. The `chat-connected` selector exposes socket state without adding diagnostic text to product screens.

## Later execution on a physical phone only

Configure the official [Maestro CLI](https://docs.maestro.dev/maestro-cli/) and Android platform tools. Use a dedicated physical Android phone with USB debugging authorized, English system language, and Android 13 or later for the Photo Picker helpers. OEM picker controls, native playback controls, document provider labels and cropping dialogs may require adjustment after inspecting that phone.

When Maestro and ADB are available in PowerShell, from `mobile/`:

```powershell
# Replace YOUR_PHONE_SERIAL with the physical phone's ADB serial.
.\.maestro\scripts\run-physical.ps1 -Serial YOUR_PHONE_SERIAL -IncludeTags smoke

# Excludes native media and destructive cases by default.
.\.maestro\scripts\run-physical.ps1 -Serial YOUR_PHONE_SERIAL

# All 259 authored cases, including uploads and disposable-account deletion.
.\.maestro\scripts\run-physical.ps1 -Serial YOUR_PHONE_SERIAL -ExcludeTags ''
```

The runner requires an explicit serial, rejects emulator serials and QEMU/goldfish/ranchu hardware, checks local API health and establishes `adb reverse` for port 4400. It copies the valid PDF, invalid PDF and WAV into `Download/UddeeptoMaestro`. Photo/video flows add their media to the gallery explicitly. These phone files remain until removed manually. Flows clear app state when signing in. Reports go to `.maestro/artifacts/` only after a future execution.

For WSL/Linux, use its physical-device ADB setup and pass the fixture variables to `maestro --device YOUR_PHONE_SERIAL test .maestro`. The CLI, ADB connection and fixture API must share working localhost connectivity. The PowerShell wrapper is not a WSL bridge. Do not use automatic device selection, device creation, sharding or cloud execution for this workflow.

## Current behavior and limits

- Deep links keep detail cases independent; navigation cases also cover tabs, search results, notifications and profile job cards.
- A newly created hirer job is currently saved as a draft because the jobs API treats create-status as an admin-only field. The original create-job case reflects this behavior. Opening/closing cases use an independently seeded open job. This suite does not fix the mobile form's attempt to publish during creation.
- AI scenarios exercise the explicit missing-key error. Video questions are seeded. Real Gemini responses, payment provider completion and external meeting apps are not exercised.
- [COVERAGE.md](COVERAGE.md) lists remaining feature and device checks, including native map interaction, large media boundaries, multiple devices, lifecycle interruptions and production backend parity.
- All cases need a future physical-phone run before they can be reported as passing.

## Documentation used

- [Maestro selectors](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/how-to-use-selectors)
- [Nested flows](https://docs.maestro.dev/reference/commands-available/runflow)
- [Flow hooks](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/hooks)
- [Media fixtures](https://docs.maestro.dev/reference/commands-available/addmedia)
- [HTTP calls from scripts](https://docs.maestro.dev/maestro-flows/javascript/make-http-requests)
- [Explicit device selection](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/specify-and-start-devices)
