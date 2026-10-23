"""
Fin City pixel icons. Every icon is a 16x16 grid drawn with a few primitives; a dark outline is
added automatically around every shape so the whole set shares one look.

Palette letters -> colours are in PALETTE. '.' is transparent.
"""
import math

PALETTE = {
    'k': '#1b2030',  # outline (added automatically)
    'w': '#ffffff',
    'e': '#f3ead2',  # cream
    'S': '#d3d8df',  # light grey
    'd': '#8a93a0',  # grey
    'D': '#4a5260',  # dark grey
    'g': '#4cc46a',  # green
    'G': '#2a8a4a',  # dark green
    'L': '#a8e6a0',  # light green
    'r': '#e5533d',  # red
    'R': '#a3302a',  # dark red
    'y': '#ffcf3f',  # gold
    'Y': '#c9952a',  # dark gold
    'o': '#f08a3a',  # orange
    'b': '#3f8ee0',  # blue
    'B': '#2b5ba8',  # dark blue
    'l': '#a6d8f5',  # light blue
    'c': '#2ebaba',  # teal
    'v': '#8a5cf6',  # purple
    'p': '#f28ab0',  # pink
    'P': '#c95f86',  # dark pink
    'n': '#b07a44',  # brown
    'N': '#6b4428',  # dark brown
    's': '#f2c39c',  # skin
    'u': '#2a2f3d',  # near-black fill (hair, tyres)
}


class Icon:
    def __init__(self):
        self.g = [['.'] * 16 for _ in range(16)]

    def px(self, x, y, c):
        if 0 <= x < 16 and 0 <= y < 16:
            self.g[y][x] = c
        return self

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)
        return self

    def circle(self, cx, cy, r, c):
        for y in range(16):
            for x in range(16):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3:
                    self.px(x, y, c)
        return self

    def ring(self, cx, cy, r, c, t=1.0):
        for y in range(16):
            for x in range(16):
                d = math.hypot(x - cx, y - cy)
                if r - t < d <= r + 0.35:
                    self.px(x, y, c)
        return self

    def line(self, x0, y0, x1, y1, c, w=1):
        n = int(round(max(abs(x1 - x0), abs(y1 - y0), 1)))
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            for dx in range(w):
                for dy in range(w):
                    self.px(x + dx, y + dy, c)
        return self

    def tri(self, x0, y0, x1, y1, x2, y2, c):
        def inside(px, py):
            def s(ax, ay, bx, by):
                return (px - bx) * (ay - by) - (ax - bx) * (py - by)
            d1, d2, d3 = s(x0, y0, x1, y1), s(x1, y1, x2, y2), s(x2, y2, x0, y0)
            neg = d1 < 0 or d2 < 0 or d3 < 0
            pos = d1 > 0 or d2 > 0 or d3 > 0
            return not (neg and pos)
        for y in range(16):
            for x in range(16):
                if inside(x, y):
                    self.px(x, y, c)
        return self

    def stamp(self, x, y, rows):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ' ':
                    self.px(x + i, y + j, ch)
        return self

    def clear(self, *pts):
        for x, y in pts:
            self.px(x, y, '.')
        return self

    def done(self):
        """Adds the outline: transparent pixels touching a coloured one become 'k'."""
        out = [row[:] for row in self.g]
        for y in range(16):
            for x in range(16):
                if self.g[y][x] != '.':
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < 16 and 0 <= ny < 16 and self.g[ny][nx] not in ('.', 'k'):
                        out[y][x] = 'k'
                        break
        return out


D = {}


def icon(name):
    def wrap(fn):
        D[name] = lambda: fn(Icon()).done()
        return fn
    return wrap


def rbox(i, x0, y0, x1, y1, c):
    i.rect(x0, y0, x1, y1, c)
    return i.clear((x0, y0), (x1, y0), (x0, y1), (x1, y1))


# ───────── Status ─────────

@icon('check')
def _(i):
    rbox(i, 1, 1, 14, 13, 'g').rect(2, 12, 13, 13, 'G').clear((1, 13), (14, 13))
    for d in (0, 1):
        i.line(3, 7 + d, 6, 10 + d, 'w')
        i.line(6, 10 + d, 12, 4 + d, 'w')
    return i


@icon('cross')
def _(i):
    rbox(i, 1, 1, 14, 13, 'r').rect(2, 12, 13, 13, 'R').clear((1, 13), (14, 13))
    for d in (0, 1):
        i.line(4 + d, 3, 11 + d, 10, 'w')
        i.line(11 + d, 3, 4 + d, 10, 'w')
    return i


@icon('warn')
def _(i):
    i.tri(7.5, 1, 1, 14, 14, 14, 'y').rect(2, 13, 13, 14, 'Y')
    i.rect(7, 5, 8, 10, 'u').rect(7, 12, 8, 12, 'u')
    return i


@icon('stop')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'r').rect(3, 6, 12, 9, 'w')
    return i


@icon('question')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'b')
    i.rect(5, 3, 10, 4, 'w').rect(9, 5, 10, 6, 'w').rect(7, 7, 9, 7, 'w').rect(7, 8, 8, 9, 'w').rect(7, 11, 8, 12, 'w').rect(5, 5, 5, 5, 'w')
    return i


@icon('star')
def _(i):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = 7 if k % 2 == 0 else 3
        pts.append((7.5 + math.cos(a) * r, 8 + math.sin(a) * r))
    for k in range(10):
        i.tri(7.5, 8, *pts[k], *pts[(k + 1) % 10], 'y')
    i.px(6, 5, 'w').px(6, 6, 'w')
    for x in range(16):
        for y in range(10, 16):
            if i.g[y][x] == 'y':
                i.g[y][x] = 'Y' if y > 12 else 'y'
    return i


@icon('sparkle')
def _(i):
    i.rect(6, 2, 7, 12, 'y').rect(2, 6, 11, 7, 'y').rect(5, 5, 8, 8, 'y').px(6, 6, 'w')
    i.rect(12, 10, 12, 14, 'y').rect(10, 12, 14, 12, 'y')
    i.rect(12, 1, 12, 3, 'w').rect(11, 2, 13, 2, 'w')
    return i


@icon('trophy')
def _(i):
    i.rect(4, 2, 11, 7, 'y').rect(5, 8, 10, 8, 'y').rect(6, 9, 9, 9, 'Y').rect(7, 10, 8, 11, 'Y')
    i.rect(4, 12, 11, 13, 'N').rect(5, 12, 10, 12, 'n')
    i.rect(1, 3, 3, 3, 'y').rect(1, 4, 1, 5, 'y').rect(2, 6, 3, 6, 'y')
    i.rect(12, 3, 14, 3, 'y').rect(14, 4, 14, 5, 'y').rect(12, 6, 13, 6, 'y')
    i.rect(5, 3, 5, 6, 'w')
    return i


@icon('medal')
def _(i):
    i.line(4, 1, 7, 7, 'b', 2).line(11, 1, 8, 7, 'r', 2)
    i.circle(7.5, 10.5, 3.6, 'y').circle(7.5, 10.5, 2, 'Y').px(7, 10, 'y')
    return i


@icon('crown')
def _(i):
    i.rect(2, 8, 13, 12, 'y').tri(2, 8, 2, 3, 5, 8, 'y').tri(7.5, 2, 5, 8, 10, 8, 'y').tri(13, 3, 13, 8, 10, 8, 'y')
    i.rect(2, 11, 13, 12, 'Y').px(5, 9, 'r').px(7, 9, 'b').px(8, 9, 'b').px(10, 9, 'r')
    return i


# ───────── Money ─────────

@icon('coin')
def _(i):
    # FinBucks coin: gold rim, inner ring, a bold F
    i.circle(7.5, 7.5, 6.6, 'y').ring(7.5, 7.5, 5.0, 'Y')
    i.rect(5, 4, 6, 11, 'Y').rect(5, 4, 10, 5, 'Y').rect(5, 7, 9, 8, 'Y')
    i.px(3, 4, 'w').px(4, 3, 'w')
    return i


@icon('cash')
def _(i):
    # FinBucks note: teal with a gold medallion holding an F, stacked over a second note
    i.rect(3, 2, 14, 9, 'G')
    i.rect(1, 5, 12, 12, 'c').rect(2, 6, 11, 11, 'l').rect(3, 7, 10, 10, 'c')
    i.circle(6.5, 8.5, 2.2, 'y').rect(6, 7, 6, 10, 'Y').rect(6, 7, 7, 7, 'Y').rect(6, 8, 7, 8, 'Y')
    i.px(10, 7, 'y').px(10, 10, 'y')
    return i


@icon('euro')
def _(i):
    i.rect(3, 2, 14, 9, 'B').rect(1, 5, 12, 12, 'b').rect(2, 6, 11, 11, 'l').rect(3, 7, 10, 10, 'b')
    i.circle(6.5, 8.5, 1.6, 'l')
    return i


@icon('pound')
def _(i):
    i.rect(3, 2, 14, 9, 'v').rect(1, 5, 12, 12, 'p').rect(2, 6, 11, 11, 'e').rect(3, 7, 10, 10, 'p')
    i.circle(6.5, 8.5, 1.6, 'e')
    return i


@icon('wings')
def _(i):
    i.rect(4, 6, 11, 11, 'g').rect(5, 7, 10, 10, 'L').rect(7, 8, 8, 9, 'g')
    i.tri(4, 6, 0, 2, 1, 8, 'w').tri(11, 6, 15, 2, 14, 8, 'w')
    return i


@icon('card')
def _(i):
    rbox(i, 1, 3, 14, 12, 'b').rect(1, 5, 14, 6, 'u').rect(3, 8, 5, 10, 'y').rect(8, 10, 12, 10, 'l')
    return i


@icon('idcard')
def _(i):
    rbox(i, 1, 3, 14, 12, 'e').rect(2, 5, 6, 10, 'l').circle(4, 7, 1.2, 's').rect(8, 6, 12, 6, 'd').rect(8, 8, 11, 8, 'd').rect(8, 10, 12, 10, 'd')
    return i


@icon('piggy')
def _(i):
    i.circle(7, 9, 5, 'p').rect(3, 7, 12, 11, 'p').rect(12, 8, 14, 10, 'P').px(13, 9, 'u')
    i.rect(4, 13, 5, 14, 'P').rect(9, 13, 10, 14, 'P').px(10, 7, 'u').tri(4, 5, 6, 3, 7, 6, 'P')
    i.rect(6, 4, 8, 4, 'u')
    i.rect(6, 0, 8, 2, 'y')
    return i


@icon('moneybag')
def _(i):
    i.circle(7.5, 10, 5, 'n').rect(6, 3, 9, 5, 'n').rect(5, 2, 10, 2, 'N').rect(6, 5, 9, 5, 'N')
    i.rect(7, 7, 8, 13, 'y').rect(6, 8, 9, 8, 'y').rect(6, 12, 9, 12, 'y').rect(6, 10, 9, 10, 'y')
    return i


@icon('gem')
def _(i):
    i.tri(1, 5, 14, 5, 7.5, 14, 'c').rect(4, 2, 11, 5, 'l').tri(1, 5, 4, 2, 4, 5, 'l').tri(14, 5, 11, 2, 11, 5, 'l')
    i.line(4, 5, 7, 12, 'w').line(6, 3, 7, 4, 'w')
    return i


@icon('exchange')
def _(i):
    i.circle(5, 5, 3.6, 'y').circle(10.5, 10.5, 3.6, 'g').px(5, 5, 'Y').px(10, 10, 'G')
    i.rect(10, 1, 13, 1, 'b').rect(13, 2, 13, 4, 'b').px(12, 4, 'b').px(14, 4, 'b')
    i.rect(2, 14, 5, 14, 'b').rect(2, 11, 2, 13, 'b').px(1, 11, 'b').px(3, 11, 'b')
    return i


@icon('chart_up')
def _(i):
    rbox(i, 1, 1, 14, 13, 'w').rect(2, 2, 2, 12, 'S').rect(2, 12, 13, 12, 'S')
    i.line(3, 11, 6, 7, 'g', 2).line(6, 7, 8, 9, 'g', 2).line(8, 9, 12, 4, 'g', 2)
    i.rect(11, 3, 13, 3, 'G').rect(13, 3, 13, 5, 'G')
    return i


@icon('chart_down')
def _(i):
    rbox(i, 1, 1, 14, 13, 'w').rect(2, 2, 2, 12, 'S').rect(2, 12, 13, 12, 'S')
    i.line(3, 3, 6, 7, 'r', 2).line(6, 7, 8, 5, 'r', 2).line(8, 5, 12, 10, 'r', 2)
    i.rect(11, 11, 13, 11, 'R').rect(13, 9, 13, 11, 'R')
    return i


@icon('bars')
def _(i):
    rbox(i, 1, 1, 14, 13, 'w').rect(2, 12, 13, 12, 'S')
    i.rect(3, 8, 4, 11, 'b').rect(6, 5, 7, 11, 'g').rect(9, 7, 10, 11, 'o').rect(12, 3, 13, 11, 'v'.replace('v', 'y'))
    return i


@icon('receipt')
def _(i):
    i.rect(3, 1, 12, 13, 'w').rect(5, 3, 10, 3, 'd').rect(5, 5, 8, 5, 'd').rect(5, 7, 10, 7, 'd').rect(5, 9, 7, 9, 'd').rect(9, 10, 10, 11, 'g')
    for x in range(3, 13, 2):
        i.px(x, 13, '.')
    return i


@icon('scales')
def _(i):
    i.rect(7, 2, 8, 13, 'Y').rect(4, 13, 11, 14, 'Y').rect(2, 3, 13, 3, 'y')
    i.line(2, 4, 1, 8, 'd').line(3, 4, 4, 8, 'd').rect(0, 9, 4, 9, 'y').rect(1, 10, 3, 10, 'Y')
    i.line(12, 4, 11, 8, 'd').line(13, 4, 14, 8, 'd').rect(11, 9, 15, 9, 'y').rect(12, 10, 14, 10, 'Y')
    return i


@icon('abacus')
def _(i):
    i.rect(1, 1, 14, 14, 'n').rect(2, 2, 13, 13, 'e')
    for y, cols in ((4, (3, 4, 9)), (7, (3, 7, 8, 11)), (10, (5, 6, 12))):
        i.rect(2, y, 13, y, 'd')
        for x in cols:
            i.rect(x, y - 1, x, y + 1, 'r' if y == 4 else 'b' if y == 7 else 'g')
    return i


# ───────── Places ─────────

@icon('bank')
def _(i):
    i.tri(7.5, 1, 0, 5, 15, 5, 'e').rect(1, 5, 14, 6, 'S')
    for x in (2, 5, 9, 12):
        i.rect(x, 7, x + 1, 11, 'e').px(x + 1, 7, 'S')
    i.rect(1, 12, 14, 13, 'S').rect(0, 14, 15, 14, 'd').px(7, 3, 'y').px(8, 3, 'y')
    return i


@icon('office')
def _(i):
    i.rect(3, 1, 12, 14, 'l').rect(3, 1, 12, 2, 'B')
    for y in (4, 7, 10):
        for x in (5, 8, 10):
            i.rect(x, y, x, y + 1, 'B')
    i.rect(6, 12, 9, 14, 'B')
    return i


@icon('city')
def _(i):
    i.rect(1, 6, 5, 14, 'b').rect(6, 2, 10, 14, 'l').rect(11, 8, 14, 14, 'B')
    for y in range(4, 13, 2):
        i.px(7, y, 'y').px(9, y, 'B')
    for y in range(8, 13, 2):
        i.px(2, y, 'y').px(4, y, 'l').px(12, y + 1, 'y')
    return i


@icon('house')
def _(i):
    i.tri(7.5, 1, 0, 8, 15, 8, 'r').rect(2, 8, 13, 14, 'e').rect(6, 10, 9, 14, 'n').rect(10, 9, 12, 11, 'l').rect(3, 9, 5, 11, 'l')
    i.rect(11, 2, 12, 5, 'D')
    return i


@icon('shop')
def _(i):
    i.rect(1, 6, 14, 14, 'e')
    for x in range(1, 15):
        i.rect(x, 2, x, 5, 'r' if (x // 2) % 2 == 0 else 'w')
    i.rect(3, 8, 7, 11, 'l').rect(9, 8, 12, 14, 'n')
    return i


@icon('school')
def _(i):
    i.rect(1, 6, 14, 14, 'r').tri(7.5, 1, 4, 6, 11, 6, 'r').rect(6, 10, 9, 14, 'n').rect(3, 8, 4, 9, 'l').rect(11, 8, 12, 9, 'l')
    i.circle(7.5, 4.5, 1.2, 'w')
    return i


@icon('hotel')
def _(i):
    i.rect(2, 1, 13, 14, 'p').rect(2, 1, 13, 2, 'P')
    for y in (4, 7, 10):
        for x in (4, 7, 10):
            i.rect(x, y, x + 1, y + 1, 'l')
    i.rect(6, 12, 9, 14, 'n')
    return i


@icon('factory')
def _(i):
    i.rect(1, 7, 14, 14, 'd').tri(1, 7, 5, 4, 5, 7, 'd').tri(5, 7, 9, 4, 9, 7, 'd').rect(11, 1, 13, 7, 'D')
    i.rect(3, 10, 4, 11, 'y').rect(7, 10, 8, 11, 'y').rect(11, 10, 12, 11, 'y')
    return i


@icon('construction')
def _(i):
    i.rect(3, 1, 4, 14, 'y').rect(1, 2, 14, 3, 'y').rect(12, 4, 12, 8, 'D').rect(11, 9, 13, 10, 'o').rect(1, 13, 7, 14, 'd')
    for y in range(4, 14, 3):
        i.px(3, y, 'Y').px(4, y + 1, 'Y')
    return i


@icon('landmark')
def _(i):
    i.rect(6, 1, 9, 14, 'd').rect(7, 0, 8, 0, 'y').rect(5, 5, 10, 6, 'D').rect(4, 10, 11, 11, 'D').rect(3, 14, 12, 14, 'D')
    i.circle(7.5, 3, 1, 'y')
    return i


@icon('bridge')
def _(i):
    i.rect(0, 10, 15, 11, 'r').rect(3, 2, 4, 14, 'r').rect(11, 2, 12, 14, 'r')
    i.line(4, 3, 11, 9, 'R').line(11, 3, 4, 9, 'R').line(0, 9, 3, 4, 'R').line(15, 9, 12, 4, 'R')
    i.rect(0, 13, 15, 14, 'b')
    return i


@icon('lantern')
def _(i):
    i.rect(7, 0, 8, 1, 'Y').rect(5, 2, 10, 2, 'Y').rect(3, 3, 12, 11, 'r').rect(5, 12, 10, 12, 'Y').rect(7, 13, 8, 15, 'y')
    i.rect(4, 5, 11, 5, 'R').rect(4, 9, 11, 9, 'R').rect(6, 4, 7, 10, 'o')
    return i


@icon('ferris')
def _(i):
    i.ring(7.5, 6.5, 5.6, 'd').line(7, 1, 7, 12, 'S').line(2, 6, 13, 6, 'S').line(4, 3, 11, 10, 'S').line(11, 3, 4, 10, 'S')
    for a in range(8):
        x = 7.5 + math.cos(a * math.pi / 4) * 5.6
        y = 6.5 + math.sin(a * math.pi / 4) * 5.6
        i.px(round(x), round(y), 'rbygvcop'[a])
    i.line(7, 7, 4, 14, 'D').line(8, 7, 11, 14, 'D').rect(3, 14, 12, 14, 'D')
    return i


@icon('door')
def _(i):
    i.rect(3, 1, 12, 14, 'n').rect(4, 2, 11, 7, 'N').rect(4, 9, 11, 13, 'N').rect(5, 3, 10, 6, 'n').rect(5, 10, 10, 12, 'n').px(10, 8, 'y')
    return i


@icon('portal')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'v').ring(7.5, 7.5, 5, 'p').ring(7.5, 7.5, 3, 'l').circle(7.5, 7.5, 1.2, 'w')
    return i


# ───────── Objects ─────────

@icon('lock')
def _(i):
    i.ring(7.5, 6, 4, 'd', 1.6).rect(2, 6, 13, 14, 'y').rect(2, 13, 13, 14, 'Y').rect(7, 8, 8, 11, 'u')
    for y in range(6, 10):
        for x in range(16):
            if i.g[y][x] == 'd':
                i.g[y][x] = '.'
    i.rect(2, 6, 13, 7, 'y')
    return i


@icon('unlock')
def _(i):
    i.ring(10.5, 4.5, 3.6, 'd', 1.6)
    for y in range(4, 9):
        for x in range(9, 16):
            if i.g[y][x] == 'd' and x < 10:
                i.g[y][x] = '.'
    i.rect(1, 7, 11, 14, 'y').rect(1, 13, 11, 14, 'Y').rect(5, 9, 6, 12, 'u')
    return i


@icon('key')
def _(i):
    i.circle(4.5, 5.5, 3.6, 'y').circle(4.5, 5.5, 1.2, '.').line(7, 7, 13, 13, 'y', 2).rect(11, 12, 12, 13, 'y').rect(10, 13, 10, 14, 'y').rect(12, 10, 14, 10, 'y')
    return i


@icon('bulb')
def _(i):
    i.circle(7.5, 6, 5, 'y').rect(5, 10, 10, 11, 'y').rect(5, 12, 10, 14, 'd').rect(5, 13, 10, 13, 'S').rect(5, 3, 6, 5, 'w')
    return i


@icon('phone')
def _(i):
    rbox(i, 4, 0, 11, 15, 'u').rect(5, 2, 10, 12, 'c').rect(6, 4, 9, 4, 'w').rect(6, 6, 8, 6, 'l').rect(7, 14, 8, 14, 'd')
    return i


@icon('computer')
def _(i):
    i.rect(1, 2, 14, 10, 'D').rect(2, 3, 13, 9, 'c').rect(3, 4, 7, 4, 'w').rect(3, 6, 10, 6, 'l').rect(6, 11, 9, 12, 'd').rect(3, 13, 12, 14, 'S')
    return i


@icon('laptop')
def _(i):
    i.rect(2, 3, 13, 10, 'D').rect(3, 4, 12, 9, 'b').rect(0, 11, 15, 13, 'S').rect(4, 5, 8, 5, 'w')
    return i


@icon('tv')
def _(i):
    i.rect(1, 3, 14, 12, 'D').rect(2, 4, 13, 11, 'l').line(5, 0, 7, 3, 'd').line(10, 0, 8, 3, 'd').rect(4, 13, 11, 14, 'd')
    return i


@icon('robot')
def _(i):
    i.rect(3, 4, 12, 11, 'S').rect(5, 6, 6, 7, 'c').rect(9, 6, 10, 7, 'c').rect(6, 9, 9, 9, 'D').rect(7, 1, 8, 3, 'd').rect(7, 0, 8, 0, 'r')
    i.rect(1, 6, 2, 9, 'd').rect(13, 6, 14, 9, 'd').rect(5, 12, 10, 14, 'd')
    return i


@icon('gear')
def _(i):
    for a in range(8):
        x = 7.5 + math.cos(a * math.pi / 4) * 6
        y = 7.5 + math.sin(a * math.pi / 4) * 6
        i.rect(round(x) - 1, round(y) - 1, round(x), round(y), 'd')
    i.circle(7.5, 7.5, 5, 'd').circle(7.5, 7.5, 2, '.').ring(7.5, 7.5, 5, 'S')
    return i


@icon('wrench')
def _(i):
    i.line(3, 12, 10, 5, 'd', 2).circle(11.5, 3.5, 3, 'd').rect(11, 1, 12, 4, '.').rect(2, 12, 4, 14, 'r')
    return i


@icon('hammer')
def _(i):
    i.line(4, 13, 10, 7, 'n', 2).rect(6, 2, 14, 5, 'd').rect(6, 2, 7, 6, 'D')
    return i


@icon('floppy')
def _(i):
    i.rect(1, 1, 14, 14, 'b').rect(4, 1, 11, 5, 'S').rect(9, 2, 10, 4, 'D').rect(3, 8, 12, 14, 'w').rect(4, 10, 11, 10, 'd').rect(4, 12, 9, 12, 'd')
    return i


@icon('battery')
def _(i):
    i.rect(1, 4, 13, 11, 'S').rect(14, 6, 14, 9, 'd').rect(2, 5, 9, 10, 'g').line(8, 5, 6, 8, 'y').line(6, 8, 9, 8, 'y').line(9, 8, 7, 11, 'y')
    return i


@icon('bolt')
def _(i):
    i.tri(9, 0, 3, 9, 8, 9, 'y').tri(7, 6, 12, 6, 6, 15, 'y').rect(7, 6, 8, 9, 'y')
    return i


@icon('package')
def _(i):
    i.rect(1, 4, 14, 14, 'n').rect(1, 2, 14, 4, 'e').rect(1, 4, 14, 4, 'N').rect(7, 2, 8, 14, 'Y').rect(9, 9, 12, 11, 'w')
    return i


@icon('gift')
def _(i):
    i.rect(1, 6, 14, 14, 'r').rect(1, 5, 14, 7, 'R').rect(7, 5, 8, 14, 'y').circle(5, 3, 2, 'y').circle(10, 3, 2, 'y').rect(7, 3, 8, 4, 'Y')
    return i


@icon('balloon')
def _(i):
    i.circle(7.5, 5.5, 5, 'r').rect(7, 11, 8, 11, 'R').line(7, 12, 9, 15, 'd').rect(5, 3, 5, 5, 'w')
    return i


@icon('party')
def _(i):
    i.tri(1, 14, 4, 4, 11, 11, 'v').line(3, 9, 6, 12, 'y').line(4, 6, 9, 11, 'y')
    i.px(9, 2, 'r').px(12, 4, 'g').px(13, 1, 'y').px(10, 6, 'b').px(14, 7, 'p').px(6, 1, 'g').px(12, 9, 'r')
    return i


@icon('fireworks')
def _(i):
    for a in range(12):
        x = 7.5 + math.cos(a * math.pi / 6) * 6
        y = 7.5 + math.sin(a * math.pi / 6) * 6
        i.line(7.5 + math.cos(a * math.pi / 6) * 2, 7.5 + math.sin(a * math.pi / 6) * 2, x, y, 'ryb'[a % 3])
    i.px(7, 7, 'w').px(8, 8, 'w')
    return i


@icon('heart')
def _(i):
    i.circle(4.5, 5, 3.5, 'r').circle(10.5, 5, 3.5, 'r').tri(1, 6, 14, 6, 7.5, 13.5, 'r').rect(3, 3, 4, 4, 'w')
    return i


@icon('heart_blue')
def _(i):
    i.circle(4.5, 5, 3.5, 'b').circle(10.5, 5, 3.5, 'b').tri(1, 6, 14, 6, 7.5, 13.5, 'b').rect(3, 3, 4, 4, 'w')
    return i


@icon('heart_gold')
def _(i):
    i.circle(4.5, 5, 3.5, 'y').circle(10.5, 5, 3.5, 'y').tri(1, 6, 14, 6, 7.5, 13.5, 'y').rect(3, 3, 4, 4, 'w')
    return i


@icon('heart_broken')
def _(i):
    i.circle(4.5, 5, 3.5, 'r').circle(10.5, 5, 3.5, 'r').tri(1, 6, 14, 6, 7.5, 13.5, 'r').line(8, 2, 6, 6, '.').line(6, 6, 9, 9, '.').line(9, 9, 7, 13, '.')
    return i


@icon('ribbon')
def _(i):
    i.circle(7.5, 5, 3, 'p').circle(7.5, 5, 1.2, '.').line(6, 8, 3, 14, 'p', 2).line(9, 8, 12, 14, 'p', 2)
    return i


@icon('briefcase')
def _(i):
    i.rect(5, 2, 10, 3, 'N').rect(1, 4, 14, 13, 'n').rect(1, 8, 14, 8, 'N').rect(7, 7, 8, 9, 'y')
    return i


@icon('bags')
def _(i):
    i.rect(1, 6, 9, 14, 'p').ring(5, 5.5, 2.5, 'P').rect(1, 5, 9, 5, '.').rect(1, 6, 9, 14, 'p')
    i.rect(7, 4, 14, 14, 'b').rect(9, 2, 12, 2, 'B').rect(9, 3, 9, 4, 'B').rect(12, 3, 12, 4, 'B')
    return i


@icon('backpack')
def _(i):
    rbox(i, 3, 2, 12, 14, 'o').rect(5, 8, 10, 12, 'r').rect(6, 0, 9, 1, 'N').rect(5, 9, 10, 9, 'R')
    return i


@icon('cart')
def _(i):
    i.rect(0, 1, 2, 2, 'D').line(2, 2, 4, 10, 'D').rect(3, 4, 14, 8, 'S').rect(4, 5, 13, 7, 'g').rect(4, 10, 13, 10, 'D').circle(5, 13, 1.5, 'u').circle(12, 13, 1.5, 'u')
    i.rect(5, 3, 7, 4, 'r').rect(9, 2, 11, 4, 'y')
    return i


@icon('basket')
def _(i):
    i.ring(7.5, 7, 5, 'n', 1.4).rect(1, 7, 14, 7, '.').rect(1, 8, 14, 14, 'n')
    for x in range(2, 14, 3):
        i.rect(x, 9, x, 13, 'N')
    i.rect(3, 5, 5, 7, 'r').rect(9, 5, 11, 7, 'g')
    return i


@icon('ticket')
def _(i):
    i.rect(0, 4, 15, 11, 'y').rect(5, 4, 5, 11, 'Y').rect(7, 6, 13, 6, 'Y').rect(7, 9, 11, 9, 'Y').clear((0, 7), (0, 8), (15, 7), (15, 8))
    return i


@icon('label')
def _(i):
    i.tri(1, 7.5, 5, 2, 5, 13, 'o').rect(5, 2, 14, 13, 'o').circle(5, 7.5, 1, '.').rect(8, 5, 12, 5, 'w').rect(8, 8, 11, 8, 'w')
    return i


@icon('memo')
def _(i):
    i.rect(2, 1, 11, 14, 'w').rect(4, 3, 9, 3, 'd').rect(4, 5, 9, 5, 'd').rect(4, 7, 7, 7, 'd').line(13, 3, 7, 11, 'y', 2).rect(6, 12, 7, 12, 'D')
    return i


@icon('pencil')
def _(i):
    i.line(3, 12, 12, 3, 'y', 2).rect(12, 2, 13, 3, 'p').rect(2, 12, 3, 13, 'e').px(1, 14, 'u')
    return i


@icon('scissors')
def _(i):
    i.circle(4, 11, 2.4, 'r').circle(11, 11, 2.4, 'r').circle(4, 11, 1, '.').circle(11, 11, 1, '.').line(5, 9, 11, 1, 'S').line(10, 9, 4, 1, 'S')
    return i


@icon('ruler')
def _(i):
    i.tri(1, 14, 1, 1, 14, 14, 'y').tri(4, 11, 4, 7, 8, 11, '.')
    for k in range(2, 13, 2):
        i.px(2, k, 'Y')
    return i


@icon('page')
def _(i):
    i.rect(3, 1, 12, 14, 'w').tri(9, 1, 12, 1, 12, 4, '.').rect(9, 1, 9, 4, 'S').rect(9, 4, 12, 4, 'S')
    i.rect(5, 6, 10, 6, 'd').rect(5, 8, 10, 8, 'd').rect(5, 10, 8, 10, 'd')
    return i


@icon('clipboard')
def _(i):
    i.rect(2, 2, 13, 14, 'n').rect(3, 3, 12, 13, 'w').rect(5, 1, 10, 3, 'd').rect(5, 6, 10, 6, 'd').rect(5, 8, 10, 8, 'd').rect(5, 10, 8, 10, 'd')
    return i


@icon('scroll')
def _(i):
    i.rect(3, 2, 12, 13, 'e').rect(2, 1, 13, 2, 'n').rect(2, 13, 13, 14, 'n').rect(5, 5, 10, 5, 'N').rect(5, 7, 10, 7, 'N').rect(5, 9, 8, 9, 'N')
    return i


@icon('books')
def _(i):
    i.rect(1, 3, 4, 14, 'r').rect(5, 1, 8, 14, 'b').rect(9, 4, 11, 14, 'g').line(11, 5, 14, 14, 'y', 2)
    i.rect(1, 6, 4, 6, 'y').rect(5, 4, 8, 4, 'y').rect(9, 7, 11, 7, 'y')
    return i


@icon('book')
def _(i):
    i.rect(1, 3, 7, 13, 'w').rect(8, 3, 14, 13, 'w').rect(7, 3, 8, 14, 'S').rect(0, 13, 15, 14, 'b')
    for y in (5, 7, 9):
        i.rect(2, y, 6, y, 'd').rect(9, y, 13, y, 'd')
    return i


@icon('closedbook')
def _(i):
    i.rect(2, 1, 13, 14, 'r').rect(2, 1, 3, 14, 'R').rect(5, 4, 11, 6, 'e').rect(4, 13, 13, 14, 'w')
    return i


@icon('newspaper')
def _(i):
    i.rect(1, 2, 14, 13, 'w').rect(2, 3, 13, 4, 'u').rect(2, 6, 7, 10, 'S').rect(9, 6, 13, 6, 'd').rect(9, 8, 13, 8, 'd').rect(9, 10, 13, 10, 'd').rect(2, 12, 13, 12, 'd')
    return i


@icon('calendar')
def _(i):
    i.rect(1, 2, 14, 14, 'w').rect(1, 2, 14, 5, 'r').rect(4, 0, 4, 3, 'D').rect(11, 0, 11, 3, 'D')
    for y in (7, 9, 11):
        for x in (3, 6, 9, 12):
            i.px(x, y, 'd')
    i.rect(8, 10, 10, 12, 'b')
    return i


@icon('stopwatch')
def _(i):
    i.circle(7.5, 8.5, 6, 'S').circle(7.5, 8.5, 4.6, 'w').rect(6, 0, 9, 1, 'd').rect(7, 2, 8, 2, 'd').rect(7, 5, 8, 9, 'r').rect(8, 8, 10, 9, 'u')
    return i


@icon('hourglass')
def _(i):
    i.rect(3, 0, 12, 1, 'n').rect(3, 14, 12, 15, 'n').tri(4, 2, 11, 2, 7.5, 8, 'l').tri(4, 13, 11, 13, 7.5, 7, 'l').tri(6, 11, 9, 11, 7.5, 9, 'y').rect(5, 12, 10, 13, 'y')
    return i


@icon('watch')
def _(i):
    i.rect(5, 0, 10, 15, 'D').circle(7.5, 7.5, 4.6, 'S').circle(7.5, 7.5, 3.4, 'w').rect(7, 5, 7, 8, 'u').rect(8, 8, 9, 8, 'u')
    return i


@icon('mic')
def _(i):
    rbox(i, 5, 1, 10, 9, 'd').rect(6, 2, 9, 8, 'S').ring(7.5, 6.5, 4.6, 'D').rect(2, 0, 13, 5, '.').rect(5, 1, 10, 9, 'd').rect(6, 2, 7, 7, 'S').rect(7, 11, 8, 13, 'D').rect(4, 14, 11, 14, 'D')
    return i


@icon('headphones')
def _(i):
    i.ring(7.5, 8, 6, 'D', 1.6).rect(0, 8, 15, 15, '.').rect(1, 8, 4, 14, 'r').rect(11, 8, 14, 14, 'r')
    return i


@icon('music')
def _(i):
    i.rect(5, 2, 6, 11, 'u').rect(11, 1, 12, 9, 'u').rect(5, 1, 12, 3, 'u').circle(4, 12, 2, 'v').circle(10, 10, 2, 'v')
    return i


@icon('megaphone')
def _(i):
    i.tri(3, 7.5, 13, 1, 13, 14, 'r').rect(1, 5, 4, 10, 'S').rect(4, 10, 6, 13, 'D').rect(14, 4, 14, 11, 'R')
    return i


@icon('speaker')
def _(i):
    i.rect(1, 5, 4, 10, 'D').tri(4, 7.5, 9, 1, 9, 14, 'D').ring(9, 7.5, 3.6, 'b').ring(9, 7.5, 6, 'b').rect(0, 0, 9, 15, '.').rect(1, 5, 4, 10, 'D').tri(4, 7.5, 9, 1, 9, 14, 'D')
    return i


@icon('shield')
def _(i):
    i.rect(2, 1, 13, 8, 'b').tri(2, 8, 13, 8, 7.5, 15, 'b').rect(7, 2, 8, 12, 'w').rect(4, 5, 11, 6, 'w')
    return i


@icon('target')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'r').circle(7.5, 7.5, 4.8, 'w').circle(7.5, 7.5, 3, 'r').circle(7.5, 7.5, 1.2, 'w')
    return i


@icon('search')
def _(i):
    i.ring(6, 6, 4.4, 'D', 1.6).circle(6, 6, 2.9, 'l').line(9, 9, 13, 13, 'n', 2)
    return i


@icon('trash')
def _(i):
    i.rect(2, 3, 13, 4, 'd').rect(6, 1, 9, 2, 'd').rect(3, 5, 12, 14, 'S').rect(5, 7, 5, 12, 'd').rect(7, 7, 8, 12, 'd').rect(10, 7, 10, 12, 'd')
    return i


@icon('broom')
def _(i):
    i.line(11, 1, 6, 9, 'n', 2).tri(1, 15, 5, 8, 11, 12, 'y').line(3, 13, 7, 10, 'Y')
    return i


@icon('inbox')
def _(i):
    i.rect(1, 8, 14, 14, 'S').rect(4, 8, 11, 10, 'D').rect(6, 0, 9, 4, 'b').tri(4, 4, 11, 4, 7.5, 7.5, 'b')
    return i


@icon('outbox')
def _(i):
    i.rect(1, 8, 14, 14, 'S').rect(4, 8, 11, 10, 'D').rect(6, 3, 9, 7, 'g').tri(4, 4, 11, 4, 7.5, 0, 'g')
    return i


@icon('envelope')
def _(i):
    i.rect(1, 3, 14, 12, 'w').line(1, 3, 7, 8, 'd').line(14, 3, 8, 8, 'd')
    return i


@icon('speech')
def _(i):
    rbox(i, 1, 1, 14, 10, 'w').tri(3, 10, 7, 10, 3, 14, 'w').rect(4, 4, 11, 4, 'd').rect(4, 7, 9, 7, 'd')
    return i


@icon('map')
def _(i):
    i.rect(1, 2, 5, 13, 'L').rect(6, 1, 10, 12, 'e').rect(11, 2, 14, 13, 'L').line(2, 10, 7, 5, 'r').line(7, 5, 12, 8, 'r').rect(12, 7, 13, 8, 'R')
    return i


@icon('compass')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'S').circle(7.5, 7.5, 5.4, 'w').tri(7.5, 2, 6, 7.5, 9, 7.5, 'r').tri(7.5, 13, 6, 7.5, 9, 7.5, 'd')
    return i


@icon('pin')
def _(i):
    i.circle(7.5, 5.5, 4.6, 'r').tri(4, 8, 11, 8, 7.5, 15, 'r').circle(7.5, 5.5, 1.8, 'w')
    return i


@icon('pushpin')
def _(i):
    i.rect(4, 1, 11, 3, 'r').rect(5, 4, 10, 7, 'r').rect(3, 8, 12, 9, 'R').line(7, 10, 5, 15, 'd')
    return i


@icon('flag')
def _(i):
    i.rect(2, 1, 3, 15, 'D').rect(4, 2, 13, 8, 'r').tri(13, 2, 13, 8, 10, 5, 'r').rect(4, 7, 12, 8, 'R')
    return i


@icon('chequered')
def _(i):
    i.rect(2, 1, 3, 15, 'D').rect(4, 2, 13, 9, 'w')
    for y in range(2, 10):
        for x in range(4, 14):
            if ((x // 2) + (y // 2)) % 2:
                i.px(x, y, 'u')
    return i


@icon('globe')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'b').rect(3, 3, 6, 6, 'g').rect(4, 7, 6, 11, 'g').rect(9, 4, 12, 6, 'g').rect(10, 9, 12, 12, 'g').rect(4, 2, 5, 3, 'w')
    return i


@icon('rocket')
def _(i):
    i.line(4, 11, 11, 4, 'S', 3).tri(11, 2, 14, 1, 13, 4, 'r').rect(9, 5, 10, 6, 'b').tri(2, 9, 5, 7, 5, 10, 'r').tri(6, 13, 8, 10, 5, 10, 'r').line(1, 14, 3, 12, 'o').px(2, 14, 'y')
    return i


@icon('plane')
def _(i):
    i.rect(1, 7, 14, 8, 'S').tri(5, 7, 9, 7, 11, 1, 'S').tri(5, 8, 9, 8, 11, 14, 'S').tri(1, 7, 1, 3, 3, 7, 'S').px(13, 7, 'b')
    return i


@icon('helicopter')
def _(i):
    i.rect(1, 2, 14, 2, 'D').rect(7, 3, 7, 4, 'D').circle(7, 8, 3.6, 'r').rect(10, 7, 14, 8, 'r').rect(5, 6, 7, 8, 'l').rect(3, 13, 11, 13, 'D')
    return i


@icon('car')
def _(i):
    i.rect(1, 7, 14, 11, 'r').rect(4, 3, 11, 7, 'r').rect(5, 4, 7, 6, 'l').rect(9, 4, 10, 6, 'l').circle(4, 12, 1.8, 'u').circle(11, 12, 1.8, 'u').rect(13, 8, 14, 8, 'y')
    return i


@icon('taxi')
def _(i):
    i.rect(1, 7, 14, 11, 'y').rect(4, 3, 11, 7, 'y').rect(5, 4, 7, 6, 'l').rect(9, 4, 10, 6, 'l').circle(4, 12, 1.8, 'u').circle(11, 12, 1.8, 'u').rect(6, 1, 9, 2, 'u')
    return i


@icon('suv')
def _(i):
    i.rect(1, 5, 14, 11, 'b').rect(2, 2, 11, 5, 'b').rect(3, 3, 5, 5, 'l').rect(7, 3, 10, 5, 'l').circle(4, 12, 2, 'u').circle(11, 12, 2, 'u')
    return i


@icon('truck')
def _(i):
    i.rect(1, 3, 10, 11, 'S').rect(10, 6, 14, 11, 'r').rect(11, 7, 13, 8, 'l').circle(4, 12, 1.8, 'u').circle(11, 12, 1.8, 'u')
    return i


@icon('bus')
def _(i):
    rbox(i, 1, 1, 14, 12, 'r').rect(2, 3, 13, 6, 'l').rect(2, 9, 3, 10, 'y').rect(12, 9, 13, 10, 'y').rect(3, 13, 5, 14, 'u').rect(10, 13, 12, 14, 'u')
    return i


@icon('train')
def _(i):
    rbox(i, 3, 0, 12, 12, 'S').rect(4, 2, 11, 6, 'b').rect(4, 9, 5, 10, 'y').rect(10, 9, 11, 10, 'y').line(4, 13, 2, 15, 'D').line(11, 13, 13, 15, 'D')
    return i


@icon('bike')
def _(i):
    i.ring(3.5, 10.5, 3, 'u').ring(11.5, 10.5, 3, 'u').line(4, 10, 7, 5, 'r').line(7, 5, 11, 10, 'r').line(7, 5, 11, 5, 'r').line(4, 10, 8, 10, 'r').rect(6, 3, 8, 3, 'D').rect(10, 3, 12, 4, 'D')
    return i


@icon('scooter')
def _(i):
    i.circle(3, 12.5, 2, 'u').circle(12, 12.5, 2, 'u').rect(3, 10, 12, 10, 'S').line(11, 10, 11, 2, 'd').rect(9, 1, 13, 2, 'D').rect(4, 7, 9, 9, 'c')
    return i


@icon('boat')
def _(i):
    i.tri(1, 9, 14, 9, 11, 13, 'n').rect(3, 9, 11, 12, 'n').rect(7, 1, 7, 9, 'D').tri(8, 2, 8, 8, 13, 8, 'w').tri(6, 3, 6, 8, 2, 8, 'e').rect(0, 14, 15, 14, 'b')
    return i


@icon('ship')
def _(i):
    i.tri(0, 9, 15, 9, 12, 13, 'r').rect(3, 9, 12, 12, 'r').rect(4, 5, 11, 8, 'w').rect(6, 2, 8, 4, 'D').rect(5, 6, 6, 7, 'l').rect(9, 6, 10, 7, 'l').rect(0, 14, 15, 14, 'b')
    return i


@icon('anchor')
def _(i):
    i.ring(7.5, 2.5, 1.8, 'd').rect(7, 4, 8, 13, 'd').rect(4, 6, 11, 6, 'd').line(2, 9, 7, 14, 'd').line(13, 9, 8, 14, 'd').rect(1, 8, 2, 9, 'd').rect(13, 8, 14, 9, 'd')
    return i


@icon('umbrella')
def _(i):
    i.circle(7.5, 7, 6.5, 'v').rect(0, 7, 15, 15, '.').rect(7, 7, 8, 13, 'D').rect(5, 13, 7, 14, 'D').rect(5, 12, 5, 12, 'D')
    for x in (3, 7, 12):
        i.rect(x, 1, x, 6, 'p')
    return i


# ───────── Weather / nature ─────────

@icon('sun')
def _(i):
    i.circle(7.5, 7.5, 3.8, 'y')
    for a in range(8):
        x = 7.5 + math.cos(a * math.pi / 4) * 6.2
        y = 7.5 + math.sin(a * math.pi / 4) * 6.2
        i.rect(round(x) - (1 if a % 2 == 0 else 0), round(y) - (1 if a % 2 == 0 else 0), round(x), round(y), 'o')
    i.rect(6, 6, 6, 7, 'w')
    return i


@icon('cloud')
def _(i):
    i.circle(5, 9, 3.4, 'S').circle(9.5, 7, 4.2, 'S').rect(2, 9, 14, 12, 'S').rect(3, 11, 14, 12, 'd').circle(9, 6, 2, 'w')
    return i


@icon('suncloud')
def _(i):
    i.circle(10, 5, 3.6, 'y').circle(5, 10, 3, 'S').circle(9, 9, 3.6, 'S').rect(2, 10, 13, 13, 'S').rect(3, 12, 13, 13, 'd')
    return i


@icon('rain')
def _(i):
    i.circle(5, 6, 3.4, 'S').circle(9.5, 4.5, 4, 'S').rect(2, 6, 14, 9, 'S').rect(3, 8, 14, 9, 'd')
    for x in (3, 7, 11):
        i.line(x + 1, 11, x, 14, 'b')
    return i


@icon('storm')
def _(i):
    i.circle(5, 6, 3.4, 'd').circle(9.5, 4.5, 4, 'd').rect(2, 6, 14, 9, 'd').rect(3, 8, 14, 9, 'D').line(9, 10, 7, 13, 'y').line(7, 13, 9, 13, 'y').line(9, 13, 7, 15, 'y').line(3, 11, 2, 14, 'b').line(13, 11, 12, 14, 'b')
    return i


@icon('snow')
def _(i):
    for a in range(3):
        an = a * math.pi / 3
        i.line(7.5 - math.cos(an) * 6.5, 7.5 - math.sin(an) * 6.5, 7.5 + math.cos(an) * 6.5, 7.5 + math.sin(an) * 6.5, 'l')
    i.circle(7.5, 7.5, 1.4, 'w')
    return i


@icon('fog')
def _(i):
    for y, (a, b) in zip((3, 6, 9, 12), ((2, 13), (0, 11), (3, 15), (1, 12))):
        i.rect(a, y, b, y + 1, 'S')
    return i


@icon('tornado')
def _(i):
    for y, (a, b) in enumerate(((1, 14), (2, 13), (3, 12), (4, 10), (5, 10), (5, 9), (6, 9), (6, 8), (7, 8), (7, 8))):
        i.rect(a, y + 2, b, y + 2, 'S' if y % 2 else 'd')
    return i


@icon('moon')
def _(i):
    i.circle(7.5, 7.5, 6, 'y').circle(10.5, 5.5, 5, '.')
    return i


@icon('drop')
def _(i):
    i.circle(7.5, 10, 4.6, 'b').tri(3.5, 9, 11.5, 9, 7.5, 1, 'b').rect(5, 9, 5, 11, 'l')
    return i


@icon('wave')
def _(i):
    i.circle(6, 8, 5, 'b').circle(8, 7, 3, '.').rect(1, 11, 14, 14, 'b').rect(10, 6, 12, 7, 'w')
    return i


@icon('fire')
def _(i):
    i.circle(7.5, 10, 4.6, 'o').tri(3, 9, 12, 9, 6, 1, 'o').tri(9, 9, 12, 9, 11, 4, 'o').circle(7.5, 11, 2.4, 'y')
    return i


@icon('boom')
def _(i):
    for a in range(10):
        an = a * math.pi / 5
        r = 7 if a % 2 == 0 else 4
        i.tri(7.5, 7.5, 7.5 + math.cos(an) * r, 7.5 + math.sin(an) * r, 7.5 + math.cos(an + math.pi / 5) * (11 - r), 7.5 + math.sin(an + math.pi / 5) * (11 - r), 'o')
    i.circle(7.5, 7.5, 2.4, 'y')
    return i


@icon('ice')
def _(i):
    rbox(i, 2, 2, 13, 13, 'l').rect(3, 3, 6, 4, 'w').rect(10, 10, 12, 12, 'b')
    return i


@icon('seedling')
def _(i):
    i.rect(7, 6, 8, 12, 'G').circle(4.5, 5, 3, 'g').circle(11, 4, 3, 'g').rect(3, 12, 12, 14, 'n')
    return i


@icon('tree')
def _(i):
    i.circle(7.5, 6, 5.6, 'g').circle(5, 5, 2, 'L').rect(7, 10, 8, 14, 'n').rect(3, 14, 12, 14, 'N')
    return i


@icon('palm')
def _(i):
    i.line(7, 14, 9, 5, 'n', 2).tri(9, 5, 1, 7, 4, 3, 'g').tri(9, 5, 15, 7, 13, 2, 'g').tri(9, 5, 7, 0, 12, 1, 'G').rect(3, 14, 13, 14, 'y')
    return i


@icon('flower')
def _(i):
    i.rect(7, 8, 8, 14, 'G').circle(4, 11, 1.6, 'g')
    for a in range(5):
        an = a * math.pi * 2 / 5
        i.circle(7.5 + math.cos(an) * 3, 5 + math.sin(an) * 3, 2, 'p')
    i.circle(7.5, 5, 1.6, 'y')
    return i


@icon('sunflower')
def _(i):
    i.rect(7, 9, 8, 15, 'G').circle(7.5, 6, 5.4, 'y').circle(7.5, 6, 2.6, 'N')
    return i


@icon('potplant')
def _(i):
    i.circle(5, 5, 3, 'g').circle(10, 4, 3, 'G').circle(7.5, 7, 3, 'g').rect(4, 10, 11, 14, 'o').rect(3, 9, 12, 10, 'R')
    return i


# ───────── Food ─────────

@icon('apple')
def _(i):
    i.circle(5.5, 9, 4.6, 'r').circle(9.5, 9, 4.6, 'r').rect(7, 2, 8, 5, 'N').tri(8, 4, 13, 1, 12, 5, 'g').rect(4, 6, 5, 8, 'w')
    return i


@icon('pear')
def _(i):
    i.circle(7.5, 10, 4.6, 'L').circle(7.5, 5.5, 2.6, 'L').rect(7, 1, 8, 3, 'N')
    return i


@icon('orange')
def _(i):
    i.circle(7.5, 8.5, 6, 'o').rect(7, 1, 8, 2, 'G').tri(8, 2, 13, 1, 11, 4, 'g').rect(4, 5, 5, 6, 'y')
    return i


@icon('lemon')
def _(i):
    i.circle(7.5, 8, 5, 'y').rect(1, 7, 14, 9, 'y').rect(4, 5, 5, 6, 'w').px(0, 8, 'Y').px(15, 8, 'Y')
    return i


@icon('banana')
def _(i):
    i.ring(10, 2, 9, 'y', 3).rect(0, 0, 15, 2, '.').rect(13, 0, 15, 15, '.').px(12, 3, 'N')
    return i


@icon('grapes')
def _(i):
    for x, y in ((5, 5), (9, 5), (3, 8), (7, 8), (11, 8), (5, 11), (9, 11), (7, 14)):
        i.circle(x, y, 1.9, 'v')
    i.rect(7, 0, 8, 3, 'G')
    return i


@icon('carrot')
def _(i):
    i.tri(3, 14, 13, 4, 8, 3, 'o').tri(3, 14, 13, 4, 12, 8, 'o').line(12, 3, 14, 0, 'g', 2).line(11, 2, 11, 0, 'g')
    return i


@icon('broccoli')
def _(i):
    i.circle(5, 6, 3.4, 'G').circle(10.5, 6, 3.4, 'G').circle(7.5, 4, 3.4, 'g').rect(6, 8, 9, 14, 'L')
    return i


@icon('corn')
def _(i):
    i.circle(7.5, 6, 3.6, 'y').rect(4, 6, 11, 11, 'y').tri(2, 15, 6, 6, 7, 15, 'g').tri(13, 15, 9, 6, 8, 15, 'g')
    return i


@icon('veg')
def _(i):
    i.circle(7.5, 9, 5.4, 'v').rect(6, 1, 9, 4, 'g').rect(5, 6, 6, 8, 'p')
    return i


@icon('leafy')
def _(i):
    i.circle(5, 7, 4, 'g').circle(10, 7, 4, 'G').circle(7.5, 9, 4, 'L').rect(7, 11, 8, 15, 'G')
    return i


@icon('pepper')
def _(i):
    i.line(3, 13, 11, 5, 'r', 3).rect(11, 2, 12, 5, 'g').tri(1, 14, 4, 11, 5, 14, 'r')
    return i


@icon('bread')
def _(i):
    i.circle(7.5, 6, 6, 'o').rect(1, 6, 14, 13, 'o').rect(2, 7, 13, 12, 'e').rect(4, 3, 6, 3, 'y')
    return i


@icon('croissant')
def _(i):
    i.ring(7.5, 11, 6.5, 'o', 3.4).rect(0, 11, 15, 15, '.').line(5, 5, 6, 8, 'Y').line(10, 5, 9, 8, 'Y')
    return i


@icon('cheese')
def _(i):
    i.tri(1, 12, 14, 12, 14, 4, 'y').rect(1, 12, 14, 14, 'y').rect(1, 13, 14, 14, 'Y').circle(9, 10, 1.2, 'Y').circle(12, 7, 0.9, 'Y')
    return i


@icon('egg')
def _(i):
    i.circle(7.5, 9, 5, 'w').circle(7.5, 6, 3.6, 'w').circle(7.5, 9.5, 2.4, 'y')
    return i


@icon('butter')
def _(i):
    i.rect(1, 10, 14, 13, 'S').rect(3, 6, 12, 10, 'y').rect(3, 6, 12, 7, 'w')
    return i


@icon('cookie')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'n').circle(7.5, 7.5, 5.4, 'o')
    for x, y in ((5, 5), (9, 4), (10, 9), (5, 10), (7, 7)):
        i.px(x, y, 'N').px(x + 1, y, 'N')
    return i


@icon('cupcake')
def _(i):
    i.circle(7.5, 5.5, 4.6, 'p').rect(3, 9, 12, 14, 'b').rect(5, 9, 5, 14, 'B').rect(10, 9, 10, 14, 'B').circle(7.5, 1.5, 1.2, 'r')
    return i


@icon('chocolate')
def _(i):
    i.rect(3, 1, 12, 14, 'N')
    for y in (4, 8, 11):
        i.rect(3, y, 12, y, 'n')
    i.rect(7, 1, 8, 14, 'n').rect(3, 9, 12, 14, 'r')
    return i


@icon('icecream')
def _(i):
    i.circle(7.5, 5, 4.6, 'p').tri(3.5, 7, 11.5, 7, 7.5, 15, 'o').line(5, 8, 9, 12, 'n').px(6, 3, 'w')
    return i


@icon('honey')
def _(i):
    i.rect(3, 4, 12, 14, 'y').rect(2, 2, 13, 4, 'n').rect(5, 7, 10, 10, 'Y')
    return i


@icon('coffee')
def _(i):
    i.rect(2, 5, 11, 13, 'w').rect(3, 6, 10, 7, 'N').ring(12, 8.5, 2.4, 'w').rect(1, 14, 13, 14, 'S').line(5, 1, 5, 3, 'S').line(8, 1, 8, 3, 'S')
    return i


@icon('tea')
def _(i):
    i.rect(2, 6, 12, 12, 'G').rect(3, 6, 11, 7, 'L').rect(1, 13, 13, 14, 'S').line(5, 1, 6, 4, 'S').line(9, 1, 8, 4, 'S')
    return i


@icon('drink')
def _(i):
    i.tri(3, 4, 12, 4, 10, 14, 'r').tri(3, 4, 5, 14, 10, 14, 'r').rect(3, 3, 12, 4, 'w').line(9, 4, 11, 0, 'S').rect(5, 8, 10, 9, 'w')
    return i


@icon('bubbletea')
def _(i):
    i.tri(3, 4, 12, 4, 10, 14, 'e').tri(3, 4, 5, 14, 10, 14, 'e').rect(3, 3, 12, 4, 'p').line(9, 3, 11, 0, 'u')
    for x, y in ((6, 12), (8, 12), (7, 10), (5, 10)):
        i.px(x, y, 'u')
    return i


@icon('milk')
def _(i):
    i.rect(4, 3, 11, 14, 'w').rect(4, 7, 11, 10, 'b').rect(5, 1, 10, 2, 'S')
    return i


@icon('juicebox')
def _(i):
    i.rect(3, 4, 11, 14, 'o').rect(3, 4, 11, 5, 'y').line(9, 4, 12, 0, 'S').circle(7, 10, 2, 'y')
    return i


@icon('bowl')
def _(i):
    i.rect(1, 7, 14, 7, 'w').circle(7.5, 7, 6, 'r').rect(0, 0, 15, 6, '.').rect(1, 6, 14, 7, 'e').rect(5, 13, 10, 14, 'R')
    i.line(9, 1, 6, 6, 'n').line(12, 1, 8, 6, 'n').line(3, 4, 4, 6, 'S').line(6, 3, 6, 5, 'S')
    return i


@icon('rice')
def _(i):
    i.circle(7.5, 7, 5, 'w').circle(7.5, 9, 6, 'b').rect(0, 0, 15, 8, '.').circle(7.5, 7, 5, 'w').rect(0, 9, 15, 15, '.').circle(7.5, 9, 6, 'b').rect(0, 0, 15, 8, '.').rect(2, 7, 13, 8, 'w').rect(3, 5, 12, 6, 'w').rect(5, 4, 10, 4, 'w')
    return i


@icon('dumpling')
def _(i):
    i.circle(7.5, 9, 6, 'e').rect(0, 11, 15, 15, '.').rect(1, 10, 14, 12, 'e').rect(1, 12, 14, 12, 'S')
    for x in range(3, 13, 2):
        i.px(x, 4 + abs(x - 7) // 3, 'S')
    return i


@icon('mooncake')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'Y').circle(7.5, 7.5, 5, 'y').ring(7.5, 7.5, 3, 'Y').px(7, 7, 'Y')
    return i


@icon('shrimp')
def _(i):
    i.ring(7, 8, 5, 'o', 3).rect(0, 0, 6, 15, '.').tri(6, 13, 2, 15, 3, 11, 'o').rect(8, 1, 10, 3, 'o')
    return i


@icon('pizza')
def _(i):
    i.tri(1, 2, 14, 2, 7.5, 14, 'y').rect(1, 1, 14, 2, 'n').circle(5, 5, 1.2, 'r').circle(9, 6, 1.2, 'r').circle(7, 9, 1, 'r')
    return i


@icon('burger')
def _(i):
    i.circle(7.5, 6, 6, 'o').rect(0, 6, 15, 15, '.').rect(1, 6, 14, 7, 'g').rect(1, 8, 14, 9, 'N').rect(1, 10, 14, 10, 'y').rect(1, 11, 14, 13, 'o').px(5, 3, 'e').px(9, 2, 'e')
    return i


@icon('can')
def _(i):
    i.rect(3, 2, 12, 14, 'S').rect(3, 5, 12, 11, 'r').rect(5, 7, 10, 9, 'w')
    return i


@icon('plate')
def _(i):
    i.circle(7.5, 8, 5, 'w').circle(7.5, 8, 3.4, 'S').rect(0, 2, 0, 13, 'd').rect(15, 2, 15, 13, 'd')
    return i


@icon('chopsticks')
def _(i):
    i.line(2, 1, 12, 14, 'n', 2).line(6, 1, 14, 12, 'N', 2)
    return i


@icon('cooking')
def _(i):
    i.circle(6.5, 8, 5.6, 'D').rect(11, 7, 15, 8, 'D').circle(6.5, 8, 2.6, 'w').circle(6.5, 8, 1.4, 'y')
    return i


# ───────── Clothing ─────────

@icon('shirt')
def _(i):
    i.rect(4, 2, 11, 14, 'c').tri(4, 2, 0, 6, 3, 8, 'c').tri(11, 2, 15, 6, 12, 8, 'c').rect(6, 2, 9, 3, '.').rect(6, 2, 9, 2, '.')
    return i


@icon('coat')
def _(i):
    i.rect(3, 2, 12, 14, 'n').tri(3, 2, 0, 12, 3, 12, 'n').tri(12, 2, 15, 12, 12, 12, 'n').line(7, 2, 7, 14, 'N').tri(5, 2, 7, 2, 7, 7, 'e').tri(10, 2, 8, 2, 8, 7, 'e').px(9, 9, 'y').px(9, 12, 'y')
    return i


@icon('vest')
def _(i):
    i.rect(3, 2, 12, 14, 'o').rect(6, 1, 9, 6, '.').rect(3, 9, 12, 10, 'y')
    return i


@icon('dress')
def _(i):
    i.rect(5, 1, 10, 6, 'p').tri(5, 6, 10, 6, 1, 15, 'p').tri(5, 6, 10, 6, 14, 15, 'p').rect(1, 14, 14, 15, 'P').rect(5, 6, 10, 7, 'P')
    return i


@icon('jeans')
def _(i):
    i.rect(3, 1, 12, 5, 'b').rect(3, 5, 7, 14, 'b').rect(8, 5, 12, 14, 'b').rect(3, 1, 12, 2, 'B').px(7, 5, 'B')
    return i


@icon('shorts')
def _(i):
    i.rect(3, 3, 12, 7, 'g').rect(2, 7, 7, 11, 'g').rect(8, 7, 13, 11, 'g').rect(3, 3, 12, 4, 'G')
    return i


@icon('scarf')
def _(i):
    i.ring(7.5, 5, 4.4, 'r', 2.4).rect(8, 7, 11, 15, 'r').rect(8, 10, 11, 10, 'w').rect(8, 13, 11, 13, 'w')
    return i


@icon('shoe')
def _(i):
    i.rect(1, 8, 14, 12, 'r').rect(1, 4, 7, 8, 'r').rect(1, 12, 14, 13, 'w').rect(3, 6, 6, 6, 'w').rect(4, 8, 7, 8, 'w')
    return i


@icon('dressshoe')
def _(i):
    i.rect(1, 8, 14, 11, 'N').rect(1, 5, 6, 8, 'N').rect(1, 12, 14, 12, 'u').rect(9, 8, 12, 9, 'n')
    return i


@icon('cap')
def _(i):
    i.circle(7.5, 9, 5.5, 'b').rect(0, 9, 15, 15, '.').rect(2, 9, 15, 10, 'B').px(7, 3, 'w')
    return i


@icon('tophat')
def _(i):
    i.rect(4, 2, 11, 11, 'u').rect(1, 11, 14, 13, 'u').rect(4, 9, 11, 10, 'r')
    return i


@icon('gradcap')
def _(i):
    i.tri(0, 6, 7.5, 2, 15, 6, 'u').tri(0, 6, 7.5, 10, 15, 6, 'u').rect(4, 8, 11, 12, 'u').line(13, 6, 13, 12, 'y').rect(12, 12, 14, 13, 'y')
    return i


@icon('sunhat')
def _(i):
    i.circle(7.5, 8, 4, 'e').rect(0, 9, 15, 15, '.').rect(0, 9, 15, 11, 'e').rect(4, 7, 11, 8, 'r')
    return i


@icon('helmet')
def _(i):
    i.circle(7.5, 9, 6, 'w').rect(0, 10, 15, 15, '.').rect(1, 10, 14, 11, 'w').rect(7, 4, 8, 9, 'r').rect(5, 6, 10, 7, 'r')
    return i


@icon('glasses')
def _(i):
    i.ring(4, 8, 3, 'u').ring(11, 8, 3, 'u').circle(4, 8, 2, 'l').circle(11, 8, 2, 'l').rect(7, 7, 8, 7, 'u').rect(0, 6, 1, 6, 'u').rect(14, 6, 15, 6, 'u')
    return i


@icon('shades')
def _(i):
    i.rect(1, 6, 6, 10, 'u').rect(9, 6, 14, 10, 'u').rect(6, 7, 9, 7, 'u').px(2, 7, 'd').px(10, 7, 'd')
    return i


@icon('yarn')
def _(i):
    i.circle(7.5, 7.5, 6, 'p').line(3, 3, 12, 12, 'P').line(2, 7, 9, 14, 'P').line(6, 2, 13, 9, 'P')
    return i


# ───────── Play ─────────

@icon('gamepad')
def _(i):
    rbox(i, 1, 4, 14, 11, 'D').circle(3, 11, 2.4, 'D').circle(12, 11, 2.4, 'D').rect(3, 7, 5, 7, 'w').rect(4, 6, 4, 8, 'w').px(10, 6, 'r').px(12, 8, 'g').px(11, 7, 'y')
    return i


@icon('joystick')
def _(i):
    i.rect(1, 10, 14, 14, 'D').rect(7, 4, 8, 10, 'd').circle(7.5, 3, 2.6, 'r').px(11, 12, 'y').px(4, 12, 'g')
    return i


@icon('dice')
def _(i):
    rbox(i, 1, 1, 14, 14, 'w')
    for x, y in ((4, 4), (10, 4), (7, 7), (4, 10), (10, 10)):
        i.rect(x, y, x + 1, y + 1, 'r')
    return i


@icon('cards')
def _(i):
    i.rect(1, 3, 9, 14, 'w').rect(6, 1, 14, 12, 'w').rect(8, 3, 9, 4, 'r').circle(10, 7, 1.4, 'r').rect(2, 5, 3, 6, 'u')
    return i


@icon('yoyo')
def _(i):
    i.circle(8, 10, 5, 'r').ring(8, 10, 2, 'R').line(8, 0, 8, 6, 'd')
    return i


@icon('rollercoaster')
def _(i):
    i.line(0, 12, 4, 3, 'r', 2).line(4, 3, 9, 11, 'r', 2).line(9, 11, 15, 5, 'r', 2).rect(1, 8, 2, 4, 'r').rect(3, 7, 7, 9, 'y')
    for x in (2, 6, 10, 13):
        i.rect(x, 12, x, 15, 'd')
    return i


@icon('slide')
def _(i):
    i.rect(2, 2, 3, 15, 'd').rect(2, 2, 6, 3, 'r').line(6, 3, 14, 13, 'y', 2)
    for y in (6, 9, 12):
        i.rect(1, y, 4, y, 'S')
    return i


@icon('teddy')
def _(i):
    i.circle(7.5, 10, 4.6, 'n').circle(7.5, 4.5, 3.4, 'n').circle(4, 2, 1.6, 'n').circle(11, 2, 1.6, 'n').circle(7.5, 5.5, 1.4, 'e').px(6, 3, 'u').px(9, 3, 'u').circle(7.5, 10.5, 2.2, 'e')
    return i


@icon('film')
def _(i):
    i.rect(1, 6, 14, 14, 'u').line(1, 2, 14, 1, 'u', 3).rect(3, 8, 12, 12, 'D')
    for x in (3, 7, 11):
        i.line(x, 2, x + 2, 1, 'w')
    return i


@icon('masks')
def _(i):
    i.circle(5, 6, 4.4, 'y').circle(10.5, 9, 4.4, 'v').px(3, 5, 'u').px(6, 5, 'u').rect(4, 8, 6, 8, 'u').px(9, 8, 'u').px(12, 8, 'u').rect(9, 11, 12, 11, 'u')
    return i


@icon('palette')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'e').circle(11, 10, 1.6, '.').circle(4, 5, 1.2, 'r').circle(7.5, 3.5, 1.2, 'y').circle(11, 5, 1.2, 'b').circle(4.5, 9.5, 1.2, 'g')
    return i


@icon('paintbrush')
def _(i):
    i.line(13, 1, 7, 9, 'n', 2).rect(5, 9, 8, 11, 'S').tri(2, 15, 5, 11, 8, 12, 'r')
    return i


@icon('picture')
def _(i):
    i.rect(1, 2, 14, 13, 'n').rect(2, 3, 13, 12, 'l').tri(2, 12, 7, 6, 11, 12, 'g').circle(11, 5, 1.4, 'y')
    return i


@icon('couch')
def _(i):
    i.rect(2, 4, 13, 9, 'r').rect(0, 7, 2, 12, 'R').rect(13, 7, 15, 12, 'R').rect(2, 9, 13, 12, 'r').rect(2, 9, 13, 9, 'R').rect(1, 13, 1, 14, 'N').rect(14, 13, 14, 14, 'N')
    return i


@icon('bed')
def _(i):
    i.rect(0, 4, 1, 14, 'n').rect(1, 8, 15, 12, 'b').rect(2, 6, 5, 8, 'w').rect(14, 9, 15, 14, 'n')
    return i


@icon('chair')
def _(i):
    i.rect(4, 1, 11, 7, 'n').rect(3, 8, 12, 9, 'N').rect(4, 10, 4, 15, 'N').rect(11, 10, 11, 15, 'N')
    return i


@icon('bath')
def _(i):
    i.rect(1, 7, 14, 11, 'w').rect(3, 12, 4, 14, 'd').rect(11, 12, 12, 14, 'd').rect(1, 2, 3, 7, 'S').rect(3, 2, 5, 2, 'S').rect(2, 7, 13, 7, 'l')
    return i


@icon('cabinet')
def _(i):
    i.rect(3, 1, 12, 14, 'd').rect(4, 2, 11, 6, 'S').rect(4, 8, 11, 13, 'S').rect(6, 4, 9, 4, 'D').rect(6, 10, 9, 10, 'D')
    return i


@icon('candle')
def _(i):
    i.rect(5, 6, 10, 14, 'e').tri(7.5, 1, 6, 5, 9, 5, 'o').px(7, 4, 'y').rect(5, 6, 10, 6, 'S')
    return i


# ───────── People / faces ─────────

def face(i, mood):
    i.circle(7.5, 7.5, 6.6, 'y')
    i.rect(5, 5, 5, 6, 'u').rect(10, 5, 10, 6, 'u')
    if mood == 'smile':
        i.px(4, 9, 'u').rect(5, 10, 10, 10, 'u').px(11, 9, 'u')
    elif mood == 'grin':
        i.rect(4, 9, 11, 9, 'u').rect(5, 10, 10, 11, 'w').rect(5, 12, 10, 12, 'u').px(4, 10, 'u').px(11, 10, 'u')
    elif mood == 'neutral':
        i.rect(5, 10, 10, 10, 'u')
    elif mood == 'worried':
        i.px(4, 4, 'u').px(11, 4, 'u').rect(5, 10, 10, 10, 'u').px(4, 11, 'u').px(11, 11, 'u')
    elif mood == 'sad':
        i.rect(5, 10, 10, 10, 'u').px(4, 11, 'u').px(11, 11, 'u').rect(4, 7, 4, 8, 'l')
    elif mood == 'grimace':
        i.rect(4, 9, 11, 12, 'u').rect(5, 10, 10, 11, 'w').rect(7, 10, 7, 11, 'd')
    elif mood == 'wow':
        i.circle(7.5, 10.5, 1.6, 'u')
    elif mood == 'think':
        i.rect(6, 10, 10, 10, 'u').rect(2, 11, 5, 13, 's')
    elif mood == 'party':
        i.px(4, 9, 'u').rect(5, 10, 10, 10, 'u').px(11, 9, 'u').tri(9, 1, 14, 0, 13, 5, 'v').px(13, 1, 'y')
    elif mood == 'scream':
        i.circle(7.5, 10.5, 2, 'u').rect(1, 6, 2, 11, 's').rect(13, 6, 14, 11, 's')
    return i


for _m in ('smile', 'grin', 'neutral', 'worried', 'sad', 'grimace', 'wow', 'think', 'party', 'scream'):
    D['face_' + _m] = (lambda m: (lambda: face(Icon(), m).done()))(_m)


def person(i, shirt='b', hair='u', skin='s', hat=None, old=False, kid=False):
    top = 3 if kid else 1
    i.circle(7.5, top + 3, 3, skin).rect(4, top, 11, top + 1, hair if not old else 'S')
    i.rect(3, top + 7, 12, 15, shirt).px(6, top + 3, 'u').px(9, top + 3, 'u')
    if hat == 'chef':
        i.rect(4, top - 1, 11, top + 1, 'w')
    if hat == 'police':
        i.rect(3, top, 12, top + 1, 'B').px(7, top, 'y')
    return i


D['person'] = lambda: person(Icon()).done()
D['woman'] = lambda: person(Icon(), shirt='p', hair='N').rect(3, 2, 4, 7, 'N').rect(11, 2, 12, 7, 'N').done()
D['elder'] = lambda: person(Icon(), shirt='v', old=True).done()
D['child'] = lambda: person(Icon(), shirt='o', kid=True).done()
D['chef'] = lambda: person(Icon(), shirt='w', hat='chef').done()
D['police'] = lambda: person(Icon(), shirt='B', hat='police').done()
D['suit'] = lambda: person(Icon(), shirt='u').rect(7, 9, 8, 15, 'w').px(7, 10, 'r').done()
D['hero'] = lambda: person(Icon(), shirt='r').rect(6, 10, 9, 12, 'y').done()
D['spy'] = lambda: person(Icon(), shirt='D').rect(2, 0, 13, 2, 'D').rect(4, 4, 11, 4, 'u').done()


@icon('family')
def _(i):
    i.circle(4, 4, 2.4, 's').rect(1, 7, 7, 14, 'b').circle(11, 4, 2.4, 's').rect(8, 7, 14, 14, 'p').circle(7.5, 9, 1.8, 's').rect(6, 11, 9, 15, 'y')
    return i


@icon('runner')
def _(i):
    i.circle(9, 2.5, 2, 's').line(9, 5, 7, 9, 'r', 2).line(7, 9, 3, 13, 'b', 2).line(7, 9, 11, 13, 'b', 2).line(8, 6, 4, 6, 'r').line(9, 6, 12, 8, 'r')
    return i


@icon('swimmer')
def _(i):
    i.circle(4, 5, 2, 's').line(5, 7, 12, 5, 's', 2).rect(0, 10, 15, 14, 'b').rect(2, 9, 13, 9, 'l')
    return i


@icon('lifter')
def _(i):
    i.rect(0, 2, 15, 2, 'D').rect(0, 0, 1, 4, 'D').rect(14, 0, 15, 4, 'D').circle(7.5, 5, 2, 's').line(4, 3, 6, 7, 's').line(11, 3, 9, 7, 's').rect(5, 7, 10, 11, 'r').rect(5, 12, 6, 15, 'b').rect(9, 12, 10, 15, 'b')
    return i


@icon('ball')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'w').rect(6, 6, 9, 9, 'u').px(3, 4, 'u').px(12, 4, 'u').px(4, 12, 'u').px(11, 12, 'u')
    return i


@icon('wavehand')
def _(i):
    i.rect(4, 6, 11, 13, 's').rect(4, 2, 5, 6, 's').rect(6, 1, 7, 6, 's').rect(8, 2, 9, 6, 's').rect(10, 3, 11, 6, 's').line(11, 9, 14, 6, 's', 2)
    return i


@icon('handshake')
def _(i):
    i.rect(0, 4, 3, 10, 'b').rect(12, 4, 15, 10, 'r').rect(3, 6, 12, 10, 's').rect(5, 7, 10, 7, 'o')
    return i


@icon('muscle')
def _(i):
    i.circle(9, 7, 4, 's').rect(1, 9, 9, 13, 's').rect(10, 1, 12, 4, 's')
    return i


@icon('point')
def _(i):
    i.rect(1, 6, 8, 11, 's').rect(8, 6, 14, 7, 's').rect(1, 6, 2, 11, 'b')
    return i


@icon('footprints')
def _(i):
    i.circle(4, 5, 2, 'n').circle(4, 9, 1.2, 'n').circle(11, 8, 2, 'n').circle(11, 12, 1.2, 'n')
    return i


@icon('brain')
def _(i):
    i.circle(5, 7, 4.4, 'p').circle(10, 7, 4.4, 'p').line(7, 3, 7, 12, 'P').line(3, 6, 5, 8, 'P').line(10, 5, 12, 8, 'P')
    return i


@icon('medical')
def _(i):
    rbox(i, 1, 1, 14, 14, 'w').rect(6, 3, 9, 12, 'r').rect(3, 6, 12, 9, 'r')
    return i


@icon('stethoscope')
def _(i):
    i.ring(6, 6, 4, 'D').rect(1, 0, 11, 5, '.').line(6, 10, 9, 13, 'D').circle(11.5, 11.5, 2.4, 'S').rect(1, 1, 2, 2, 'D').rect(10, 1, 11, 2, 'D')
    return i


@icon('toothbrush')
def _(i):
    i.line(1, 14, 10, 5, 'b', 2).rect(10, 2, 14, 5, 'w').rect(10, 5, 14, 5, 'l')
    return i


@icon('wheelchair')
def _(i):
    i.circle(5, 2, 1.6, 'b').rect(4, 4, 5, 9, 'b').rect(5, 8, 10, 9, 'b').rect(10, 9, 11, 13, 'b').ring(6, 11, 3.6, 'b')
    return i


# ───────── Animals ─────────

@icon('paw')
def _(i):
    i.circle(7.5, 10.5, 3.6, 'n').circle(3, 6, 1.6, 'n').circle(6, 3, 1.6, 'n').circle(9.5, 3, 1.6, 'n').circle(12.5, 6, 1.6, 'n')
    return i


@icon('dog')
def _(i):
    i.circle(7.5, 8, 5.4, 'o').rect(1, 3, 3, 9, 'N').rect(12, 3, 14, 9, 'N').px(5, 7, 'u').px(10, 7, 'u').rect(6, 10, 9, 12, 'e').rect(7, 10, 8, 10, 'u')
    return i


@icon('cat')
def _(i):
    i.circle(7.5, 9, 5.4, 'S').tri(2, 1, 2, 7, 6, 5, 'S').tri(13, 1, 13, 7, 9, 5, 'S').px(5, 8, 'g').px(10, 8, 'g').px(7, 11, 'p').px(8, 11, 'p')
    return i


@icon('rabbit')
def _(i):
    i.circle(7.5, 10, 4.6, 'w').rect(4, 0, 6, 6, 'w').rect(9, 0, 11, 6, 'w').rect(5, 1, 5, 5, 'p').rect(10, 1, 10, 5, 'p').px(6, 9, 'u').px(9, 9, 'u')
    return i


@icon('hamster')
def _(i):
    i.circle(7.5, 9, 5.6, 'o').circle(3, 4, 1.6, 'o').circle(12, 4, 1.6, 'o').circle(7.5, 11, 3, 'e').px(5, 8, 'u').px(10, 8, 'u')
    return i


@icon('bird')
def _(i):
    i.circle(6, 8, 4.6, 'g').circle(10, 5, 2.6, 'g').tri(12, 4, 15, 5, 12, 6, 'y').px(10, 4, 'u').tri(1, 7, 6, 8, 2, 12, 'G')
    return i


@icon('dove')
def _(i):
    i.circle(7, 9, 4, 'w').circle(11, 6, 2.2, 'w').tri(13, 5, 15, 6, 13, 7, 'y').tri(4, 8, 9, 8, 2, 1, 'S').px(11, 5, 'u')
    return i


@icon('fish')
def _(i):
    i.circle(7, 8, 4.6, 'b').rect(3, 6, 11, 10, 'b').tri(11, 8, 15, 4, 15, 12, 'b').px(4, 7, 'w').rect(6, 6, 6, 10, 'l')
    return i


@icon('tropfish')
def _(i):
    i.circle(7, 8, 4.6, 'o').rect(3, 6, 11, 10, 'o').tri(11, 8, 15, 4, 15, 12, 'o').px(4, 7, 'u').rect(6, 4, 7, 12, 'w')
    return i


@icon('bone')
def _(i):
    i.line(4, 11, 11, 4, 'e', 2).circle(3, 11, 1.6, 'e').circle(5, 13, 1.6, 'e').circle(11, 3, 1.6, 'e').circle(13, 5, 1.6, 'e')
    return i


@icon('lion')
def _(i):
    i.circle(7.5, 7.5, 6.6, 'o').circle(7.5, 8, 4.4, 'y').px(6, 7, 'u').px(9, 7, 'u').rect(7, 10, 8, 10, 'N')
    return i


@icon('bull')
def _(i):
    i.circle(7.5, 8.5, 5, 'n').line(1, 3, 3, 5, 'e', 2).line(14, 3, 12, 5, 'e', 2).rect(5, 10, 10, 13, 'p').px(6, 7, 'u').px(9, 7, 'u').px(6, 11, 'u').px(9, 11, 'u')
    return i


@icon('bear')
def _(i):
    i.circle(7.5, 8.5, 5.6, 'N').circle(3, 3, 2, 'N').circle(12, 3, 2, 'N').circle(7.5, 10.5, 2.4, 'n').px(5, 7, 'u').px(10, 7, 'u').px(7, 10, 'u')
    return i


@icon('horse')
def _(i):
    i.rect(5, 2, 10, 14, 'n').rect(8, 9, 12, 14, 'n').rect(4, 2, 5, 10, 'N').px(8, 5, 'u').tri(6, 2, 8, 0, 8, 2, 'n')
    return i


@icon('turtle')
def _(i):
    i.circle(7, 9, 5, 'G').rect(0, 10, 15, 15, '.').rect(2, 9, 12, 10, 'g').circle(13, 8, 1.8, 'g').rect(3, 11, 4, 12, 'g').rect(10, 11, 11, 12, 'g').line(5, 5, 9, 9, 'g')
    return i


@icon('unicorn')
def _(i):
    i.circle(7.5, 9.5, 5, 'w').line(9, 4, 12, 0, 'y', 2).rect(3, 6, 5, 13, 'v').px(9, 9, 'u').rect(9, 12, 11, 12, 'p')
    return i


@icon('bug')
def _(i):
    i.circle(7.5, 9, 5, 'r').rect(7, 4, 8, 14, 'u').circle(7.5, 4, 2.4, 'u').px(5, 8, 'u').px(10, 8, 'u').px(5, 11, 'u').px(10, 11, 'u')
    return i


@icon('bee')
def _(i):
    i.circle(7.5, 9, 4.6, 'y').rect(5, 5, 5, 13, 'u').rect(9, 5, 9, 13, 'u').circle(5, 3.5, 2, 'l').circle(10, 3.5, 2, 'l')
    return i


@icon('turkey')
def _(i):
    i.circle(7.5, 7, 6.4, 'o').circle(7.5, 7, 4.6, 'r').circle(7.5, 10, 3.6, 'n').circle(7.5, 5.5, 2, 'n').px(7, 5, 'u').rect(8, 6, 8, 7, 'r')
    return i


@icon('mirror')
def _(i):
    i.circle(7.5, 6.5, 5.6, 'y').circle(7.5, 6.5, 4.4, 'l').rect(7, 12, 8, 15, 'y').line(5, 4, 7, 2, 'w')
    return i


@icon('jar')
def _(i):
    i.rect(3, 4, 12, 14, 'l').rect(4, 1, 11, 3, 'S').rect(4, 7, 11, 11, 'w')
    return i


@icon('chains')
def _(i):
    for k in range(3):
        i.ring(3 + k * 4.5, 3 + k * 4.5, 2.6, 'd')
    return i


@icon('trap')
def _(i):
    i.rect(1, 8, 14, 13, 'n').ring(7.5, 8, 5, 'S').rect(0, 9, 15, 15, '.').rect(1, 9, 14, 13, 'n').circle(4, 7, 1.2, 'y')
    return i


@icon('placard')
def _(i):
    i.rect(1, 1, 14, 9, 'w').rect(3, 3, 12, 3, 'd').rect(3, 6, 9, 6, 'd').rect(7, 9, 8, 15, 'n')
    return i


@icon('hut')
def _(i):
    i.tri(7.5, 1, 0, 8, 15, 8, 'y').rect(2, 8, 13, 14, 'n').rect(6, 10, 9, 14, 'N')
    return i


@icon('night')
def _(i):
    i.rect(0, 0, 15, 15, 'B').circle(11, 4, 2.4, 'y').circle(12, 3, 2, 'B').px(3, 2, 'w').px(6, 5, 'w').px(2, 7, 'w').rect(1, 10, 4, 15, 'D').rect(5, 8, 9, 15, 'u').rect(10, 11, 14, 15, 'D').px(6, 10, 'y').px(12, 13, 'y')
    return i


@icon('hotsprings')
def _(i):
    i.circle(7.5, 12, 4, 'b').rect(0, 13, 15, 15, '.').rect(3, 12, 12, 13, 'b')
    for x in (4, 7, 10):
        i.line(x, 9, x + 1, 6, 'r').line(x + 1, 6, x, 3, 'r')
    return i


@icon('elevator')
def _(i):
    i.rect(2, 1, 13, 14, 'S').rect(3, 3, 7, 14, 'd').rect(8, 3, 12, 14, 'd').tri(7.5, 0, 6, 2, 9, 2, 'g')
    return i


@icon('printer')
def _(i):
    i.rect(1, 6, 14, 11, 'S').rect(4, 1, 11, 6, 'w').rect(4, 10, 11, 14, 'w').rect(5, 12, 10, 12, 'd').px(12, 7, 'g')
    return i


@icon('keyboard')
def _(i):
    i.rect(0, 4, 15, 11, 'D')
    for y in (5, 7):
        for x in range(1, 15, 2):
            i.px(x, y, 'S')
    i.rect(4, 9, 11, 9, 'S')
    return i


@icon('pause')
def _(i):
    rbox(i, 1, 1, 14, 14, 'b').rect(4, 4, 6, 11, 'w').rect(9, 4, 11, 11, 'w')
    return i


@icon('minus')
def _(i):
    i.rect(2, 6, 13, 9, 'D')
    return i


@icon('arrow_up')
def _(i):
    i.tri(7.5, 1, 1, 8, 14, 8, 'g').rect(5, 8, 10, 14, 'g')
    return i


@icon('triangle_up')
def _(i):
    i.tri(7.5, 3, 2, 12, 13, 12, 'r')
    return i


@icon('refresh')
def _(i):
    i.ring(7.5, 7.5, 5.6, 'b', 2).rect(0, 6, 4, 9, '.').tri(10, 0, 14, 3, 10, 6, 'b').tri(5, 9, 1, 12, 5, 15, 'b')
    return i


@icon('slider')
def _(i):
    for y, x in ((3, 10), (8, 4), (13, 8)):
        i.rect(1, y, 14, y, 'd').rect(x - 1, y - 2, x + 1, y + 2, 'b')
    return i


@icon('luggage')
def _(i):
    rbox(i, 2, 4, 13, 14, 'b').rect(5, 1, 10, 2, 'D').rect(5, 3, 5, 4, 'D').rect(10, 3, 10, 4, 'D').rect(2, 8, 13, 8, 'B').rect(6, 5, 9, 6, 'y')
    return i


@icon('ten')
def _(i):
    rbox(i, 0, 1, 15, 14, 'b').rect(3, 4, 4, 11, 'w').px(2, 5, 'w').rect(7, 4, 12, 11, 'w').rect(9, 6, 10, 9, 'b')
    return i


@icon('diamondshape')
def _(i):
    i.tri(7.5, 0, 0, 7.5, 15, 7.5, 'l').tri(7.5, 15, 0, 7.5, 15, 7.5, 'l').circle(7.5, 7.5, 2, 'b')
    return i


def square(c):
    return lambda: rbox(Icon(), 2, 2, 13, 13, c).done()


def dot(c):
    return lambda: Icon().circle(7.5, 7.5, 6, c).done()


D['sq_green'] = square('g')
D['dot_blue'] = dot('b')
D['dot_yellow'] = dot('y')
D['dot_green'] = dot('g')

# Regional indicator letters: little country-code tiles (no national flags drawn)
FONT5 = {
    'B': ['1110', '1001', '1110', '1001', '1110'],
    'E': ['1111', '1000', '1110', '1000', '1111'],
    'G': ['0111', '1000', '1011', '1001', '0111'],
    'H': ['1001', '1001', '1111', '1001', '1001'],
    'J': ['0011', '0001', '0001', '1001', '0110'],
    'K': ['1001', '1010', '1100', '1010', '1001'],
    'P': ['1110', '1001', '1110', '1000', '1000'],
    'S': ['0111', '1000', '0110', '0001', '1110'],
    'U': ['1001', '1001', '1001', '1001', '0110'],
}


def letter_tile(ch):
    def f():
        i = rbox(Icon(), 1, 2, 14, 13, 'B')
        rows = FONT5[ch]
        for y, row in enumerate(rows):
            for x, v in enumerate(row):
                if v == '1':
                    i.rect(4 + x * 2, 3 + y * 2, 5 + x * 2, 4 + y * 2, 'w')
        return i.done()
    return f


for _ch in FONT5:
    D['letter_' + _ch] = letter_tile(_ch)
