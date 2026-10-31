"""
Synthesises the game's sound effects and music loop as 16-bit WAV files into assets/audio.
Loops carry a `smpl` chunk so Godot's WAV importer picks up the loop points by itself.

    python tools/gen_audio.py
"""
import math, os, struct
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1989)


def write_wav(name, data, loop=False):
    data = np.clip(data, -1, 1)
    pcm = (data * 32767).astype('<i2').tobytes()
    chunks = [b'fmt ', struct.pack('<HHIIHH', 1, 1, SR, SR * 2, 2, 16), b'data', pcm]
    body = b''
    for i in range(0, len(chunks), 2):
        body += chunks[i] + struct.pack('<I', len(chunks[i + 1])) + chunks[i + 1] + (b'\0' if len(chunks[i + 1]) % 2 else b'')
    if loop:
        smpl = struct.pack('<IIIIIIIII', 0, 0, 1000000000 // SR, 60, 0, 0, 0, 1, 0) + struct.pack('<IIIIII', 0, 0, 0, len(data) - 1, 0, 0)
        body += b'smpl' + struct.pack('<I', len(smpl)) + smpl
    with open(os.path.join(OUT, name + '.wav'), 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 4 + len(body)) + b'WAVE' + body)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, a=0.002, d=0.1, s=0.0, r=0.05, hold=0.0):
    x = np.zeros(n)
    segs = [np.linspace(0, 1, int(a * SR)), np.ones(int(hold * SR)), np.linspace(1, s, int(d * SR)), np.linspace(s, 0, int(r * SR))]
    i = 0
    for seg in segs:
        m = min(len(seg), n - i)
        if m <= 0:
            break
        x[i:i + m] = seg[:m]
        i += m
    return x


def noise(n):
    return rng.uniform(-1, 1, n)


def lowpass(x, cutoff):
    # One-pole lowpass.
    k = 1 - math.exp(-2 * math.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += k * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def sine(freq, sec, phase=0):
    return np.sin(2 * np.pi * freq * t(sec) + phase)


def sweep(f0, f1, sec):
    tt = t(sec)
    ph = 2 * np.pi * (f0 * tt + (f1 - f0) * tt * tt / (2 * sec))
    return np.sin(ph)


# ---- one-shots ----
n = int(SR * 0.25)
hit = lowpass(noise(n), 900) * env(n, 0.001, 0.12, 0, 0.1) * 1.6 + sweep(140, 50, 0.25) * env(n, 0.001, 0.09, 0, 0.1) * 0.9
write_wav('hit', hit * 0.9)

n = int(SR * 0.12)
write_wav('block', (highpass(noise(n), 1500) * env(n, 0.001, 0.05, 0, 0.06) * 0.7 + sine(420, 0.12) * env(n, 0.001, 0.04, 0, 0.05) * 0.4))

n = int(SR * 0.35)
write_wav('thud', lowpass(noise(n), 300) * env(n, 0.002, 0.2, 0, 0.12) * 1.8 + sweep(90, 35, 0.35) * env(n, 0.002, 0.2, 0, 0.1))

n = int(SR * 0.22)
wh = noise(n)
wh = lowpass(wh, 2500) - lowpass(wh, 400)
write_wav('whoosh', wh * env(n, 0.06, 0.1, 0, 0.06) * 0.9)

n = int(SR * 0.09)
write_wav('step', lowpass(noise(n), 1200) * env(n, 0.001, 0.05, 0, 0.03) * 0.6)

n = int(SR * 0.35)
coin = sine(1245, 0.35) * env(n, 0.001, 0.1, 0.3, 0.2) * 0.5 + sine(1865, 0.35) * np.concatenate([np.zeros(int(0.08 * SR)), env(n - int(0.08 * SR), 0.001, 0.12, 0.3, 0.2)]) * 0.5
write_wav('coin', coin)

n = int(SR * 0.06)
write_wav('ui', sine(900, 0.06) * env(n, 0.001, 0.03, 0, 0.02) * 0.5)

n = int(SR * 0.3)
conf = sine(660, 0.3) * env(n, 0.001, 0.08, 0.2, 0.1) * 0.4 + sine(990, 0.3) * np.concatenate([np.zeros(int(0.1 * SR)), env(n - int(0.1 * SR), 0.001, 0.12, 0.2, 0.1)]) * 0.4
write_wav('confirm', conf)

n = int(SR * 0.9)
ko = lowpass(noise(n), 200) * env(n, 0.002, 0.5, 0, 0.3) * 2.2 + sweep(70, 28, 0.9) * env(n, 0.002, 0.5, 0, 0.3) * 1.2 + highpass(noise(n), 3000) * env(n, 0.001, 0.15, 0, 0.1) * 0.5
write_wav('ko', ko * 0.8)

n = int(SR * 0.6)
crash = lowpass(noise(n), 500) * env(n, 0.001, 0.3, 0, 0.25) * 1.5 + highpass(noise(n), 2500) * env(n, 0.001, 0.2, 0.2, 0.3) * 0.8
for f in (3100, 4700, 6200):
    crash += sine(f, 0.6) * env(n, 0.001, 0.25, 0, 0.3) * 0.12
write_wav('crash', crash * 0.8)

n = int(SR * 0.45)
horn = (np.sign(sine(440, 0.45)) * 0.3 + np.sign(sine(554, 0.45)) * 0.3)
write_wav('horn', lowpass(horn, 1800) * env(n, 0.01, 0.05, 0.9, 0.08))

# ---- loops ----
n = int(SR * 6)
wind = lowpass(noise(n), 420)
mod = 0.55 + 0.45 * np.sin(2 * np.pi * 0.18 * t(6)) * np.sin(2 * np.pi * 0.07 * t(6) + 1)
write_wav('wind', wind * mod * 1.2, loop=True)

n = int(SR * 2)
tt = t(2)
eng = np.sign(np.sin(2 * np.pi * 46 * tt)) * 0.35 + np.sin(2 * np.pi * 92 * tt) * 0.3 + lowpass(noise(n), 300) * 0.3
write_wav('engine', lowpass(eng, 900) * 0.8, loop=True)

n = int(SR * 2)
tt = t(2)
f = np.where((tt % 1.0) < 0.5, 700, 930)
siren = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
write_wav('siren', siren, loop=True)

# ---- music: a brooding synth loop in A minor, 112 bpm, 8 bars ----
BPM = 112
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
n = int(SR * total)
music = np.zeros(n)
tt = t(total)


def add(s, x):
    seg = music[s:s + len(x)]
    seg += x[:len(seg)]

A, C, D, E, F, G = 110.0, 130.81, 146.83, 164.81, 174.61, 196.0
chords = [(A, C, E), (F, A, C), (G, 123.47, D), (E, G, 123.47)]  # Am F G Em
bass_notes = [A, F, G, E]
for bar in range(bars):
    start = int(bar * 4 * beat * SR)
    root = bass_notes[bar % 4]
    chord = chords[bar % 4]
    # Bass: a plucked saw on beats 1 and 3, an octave up on the off-beats.
    for b in range(8):
        s = start + int(b * beat / 2 * SR)
        ln = int(beat * 0.45 * SR)
        fr = root / 2 if b % 2 == 0 else root
        seg = tt[:ln]
        saw = 2 * ((seg * fr) % 1) - 1
        add(s, lowpass(saw, 700)[:ln] * env(ln, 0.003, 0.25, 0.3, 0.1) * 0.28)
    # Pad: soft chord.
    ln = int(4 * beat * SR)
    pad = np.zeros(ln)
    for fr in chord:
        pad += np.sin(2 * np.pi * fr * 2 * tt[:ln]) + 0.5 * np.sin(2 * np.pi * fr * 4 * tt[:ln] + 0.3)
    add(start, lowpass(pad, 1400) * env(ln, 0.3, 0.5, 0.6, 0.4) * 0.08)
    # Arpeggio pluck, 16ths.
    for k in range(16):
        s = start + int(k * beat / 4 * SR)
        ln = int(beat / 4 * 0.9 * SR)
        fr = chord[k % 3] * (4 if k % 4 == 3 else 2)
        add(s, np.sin(2 * np.pi * fr * tt[:ln]) * env(ln, 0.002, 0.12, 0.1, 0.05) * 0.14)
    # Drums: kick on 1 and 3, snare on 2 and 4, hats on 8ths.
    for b in range(4):
        s = start + int(b * beat * SR)
        ln = int(0.25 * SR)
        if b % 2 == 0:
            add(s, sweep(120, 40, 0.25)[:ln] * env(ln, 0.001, 0.15, 0, 0.08) * 0.6)
        else:
            add(s, lowpass(noise(ln), 2500)[:ln] * env(ln, 0.001, 0.12, 0, 0.1) * 0.35)
        for h in range(2):
            hs = s + int(h * beat / 2 * SR)
            hl = int(0.05 * SR)
            add(hs, highpass(noise(hl), 6000)[:hl] * env(hl, 0.001, 0.03, 0, 0.02) * 0.18)
music = np.tanh(music * 1.4) * 0.8
write_wav('music', music, loop=True)
print('audio written to', os.path.abspath(OUT), sorted(os.listdir(OUT)))
