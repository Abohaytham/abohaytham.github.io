import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import T from './timeline.json';
import {COLORS, COUNT_FROM, COUNT_TO, TEXT} from './config';

// Baloo Bhaijaan 2 (variable font, bundled locally in public/fonts)
const fontFamily = 'Baloo Bhaijaan 2';
const fontHandle = delayRender('Loading Baloo Bhaijaan 2');
Promise.all(
  [
    ['baloo-arabic.woff2', 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+2010-2011, U+FB50-FDFF, U+FE70-FEFC'],
    ['baloo-latin.woff2', 'U+0000-00FF, U+2000-206F, U+2212'],
  ].map(([file, range]) => {
    const face = new FontFace(fontFamily, `url(${staticFile('fonts/' + file)}) format('woff2')`, {
      weight: '400 800',
      unicodeRange: range,
    });
    return face.load().then((f) => document.fonts.add(f));
  }),
).then(() => continueRender(fontHandle));
const FONT = `'${fontFamily}', 'Noto Color Emoji', sans-serif`;

const W = 1080;
const H = 1920;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- helpers ----------
const usePop = (start: number, damping = 10) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - start, fps, config: {damping, stiffness: 160, mass: 0.7}});
};

const exitProgress = (frame: number, start: number, len = 10) =>
  interpolate(frame, [start, start + len], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});

// ---------- background ----------
const Blobs: React.FC = () => {
  const frame = useCurrentFrame();
  const blobs = [
    {x: 120, y: 260, r: 150, c: COLORS.lime, s: 0.9},
    {x: 960, y: 520, r: 190, c: COLORS.lime, s: 1.3},
    {x: 880, y: 140, r: 70, c: COLORS.coral, s: 1.7},
    {x: 170, y: 900, r: 60, c: COLORS.teal, s: 1.1},
    {x: 990, y: 1080, r: 90, c: COLORS.coral, s: 0.8},
  ];
  const dots = Array.from({length: 16}, (_, i) => ({
    x: (i * 263) % W,
    y: 120 + ((i * 397) % 1250),
    r: 6 + (i % 4) * 3,
    c: [COLORS.lime, COLORS.teal, COLORS.coral][i % 3],
  }));
  return (
    <AbsoluteFill>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x - b.r,
            top: b.y - b.r + Math.sin((frame / 30) * b.s + i) * 18,
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: '50%',
            background: b.c,
            opacity: 0.22,
          }}
        />
      ))}
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: d.x + Math.sin(frame / 25 + i) * 10,
            top: d.y + Math.cos(frame / 30 + i * 2) * 12,
            width: d.r,
            height: d.r,
            borderRadius: '50%',
            background: d.c,
            opacity: 0.35,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const wavePath = (baseY: number, amp: number, len: number, phase: number) => {
  let d = `M 0 ${H} L 0 ${baseY}`;
  for (let x = 0; x <= W; x += 20) {
    const y = baseY + Math.sin((x / len) * Math.PI * 2 + phase) * amp;
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  return d + ` L ${W} ${H} Z`;
};

const Hill: React.FC<{baseY: number; amp: number; len: number; speed: number; color: string; offset: number}> = ({
  baseY,
  amp,
  len,
  speed,
  color,
  offset,
}) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 14], [160, 0], {...clamp, easing: Easing.out(Easing.back(1.6))});
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <path d={wavePath(baseY + rise, amp, len, offset + (frame / 30) * speed)} fill={color} />
    </svg>
  );
};

// ---------- dino ----------
const DINO_W = 640;
const DINO_H = Math.round((DINO_W * 1451) / 821); // body extended below the hills
const DINO_LEFT = (W - DINO_W) / 2 + 30;
const DINO_BOTTOM = 2000;

const jumpY = (frame: number, start: number, len = 24, height = 270) => {
  const p = (frame - start) / len;
  if (p <= 0 || p >= 1) return 0;
  return -height * 4 * p * (1 - p);
};

const squash = (frame: number, at: number) => {
  // a quick squash-and-stretch pulse centred on `at`
  const d = frame - at;
  if (d < -3 || d > 8) return 0;
  return Math.sin(((d + 3) / 11) * Math.PI);
};

const Dino: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // 1) rise from below with a bounce
  const rise = spring({frame: frame - T.dinoRise, fps, config: {damping: 8, stiffness: 120, mass: 0.8}});
  let y = interpolate(rise, [0, 1], [DINO_H + 100, 0]);

  // head shake in scene 1
  const shake = interpolate(frame, [T.dinoLand + 8, T.dinoLand + 50], [1, 0], clamp);
  let rot = Math.sin((frame - T.dinoLand) * 0.45) * 5 * shake * (frame > T.dinoLand + 8 ? 1 : 0);

  // tiny nod when the price shows up / when counter lands
  rot += Math.sin(interpolate(frame, [T.countEnd, T.countEnd + 16], [0, Math.PI * 2], clamp)) * 4;

  // 2) jumps of joy
  let sx = 1;
  let sy = 1;
  for (const j of T.jumps) {
    y += jumpY(frame, j);
    const pre = squash(frame, j - 1);
    const land = squash(frame, j + 24);
    sy -= 0.1 * (pre + land);
    sx += 0.07 * (pre + land);
    // stretch while in the air
    const air = frame > j && frame < j + 24 ? Math.sin(((frame - j) / 24) * Math.PI) : 0;
    sy += 0.05 * air;
    sx -= 0.03 * air;
    rot += Math.sin(((frame - j) / 24) * Math.PI * 2) * 6 * (frame > j && frame < j + 24 ? 1 : 0);
  }

  // 3) sink to peek from the bottom for the outro
  const sink = spring({frame: frame - (T.scene4Out + 2), fps, config: {damping: 14, stiffness: 90}});
  y += sink * 200;
  const scale = 1 - sink * 0.22;
  const sideX = sink * 250;
  rot += sink * -8 + Math.sin(frame / 9) * 3 * sink;

  // breathing — always on
  const breath = Math.sin((frame / fps) * Math.PI * 2 * 0.75);
  sy *= 1 + breath * 0.018;
  sx *= 1 - breath * 0.008;

  return (
    <div
      style={{
        position: 'absolute',
        left: DINO_LEFT + sideX,
        top: DINO_BOTTOM - DINO_H,
        width: DINO_W,
        height: DINO_H,
        transformOrigin: '50% 100%',
        transform: `translateY(${y}px) rotate(${rot}deg) scale(${scale * sx}, ${scale * sy})`,
      }}
    >
      <Img src={staticFile('dino-mascot.png')} style={{width: '100%', height: '100%'}} />
    </div>
  );
};

// ---------- stars ----------
const StarShape: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    <path
      d="M0,-46 C6,-18 18,-6 46,0 C18,6 6,18 0,46 C-6,18 -18,6 -46,0 C-18,-6 -6,-18 0,-46 Z"
      fill={color}
    />
  </svg>
);

const StarBurst: React.FC<{start: number; cx: number; cy: number; seed: number}> = ({start, cx, cy, seed}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0 || t > 40) return null;
  const colors = [COLORS.star, COLORS.coral, COLORS.teal, COLORS.lime, COLORS.white];
  return (
    <>
      {Array.from({length: 12}, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 + seed;
        const dist = interpolate(t, [0, 26], [40, 300 + ((i * 53) % 140)], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        const s = interpolate(t, [0, 6, 28, 40], [0, 1, 0.9, 0], clamp);
        const size = 44 + ((i * 29) % 40);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx + Math.cos(ang) * dist - size / 2,
              top: cy + Math.sin(ang) * dist * 0.85 - size / 2,
              transform: `scale(${s}) rotate(${t * 8 + i * 30}deg)`,
            }}
          >
            <StarShape size={size} color={colors[i % colors.length]} />
          </div>
        );
      })}
    </>
  );
};

// ---------- text pieces ----------
const textBase: React.CSSProperties = {
  fontFamily: FONT,
  direction: 'rtl',
  fontWeight: 800,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
};

const PopWord: React.FC<{start: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  start,
  children,
  style,
}) => {
  const p = usePop(start, 9);
  return (
    <span
      style={{
        display: 'inline-block',
        transform: `translateY(${(1 - p) * 70}px) scale(${0.3 + p * 0.7})`,
        opacity: Math.min(1, p * 3),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

const SpeechBubble: React.FC = () => {
  const frame = useCurrentFrame();
  const p = usePop(T.bubbleIn, 9);
  const out = exitProgress(frame, T.wordsIn[0] - 8, 8);
  if (frame < T.bubbleIn) return null;
  const s = p * (1 - out);
  const wobble = Math.sin(frame / 7) * 1.5;
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 520,
        width: 840,
        transformOrigin: '62% 100%',
        transform: `scale(${s}) rotate(${wobble}deg)`,
        opacity: 1 - out,
      }}
    >
      <div
        style={{
          ...textBase,
          background: COLORS.white,
          color: COLORS.teal,
          fontSize: 82,
          textAlign: 'center',
          padding: '34px 40px 26px',
          borderRadius: 70,
          border: `8px solid ${COLORS.teal}`,
          boxShadow: '0 16px 0 rgba(19,135,142,0.18)',
        }}
      >
        {TEXT.bubble}
      </div>
      {/* tail */}
      <svg width={120} height={110} style={{position: 'absolute', left: 470, top: '100%', marginTop: -10}}>
        <path d="M10 0 L100 0 L40 100 Z" fill={COLORS.white} stroke={COLORS.teal} strokeWidth={8} strokeLinejoin="round" />
        <rect x={14} y={0} width={82} height={12} fill={COLORS.white} />
      </svg>
    </div>
  );
};

const PriceScene: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.wordsIn[0] - 2 || frame > T.scene2Out + 12) return null;
  const out = exitProgress(frame, T.scene2Out, 10);
  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        width: W,
        textAlign: 'center',
        transform: `translateY(${-out * 120}px) scale(${1 - out * 0.3})`,
        opacity: 1 - out,
      }}
    >
      <div style={{...textBase, fontSize: 132, color: COLORS.teal}}>
        <PopWord start={T.wordsIn[0]}>{TEXT.priceLine1[0]}</PopWord>{' '}
        <PopWord start={T.wordsIn[1]}>{TEXT.priceLine1[1]}</PopWord>
      </div>
      <div style={{...textBase, fontSize: 132, color: COLORS.teal, marginTop: 10}}>
        <PopWord start={T.wordsIn[2]}>
          {TEXT.pricePrefix}{' '}
          <span style={{color: COLORS.coral, fontSize: 210}}>{TEXT.priceNumber}</span>
        </PopWord>{' '}
        <PopWord start={T.wordsIn[3]} style={{marginRight: 30}}>{TEXT.priceUnit}</PopWord>
      </div>
    </div>
  );
};

const CounterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = usePop(T.line3In, 11);
  const numIn = usePop(T.countStart - 8, 9);
  const unit = usePop(T.perDayIn, 10);
  if (frame < T.line3In - 2 || frame > T.scene3Out + 12) return null;
  const out = exitProgress(frame, T.scene3Out, 9);
  const p = interpolate(frame, [T.countStart, T.countEnd], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const value = Math.round(COUNT_FROM - (COUNT_FROM - COUNT_TO) * p);
  const land = spring({frame: frame - T.countEnd, fps, config: {damping: 6, stiffness: 220, mass: 0.6}});
  const landPulse = frame >= T.countEnd ? Math.sin(land * Math.PI) * 0.22 : 0;
  // little shake of the digits while counting
  const jitter = frame > T.countStart && frame < T.countEnd ? Math.sin(frame * 2.3) * 3 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        width: W,
        textAlign: 'center',
        transform: `translateY(${-out * 120}px) scale(${1 - out * 0.3})`,
        opacity: 1 - out,
      }}
    >
      <div
        style={{
          ...textBase,
          fontSize: 84,
          color: COLORS.teal,
          transform: `translateY(${(1 - head) * 60}px) scale(${0.5 + head * 0.5})`,
          opacity: Math.min(1, head * 3),
        }}
      >
        {TEXT.subscription}
      </div>
      <div
        style={{
          ...textBase,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 26,
          marginTop: 10,
        }}
      >
        <div
          style={{
            fontSize: 300,
            color: COLORS.coral,
            lineHeight: 1,
            minWidth: 330,
            transform: `scale(${numIn * (1 + landPulse)}) rotate(${jitter}deg)`,
            textShadow: '0 12px 0 rgba(224,105,74,0.18)',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 96,
            color: COLORS.coral,
            transform: `translateX(${(1 - unit) * -120}px) scale(${unit})`,
            opacity: Math.min(1, unit * 2),
          }}
        >
          {TEXT.perDay}
        </div>
      </div>
    </div>
  );
};

const CelebrateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const a = usePop(T.celebrateIn, 9);
  const b = usePop(T.celebrateIn + 8, 8);
  if (frame < T.celebrateIn - 2 || frame > T.scene4Out + 12) return null;
  const out = exitProgress(frame, T.scene4Out, 9);
  const wiggle = Math.sin(frame / 4) * 3 * b;
  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        width: W,
        textAlign: 'center',
        transform: `translateY(${-out * 120}px) scale(${1 - out * 0.3})`,
        opacity: 1 - out,
      }}
    >
      <div style={{...textBase, fontSize: 118, color: COLORS.teal, transform: `scale(${a})`}}>{TEXT.celebrate1}</div>
      <div
        style={{
          ...textBase,
          display: 'inline-block',
          fontSize: 136,
          color: COLORS.white,
          background: COLORS.coral,
          borderRadius: 60,
          padding: '6px 50px 0',
          marginTop: 16,
          transform: `scale(${b}) rotate(${-3 + wiggle}deg)`,
          boxShadow: '0 14px 0 rgba(224,105,74,0.25)',
        }}
      >
        {TEXT.celebrate2}
      </div>
    </div>
  );
};

const Twinkles: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.jumps[0] || frame > T.scene4Out + 6) return null;
  const pts = [
    [170, 1000], [900, 960], [120, 1320], [960, 1300], [300, 820], [800, 800],
  ];
  const fade = interpolate(frame, [T.scene4Out - 6, T.scene4Out + 6], [1, 0], clamp);
  return (
    <>
      {pts.map(([x, y], i) => {
        const s = Math.max(0, Math.sin((frame - T.jumps[0]) / 6 + i * 1.3)) * fade;
        return (
          <div key={i} style={{position: 'absolute', left: x - 30, top: y - 30, transform: `scale(${s}) rotate(${frame * 4}deg)`}}>
            <StarShape size={60} color={[COLORS.star, COLORS.coral, COLORS.teal][i % 3]} />
          </div>
        );
      })}
    </>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const offer = usePop(T.offerIn, 11);
  const loc = usePop(T.locationIn, 12);
  if (frame < T.logoIn - 2) return null;
  const logo = spring({frame: frame - T.logoIn, fps, config: {damping: 9, stiffness: 140, mass: 0.8}});
  const float = Math.sin((frame - T.logoIn) / 14) * 8;
  const LOGO_W = 860;
  const LOGO_H = Math.round((LOGO_W * 384) / 964);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: (W - LOGO_W) / 2,
          top: 330 + float,
          width: LOGO_W,
          height: LOGO_H,
          transform: `scale(${logo}) rotate(${(1 - logo) * -12}deg)`,
        }}
      >
        <Img src={staticFile('dino-logo.png')} style={{width: '100%', height: '100%'}} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 760,
          width: W,
          display: 'flex',
          justifyContent: 'center',
          transform: `translateY(${(1 - offer) * 80}px) scale(${0.6 + offer * 0.4})`,
          opacity: Math.min(1, offer * 2.5),
        }}
      >
        <div
          style={{
            ...textBase,
            background: COLORS.white,
            borderRadius: 56,
            padding: '30px 56px 18px',
            border: `7px solid ${COLORS.teal}`,
            boxShadow: '0 14px 0 rgba(19,135,142,0.18)',
            textAlign: 'center',
          }}
        >
          <div style={{fontSize: 76, color: COLORS.teal}}>{TEXT.offerTitle}</div>
          <div style={{fontSize: 76, color: COLORS.teal}}>
            {TEXT.offerDays}
            <span style={{color: COLORS.lime, margin: '0 22px'}}>●</span>
            <span style={{color: COLORS.coral}}>{TEXT.offerPrice}</span> {TEXT.offerCurrency}
          </div>
        </div>
      </div>
      <div
        style={{
          ...textBase,
          position: 'absolute',
          top: 1080,
          width: W,
          textAlign: 'center',
          fontSize: 54,
          fontWeight: 700,
          color: COLORS.teal,
          transform: `translateY(${(1 - loc) * 50}px)`,
          opacity: Math.min(1, loc * 2),
        }}
      >
        {TEXT.location}
      </div>
    </>
  );
};

const Credit: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [T.creditIn, T.creditIn + 10], [0, 1], clamp);
  if (o <= 0) return null;
  return (
    <div
      style={{
        ...textBase,
        position: 'absolute',
        bottom: 46,
        width: W,
        textAlign: 'center',
        fontSize: 34,
        fontWeight: 700,
        color: COLORS.white,
        opacity: o,
        transform: `translateY(${(1 - o) * 16}px)`,
      }}
    >
      {TEXT.credit}
    </div>
  );
};

export const DinoLand: React.FC = () => {
  const frame = useCurrentFrame();
  const starY = (j: number) => DINO_BOTTOM - DINO_H + 260 + jumpY(j + 12, j);
  return (
    <AbsoluteFill style={{background: COLORS.bg, overflow: 'hidden'}}>
      <Audio src={staticFile('music.wav')} />
      <Blobs />
      <Hill baseY={1470} amp={38} len={620} speed={0.6} color={COLORS.lime} offset={0} />
      <Twinkles />
      <Dino />
      <Hill baseY={1590} amp={34} len={520} speed={-0.8} color={COLORS.teal} offset={1.5} />
      <Hill baseY={1740} amp={30} len={460} speed={1} color={COLORS.coral} offset={3} />
      {T.jumps.map((j, i) => (
        <StarBurst key={j} start={j + 6} cx={W / 2 + 30} cy={starY(j)} seed={i * 0.26} />
      ))}
      <SpeechBubble />
      <PriceScene />
      <CounterScene />
      <CelebrateScene />
      <OutroScene />
      <Credit />
      {/* frame is read so Remotion re-renders every frame */}
      <div style={{display: 'none'}}>{frame}</div>
    </AbsoluteFill>
  );
};
