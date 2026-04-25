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

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add environment variables in **Settings → Environment Variables**:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
4. Deploy.

Recipe edits in Notion show up on the live site within ~60 seconds (`revalidate = 60` ISR).

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **@notionhq/client** — official Notion SDK
- **Framer Motion** — entry and hover animations
- **Lucide React** — icons
- **@tailwindcss/typography** — prose styling on recipe bodies
- Design system guided by the [ui-ux-pro-max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
