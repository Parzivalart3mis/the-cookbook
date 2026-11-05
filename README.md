# The Cookbook

A personal recipe website backed by Notion. Recipes are authored and edited in Notion (on any device) and served as a statically-generated Next.js site deployed on Vercel. Updates appear within ~60 seconds via ISR.

## Setup

```bash
git clone <your-repo>
cd the-cookbook
npm install

# Create your env file from the template
cp .env.local.example .env.local
```

Edit `.env.local` and fill in both values:

```
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=<32-char hex from your database URL>
```

**Important:** Before running the dev server, connect your Notion integration to the database:
1. Open the database in Notion
2. Click `•••` (top-right menu) → **Connections** → find your integration → Connect
3. Without this step the API returns empty results even with a valid token.

```bash
npm run dev
# Open http://localhost:3000
```

If the page shows "No recipes yet," add a recipe in Notion first — it will appear within a minute.

## Notion database schema

Create a full-page database in Notion with these properties (names are case-sensitive):

| Property | Type | Notes |
|----------|------|-------|
| **Name** | Title | Required — the dish name |
| **Servings** | Number | Optional |
| **Source** | URL | Optional — typically a YouTube link |
| **Tags** | Multi-select | Optional |

The page body (headings, paragraphs, lists) becomes the recipe content.

## AI Kitchen (`/kitchen-ai`)

AI Kitchen uses Gemini through `src/lib/gemini.ts`. Requests have one route deadline, try another model on transient errors or invalid output, and start a fallback alongside a slow model. SDK retries are disabled so they cannot add hidden backoff inside this budget. Named Gemini 3 Flash models use low thinking for these short cooking tasks ([Google thinking configuration](https://firebase.google.com/docs/ai-logic/thinking)).

| Tab | Results | Needs |
|---|---|---|
| **Discover** | New dishes outside the cookbook and Future Recipes, with YouTube videos and recent trending videos | `GEMINI_API_KEY`; optional `YOUTUBE_API_KEY` |
| **From my pantry** | **From your recipes:** real saved recipes ranked by pantry ingredient coverage. **New dishes to try:** Gemini suggestions excluding existing cookbook names | tote connection; Gemini only for new dishes |
| **High-protein** | The same two sections, with protein/calorie filters. Saved recipes use recorded per-serving nutrition; new dishes use AI estimates | same as Pantry |

Pantry is read independently of Gemini. Opening a pantry-based tab or returning to the window checks tote (automatic checks are throttled to once per 30 seconds). **Refresh pantry** checks immediately. New AI generation also starts a pantry check. No AI request runs automatically when stock changes.

The screen distinguishes the current pantry check time from the suggestion generation time. Cached suggestions are marked as previous results when the pantry, cuisine, diet, request text or protein targets change, or after 24 hours. A failed generation keeps the previous suggestions and the independently refreshed pantry/saved-recipe matches.

Saved matches use a five-minute, per-server-process ingredient index with concurrent requests coalesced. Recipe pages remain the source of instructions. Matching recognizes ingredient amounts, optional preparation notes, singular/plural forms and limited spelling variants; it does not verify sufficient quantities. Salt, pepper, water and cooking oil are assumed available. Cuisine matches saved tags/names; meal requests such as “Dinner” match saved meal types, and “under 20 minutes” uses recorded prep/cook times. Other free-text instructions apply to AI generation. Recipes with unreadable ingredients are excluded; High-protein also excludes recipes without recorded protein/calories. The UI reports these exclusions.

Every tab supports cuisine and a shared diet preference (Vegetarian by default, Eggetarian or Non-veg). Generated dishes and videos are checked for excluded animal ingredients with `fitsDiet` in `src/lib/kitchen-ai.ts`. This keyword filter is conservative, not an allergy guarantee.

AI errors include a specific category and request reference. Search server logs for the reference to see model attempts, HTTP status, elapsed time, hedges and deadline exhaustion, without logging prompts, pantry contents or API keys. A provider outage can still prevent new suggestions; saved matches remain available.

Environment variables (see `.env.local.example`):

- `GEMINI_API_KEY`: from [Google AI Studio](https://aistudio.google.com/apikey). Optional `GEMINI_MODEL` / `GEMINI_MODEL_LITE` override the default models.
- `YOUTUBE_API_KEY`: Google Cloud Console → enable **YouTube Data API v3** → Credentials → API key. Free quota is 10,000 units/day; one Discover refresh costs about 700, and results are cached for 6 h.
- `TOTE_API_URL` / `TOTE_API_KEY`: your tote URL and the same value as tote's `PANTRY_SHARE_SECRET` (tote also needs `PANTRY_SHARE_USER_ID`).

Run the focused workflow regression tests with Node 22.15+ or Node 24:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Run typecheck after build rather than concurrently: Next regenerates `.next/types` during a build.

Check your key and models with:

```bash
GEMINI_API_KEY=... node scripts/test-gemini.mjs
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add environment variables in **Settings → Environment Variables**:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
   - `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `TOTE_API_URL`, `TOTE_API_KEY` (AI features, see above)
4. Deploy.

Recipe edits in Notion show up on the live site within ~60 seconds (`revalidate = 60` ISR).

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **@notionhq/client** — official Notion SDK
- **Framer Motion** — entry and hover animations
- **Lucide React** — icons
- **@google/genai** — Gemini for all AI features
- **YouTube Data API v3** — recipe videos
- **@tailwindcss/typography** — prose styling on recipe bodies
- Design system guided by the [ui-ux-pro-max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
