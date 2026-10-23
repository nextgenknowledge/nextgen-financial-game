"""
Builds app/fonts/fin-icons.woff: a colour (COLR/CPAL) font that draws Fin City's own pixel icons
in place of emoji characters. The game lists it first in every font stack with a unicode-range
covering only these characters, so wherever text contains one of them the custom icon is shown
instead of the system emoji.

Usage (needs fontTools):  python3 tools/icons/build_icon_font.py [--preview out.png]
"""
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(__file__))
from designs import D, PALETTE  # noqa: E402

# Every emoji character used anywhere in the game -> the icon that replaces it
MAP = {
    '✅': 'check', '✔': 'check', '☑': 'check', '❌': 'cross', '⚠': 'warn', '🛑': 'stop', '❓': 'question',
    '⭐': 'star', '🌟': 'star', '★': 'star', '✨': 'sparkle', '🏆': 'trophy', '🏅': 'medal', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal', '🎖': 'medal', '👑': 'crown',
    '🪙': 'coin', '💵': 'cash', '💶': 'euro', '💷': 'pound', '💸': 'wings', '💳': 'card', '🪪': 'idcard', '🐷': 'piggy', '💰': 'moneybag', '💎': 'gem', '💠': 'diamondshape',
    '💱': 'exchange', '📈': 'chart_up', '💹': 'chart_up', '📉': 'chart_down', '📊': 'bars', '🧾': 'receipt', '⚖': 'scales', '🧮': 'abacus',
    '🏦': 'bank', '🏛': 'bank', '🏧': 'bank', '🏢': 'office', '🏙': 'city', '🌃': 'night', '🏠': 'house', '🏡': 'house', '🏘': 'house', '🛖': 'hut', '🏪': 'shop', '🏫': 'school', '🏨': 'hotel',
    '🏗': 'construction', '🗼': 'landmark', '🗽': 'landmark', '🗿': 'landmark', '🌉': 'bridge', '🏮': 'lantern', '🎡': 'ferris', '🎢': 'rollercoaster', '🛝': 'slide', '🚪': 'door', '🛗': 'elevator', '🌀': 'portal',
    '🔒': 'lock', '🔐': 'lock', '⛓': 'chains', '🔓': 'unlock', '🔑': 'key', '💡': 'bulb', '📱': 'phone', '🖥': 'computer', '💻': 'laptop', '📺': 'tv', '🖨': 'printer', '⌨': 'keyboard', '🤖': 'robot',
    '⚙': 'gear', '🔧': 'wrench', '🔨': 'hammer', '💾': 'floppy', '🔋': 'battery', '⚡': 'bolt', '📦': 'package', '🎁': 'gift', '🎀': 'ribbon', '🎗': 'ribbon', '🎈': 'balloon', '🎉': 'party', '🥳': 'face_party', '🎆': 'fireworks',
    '💝': 'heart', '💙': 'heart_blue', '💛': 'heart_gold', '💔': 'heart_broken', '💼': 'briefcase', '🛍': 'bags', '🎒': 'backpack', '🧳': 'luggage', '🛒': 'cart', '🧺': 'basket',
    '🎟': 'ticket', '🏷': 'label', '🪧': 'placard', '📝': 'memo', '✏': 'pencil', '🖍': 'pencil', '✂': 'scissors', '📐': 'ruler', '📄': 'page', '📋': 'clipboard', '📜': 'scroll', '📚': 'books', '📖': 'book', '📕': 'closedbook', '📒': 'closedbook',
    '📰': 'newspaper', '📅': 'calendar', '🗓': 'calendar', '⏱': 'stopwatch', '⏳': 'hourglass', '⌚': 'watch', '🎤': 'mic', '🎧': 'headphones', '🎵': 'music', '🎺': 'music', '🎹': 'music', '📣': 'megaphone', '🔊': 'speaker',
    '🛡': 'shield', '⛑': 'helmet', '🎯': 'target', '🔍': 'search', '🗑': 'trash', '🧹': 'broom', '📥': 'inbox', '📤': 'outbox', '✉': 'envelope', '💬': 'speech',
    '🗺': 'map', '🧭': 'compass', '📍': 'pin', '📌': 'pushpin', '🚩': 'flag', '🏁': 'chequered', '🌍': 'globe', '🌏': 'globe', '🌐': 'globe',
    '🚀': 'rocket', '✈': 'plane', '🛩': 'plane', '🚁': 'helicopter', '🚗': 'car', '🏎': 'car', '🚙': 'suv', '🛻': 'truck', '🚚': 'truck', '🚒': 'truck', '🚌': 'bus', '🚆': 'train', '🚇': 'train', '🚄': 'train',
    '🚲': 'bike', '🚴': 'bike', '🛴': 'scooter', '🛵': 'scooter', '⛵': 'boat', '🛶': 'boat', '🚤': 'boat', '🚢': 'ship', '⚓': 'anchor',
    '☂': 'umbrella', '☔': 'umbrella', '☀': 'sun', '🌤': 'suncloud', '⛅': 'suncloud', '☁': 'cloud', '🌧': 'rain', '⛈': 'storm', '🌨': 'snow', '❄': 'snow', '🌫': 'fog', '🌪': 'tornado', '🌙': 'moon',
    '💧': 'drop', '🌊': 'wave', '♨': 'hotsprings', '🔥': 'fire', '💥': 'boom', '🧊': 'ice', '🌱': 'seedling', '🌳': 'tree', '🌴': 'palm', '🏖': 'palm', '🌷': 'flower', '🌻': 'sunflower', '🪴': 'potplant',
    '🍎': 'apple', '🍐': 'pear', '🍊': 'orange', '🍋': 'lemon', '🍌': 'banana', '🍇': 'grapes', '🥕': 'carrot', '🥦': 'broccoli', '🌽': 'corn', '🥒': 'leafy', '🍆': 'veg', '🥬': 'leafy', '🌶': 'pepper',
    '🍞': 'bread', '🥐': 'croissant', '🥯': 'bread', '🧀': 'cheese', '🥚': 'egg', '🧈': 'butter', '🍪': 'cookie', '🧁': 'cupcake', '🍫': 'chocolate', '🍦': 'icecream', '🍯': 'honey',
    '☕': 'coffee', '🍵': 'tea', '🥤': 'drink', '🧋': 'bubbletea', '🥛': 'milk', '🧃': 'juicebox', '🍜': 'bowl', '🥣': 'bowl', '🍝': 'bowl', '🍚': 'rice', '🥟': 'dumpling', '🥮': 'mooncake', '🍤': 'shrimp',
    '🍕': 'pizza', '🍔': 'burger', '🥫': 'can', '🍽': 'plate', '🥢': 'chopsticks', '🍳': 'cooking', '🫙': 'jar',
    '👕': 'shirt', '🧥': 'coat', '🦺': 'vest', '👗': 'dress', '👖': 'jeans', '🩳': 'shorts', '🧣': 'scarf', '👟': 'shoe', '👞': 'dressshoe', '🧢': 'cap', '🎩': 'tophat', '🎓': 'gradcap', '👒': 'sunhat',
    '👓': 'glasses', '🕶': 'shades', '🧶': 'yarn', '🪞': 'mirror',
    '🎮': 'gamepad', '🕹': 'joystick', '🎲': 'dice', '🃏': 'cards', '🪀': 'yoyo', '🧸': 'teddy', '⚽': 'ball', '🎬': 'film', '🎭': 'masks', '🎨': 'palette', '🖌': 'paintbrush', '🖼': 'picture',
    '🛋': 'couch', '🛏': 'bed', '🪑': 'chair', '🛁': 'bath', '🗄': 'cabinet', '🕯': 'candle', '🎃': 'lantern', '🪥': 'toothbrush', '🪤': 'trap',
    '😀': 'face_grin', '😄': 'face_grin', '😊': 'face_smile', '🙂': 'face_smile', '😐': 'face_neutral', '😟': 'face_worried', '😬': 'face_grimace', '😢': 'face_sad', '😮': 'face_wow', '😱': 'face_scream', '🤔': 'face_think',
    '🧑': 'person', '👩': 'woman', '🧓': 'elder', '👵': 'elder', '🧒': 'child', '🤵': 'suit', '👮': 'police', '🕵': 'spy', '🦸': 'hero', '👪': 'family',
    '🏃': 'runner', '🏊': 'swimmer', '🏋': 'lifter', '👋': 'wavehand', '🤝': 'handshake', '💪': 'muscle', '👉': 'point', '👣': 'footprints', '🧠': 'brain', '🩺': 'stethoscope', '♿': 'wheelchair',
    '🐾': 'paw', '🐶': 'dog', '🐕': 'dog', '🐱': 'cat', '🐰': 'rabbit', '🐹': 'hamster', '🦜': 'bird', '🕊': 'dove', '🐟': 'fish', '🐠': 'tropfish', '🦴': 'bone', '🦁': 'lion', '🐂': 'bull', '🐻': 'bear',
    '🐴': 'horse', '🐢': 'turtle', '🦄': 'unicorn', '🐞': 'bug', '🐝': 'bee', '🦃': 'turkey',
    '🟩': 'sq_green', '🔵': 'dot_blue', '🟡': 'dot_yellow', '🟢': 'dot_green', '⏸': 'pause', '➖': 'minus', '⬆': 'arrow_up', '🔼': 'triangle_up', '🔁': 'refresh', '🎚': 'slider', '🔟': 'ten',
    '🇧': 'letter_B', '🇪': 'letter_E', '🇬': 'letter_G', '🇭': 'letter_H', '🇯': 'letter_J', '🇰': 'letter_K', '🇵': 'letter_P', '🇸': 'letter_S', '🇺': 'letter_U',
}

# Invisible helpers inside emoji sequences: variation selector and zero-width joiner
ZERO_WIDTH = [0xFE0F, 0x200D]

PX = 100          # font units per pixel
UPM = 1600        # 16 px = 1 em
ADV = 1840        # a little breathing room either side
BASE = -270       # icon bottom sits slightly below the baseline, like emoji


def rects_for(grid, colour):
    """Merge each row's runs of `colour` into rectangles (font units, y up)."""
    out = []
    for y in range(16):
        x = 0
        while x < 16:
            if grid[y][x] == colour:
                x0 = x
                while x < 16 and grid[y][x] == colour:
                    x += 1
                out.append((x0, y, x, y + 1))
            else:
                x += 1
    return out


def build(path, preview=None):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    colours = list(PALETTE.items())
    pal_index = {k: n for n, (k, _) in enumerate(colours)}
    used = sorted(set(MAP.values()))
    missing = [n for n in used if n not in D]
    if missing:
        raise SystemExit(f'missing designs: {missing}')
    grids = {n: D[n]() for n in used}

    glyph_order = ['.notdef', 'zw']
    glyphs = {}
    metrics = {'.notdef': (ADV, 0), 'zw': (0, 0)}
    layers = {}

    def draw(rects):
        pen = TTGlyphPen(None)
        off = (ADV - 16 * PX) // 2
        for x0, y0, x1, y1 in rects:
            X0, X1 = off + x0 * PX, off + x1 * PX
            Y1, Y0 = BASE + (16 - y0) * PX, BASE + (16 - y1) * PX
            pen.moveTo((X0, Y0))
            pen.lineTo((X0, Y1))
            pen.lineTo((X1, Y1))
            pen.lineTo((X1, Y0))
            pen.closePath()
        return pen.glyph()

    glyphs['.notdef'] = draw([])
    glyphs['zw'] = draw([])
    for name, grid in grids.items():
        base = f'i_{name}'
        all_px = [(x, y, x + 1, y + 1) for y in range(16) for x in range(16) if grid[y][x] != '.']
        glyphs[base] = draw(all_px)
        metrics[base] = (ADV, 0)
        glyph_order.append(base)
        lay = []
        for key, _ in colours:
            r = rects_for(grid, key)
            if not r:
                continue
            g = f'{base}.{key}'
            glyphs[g] = draw(r)
            metrics[g] = (ADV, 0)
            glyph_order.append(g)
            lay.append((g, pal_index[key]))
        layers[base] = lay

    cmap = {ord(ch): f'i_{name}' for ch, name in MAP.items()}
    for cp in ZERO_WIDTH:
        cmap[cp] = 'zw'

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=1360, descent=-300)
    fb.setupNameTable({'familyName': 'FinIcons', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=1360, sTypoDescender=-300, usWinAscent=1360, usWinDescent=300)
    fb.setupPost()
    fb.setupCOLR(layers)
    fb.setupCPAL([[hex_to_rgba(v) for _, v in colours]])
    fb.font.flavor = 'woff'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fb.save(path)
    print(f'wrote {path}: {len(used)} icons for {len(MAP)} characters')
    if preview:
        write_preview(preview, used, grids)
    return sorted(cmap)


def hex_to_rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, 1.0)


def write_preview(path, names, grids, scale=4, cols=16):
    """Contact sheet PNG of every icon (for reviewing the designs)."""
    cell = 18 * scale
    rows = (len(names) + cols - 1) // cols
    W, H = cols * cell, rows * cell
    img = [[(242, 236, 220)] * W for _ in range(H)]
    for n, name in enumerate(names):
        ox, oy = (n % cols) * cell + scale, (n // cols) * cell + scale
        g = grids[name]
        for y in range(16):
            for x in range(16):
                c = g[y][x]
                if c == '.':
                    continue
                h = PALETTE[c].lstrip('#')
                rgb = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
                for dy in range(scale):
                    for dx in range(scale):
                        img[oy + y * scale + dy][ox + x * scale + dx] = rgb
    raw = b''.join(b'\x00' + bytes(v for px in row for v in px) for row in img)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)
    print(f'preview {path}')


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', '..', 'app', 'fonts', 'fin-icons.woff')
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    cps = build(os.path.normpath(out), prev)
    # unicode-range for the @font-face rule
    print('U+' + ',U+'.join(f'{c:X}' for c in cps))
