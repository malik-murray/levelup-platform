'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

/** Served unoptimized so mobile/desktop always get the same PNG (avoids stale per-width `/_next/image` caches). */
const LOGO_SRC = '/brand/levelup-logo.png';

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

function useParallax(reducedMotion: boolean) {
  const target = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const raf = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) return;

    const onMove = (e: MouseEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    const loop = () => {
      setPos((p) => ({
        x: p.x + (target.current.x * 16 - p.x) * 0.055,
        y: p.y + (target.current.y * 12 - p.y) * 0.055,
      }));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('mousemove', onMove);
    };
  }, [reducedMotion]);

  return reducedMotion ? { x: 0, y: 0 } : pos;
}

/** Deterministic dense starfield (outer space). */
const STARFIELD: { t: number; l: number; s: number; delay: number; flare?: boolean }[] = Array.from(
  { length: 96 },
  (_, i) => ({
    t: ((i * 19) % 56) + (i % 4) * 0.3 + 2,
    l: ((i * 41) % 97) + 1.5,
    s: 0.35 + (i % 7) * 0.32,
    delay: ((i * 0.27) % 4.5) + (i % 3) * 0.1,
    flare: i % 21 === 0 || i % 31 === 0,
  })
);

const EMBERS = Array.from({ length: 20 }, (_, i) => ({
  left: `${((i * 37) % 94) + 3}%`,
  size: 2 + (i % 4),
  dx: -10 + (i % 7) * 3,
  duration: 9 + (i % 8),
  delay: (i * 0.55) % 7,
}));

function CitySilhouette() {
  return (
    <div
      className="pointer-events-none absolute bottom-[18%] left-0 right-0 h-[22%] min-h-[100px] opacity-[0.72]"
      aria-hidden
    >
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="h-full w-full text-[#05080f]"
        fill="currentColor"
      >
        <path d="M0,200 L0,120 L40,120 L40,80 L70,80 L70,140 L100,140 L100,60 L140,60 L140,100 L180,100 L180,40 L220,40 L220,90 L260,90 L260,70 L300,70 L300,130 L340,130 L340,50 L390,50 L390,110 L430,110 L430,75 L480,75 L480,125 L520,125 L520,55 L570,55 L570,95 L610,95 L610,35 L660,35 L660,105 L710,105 L710,65 L760,65 L760,115 L800,115 L800,45 L850,45 L850,100 L900,100 L900,70 L950,70 L950,135 L1000,135 L1000,55 L1050,55 L1050,90 L1100,90 L1100,75 L1150,75 L1150,125 L1200,125 L1200,200 Z" />
      </svg>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 10% 80%, rgba(255,160,60,0.35) 0px, transparent 1px), radial-gradient(circle at 25% 70%, rgba(255,180,80,0.4) 0px, transparent 1px), radial-gradient(circle at 40% 85%, rgba(255,140,50,0.3) 0px, transparent 1px), radial-gradient(circle at 55% 75%, rgba(255,170,70,0.35) 0px, transparent 1px), radial-gradient(circle at 70% 82%, rgba(255,150,55,0.4) 0px, transparent 1px), radial-gradient(circle at 85% 78%, rgba(255,165,65,0.35) 0px, transparent 1px)',
          backgroundSize: '120px 40px',
          mixBlendMode: 'screen',
          opacity: 0.85,
        }}
      />
    </div>
  );
}

const SMOKE_PLUMES: {
  left: string;
  width: string;
  height: string;
  bottom: string;
  blur: string;
  anim: 'a' | 'b' | 'c';
  gradient: string;
}[] = [
  {
    left: '8%',
    width: '42%',
    height: '70%',
    bottom: '-18%',
    blur: '48px',
    anim: 'a',
    gradient:
      'radial-gradient(ellipse 55% 45% at 50% 100%, rgba(220,228,242,0.5) 0%, rgba(160,175,205,0.2) 38%, transparent 72%)',
  },
  {
    left: '38%',
    width: '48%',
    height: '78%',
    bottom: '-22%',
    blur: '56px',
    anim: 'b',
    gradient:
      'radial-gradient(ellipse 50% 48% at 48% 100%, rgba(235,240,250,0.45) 0%, rgba(180,195,220,0.18) 42%, transparent 75%)',
  },
  {
    left: '58%',
    width: '38%',
    height: '65%',
    bottom: '-15%',
    blur: '44px',
    anim: 'c',
    gradient:
      'radial-gradient(ellipse 58% 42% at 52% 100%, rgba(210,218,235,0.42) 0%, rgba(150,168,198,0.16) 40%, transparent 70%)',
  },
  {
    left: '22%',
    width: '28%',
    height: '55%',
    bottom: '-12%',
    blur: '36px',
    anim: 'b',
    gradient:
      'radial-gradient(ellipse 45% 50% at 50% 100%, rgba(200,210,230,0.35) 0%, transparent 68%)',
  },
  {
    left: '72%',
    width: '26%',
    height: '52%',
    bottom: '-10%',
    blur: '38px',
    anim: 'a',
    gradient:
      'radial-gradient(ellipse 48% 46% at 50% 100%, rgba(190,205,228,0.32) 0%, transparent 65%)',
  },
];

function RocketSmokeFooter({ reducedMotion }: { reducedMotion: boolean }) {
  const animClass = (k: 'a' | 'b' | 'c') =>
    reducedMotion ? '' : k === 'a' ? 'landing-smoke-a' : k === 'b' ? 'landing-smoke-b' : 'landing-smoke-c';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[min(42vh,420px)] overflow-hidden"
      aria-hidden
    >
      {SMOKE_PLUMES.map((p, i) => (
        <div
          key={i}
          className={`absolute ${animClass(p.anim)}`}
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.width,
            height: p.height,
            background: p.gradient,
            filter: `blur(${p.blur})`,
            mixBlendMode: 'screen',
            opacity: reducedMotion ? 0.32 : 0.85,
          }}
        />
      ))}
    </div>
  );
}

function LandingBackground({ px, py, reducedMotion }: { px: number; py: number; reducedMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-[-8%] will-change-transform"
        style={{
          transform: reducedMotion ? undefined : `translate3d(${px}px, ${py}px, 0)`,
        }}
      >
        <div
          className={`absolute inset-0 ${reducedMotion ? '' : 'landing-hero-kenburns'}`}
          style={{ willChange: reducedMotion ? undefined : 'transform' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#050816] via-[#03060e] to-[#010205]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_50%_8%,rgba(25,45,85,0.55)_0%,transparent_58%)]" />
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 20% 25%, rgba(90,60,140,0.18) 0%, transparent 50%), radial-gradient(ellipse 55% 45% at 85% 20%, rgba(40,80,160,0.14) 0%, transparent 48%), radial-gradient(ellipse 100% 35% at 50% 0%, rgba(15,25,55,0.5) 0%, transparent 45%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'linear-gradient(125deg, transparent 0%, rgba(30,50,90,0.12) 38%, rgba(80,50,120,0.08) 52%, transparent 68%)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0a04]/35 via-transparent to-transparent" />
        </div>
      </div>

      <div
        className={`absolute -left-[20%] top-0 h-[55%] w-[140%] rounded-[50%] blur-3xl ${reducedMotion ? '' : 'landing-nebula-shift'}`}
        style={{
          background:
            'radial-gradient(ellipse 48% 38% at 32% 18%, rgba(255,130,70,0.22) 0%, transparent 54%), radial-gradient(ellipse 42% 36% at 78% 22%, rgba(255,95,45,0.14) 0%, transparent 50%), radial-gradient(ellipse 30% 28% at 55% 12%, rgba(180,200,255,0.08) 0%, transparent 45%)',
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[#02040a]/90 via-transparent to-transparent to-[48%]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#010205] via-transparent to-[#060a14]/35" />

      <CitySilhouette />

      <div
        className="absolute inset-x-0 bottom-0 h-[48%]"
        style={{ perspective: '420px', perspectiveOrigin: '50% 0%' }}
      >
        <div
          className={`absolute inset-x-[-25%] bottom-0 h-[130%] origin-bottom ${reducedMotion ? '' : 'landing-grid-flow'}`}
          style={{
            transform: 'rotateX(73deg)',
            background: `
              linear-gradient(to top, rgba(255,100,30,0.5) 0%, transparent 32%),
              repeating-linear-gradient(90deg, transparent 0, transparent 38px, rgba(255,200,90,0.42) 38px, rgba(255,200,90,0.42) 39px),
              repeating-linear-gradient(0deg, transparent 0, transparent 38px, rgba(255,200,90,0.28) 38px, rgba(255,200,90,0.28) 39px)
            `,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 26%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 26%)',
            opacity: 0.88,
            willChange: reducedMotion ? undefined : 'background-position',
          }}
        />
      </div>

      <div
        className="absolute bottom-0 left-1/2 z-[3] h-36 w-[min(110%,900px)] -translate-x-1/2 rounded-[100%] blur-3xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,115,35,0.5) 0%, rgba(255,80,20,0.15) 45%, transparent 72%)',
        }}
      />

      <RocketSmokeFooter reducedMotion={reducedMotion} />

      {STARFIELD.map((st, i) => (
        <span
          key={i}
          className="landing-twinkle-star absolute rounded-full bg-white"
          style={{
            top: `${st.t}%`,
            left: `${st.l}%`,
            width: st.s,
            height: st.s,
            animationDelay: `${st.delay}s`,
            boxShadow: st.flare
              ? `0 0 ${st.s * 2}px rgba(255,255,255,0.95), ${st.s}px 0 0 rgba(255,255,255,0.35), -${st.s}px 0 0 rgba(255,255,255,0.35), 0 ${st.s}px 0 rgba(255,255,255,0.35), 0 -${st.s}px 0 rgba(255,255,255,0.35)`
              : `0 0 ${st.s * 2.5}px rgba(255,255,255,0.85)`,
          }}
        />
      ))}

      {EMBERS.map((e, i) => (
        <span
          key={`ember-${i}`}
          className="pointer-events-none absolute rounded-full bg-[#ffb040]"
          style={
            {
              left: e.left,
              bottom: '-4%',
              width: e.size,
              height: e.size,
              opacity: reducedMotion ? 0 : undefined,
              boxShadow: '0 0 6px rgba(255,180,60,0.8)',
              animation: reducedMotion
                ? 'none'
                : `landing-ember-rise ${e.duration}s linear infinite`,
              animationDelay: `${e.delay}s`,
              '--ember-dx': `${e.dx}px`,
            } as import('react').CSSProperties
          }
        />
      ))}

      <div className="landing-grain pointer-events-none absolute inset-0 mix-blend-overlay" />
    </div>
  );
}

export default function LandingPage() {
  const reducedMotion = usePrefersReducedMotion();
  const parallax = useParallax(reducedMotion);

  return (
    <main
      className={`${outfit.className} relative min-h-dvh overflow-hidden bg-[#010205] text-white antialiased`}
    >
      <LandingBackground px={parallax.x} py={parallax.y} reducedMotion={reducedMotion} />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 pb-16 pt-10 sm:pb-24 sm:pt-14">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
          <div
            className={`relative -mt-8 mb-2 sm:-mt-12 sm:mb-0 ${reducedMotion ? 'brightness-[1.02] [filter:drop-shadow(0_0_16px_rgba(255,180,60,0.45))_drop-shadow(0_0_40px_rgba(255,130,40,0.22))]' : 'landing-logo-breathe'}`}
          >
            <div className="relative h-[11.5rem] w-[19rem] sm:h-[13.5rem] sm:w-[22rem]">
              <Image
                src={LOGO_SRC}
                alt="Level Up Solutions"
                fill
                unoptimized
                className="object-contain object-center"
                priority
                sizes="352px"
              />
            </div>
          </div>

          <p
            className={`mt-8 text-4xl font-extrabold tracking-tight text-[#ffe066] sm:mt-10 sm:text-5xl md:text-6xl ${
              reducedMotion ? '' : 'landing-player-one-hero'
            }`}
            style={
              reducedMotion
                ? {
                    textShadow:
                      '0 0 24px rgba(255,200,80,1), 0 0 48px rgba(255,150,40,0.7), 0 0 80px rgba(255,100,30,0.35)',
                  }
                : undefined
            }
          >
            Player One
          </p>

          <p className="mt-6 text-base text-white/90 sm:text-lg">
            Are you ready to{' '}
            <span className="font-semibold text-[#ffc84a]" style={{ textShadow: '0 0 12px rgba(255,180,60,0.5)' }}>
              level up?
            </span>
          </p>

          <div className="mt-12 flex w-full max-w-md flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
            <Link
              href="/login"
              className={`no-touch-target inline-flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-[#ffb020] bg-black/35 px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.2em] text-white backdrop-blur-[2px] transition hover:bg-[#ffb020]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb020] sm:min-w-[160px] sm:flex-none ${reducedMotion ? '' : 'landing-btn-glow-pulse'}`}
              style={
                reducedMotion
                  ? {
                      boxShadow:
                        '0 0 16px rgba(255,160,40,0.5), inset 0 0 20px rgba(255,160,40,0.08)',
                    }
                  : undefined
              }
            >
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className={`no-touch-target inline-flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-[#ffb020] bg-black/35 px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.15em] text-white backdrop-blur-[2px] transition hover:bg-[#ffb020]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb020] sm:min-w-[160px] sm:flex-none ${reducedMotion ? '' : 'landing-btn-glow-pulse'}`}
              style={
                reducedMotion
                  ? {
                      boxShadow:
                        '0 0 16px rgba(255,160,40,0.5), inset 0 0 20px rgba(255,160,40,0.08)',
                    }
                  : { animationDelay: '0.4s' }
              }
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
