import { ImageResponse } from 'next/og';
import { getAllRecipes } from '@/lib/notion';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 60;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipes = await getAllRecipes();
  const recipe = recipes.find((r) => r.slug === slug);
  const name = recipe?.name ?? 'Recipe';

  const fontSize = name.length > 40 ? 64 : name.length > 25 ? 76 : 88;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#b45309',
          padding: '80px 80px 60px',
          gap: '0px',
        }}
      >
        {/* Chef hat icon */}
        <svg
          width="72"
          height="72"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
          <path d="M6 17h12" />
        </svg>

        {/* Recipe name */}
        <div
          style={{
            color: 'white',
            fontSize: `${fontSize}px`,
            fontWeight: '700',
            textAlign: 'center',
            lineHeight: 1.15,
            marginTop: '28px',
            maxWidth: '1000px',
          }}
        >
          {name}
        </div>

        {/* Divider */}
        <div
          style={{
            width: '60px',
            height: '3px',
            background: 'rgba(255,255,255,0.45)',
            borderRadius: '2px',
            marginTop: '32px',
          }}
        />

        {/* Site name */}
        <div
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: '28px',
            marginTop: '20px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          The Cookbook
        </div>
      </div>
    ),
    { ...size }
  );
}
