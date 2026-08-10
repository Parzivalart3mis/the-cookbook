# Audit Plan — The Cookbook

**Date:** 2026-07-30 · **Branch:** main · **Auditor pass:** 1

**Calibration:** solo maintainer · 2–4 h/week · ~1 real user, staying 1–5 · side project ·
primary device iPhone Safari (PWA) · focus: correctness of the Notion → ingredients → shopping-list path.
Off-limits (untouched): Next.js 16 App Router, Clerk, Turso/libsql, Notion as source of truth, Vercel,
Tailwind v4, framer-motion.

---

## Executive Summary

The app is in better shape than its age suggests: typecheck is clean, the build is green, all 71 routes
compile, every user-data API route is auth-gated and correctly scoped by `user_id`, and `.env.local` is
gitignored with no secrets in tracked files. The multi-tenant story is genuinely sound.

The real problem is concentrated in exactly the area flagged as most important. The shopping-list
pipeline depends on `extractIngredients()` inferring document structure from Notion blocks, and that
inference is brittle. Running the real function against live Notion data shows **three recipes now
return zero ingredients** — Dal Baati Chokha, Malai Kofta, Sooji Appe. Their "Add to Shopping List"
button silently produces nothing. This is a regression introduced hours ago when component group
headings (`For the baati`) were added to those pages: any heading without an ingredient keyword resets
collection to false. A closely related fragility — section labels written as paragraphs rather than
headings — previously caused Sev Tamatar to sweep all ten cooking steps into the shopping list. That
one is currently masked because the data was rewritten, not because the code was fixed.

The second gap is verification. There is no test harness and no `typecheck` script; `npm test` errors
out. For a solo project at 2–4 h/week a full harness is not a sensible ask, but the absence means every
change to the extractor — the most fragile code in the app — is verified by hand or not at all.

Everything else is minor: a deprecation warning, transitive advisories in a code path that is not
exercised, and two dead components. Nothing here threatens data.

---

## Ground Truth

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | **exit 0**, clean |
| `npm run lint` | **exit 0** — 0 errors, **1 warning** (`scripts/audit-recipes.mjs:91` unused `isList`) |
| `npx next build` | **exit 0** — compiled 4.6s, 71 static pages generated |
| `npm test` | **script does not exist** — npm error. Absence recorded as TEST-01 |
| `npm audit --omit=dev` | **7 high** — all `ws` (GHSA-96hv-2xvq-fx4p), transitive via `@libsql/client` |
| `git remote -v` | `origin https://github.com/Parzivalart3mis/the-cookbook.git` |

**Baseline bar for every commit:** typecheck exit 0 · lint exit 0 with ≤1 warning, 0 errors · build exit 0.

**Live-data probe** (real `extractIngredients()` logic replayed against all 47 Notion pages):
39 clean · 4 zero-ingredient (1 legitimately empty, 3 broken) · 0 confirmed step-leakage.

---

## Findings

### FUNC-01 — Component group headings make ingredient extraction return nothing
**Status:** [verified]
**Evidence:** `src/lib/ingredients.ts:45` — `if (isHeading(block)) { collecting = INGREDIENT_KW.some(...); continue; }`.
Live probe against Notion: Dal Baati Chokha, Malai Kofta, Sooji Appe each extract **0 items**. Their pages
open `heading_2 "Ingredients"` → `heading_3 "For the baati"`, and the `heading_3` resets `collecting` to false.
**Problem:** Any sub-heading inside the ingredients section terminates collection, so nothing after it is gathered.
**Impact:** "Add to Shopping List" on those three recipes silently adds nothing. The UI shows "No ingredients found" —
the user's single most-used data path, broken today for the three most complex recipes.
**Fix:** Track section state explicitly. Stay in the ingredients section across non-keyword headings; leave it only
on a heading that matches an instruction keyword.
**Priority:** P0   **Effort:** S   **Depends on:** —
**Action:** IMPLEMENT

### FUNC-02 — Section labels written as paragraphs are not recognised as dividers
**Status:** [inferred]
**Evidence:** `src/lib/ingredients.ts:26-27` — `isHeading()` accepts only `heading_1|2|3`. Sev Tamatar previously
stored `Instructions` as a `paragraph`, which produced 34 "ingredients" (24 real + 10 cooking steps) before the
Notion content was rewritten. The data was corrected; the code was not.
**Problem:** A section label typed as normal text is invisible to the parser, so instructions are swept into the
ingredient list. Notion makes this easy to do by accident.
**Impact:** Shopping lists silently contaminated with sentences like "Heat 1 tbsp ghee in a kadai". Currently latent —
no recipe is in this state right now — but one keystroke in Notion reintroduces it.
**Fix:** Additive — also treat a short paragraph (≤40 chars) whose text matches a section keyword as a divider.
Recipes using real headings are unaffected.
**Priority:** P1   **Effort:** S   **Depends on:** FUNC-01
**Action:** IMPLEMENT

### FUNC-03 — No `typecheck` script
**Status:** [verified]
**Evidence:** `package.json` scripts = `dev`, `build`, `start`, `lint`. Typechecking only happens inside `next build`.
**Problem:** No fast way to typecheck without a full build; CI or a pre-commit hook has nothing to call.
**Impact:** Slower feedback; the verification gate has no standard entry point.
**Fix:** Add `"typecheck": "tsc --noEmit"`. Purely additive.
**Priority:** P2   **Effort:** S   **Depends on:** —
**Action:** IMPLEMENT

### SEC-01 — AI routes rely solely on middleware for auth
**Status:** [verified]
**Evidence:** `src/app/api/ai/{voice,substitute,meal-plan}/route.ts` contain no `auth()` call. Production probe:
unauthenticated `POST` to all three returns **404** (Clerk middleware blocks them), so there is no open door today.
Every other route calls `await auth()` and scopes queries by `user_id`.
**Problem:** These three are protected by exactly one mechanism. `middleware.ts`'s `isPublicRoute` list is edited
often — `/welcome` and `/recipes` were both added this week — and one wrong entry exposes paid Groq calls.
**Impact:** Not exploitable now. If it regressed, an anonymous caller could spend your Groq quota.
**Fix:** Additive defense-in-depth — `const { userId } = await auth(); if (!userId) return 401` in each route.
No behaviour change for signed-in users.
**Priority:** P2   **Effort:** S   **Depends on:** —
**Action:** IMPLEMENT

### TEST-01 — No test harness at all
**Status:** [verified]
**Evidence:** `npm test` → npm error, no script. No `vitest`/`jest` in `package.json`, no test files in repo.
**Problem:** `extractIngredients()` is pure, has three fallback branches, and has now broken twice in one week.
It is the ideal unit-test target and has zero coverage.
**Impact:** Every extractor change is validated by hand against live Notion, which is slow and easily skipped.
**Fix:** Add Vitest plus a table-driven spec for `extractIngredients` covering headings, `heading_3` groups,
paragraph labels, and the bulleted fallback.
**Priority:** P1   **Effort:** M   **Depends on:** FUNC-01, FUNC-02
**Action:** DEFERRED — requires a package addition (vitest), which the autonomy rules exclude.

### DEPLOY-01 — `middleware` file convention deprecated in Next.js 16
**Status:** [verified]
**Evidence:** every `next build` prints `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
**Problem:** Deprecated convention; will break on a future major.
**Impact:** None today — builds and deploys succeed.
**Fix:** Rename `src/middleware.ts` → `src/proxy.ts` and adapt to the proxy API.
**Priority:** P2   **Effort:** M   **Depends on:** —
**Action:** DEFERRED — this file is the sole auth gate for every route. A rename that misbehaves logs the owner
out of an app used daily, and the finding does not describe that risk in enough detail to change it unattended.

### DEPLOY-02 — 7 high advisories in `ws` (transitive)
**Status:** [verified]
**Evidence:** `npm audit --omit=dev` → 7 high, all GHSA-96hv-2xvq-fx4p in `node_modules/ws`, pulled in by `@libsql/client`.
**Problem:** Memory-exhaustion DoS in the WebSocket library.
**Impact:** Effectively nil — `src/lib/db.ts:8` rewrites `libsql://` to `https://`, so the WebSocket transport is
never used. It is also a DoS class issue at ~1 user, which the security calibration explicitly excludes from P0.
**Fix:** `npm audit fix`, or bump `@libsql/client`.
**Priority:** P3   **Effort:** S   **Depends on:** —
**Action:** DEFERRED — requires a dependency bump, which the autonomy rules exclude.

### UX-01 — Splash screen adds a fixed 900 ms floor to every cold start
**Status:** [verified]
**Evidence:** `src/components/AppSplash.tsx:22` `MIN_VISIBLE_MS = 900`, enforced against `performance.now()`.
**Problem:** The brief asks whether this app wants a branded startup experience. Honest answer: for a
recipe app opened one-handed mid-cook on iPhone, a deliberate 900 ms gate makes the app feel *slower*, not more
premium. Splash screens pay off when there is real work to wait for; here the shell is already interactive.
**Impact:** ~0.9 s added to every launch on the primary device, in the exact moment the user is most impatient.
**Fix:** Either drop the floor to ~350 ms, or show the splash only on first load per session and skip it on
subsequent launches.
**Priority:** P2   **Effort:** S   **Depends on:** —
**Action:** DEFERRED — the owner specified and shipped this deliberately in the previous session; changing its
feel unattended would alter a daily-use behaviour the finding cannot fully anticipate. Recommendation stands.

### ARCH-01 — Two unreferenced components remain in the tree
**Status:** [verified]
**Evidence:** `RecentlyViewedShelf.tsx` and `RecipeImageManager.tsx` — `grep -rn` across `src/` returns no importer.
**Problem:** Dead code; `RecentlyViewedShelf` was even lint-fixed this week despite nothing rendering it.
**Impact:** Minor maintenance drag and misleading grep results.
**Fix:** Delete both files.
**Priority:** P3   **Effort:** S   **Depends on:** —
**Action:** DEFERRED — P3, and the owner was offered this deletion earlier and chose to leave them.

### PERF-01 — `/api/shopping/from-recipes` refetches the whole database per slug
**Status:** [verified]
**Evidence:** `src/app/api/shopping/from-recipes/route.ts:22` calls `getRecipeBySlug(slug)` in a loop;
`src/lib/notion.ts:147` implements it as `getAllRecipes()` then `.find()`.
**Problem:** Adding a 7-recipe week issues 7 full-database reads.
**Impact:** Negligible at 47 recipes with `revalidate: 60` fetch caching in front of it.
**Fix:** Fetch all recipes once, then map slugs against the result.
**Priority:** P3   **Effort:** S   **Depends on:** —
**Action:** DEFERRED — P3.

### Retracted — "instruction text leaking into ingredient lists"
An initial probe flagged 4 recipes (Nariyal ki Chutni, Paneer Kali Mirch, Roti ki Chaat, White Sauce Pasta)
whose extracted "ingredients" exceeded 90 characters. Inspecting the live blocks showed these are legitimately long
ingredient lines — `Masale: 1 tsp lal mirch powder, …`, `2 cups water (use ~1 cup for 2–3 rotis; …)`. The
>90-character heuristic was wrong, not the code. **No finding.**

### Knowingly accepted
- **Lint warning** `scripts/audit-recipes.mjs:91` unused `isList` — accepted; the file is a standalone maintenance
  script, and the baseline of 1 warning / 0 errors is preserved rather than reduced.

---

## Roadmap

| ID | Title | Priority | Effort | Depends on | Action |
| --- | --- | --- | --- | --- | --- |
| FUNC-01 | Group headings break ingredient extraction | P0 | S | — | IMPLEMENT |
| FUNC-02 | Paragraph section labels not recognised | P1 | S | FUNC-01 | IMPLEMENT |
| SEC-01 | AI routes lack in-route auth guard | P2 | S | — | IMPLEMENT |
| FUNC-03 | No `typecheck` script | P2 | S | — | IMPLEMENT |
| TEST-01 | No test harness | P1 | M | FUNC-01, FUNC-02 | DEFERRED |
| DEPLOY-01 | `middleware` convention deprecated | P2 | M | — | DEFERRED |
| UX-01 | Splash 900 ms floor hurts perceived speed | P2 | S | — | DEFERRED |
| DEPLOY-02 | 7 high advisories in `ws` | P3 | S | — | DEFERRED |
| ARCH-01 | Two dead components | P3 | S | — | DEFERRED |
| PERF-01 | `from-recipes` refetches per slug | P3 | S | — | DEFERRED |

**Ordering note.** FUNC-02 is listed after FUNC-01 despite being lower priority because both rewrite the same
branch of `extractIngredients()`. FUNC-01 establishes explicit section state; FUNC-02 then only widens what counts
as a divider. Done in the other order, FUNC-01 would have to be written twice.

## Deferred, with reasons

**Blocked by the autonomy rules**
- TEST-01 — needs a package addition (vitest)
- DEPLOY-02 — needs a dependency bump

**Would change a daily-use behaviour beyond what the finding describes**
- DEPLOY-01 — sole auth gate for every route
- UX-01 — deliberately specified by the owner last session; recommendation recorded instead

**P3 — below the implement threshold**
- ARCH-01, PERF-01
