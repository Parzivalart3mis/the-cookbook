'use client';

import { motion, useScroll, useSpring } from 'framer-motion';
import { Grain } from './primitives';
import Nav from './Nav';
import Hero from './Hero';
import Marquee from './Marquee';
import Features from './Features';
import Stats, { type StatsData } from './Stats';
import CallToAction from './CallToAction';
import Footer from './Footer';

export type LandingData = StatsData & {
  recipeNames: string[];
};

export default function LandingPage({ data }: { data: LandingData }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div className="landing relative min-h-screen overflow-x-clip bg-[var(--l-void)] text-[var(--l-text)] antialiased">
      {/* Reading progress */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-[var(--l-ember-hot)] via-[var(--l-plasma)] to-[var(--l-ember-deep)]"
      />

      <Grain />
      <Nav />

      <main>
        <Hero recipeNames={data.recipeNames} recipeCount={data.recipeCount} />
        <Marquee recipeNames={data.recipeNames} />
        <Features />
        <Stats data={data} />
        <CallToAction recipeCount={data.recipeCount} />
      </main>

      <Footer />
    </div>
  );
}
