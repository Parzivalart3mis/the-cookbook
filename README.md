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

All AI features (AI Kitchen, meal planner, ingredient substitutions, voice assistant) use **Google Gemini** via `@google/genai` (`src/lib/gemini.ts`). If a model is retired or rate-limited, the app moves to the next model in its fallback list; if a model is slow, the next one is started alongside it and the first answer wins. Every request has one deadline, set per route so it finishes inside the route's `maxDuration`.

| Tab | What it does | Needs |
|---|---|---|
| **Discover** | 6 new dishes not already in your cookbook or Future Recipes, each with its most-watched YouTube videos, plus recipe videos that went viral in the last 2 weeks | `GEMINI_API_KEY`, `YOUTUBE_API_KEY` (optional: without it you get YouTube search links) |
| **From my pantry** | Dishes from the items tote marks **In stock** / **Running low** | `GEMINI_API_KEY`, `TOTE_API_URL`, `TOTE_API_KEY` |
| **High-protein** | Same pantry, filtered to your targets (default ≥ 25 g protein, ≤ 500 kcal per serving), ranked by protein per calorie. If nothing meets custom targets, it offers to retry with the defaults | same as above |

Every tab also has:

- **Cuisine:** Any, Indian, Chinese, Italian, American, or one you type. Each tab remembers its own.
- **Diet:** Vegetarian (the default), Eggetarian or Non-veg, shared by all tabs. For Vegetarian and Eggetarian, Gemini's dishes are also checked for meat, fish (and egg) words, including hidden ones like fish sauce and gelatin, and YouTube videos are filtered by title the same way (`fitsDiet` in `src/lib/kitchen-ai.ts`).

Environment variables (see `.env.local.example`):

- `GEMINI_API_KEY`: from [Google AI Studio](https://aistudio.google.com/apikey). Optional `GEMINI_MODEL` / `GEMINI_MODEL_LITE` override the default models.
- `YOUTUBE_API_KEY`: Google Cloud Console → enable **YouTube Data API v3** → Credentials → API key. Free quota is 10,000 units/day; one Discover refresh costs about 700, and results are cached for 6 h.
- `TOTE_API_URL` / `TOTE_API_KEY`: your tote URL and the same value as tote's `PANTRY_SHARE_SECRET` (tote also needs `PANTRY_SHARE_USER_ID`).

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
