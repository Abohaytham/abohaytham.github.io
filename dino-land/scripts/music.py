"""Synthesizes a cheerful, royalty-free kids track (120 BPM, C major) plus SFX
synced to src/timeline.json. Output: public/music.wav"""
import json, wave, numpy as np, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
T = json.load(open(root / 'src/timeline.json'))
SR = 44100; FPS = T['fps']; DUR = T['durationInFrames'] / FPS
BEAT = 60 / T['bpm']
N = int(SR * DUR); mix = np.zeros((N, 2))
rng = np.random.default_rng(7)
f = lambda fr: fr / FPS
def hz(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    mix[i:i + len(sig), 0] += sig * (1 - pan) * 0.5 * 2 ** 0.5
    mix[i:i + len(sig), 1] += sig * (1 + pan) * 0.5 * 2 ** 0.5

def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)

def pluck(m, length=0.6):  # Karplus-Strong ukulele-ish
    p = int(SR / hz(m)); n = int(SR * length)
    buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out * np.minimum(np.arange(n) / 50, 1)

def glock(m, length=0.9):
    n = int(SR * length); t = np.arange(n) / SR; fr = hz(m)
    s = np.sin(2*np.pi*fr*t) + 0.35*np.sin(2*np.pi*fr*2.76*t)*np.exp(-t/0.08) + 0.15*np.sin(2*np.pi*fr*5.4*t)*np.exp(-t/0.04)
    return s * env(n, 0.002, 0.35)

def bass(m, length=0.45):
    n = int(SR * length); t = np.arange(n) / SR
    return (np.sin(2*np.pi*hz(m)*t) + 0.2*np.sin(4*np.pi*hz(m)*t)) * env(n, 0.01, 0.25)

def kick():
    n = int(SR * 0.25); t = np.arange(n) / SR
    fr = 50 + 90 * np.exp(-t / 0.03)
    return np.sin(2*np.pi*np.cumsum(fr)/SR) * np.exp(-t / 0.09)

def noise(length, d, hp=True):
    n = int(SR * length); s = rng.uniform(-1, 1, n)
    if hp: s = np.diff(np.concatenate([[0], s]))
    return s * env(n, 0.001, d)

def clap(): return noise(0.2, 0.05) * 0.8
def shaker(): return noise(0.08, 0.018) * 0.5

def sweep(f0, f1, length, d=None, kind='sin'):
    n = int(SR * length); t = np.arange(n) / SR
    fr = f0 * (f1 / f0) ** (t / length)
    ph = 2*np.pi*np.cumsum(fr)/SR
    s = np.sin(ph) if kind == 'sin' else np.sign(np.sin(ph)) * 0.3
    e = env(n, 0.005, d) if d else np.sin(np.pi * t / length)
    return s * e

def boing(length=0.35):
    n = int(SR * length); t = np.arange(n) / SR
    fr = 180 + 260 * np.exp(-t/0.08) + 40*np.sin(2*np.pi*14*t)*np.exp(-t/0.15)
    return np.sin(2*np.pi*np.cumsum(fr)/SR) * env(n, 0.003, 0.14)

def pop(): return sweep(900, 300, 0.07, 0.025)

# --- music ---
chords = [  # (root midi, chord tones) per bar of 2 beats... one chord per 2 beats
    (48, [60, 64, 67]), (53, [60, 65, 69]), (55, [59, 62, 67]), (48, [60, 64, 67]),
    (57, [60, 64, 69]), (53, [60, 65, 69]), (55, [59, 62, 67]), (48, [60, 64, 67]),
]
melody = [  # (beat offset, midi, len) - a bouncy 8-beat phrase
    (0, 72, .5), (0.5, 76, .5), (1, 79, .5), (1.5, 76, .5), (2, 77, .5), (2.5, 81, .5), (3, 79, 1),
    (4, 79, .5), (4.5, 77, .5), (5, 76, .5), (5.5, 74, .5), (6, 72, .5), (6.5, 74, .5), (7, 76, 1),
]
nbeats = int(DUR / BEAT)
drums_in = f(T['wordsIn'][0]) - 0.1
for b in range(nbeats):
    t = b * BEAT; ch = chords[(b // 2) % len(chords)]
    if t > DUR - 1.0: break
    if b % 2 == 0: add(bass(ch[0] - 12 + 12), t, 0.5)
    # ukulele strum on off-beats
    for k, m in enumerate(ch[1]):
        add(pluck(m), t + BEAT / 2 + k * 0.012, 0.22, pan=-0.3)
    if b % 2 == 0:
        for k, m in enumerate(ch[1]): add(pluck(m), t + k * 0.012, 0.16, pan=-0.3)
    if t >= drums_in:
        add(kick(), t, 0.55)
        if b % 2 == 1: add(clap(), t, 0.35, pan=0.15)
        add(shaker(), t + BEAT / 2, 0.25, pan=0.4); add(shaker(), t, 0.12, pan=0.4)
for rep in range(4):
    base = rep * 8 * BEAT
    for off, m, ln in melody:
        t = base + off * BEAT
        if t < DUR - 1.2: add(glock(m), t, 0.22, pan=0.25)
# ending: resolution chord + sparkle
end_t = DUR - 1.0
for k, m in enumerate([60, 64, 67, 72]): add(pluck(m, 1.2), end_t + k * 0.02, 0.25)
add(bass(36, 1.0), end_t, 0.5)
for k, m in enumerate([84, 88, 91, 96]): add(glock(m, 1.0), end_t + 0.05 * k, 0.16)

# --- SFX ---
add(sweep(200, 700, 0.35), f(T['dinoRise']), 0.18)
add(boing(), f(T['dinoLand']), 0.35)
add(pop(), f(T['bubbleIn']), 0.5)
for w in T['wordsIn']: add(pop(), f(w), 0.35)
add(sweep(300, 1200, 0.25), f(T['scene2Out']), 0.1)
add(pop(), f(T['line3In']), 0.35)
cs, ce = T['countStart'], T['countEnd']
last = None
for fr in range(cs, ce + 1):
    p = (fr - cs) / (ce - cs); v = round(55 - (55 - 26) * (1 - (1 - p) ** 3))
    if v != last: add(sweep(1800, 1400, 0.025, 0.008), f(fr), 0.12); last = v
for k, m in enumerate([84, 91]): add(glock(m, 1.2), f(ce) + 0.08 * k, 0.4)
add(pop(), f(T['perDayIn']), 0.35)
for j in T['jumps']:
    add(boing(), f(j), 0.4); add(boing(0.25), f(j) + 0.42, 0.2)
for j in T['jumps']:
    for k in range(6): add(glock(96 + [0, 4, 7, 12, 7, 16][k], 0.4), f(j) + 0.25 + 0.05 * k, 0.1, pan=(k % 2) * 0.6 - 0.3)
add(pop(), f(T['celebrateIn']), 0.35)
add(sweep(250, 900, 0.3), f(T['logoIn']) - 0.15, 0.15)
add(pop(), f(T['logoIn']) + 0.15, 0.5)
add(pop(), f(T['offerIn']), 0.3); add(pop(), f(T['locationIn']), 0.3)

# master: gentle fades, soft limit
t = np.arange(N) / SR
mix *= np.minimum(t / 0.05, 1)[:, None] * np.clip((DUR - t) / 0.6, 0, 1)[:, None]
mix = np.tanh(mix * 1.2) * 0.85
pcm = (mix * 32767).astype(np.int16)
out = root / 'public/music.wav'
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR:.1f}s', 'peak', np.abs(mix).max())
