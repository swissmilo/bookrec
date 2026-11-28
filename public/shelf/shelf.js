(() => {
  let THREE;
  let RoomEnvironment;

  const BAYS = 2;
  const BAY_W = 0.78;
  const CELL_W = BAY_W - 0.024;
  const BOARD = 0.03;
  const ROW_H = 0.31;
  const DEPTH = 0.3;
  const PLINTH = 0.1;
  const EDGE = 0.012;
  const BOOK_GAP = 0.0008;
  const GROUP_GAP = 0.04;
  const LABEL_W = 0.16;
  const INCH = 0.0254;
  const LAMP_Z = DEPTH / 2 + 0.3;
  const LAMP_DROP = 0.7;

  const FILLERS = [
    {
      kind: 'frame',
      width: 0.22,
      firstShelf: true,
      hoverTurn: 0.24,
      modal: 'about',
    },
    {
      kind: 'record',
      width: 0.24,
      minSlot: 2,
      hoverTurn: 0.3,
      modal: 'music',
    },
    {
      kind: 'toy',
      width: 0.15,
      minSlot: 4,
      hoverTurn: -0.6,
      modal: 'arcade',
    },
    {
      kind: 'globe',
      width: 0.23,
      minSlot: 2,
      hoverTurn: 0,
      focus: 'globe',
    },
  ];
  const ATLAS_URL =
    'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
  const GLOBE_IDLE_SPIN = 0.07;

  const PALETTE = [
    '#7a1f1f',
    '#1f3a5f',
    '#2f4f3a',
    '#3b2a4a',
    '#c9a227',
    '#e8e0cf',
    '#1c1c1c',
    '#b5532a',
    '#4a6670',
    '#8a8f6a',
    '#d8c7a0',
    '#5a2d2d',
    '#234b4b',
    '#a33b3b',
    '#2b2b45',
    '#c46a2b',
    '#f2efe6',
    '#35506b',
  ];
  const FONTS = [
    'Georgia, "Times New Roman", serif',
    '"Helvetica Neue", Arial, sans-serif',
    '"Gill Sans", "Trebuchet MS", sans-serif',
    '"Didot", "Bodoni MT", Georgia, serif',
  ];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (
      (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
    );
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function toTexture(canvas, renderer) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function prepareBook(raw) {
    const { clamp } = THREE.MathUtils;
    const r = rng(hash(raw.name));
    const random = {
      color: r(),
      t: r(),
      h: r(),
      d: r(),
      inset: r(),
      ink: r(),
      font: r(),
    };
    const color =
      raw.color || PALETTE[Math.floor(random.color * PALETTE.length)];
    const fallbackInk =
      luminance(color) > 0.55
        ? '#1d1a16'
        : random.ink > 0.5
          ? '#f1e7d0'
          : '#d9b45a';
    const inkOk =
      raw.inkColor &&
      Math.abs(luminance(raw.inkColor) - luminance(color)) > 0.35;
    const thickness = raw.thicknessIn
      ? raw.thicknessIn * INCH
      : raw.pages
        ? 0.006 + raw.pages * 0.00006
        : 0.022 + random.t * 0.03;
    const asin = (raw.link || '').match(/\/dp\/([A-Z0-9]{10})/);
    return {
      name: raw.name,
      shortName: raw.name
        .split(':')[0]
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .trim(),
      author: raw.author || '',
      category: raw.category,
      link: raw.link,
      highlightsId: raw.highlightsId || (asin ? asin[1] : null),
      highlight: raw.highlight,
      reader: raw.reader,
      t: clamp(thickness, 0.009, 0.07),
      h: clamp(
        raw.heightIn ? raw.heightIn * INCH : 0.19 + random.h * 0.06,
        0.15,
        0.285
      ),
      d: clamp(
        raw.widthIn ? raw.widthIn * INCH : 0.13 + random.d * 0.04,
        0.1,
        0.21
      ),
      inset: random.inset * 0.015,
      color,
      ink: inkOk ? raw.inkColor : fallbackInk,
      font: FONTS[Math.floor(random.font * FONTS.length)],
    };
  }

  function layout(books) {
    const framed = FILLERS.find((f) => f.firstShelf);
    for (const reserveSlot of [0, 1]) {
      const result = arrange(books, reserveSlot, framed.width + 0.07);
      if (
        result.objects.some(
          (o) => o.firstShelf && o.slot === reserveSlot && o.x > framed.width
        )
      )
        return result;
    }
    return arrange(books, -1, 0);
  }

  function arrange(books, reserveSlot, reserveWidth) {
    const capacity = (s) => CELL_W - (s === reserveSlot ? reserveWidth : 0);
    const groups = [];
    for (const b of books) {
      const last = groups[groups.length - 1];
      if (last && last.category === b.category) last.books.push(b);
      else groups.push({ category: b.category, books: [b] });
    }
    for (const g of groups) {
      g.span = Math.max(
        LABEL_W + 0.02,
        g.books.reduce((sum, b) => sum + b.t + BOOK_GAP, 0)
      );
      g.long = g.span > CELL_W;
    }

    let slot = 0;
    let x = 0;
    const used = [];
    const labels = [];
    const objects = [];
    const advance = () => {
      used[slot] = x;
      slot++;
      x = 0;
    };
    const place = (g) => {
      if (g.long) {
        while (x > 0 || slot % BAYS !== 0) advance();
      } else {
        while (x + (x > 0 ? GROUP_GAP : 0) + g.span > capacity(slot)) advance();
      }
      if (x > 0) x += GROUP_GAP;
      if (g.filler) {
        objects.push({ ...g.filler, slot, x: x + g.span / 2 });
        x += g.span;
        used[slot] = x;
        return;
      }
      const start = x;
      const labelSlot = slot;
      labels.push({ text: g.category, slot, x });
      for (const b of g.books) {
        if (x + b.t > capacity(slot)) advance();
        b.slot = slot;
        b.x = x + b.t / 2;
        x += b.t + BOOK_GAP;
      }
      if (slot === labelSlot) x = Math.max(x, start + LABEL_W + 0.02);
      used[slot] = x;
    };

    const widest = (list) => list.reduce((a, b) => (b.span > a.span ? b : a));
    const pending = groups.filter((g) => !/shortlist/i.test(g.category));
    for (const g of groups) if (!pending.includes(g)) place(g);
    for (const filler of FILLERS) {
      if (!filler.firstShelf)
        pending.push({ filler, span: filler.width + 0.03, long: false });
    }
    while (pending.length) {
      const free = capacity(slot) - x - (x > 0 ? GROUP_GAP : 0);
      const ready = pending.filter(
        (g) => !g.filler || slot >= g.filler.minSlot
      );
      const longs = ready.filter((g) => g.long);
      const fits = ready.filter((g) => !g.long && g.span <= free);
      const shorts = ready.filter((g) => !g.long && !g.filler);
      let pick;
      if (x === 0 && slot % BAYS === 0 && longs.length) pick = widest(longs);
      else if (fits.length) pick = widest(fits);
      else if ((slot + 1) % BAYS === 0 && longs.length) pick = widest(longs);
      else if (shorts.length || longs.length)
        pick = widest(shorts.length ? shorts : longs);
      else pick = pending[0];
      pending.splice(pending.indexOf(pick), 1);
      place(pick);
    }

    const rows = Math.ceil((slot + 1) / BAYS);
    const framed = FILLERS.find((f) => f.firstShelf);
    for (let s = Math.max(0, reserveSlot); s < rows * BAYS; s++) {
      const at = used[s] || 0;
      const lead = at > 0 ? 0.05 : 0.02;
      if (CELL_W - at >= lead + framed.width + 0.01) {
        objects.push({ ...framed, slot: s, x: at + lead + framed.width / 2 });
        used[s] = at + lead + framed.width;
        break;
      }
    }
    const occupied = new Set(objects.map((o) => o.slot));
    const bookends = [];
    for (let s = 0; s < rows * BAYS; s++) {
      if (!occupied.has(s) && used[s] > 0 && CELL_W - used[s] > 0.09)
        bookends.push({ slot: s, x: used[s] + 0.004 });
    }
    return { rows, labels, objects, bookends };
  }

  function woodTexture(renderer, base, seed, strength = 1) {
    const c = makeCanvas(1024, 256);
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 700; i++) {
      const y = r() * c.height;
      const amp = 1 + r() * 4;
      const freq = 0.002 + r() * 0.006;
      const phase = r() * 6.28;
      g.strokeStyle =
        r() > 0.5
          ? `rgba(20,10,4,${(0.03 + r() * 0.1) * strength})`
          : `rgba(255,210,160,${(0.015 + r() * 0.04) * strength})`;
      g.lineWidth = 0.5 + r() * 1.5;
      g.beginPath();
      for (let px = 0; px <= c.width; px += 16) {
        const py = y + Math.sin(px * freq + phase) * amp;
        if (px === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    const t = toTexture(c, renderer);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function spineTexture(b, renderer) {
    const H = 512;
    const W = Math.max(40, Math.round((H * b.t) / b.h));
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = b.color;
    g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.32)');
    grad.addColorStop(0.22, 'rgba(255,255,255,0.07)');
    grad.addColorStop(0.78, 'rgba(255,255,255,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    g.fillStyle = b.ink;
    g.globalAlpha = 0.75;
    g.fillRect(0, 24, W, 3);
    g.fillRect(0, 32, W, 1);
    g.fillRect(0, H - 27, W, 3);
    g.fillRect(0, H - 33, W, 1);
    g.globalAlpha = 1;

    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(Math.PI / 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fs = Math.min(W * 0.52, 34);
    g.font = `bold ${fs}px ${b.font}`;
    while (g.measureText(b.shortName).width > 300 && fs > 9) {
      fs -= 1;
      g.font = `bold ${fs}px ${b.font}`;
    }
    g.fillText(b.shortName, -52, 1);
    const surname = (
      b.author.split(',')[0].trim().split(' ').pop() || ''
    ).toUpperCase();
    let as = Math.min(W * 0.3, 15);
    g.font = `${as}px "Helvetica Neue", Arial, sans-serif`;
    while (g.measureText(surname).width > 96 && as > 7) {
      as -= 1;
      g.font = `${as}px "Helvetica Neue", Arial, sans-serif`;
    }
    g.globalAlpha = 0.85;
    g.fillText(surname, 166, 1);
    g.restore();
    return toTexture(c, renderer);
  }

  function wrapText(g, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (g.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function coverTexture(b, renderer) {
    const W = 512;
    const H = Math.round((W * b.h) / b.d);
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = b.color;
    g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(0.06, 'rgba(0,0,0,0.05)');
    grad.addColorStop(0.09, 'rgba(255,255,255,0.08)');
    grad.addColorStop(0.14, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = b.ink;
    g.globalAlpha = 0.6;
    g.lineWidth = 3;
    g.strokeRect(46, 34, W - 80, H - 68);
    g.globalAlpha = 1;

    g.fillStyle = b.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fs = 54;
    let lines;
    do {
      g.font = `bold ${fs}px ${b.font}`;
      lines = wrapText(g, b.shortName, W - 140);
      fs -= 3;
    } while (
      (lines.length > 5 ||
        lines.some((l) => g.measureText(l).width > W - 130)) &&
      fs > 20
    );
    const lh = (fs + 3) * 1.18;
    const cx = W / 2 + 6;
    const top = H * 0.36 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, cx, top + i * lh));

    g.globalAlpha = 0.8;
    g.fillRect(cx - 40, H * 0.66, 80, 2);
    g.font = `26px "Helvetica Neue", Arial, sans-serif`;
    wrapText(g, b.author, W - 150)
      .slice(0, 2)
      .forEach((l, i) => g.fillText(l, cx, H * 0.74 + i * 34));
    return toTexture(c, renderer);
  }

  function brassLabel(text, renderer) {
    const c = makeCanvas(512, 72);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 72);
    grad.addColorStop(0, '#e2c98a');
    grad.addColorStop(0.5, '#b9974c');
    grad.addColorStop(1, '#8d6f31');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 72);
    g.strokeStyle = 'rgba(60,40,10,0.6)';
    g.lineWidth = 3;
    g.strokeRect(4, 4, 504, 64);
    g.fillStyle = '#2c1f0c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fs = 34;
    g.font = `600 ${fs}px "Helvetica Neue", Arial, sans-serif`;
    while (g.measureText(text.toUpperCase()).width > 470 && fs > 14) {
      fs -= 1;
      g.font = `600 ${fs}px "Helvetica Neue", Arial, sans-serif`;
    }
    g.fillText(text.toUpperCase(), 256, 38);
    return toTexture(c, renderer);
  }

  function portraitTexture(renderer) {
    const t = new THREE.TextureLoader().load('/shelf/portrait.jpg');
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function buildFrame(renderer) {
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
      color: '#a8842f',
      metalness: 0.7,
      roughness: 0.35,
    });
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.25, 0.018),
      gold
    );
    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(0.166, 0.226),
      new THREE.MeshStandardMaterial({ color: '#f1ead9', roughness: 0.9 })
    );
    mat.position.z = 0.0092;
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.1875),
      new THREE.MeshStandardMaterial({
        map: portraitTexture(renderer),
        roughness: 0.4,
      })
    );
    photo.position.z = 0.0096;
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.2, 0.006),
      new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 0.8 })
    );
    stand.position.set(0, -0.02, -0.04);
    stand.rotation.x = 0.38;
    group.add(outer, mat, photo, stand);
    outer.position.y = mat.position.y = photo.position.y = 0.125;
    stand.position.y += 0.125;
    const tilt = new THREE.Group();
    tilt.add(group);
    group.rotation.x = -0.16;
    tilt.rotation.y = -0.18;
    return tilt;
  }

  function chestWood(renderer, seed, vertical) {
    const map = woodTexture(renderer, '#6f4424', seed, 2.2);
    const g = map.image.getContext('2d');
    const r = rng(seed + 1);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(35,18,6,${0.12 + r() * 0.25})`;
      g.fillRect(r() * 1024, r() * 256, 4 + r() * 22, 1);
    }
    for (const y of [0, 85, 171]) {
      g.fillStyle = 'rgba(18,9,3,0.9)';
      g.fillRect(0, y, 1024, 3);
      g.fillStyle = 'rgba(255,220,170,0.14)';
      g.fillRect(0, y + 3, 1024, 2);
    }
    map.repeat.set(0.3, 1);
    if (vertical) {
      map.center.set(0.5, 0.5);
      map.rotation = Math.PI / 2;
      map.repeat.set(0.3, 1.5);
    }
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap: map,
      bumpScale: 1.4,
      roughness: 0.88,
    });
  }

  function buildChest(renderer) {
    const W = 0.12;
    const D = 0.076;
    const H = 0.048;
    const R = D / 2;
    const chest = new THREE.Group();

    const wood = chestWood(renderer, 131, false);
    const lidWood = chestWood(renderer, 137, true);
    const brass = new THREE.MeshStandardMaterial({
      color: '#a8874a',
      metalness: 0.5,
      roughness: 0.62,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#17110c',
      roughness: 0.7,
    });

    const part = (geo, material, x, y, z, parent = chest) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    part(new THREE.BoxGeometry(W + 0.001, H, D), wood, 0, H / 2, 0);
    part(
      new THREE.BoxGeometry(W + 0.003, 0.005, D + 0.003),
      brass,
      0,
      0.0025,
      0
    );
    part(
      new THREE.BoxGeometry(W + 0.003, 0.004, D + 0.003),
      brass,
      0,
      H - 0.002,
      0
    );

    const lid = new THREE.Group();
    lid.position.y = H;
    lid.scale.y = 0.72;
    chest.add(lid);
    part(
      new THREE.CylinderGeometry(R, R, W + 0.001, 48),
      [lidWood, wood, wood],
      0,
      0,
      0,
      lid
    ).rotation.z = Math.PI / 2;

    for (const x of [-W * 0.3, W * 0.3]) {
      part(new THREE.BoxGeometry(0.01, H, D + 0.0026), brass, x, H / 2, 0);
      part(
        new THREE.CylinderGeometry(R + 0.0013, R + 0.0013, 0.01, 48),
        brass,
        x,
        0,
        0,
        lid
      ).rotation.z = Math.PI / 2;
      for (const y of [H * 0.3, H * 0.7]) {
        part(
          new THREE.SphereGeometry(0.0017, 12, 8),
          brass,
          x,
          y,
          D / 2 + 0.0015
        );
      }
    }
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - 0.002);
      part(new THREE.BoxGeometry(0.004, H, D + 0.0026), brass, x, H / 2, 0);
      part(
        new THREE.CylinderGeometry(R + 0.0013, R + 0.0013, 0.004, 48),
        brass,
        x,
        0,
        0,
        lid
      ).rotation.z = Math.PI / 2;
    }

    part(
      new THREE.BoxGeometry(0.019, 0.024, 0.004),
      brass,
      0,
      H - 0.007,
      D / 2 + 0.0016
    );
    part(
      new THREE.BoxGeometry(0.009, 0.013, 0.0032),
      brass,
      0,
      H + 0.005,
      D / 2 + 0.0008
    );
    part(
      new THREE.CircleGeometry(0.0022, 16),
      dark,
      0,
      H - 0.009,
      D / 2 + 0.0038
    );
    part(
      new THREE.PlaneGeometry(0.0018, 0.0055),
      dark,
      0,
      H - 0.0125,
      D / 2 + 0.0038
    );

    return chest;
  }

  function buildToy(renderer) {
    const group = new THREE.Group();
    group.add(buildChest(renderer));
    return group;
  }

  function sleeveTexture(renderer) {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    const paper = g.createLinearGradient(0, 0, 0, 512);
    paper.addColorStop(0, '#efe7d6');
    paper.addColorStop(1, '#e2d6bd');
    g.fillStyle = paper;
    g.fillRect(0, 0, 512, 512);

    g.fillStyle = '#1b1a1d';
    g.textAlign = 'center';
    g.font = 'italic 30px "Didot", "Bodoni MT", Georgia, serif';
    g.fillText('almost', 256, 112);
    g.font = '600 68px "Didot", "Bodoni MT", Georgia, serif';
    g.fillText('CLASSICAL', 256, 182);
    g.fillRect(206, 208, 100, 2);
    g.font = '19px "Helvetica Neue", Arial, sans-serif';
    g.fillText('M O D E R N   P I A N O', 256, 246);

    const top = 318;
    const keys = 10;
    const kw = 512 / keys;
    g.fillStyle = '#fbf8f0';
    g.fillRect(0, top, 512, 512 - top);
    g.fillStyle = '#1b1a1d';
    g.fillRect(0, top, 512, 4);
    for (let i = 1; i < keys; i++) g.fillRect(i * kw - 1, top, 2, 512 - top);
    for (const i of [1, 2, 4, 5, 6, 8, 9])
      g.fillRect(i * kw - kw * 0.3, top, kw * 0.6, (512 - top) * 0.62);
    return toTexture(c, renderer);
  }

  function vinylTexture(renderer) {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = '#2b2b30';
    g.fillRect(0, 0, 512, 512);
    for (let radius = 96; radius < 250; radius += 3) {
      g.strokeStyle =
        radius % 9 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(256, 256, radius, 0, Math.PI * 2);
      g.stroke();
    }
    for (const angle of [-0.9, 2.25]) {
      const sheen = g.createConicGradient(angle, 256, 256);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.06, 'rgba(255,255,255,0.28)');
      sheen.addColorStop(0.12, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen;
      g.beginPath();
      g.arc(256, 256, 250, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#e2d6bd';
    g.beginPath();
    g.arc(256, 256, 84, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1a1d';
    g.beginPath();
    g.arc(256, 256, 8, 0, Math.PI * 2);
    g.fill();
    return toTexture(c, renderer);
  }

  function buildRecord(renderer) {
    const S = 0.19;
    const lean = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({
      color: '#d8cfb8',
      roughness: 0.9,
    });
    const art = new THREE.MeshStandardMaterial({
      map: sleeveTexture(renderer),
      roughness: 0.75,
    });
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(S, S, 0.004), [
      card,
      card,
      card,
      card,
      art,
      card,
    ]);
    sleeve.position.set(-0.02, S / 2, 0);
    const vinyl = new THREE.MeshStandardMaterial({
      map: vinylTexture(renderer),
      roughness: 0.35,
      metalness: 0.2,
    });
    const edge = new THREE.MeshStandardMaterial({
      color: '#2b2b30',
      roughness: 0.4,
    });
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.0018, 64),
      [edge, vinyl, vinyl]
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0.05, S / 2, -0.0005);
    lean.add(sleeve, disc);
    lean.rotation.x = -0.2;
    const group = new THREE.Group();
    group.add(lean);
    group.rotation.y = -0.12;
    return group;
  }

  function decodeAtlas(topology) {
    const { scale, translate } = topology.transform;
    const arcs = topology.arcs.map((arc) => {
      let x = 0;
      let y = 0;
      return arc.map(([dx, dy]) => {
        x += dx;
        y += dy;
        return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
      });
    });
    const ring = (indexes) => {
      const points = [];
      for (const i of indexes) {
        const arc = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
        points.push(...(points.length ? arc.slice(1) : arc));
      }
      return points;
    };
    return topology.objects.countries.geometries.map((g) => ({
      id: Number(g.id),
      polygons: (g.type === 'Polygon' ? [g.arcs] : g.arcs).map((polygon) =>
        polygon.map(ring)
      ),
    }));
  }

  function drawGlobeMap(canvas, countries, visited) {
    const W = canvas.width;
    const H = canvas.height;
    const g = canvas.getContext('2d');
    const px = (lon) => ((lon + 180) / 360) * W;
    const py = (lat) => ((90 - lat) / 180) * H;
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#93aaa6');
    sea.addColorStop(0.5, '#7f9a9a');
    sea.addColorStop(1, '#93aaa6');
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = 'rgba(55, 45, 25, 0.16)';
    g.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) {
      g.beginPath();
      g.moveTo(px(lon), 0);
      g.lineTo(px(lon), H);
      g.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      g.beginPath();
      g.moveTo(0, py(lat));
      g.lineTo(W, py(lat));
      g.stroke();
    }

    const been = new Set(Object.values(visited.countries));
    g.lineJoin = 'round';
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(70, 48, 22, 0.5)';
    for (const country of countries) {
      g.fillStyle = been.has(country.id) ? '#cb8c55' : '#e2d5ae';
      for (const polygon of country.polygons) {
        g.beginPath();
        for (const points of polygon) {
          points.forEach(([lon, lat], i) => {
            if (i === 0) g.moveTo(px(lon), py(lat));
            else g.lineTo(px(lon), py(lat));
          });
          g.closePath();
        }
        g.fill('evenodd');
        g.stroke();
      }
    }

    g.fillStyle = '#cb8c55';
    g.strokeStyle = 'rgba(50, 30, 12, 0.85)';
    g.lineWidth = 1.5;
    for (const [lat, lon] of Object.values(visited.pins)) {
      g.beginPath();
      g.arc(px(lon), py(lat), 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  function drawGlobeGlow(canvas, countries, visited) {
    const W = canvas.width;
    const H = canvas.height;
    const g = canvas.getContext('2d');
    const px = (lon) => ((lon + 180) / 360) * W;
    const py = (lat) => ((90 - lat) / 180) * H;
    const been = new Set(Object.values(visited.countries));
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffb45c';
    for (const country of countries) {
      if (!been.has(country.id)) continue;
      for (const polygon of country.polygons) {
        g.beginPath();
        for (const points of polygon) {
          points.forEach(([lon, lat], i) => {
            if (i === 0) g.moveTo(px(lon), py(lat));
            else g.lineTo(px(lon), py(lat));
          });
          g.closePath();
        }
        g.fill('evenodd');
      }
    }
    for (const [lat, lon] of Object.values(visited.pins)) {
      g.beginPath();
      g.arc(px(lon), py(lat), 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function buildGlobe(renderer) {
    const R = 0.092;
    const ring = R + 0.007;
    const center = 0.038 + ring;
    const canvas = makeCanvas(2048, 1024);
    const g = canvas.getContext('2d');
    g.fillStyle = '#7f9a9a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const map = toTexture(canvas, renderer);
    const glowCanvas = makeCanvas(1024, 512);
    const glowMap = toTexture(glowCanvas, renderer);
    const brass = new THREE.MeshStandardMaterial({
      color: '#b08a3c',
      metalness: 0.8,
      roughness: 0.35,
    });

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 48),
      new THREE.MeshStandardMaterial({
        map,
        roughness: 0.6,
        emissive: '#ffffff',
        emissiveMap: glowMap,
        emissiveIntensity: 0,
      })
    );
    sphere.name = 'globe';
    sphere.rotation.y = -1.75;
    const meridian = new THREE.Mesh(
      new THREE.TorusGeometry(ring, 0.0022, 10, 64, Math.PI),
      brass
    );
    meridian.rotation.z = -Math.PI / 2;
    const axis = new THREE.Group();
    axis.add(sphere, meridian);
    for (const side of [-1, 1]) {
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0022, 0.0022, 0.012, 12),
        brass
      );
      pin.position.y = side * (R + 0.004);
      axis.add(pin);
    }
    axis.rotation.z = -0.41;
    axis.position.y = center;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.058, 0.008, 48),
      brass
    );
    base.position.y = 0.004;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.007, 0.032, 16),
      brass
    );
    stem.position.y = 0.008 + 0.016;

    const group = new THREE.Group();
    group.add(axis, base, stem);

    Promise.all([
      fetch(ATLAS_URL).then((r) => r.json()),
      fetch('/shelf/visited.json').then((r) => r.json()),
    ])
      .then(([topology, visited]) => {
        const countries = decodeAtlas(topology);
        drawGlobeMap(canvas, countries, visited);
        drawGlobeGlow(glowCanvas, countries, visited);
        map.needsUpdate = true;
        glowMap.needsUpdate = true;
      })
      .catch(() => {});
    return group;
  }

  function buildChain() {
    const brass = new THREE.MeshStandardMaterial({
      color: '#c9a557',
      metalness: 0.9,
      roughness: 0.3,
    });
    const chain = new THREE.Group();
    const bead = new THREE.SphereGeometry(0.0028, 10, 8);
    const beads = 7;
    const pitch = 0.0066;
    for (let i = 0; i < beads; i++) {
      const m = new THREE.Mesh(bead, brass);
      m.position.y = -i * pitch;
      chain.add(m);
    }
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0028, 0.0068, 0.02, 16),
      brass
    );
    knob.position.y = -beads * pitch - 0.007;
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = knob.position.y + 0.012;
    chain.add(knob, hit);
    chain.userData = { kind: 'chain' };
    return chain;
  }

  function buildPaperPlane() {
    const geo = new THREE.BufferGeometry();
    const nose = [0, 0, 0.042];
    const tail = [0, 0, -0.036];
    const keel = [0, -0.013, -0.036];
    const left = [-0.03, 0.005, -0.036];
    const right = [0.03, 0.005, -0.036];
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [nose, tail, left, nose, right, tail, nose, keel, tail].flat(),
        3
      )
    );
    geo.computeVertexNormals();
    const plane = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: '#f4efe2',
        roughness: 0.9,
        side: THREE.DoubleSide,
        flatShading: true,
      })
    );
    plane.castShadow = true;
    plane.visible = false;
    return plane;
  }

  function crackTexture(renderer, seed) {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    const r = rng(seed);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const branch = (x, y, angle, length, width) => {
      const points = [[x, y]];
      for (let step = 0; step < length; step += 14) {
        angle += (r() - 0.5) * 1.1;
        x += Math.cos(angle) * 14;
        y += Math.sin(angle) * 14;
        points.push([x, y]);
        if (width > 1.2 && r() < 0.22)
          branch(x, y, angle + (r() - 0.5) * 2, length * 0.45, width * 0.6);
      }
      for (const [color, shift, scale] of [
        ['rgba(255, 226, 190, 0.22)', 1.5, 1],
        ['rgba(14, 7, 3, 0.92)', 0, 1],
      ]) {
        g.strokeStyle = color;
        g.lineWidth = width * scale;
        g.beginPath();
        points.forEach(([px, py], i) => {
          if (i === 0) g.moveTo(px + shift, py + shift);
          else g.lineTo(px + shift, py + shift);
        });
        g.stroke();
      }
    };
    const rays = 5 + Math.floor(r() * 3);
    for (let i = 0; i < rays; i++) {
      branch(128, 128, (i / rays) * Math.PI * 2 + r(), 70 + r() * 45, 3.2);
    }
    return toTexture(c, renderer);
  }

  const SKY_VERTEX = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const SKY_FRAGMENT = `
    uniform float time;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    vec3 curtain(vec2 uv, float seed, float base, vec3 low, vec3 high) {
      float x = uv.x * 9.0 + seed * 17.0;
      float edge = base
        + 0.035 * sin(x * 0.9 + time * 0.21 + seed)
        + 0.02 * sin(x * 2.3 - time * 0.33 + seed * 3.0)
        + 0.012 * noise(vec2(x * 1.7, time * 0.25 + seed));
      float rise = uv.y - edge;
      float rays = 0.25 + 0.75 * noise(vec2(x * 14.0 + time * 0.5, seed + time * 0.12));
      float reach = 0.035 + 0.05 * noise(vec2(x * 1.3 - time * 0.1, seed * 5.0));
      float glow = smoothstep(-0.006, 0.004, rise) * exp(-max(rise, 0.0) / reach);
      float drift = 0.55 + 0.45 * noise(vec2(x * 0.6 + time * 0.08, seed * 9.0));
      vec3 tint = mix(low, high, clamp(rise / (reach * 1.6), 0.0, 1.0));
      return tint * glow * rays * drift;
    }
    void main() {
      vec3 color = mix(vec3(0.004, 0.012, 0.035), vec3(0.002, 0.004, 0.014), vUv.y);
      vec2 grid = vUv * vec2(260.0, 188.0);
      vec2 cell = floor(grid);
      float star = hash(cell);
      if (star > 0.985) {
        vec2 offset = fract(grid) - 0.5 - 0.3 * (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5);
        float twinkle = 0.6 + 0.4 * sin(time * (1.0 + 3.0 * hash(cell + 1.3)) + star * 90.0);
        color += vec3(0.85, 0.9, 1.0) * smoothstep(0.22, 0.0, length(offset)) * twinkle;
      }
      color += curtain(vUv, 1.0, 0.37, vec3(0.1, 0.95, 0.5), vec3(0.05, 0.5, 0.75)) * 0.34;
      color += curtain(vUv, 2.0, 0.42, vec3(0.1, 0.8, 0.75), vec3(0.35, 0.25, 0.85)) * 0.26;
      color += curtain(vUv, 3.0, 0.47, vec3(0.2, 0.75, 0.6), vec3(0.5, 0.2, 0.7)) * 0.2;
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  function haloTexture(renderer) {
    const c = makeCanvas(128, 256);
    const g = c.getContext('2d');
    g.translate(64, 128);
    g.scale(1, 2);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, 64);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(0.25, 'rgba(255, 255, 255, 0.35)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = glow;
    g.fillRect(-64, -64, 128, 128);
    return toTexture(c, renderer);
  }

  function auroraTexture(renderer) {
    const W = 1024;
    const H = 512;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const r = rng(2025);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#02030b');
    sky.addColorStop(0.7, '#06142a');
    sky.addColorStop(1, '#0b2436');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      g.fillStyle = `rgba(255, 255, 255, ${0.25 + r() * 0.75})`;
      const s = r() < 0.08 ? 1.8 : 0.9;
      g.fillRect(r() * W, r() * H * 0.9, s, s);
    }
    g.globalCompositeOperation = 'lighter';
    const ribbons = [
      ['90, 255, 170', 0.3, 0.5],
      ['60, 220, 210', 0.42, 0.42],
      ['150, 110, 255', 0.22, 0.3],
    ];
    for (const [rgb, base, alpha] of ribbons) {
      const phase = r() * 6;
      for (let x = 0; x < W; x += 3) {
        const u = x / W;
        const top =
          H *
          (base +
            0.09 * Math.sin(u * 7 + phase) +
            0.05 * Math.sin(u * 19 + phase * 2));
        const length = H * (0.3 + 0.14 * Math.sin(u * 11 + phase * 3));
        const strength =
          alpha * (0.55 + 0.45 * Math.sin(u * 43 + phase) * Math.sin(u * 5));
        const streak = g.createLinearGradient(0, top, 0, top + length);
        streak.addColorStop(0, `rgba(${rgb}, 0)`);
        streak.addColorStop(0.18, `rgba(${rgb}, ${Math.max(0.03, strength)})`);
        streak.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = streak;
        g.fillRect(x, top, 3, length);
      }
    }
    return toTexture(c, renderer);
  }

  function createReader(onClose) {
    const root = document.getElementById('reader');
    const page = root.querySelector('.reader-page');
    const buy = root.querySelector('.reader-buy');
    let book = null;
    let loading = null;
    let at = -1;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    };

    function recall() {
      try {
        const saved = localStorage.getItem('reader-chapter');
        return saved === null ? -1 : Number(saved) || 0;
      } catch (error) {
        return -1;
      }
    }

    function remember(index) {
      try {
        localStorage.setItem('reader-chapter', String(index));
      } catch (error) {
        return;
      }
    }

    function link(label, index, className) {
      const b = el('button', className, label);
      b.type = 'button';
      b.addEventListener('click', () => show(index));
      return b;
    }

    function paragraph(block) {
      const p = el('p');
      const runs = typeof block === 'string' ? [[block, '']] : block.runs;
      for (const [text, flags] of runs) {
        const tag = flags.includes('b')
          ? 'strong'
          : flags.includes('i')
            ? 'em'
            : null;
        const holder = tag ? el(tag) : p;
        text.split('\n').forEach((line, i) => {
          if (i) holder.append(el('br'));
          holder.append(line);
        });
        if (tag) p.append(holder);
      }
      return p;
    }

    function show(index) {
      at = Math.max(-1, Math.min(book.chapters.length - 1, index));
      remember(at);
      page.replaceChildren();
      if (at < 0) {
        page.append(
          el('div', 'reader-kicker', 'Short stories'),
          el('h1', '', book.title),
          el('div', 'reader-author', `by ${book.author}`),
          el('div', 'reader-sep', '❦')
        );
        const list = el('ol', 'reader-toc');
        book.chapters.forEach((chapter, i) => {
          const item = el('li');
          item.append(link(chapter.title, i));
          list.append(item);
        });
        page.append(list);
      } else {
        const chapter = book.chapters[at];
        page.append(
          el('div', 'reader-kicker', book.title),
          el('h2', '', chapter.title)
        );
        let opening = true;
        for (const block of chapter.blocks) {
          if (block.sep) {
            page.append(el('div', 'reader-sep', '◆ ◆ ◆'));
            opening = true;
            continue;
          }
          const p = paragraph(block);
          if (opening) p.className = 'opening';
          opening = false;
          page.append(p);
        }
        const nav = el('nav', 'reader-nav');
        const prev = link('← Previous', at - 1);
        const next = link('Next →', at + 1);
        next.disabled = at === book.chapters.length - 1;
        nav.append(prev, link('Contents', -1), next);
        page.append(nav);
      }
      page.scrollTop = 0;
    }

    function load(url) {
      loading ||= fetch(url)
        .then((res) => res.json())
        .then((data) => {
          book = data;
          buy.href = data.link;
          show(recall());
        })
        .catch(() => {
          loading = null;
          page.replaceChildren(
            el('p', 'opening', 'The book could not be loaded.')
          );
        });
    }

    root.querySelector('.reader-close').addEventListener('click', onClose);
    root
      .querySelector('.reader-contents')
      .addEventListener('click', () => book && show(-1));

    return {
      load,
      show: () => root.classList.add('on'),
      hide: () => root.classList.remove('on'),
      step: (by) => book && show(at + by),
    };
  }

  async function main() {
    THREE = await import('three');
    ({ RoomEnvironment } = await import(
      'three/addons/environments/RoomEnvironment.js'
    ));
    const canvas = document.getElementById('scene');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0906');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.16;

    const raw = await (await fetch('/books.json')).json();
    const books = raw.map(prepareBook);
    const { rows, labels, objects, bookends } = layout(books);

    const totalW = BAYS * BAY_W + (BAYS + 1) * BOARD;
    const totalH = rows * ROW_H + (rows + 1) * BOARD;
    const left = -totalW / 2;
    const topY = PLINTH + totalH;
    const cellLeft = (slot) =>
      left + BOARD + (slot % BAYS) * (BAY_W + BOARD) + EDGE;
    const boardY = (i) => PLINTH + BOARD / 2 + (rows - i) * (ROW_H + BOARD);
    const surfaceY = (slot) => boardY(Math.floor(slot / BAYS) + 1) + BOARD / 2;
    const centerY = PLINTH + totalH / 2;

    const woodMap = woodTexture(renderer, '#4b2a15', 7);
    woodMap.repeat.set(totalW / 1.2, 1);
    const wood = new THREE.MeshStandardMaterial({
      map: woodMap,
      roughness: 0.55,
    });
    const sideMap = woodTexture(renderer, '#4b2a15', 11);
    sideMap.rotation = Math.PI / 2;
    sideMap.repeat.set(totalH / 1.2, 1);
    const woodV = new THREE.MeshStandardMaterial({
      map: sideMap,
      roughness: 0.55,
    });
    const backMap = woodTexture(renderer, '#2a170c', 23, 0.45);
    backMap.repeat.set(totalW / 2.4, totalH / 0.7);
    const woodBack = new THREE.MeshStandardMaterial({
      map: backMap,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });

    const shelf = new THREE.Group();
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      shelf.add(m);
      return m;
    };
    const backParts = [];
    const sheet = (material, x0, x1, y0, y1, z, full) => {
      const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const x = x0 + uv.getX(i) * (x1 - x0);
        const y = y0 + uv.getY(i) * (y1 - y0);
        uv.setXY(
          i,
          (x - full[0]) / (full[1] - full[0]),
          (y - full[2]) / (full[3] - full[2])
        );
      }
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
      mesh.receiveShadow = true;
      mesh.userData.full = full;
      scene.add(mesh);
      return mesh;
    };
    const capPart = { kind: 'cap', hits: 0, meshes: [] };
    const uprights = [];
    const wallPart = { kind: 'wall', hits: 0, meshes: [] };
    const segParts = [];
    const structural = [];
    const join = (mesh, part) => {
      mesh.userData = { kind: 'wood', part };
      part.meshes.push(mesh);
      structural.push(mesh);
      return mesh;
    };
    const segMap = woodMap.clone();
    segMap.repeat.set(BAY_W / 1.2, 1);
    const woodSeg = new THREE.MeshStandardMaterial({
      map: segMap,
      roughness: 0.55,
    });
    join(
      add(new THREE.BoxGeometry(totalW, BOARD, DEPTH), wood, 0, boardY(0), 0),
      capPart
    );
    for (let i = 1; i <= rows; i++) {
      for (let b = 0; b < BAYS; b++) {
        const part = {
          kind: 'segment',
          slot: (i - 1) * BAYS + b,
          hits: 0,
          jolt: 0,
          sag: 0,
          meshes: [],
        };
        const seg = add(
          new THREE.BoxGeometry(BAY_W, BOARD, DEPTH),
          woodSeg,
          left + BOARD + b * (BAY_W + BOARD) + BAY_W / 2,
          boardY(i),
          0
        );
        join(seg, part).userData.baseY = seg.position.y;
        segParts.push(part);
      }
    }
    for (let b = 0; b <= BAYS; b++) {
      const part = { kind: 'upright', index: b, hits: 0, meshes: [] };
      join(
        add(
          new THREE.BoxGeometry(BOARD, totalH, DEPTH + 0.004),
          woodV,
          left + BOARD / 2 + b * (BAY_W + BOARD),
          centerY,
          0
        ),
        part
      );
      uprights.push(part);
    }
    const tileEdges = (row, bay) => [
      left + (bay * totalW) / BAYS,
      left + ((bay + 1) * totalW) / BAYS,
      topY - ((row + 1) * totalH) / rows,
      topY - (row * totalH) / rows,
    ];
    for (let row = 0; row < rows; row++) {
      for (let bay = 0; bay < BAYS; bay++) {
        const part = { kind: 'back', hits: 0, meshes: [] };
        join(
          sheet(woodBack, ...tileEdges(row, bay), -DEPTH / 2, [
            left,
            left + totalW,
            PLINTH,
            topY,
          ]),
          part
        );
        backParts.push(part);
      }
    }
    for (let b = 0; b < BAYS; b++) {
      const kick = (totalW - 0.04) / BAYS;
      join(
        add(
          new THREE.BoxGeometry(kick, PLINTH, DEPTH - 0.03),
          woodBack,
          (b + 0.5 - BAYS / 2) * kick,
          PLINTH / 2,
          -0.01
        ),
        segParts[(rows - 1) * BAYS + b]
      );
    }
    join(
      add(
        new THREE.BoxGeometry(totalW + 0.05, 0.035, DEPTH + 0.03),
        wood,
        0,
        topY + 0.0175,
        0.008
      ),
      capPart
    );
    scene.add(shelf);

    const wallH = totalH + 6;
    const wallMap = woodTexture(renderer, '#2b180d', 57, 0.6);
    wallMap.rotation = Math.PI / 2;
    wallMap.repeat.set(wallH / 2.3, (totalW + 12) / 1.5);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallMap,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const wallZ = -DEPTH / 2 - 0.013;
    const wallEdges = [-totalW / 2 - 6, totalW / 2 + 6, -1, wallH - 1];
    const around = [
      [wallEdges[0], left, wallEdges[2], wallEdges[3]],
      [left + totalW, wallEdges[1], wallEdges[2], wallEdges[3]],
      [left, left + totalW, topY, wallEdges[3]],
      [left, left + totalW, wallEdges[2], PLINTH],
    ];
    for (const edges of around) {
      join(sheet(wallMat, ...edges, wallZ, wallEdges), wallPart);
    }
    backParts.forEach((part, i) => {
      const edges = tileEdges(Math.floor(i / BAYS), i % BAYS);
      join(sheet(wallMat, ...edges, wallZ, wallEdges), part);
    });
    const trimMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      roughness: 0.5,
    });
    for (let px = -totalW / 2 - 5.7; px <= totalW / 2 + 5.7; px += 0.6) {
      const behind = Math.abs(px) < totalW / 2 + 0.035;
      const from = behind ? topY + 0.035 : -1;
      const stile = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, wallH - 1 - from, 0.02),
        trimMat
      );
      stile.position.set(px, (from + wallH - 1) / 2, -DEPTH / 2 - 0.003);
      stile.receiveShadow = true;
      scene.add(stile);
      join(stile, wallPart);
    }
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 12, 0.09, 0.03),
      trimMat
    );
    rail.position.set(0, topY + 0.2, -DEPTH / 2);
    rail.receiveShadow = true;
    scene.add(rail);
    join(rail, wallPart);

    const floorMap = woodTexture(renderer, '#24160d', 41);
    floorMap.repeat.set(6, 6);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW + 12, 6),
      new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.5 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 3 - DEPTH / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const hemi = new THREE.HemisphereLight('#ffe2bd', '#1a0f08', 0.26);
    scene.add(hemi);
    const fill = new THREE.DirectionalLight('#ffd9a8', 0.34);
    fill.position.set(0.5, 1, 3);
    scene.add(fill, fill.target);

    const lamp = new THREE.Group();
    const brass = new THREE.MeshStandardMaterial({
      color: '#b08a3c',
      metalness: 0.85,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.075, 0.07, 40, 1, true),
      brass
    );
    shade.position.y = 0.04;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, 0.025, 24),
      brass
    );
    cap.position.y = 0.087;
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0022, 0.0022, 4, 8),
      new THREE.MeshStandardMaterial({ color: '#15100b', roughness: 0.8 })
    );
    cord.position.y = 2.1;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#fff0c8' })
    );
    bulb.position.y = 0.012;
    const grip = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    grip.position.y = 0.03;
    const lampLight = new THREE.PointLight('#ffc27a', 1.7, 0, 1.6);
    lampLight.position.set(0, -0.01, 0.25);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.camera.near = 0.05;
    lampLight.shadow.camera.far = 7;
    lampLight.shadow.bias = -0.003;
    lampLight.shadow.normalBias = 0.02;
    lampLight.shadow.radius = 3;
    const chain = buildChain();
    chain.position.set(0.046, 0.014, 0);
    lamp.add(shade, cap, cord, bulb, grip, lampLight, chain);
    const bulbOn = new THREE.Color('#fff0c8');
    const bulbOff = new THREE.Color('#2e2820');
    lamp.userData = { kind: 'lamp' };
    lamp.position.y = -LAMP_DROP;
    const lampPivot = new THREE.Group();
    lampPivot.add(lamp);
    scene.add(lampPivot);
    const lampOffset = new THREE.Vector2();
    const lampOffsetTarget = lampOffset.clone();

    const readLight = new THREE.PointLight('#ffe6c4', 0, 0, 2);
    scene.add(readLight);

    const pageMat = new THREE.MeshStandardMaterial({
      color: '#efe6d2',
      roughness: 0.95,
    });
    const pickables = [];
    let readerBook = null;
    for (const b of books) {
      const cloth = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.75,
      });
      const spine = new THREE.MeshStandardMaterial({
        map: spineTexture(b, renderer),
        roughness: 0.7,
      });
      const cover = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.7,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.t, b.h, b.d), [
        cover,
        cloth,
        pageMat,
        pageMat,
        spine,
        pageMat,
      ]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(
        cellLeft(b.slot) + b.x,
        surfaceY(b.slot) + b.h / 2,
        DEPTH / 2 - 0.03 - b.inset - b.d / 2
      );
      mesh.userData = {
        kind: 'book',
        book: b,
        home: mesh.position.clone(),
        tint: [cover, cloth, spine].map((m) => ({
          material: m,
          base: m.color.clone(),
        })),
        fade: 1,
      };
      if (b.reader) {
        spine.emissive.set('#7fd6ff');
        spine.emissiveMap = spine.map;
        const halo = new THREE.Mesh(
          new THREE.PlaneGeometry(b.t + 0.022, b.h + 0.03),
          new THREE.MeshBasicMaterial({
            map: haloTexture(renderer),
            color: '#6fd8ff',
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        halo.position.z = b.d / 2 + 0.02;
        halo.raycast = () => {};
        mesh.add(halo);
        mesh.userData.halo = halo.material;
        readerBook = mesh;
      }
      scene.add(mesh);
      pickables.push(mesh);
    }

    for (const l of labels) {
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(LABEL_W, 0.0225),
        new THREE.MeshStandardMaterial({
          map: brassLabel(l.text, renderer),
          metalness: 0.6,
          roughness: 0.4,
          emissive: '#ffb84a',
          emissiveIntensity: 0,
        })
      );
      plate.position.set(
        cellLeft(l.slot) + l.x + LABEL_W / 2,
        surfaceY(l.slot) - BOARD / 2,
        DEPTH / 2 + 0.0008
      );
      plate.userData = {
        kind: 'label',
        category: l.text,
        slot: l.slot,
        baseY: plate.position.y,
      };
      scene.add(plate);
      pickables.push(plate);
    }

    const categoryBounds = {};
    for (const mesh of pickables) {
      if (mesh.userData.kind !== 'book') continue;
      const b = mesh.userData.book;
      const box = (categoryBounds[b.category] ||= new THREE.Box2());
      box.expandByPoint(
        new THREE.Vector2(
          mesh.position.x - b.t / 2,
          mesh.position.y - b.h / 2 - BOARD
        )
      );
      box.expandByPoint(
        new THREE.Vector2(mesh.position.x + b.t / 2, mesh.position.y + b.h / 2)
      );
    }

    const shadowed = (obj) =>
      obj.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    const builders = {
      frame: buildFrame,
      toy: buildToy,
      record: buildRecord,
      globe: buildGlobe,
    };
    const globes = [];
    for (const def of objects) {
      const obj = builders[def.kind](renderer);
      obj.position.set(cellLeft(def.slot) + def.x, surfaceY(def.slot), 0.03);
      shadowed(obj);
      obj.userData = {
        kind: 'object',
        slot: def.slot,
        home: obj.position.clone(),
        modal: def.modal,
        baseTurn: obj.rotation.y,
        hoverTurn: def.hoverTurn,
        focus: def.focus,
        globe: obj.getObjectByName('globe'),
        spin: GLOBE_IDLE_SPIN,
      };
      const size = new THREE.Box3()
        .setFromObject(obj)
        .getSize(new THREE.Vector3());
      if (def.kind === 'globe') obj.userData.dome = { r: 0.1, c: 0.137 };
      obj.userData.wide = size.x;
      obj.userData.tall = size.y;
      if (def.focus) {
        categoryBounds[def.focus] = new THREE.Box2(
          new THREE.Vector2(obj.position.x - 0.12, obj.position.y - 0.02),
          new THREE.Vector2(obj.position.x + 0.12, obj.position.y + 0.26)
        );
      }
      if (obj.userData.globe) globes.push(obj);
      scene.add(obj);
      pickables.push(obj);
    }
    const iron = new THREE.MeshStandardMaterial({
      color: '#2a2521',
      metalness: 0.7,
      roughness: 0.45,
    });
    const doorExtras = [];
    for (const end of bookends) {
      const bookend = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.003, 0.13, 0.1),
        iron
      );
      plate.position.y = 0.065;
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.003, 0.1),
        iron
      );
      foot.position.set(0.035, 0.0015, 0);
      bookend.add(plate, foot);
      bookend.position.set(
        cellLeft(end.slot) + end.x,
        surfaceY(end.slot),
        DEPTH / 2 - 0.09
      );
      shadowed(bookend);
      bookend.userData = { slot: end.slot, home: bookend.position.clone() };
      doorExtras.push(bookend);
      scene.add(bookend);
    }
    pickables.push(lamp, ...structural);

    const paperPlane = buildPaperPlane();
    scene.add(paperPlane);
    let flight = null;

    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 26),
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
      })
    );
    sky.position.set(0, 4, -6);
    sky.visible = false;
    scene.add(sky);

    const doorSlot = readerBook ? readerBook.userData.book.slot : -1;
    const hinge = new THREE.Vector3();
    const doorCenter = new THREE.Vector2();
    const doorQ = new THREE.Quaternion();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const pullQ = new THREE.Quaternion();
    const pullAxis = new THREE.Vector3(1, 0, 0);
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(BAY_W, ROW_H),
      new THREE.MeshBasicMaterial({ map: auroraTexture(renderer) })
    );
    const portalLight = new THREE.PointLight('#5fe6c4', 0, 1.4, 2);
    if (readerBook) {
      const x0 = cellLeft(doorSlot) - EDGE;
      const y0 = surfaceY(doorSlot);
      hinge.set(x0, 0, -DEPTH / 2);
      doorCenter.set(x0 + BAY_W / 2, y0 + ROW_H / 2);
      portal.position.set(doorCenter.x, doorCenter.y, -DEPTH / 2 + 0.009);
      portal.visible = false;
      portalLight.position.set(doorCenter.x, doorCenter.y, 0);
      scene.add(portal, portalLight);
    }

    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const { clamp } = THREE.MathUtils;
    const rowPitch = ROW_H + BOARD;
    let dist = 3;
    let baseDist = 3;
    let widthDist = 3;
    let zoom = 1;
    let minZoom = 1;
    let viewW = 1;
    let viewH = 1;
    let maxPanX = 0;
    let minY = 0;
    let maxY = 0;
    let pointerInside = false;
    const scroll = new THREE.Vector2();
    const pointerNorm = new THREE.Vector2();

    function applyZoom(value) {
      zoom = clamp(value, minZoom, 2.2);
      dist = baseDist / zoom + DEPTH / 2;
      viewH = 2 * (dist - DEPTH / 2) * tanHalf;
      viewW = viewH * camera.aspect;
      maxPanX = Math.max(0, (totalW + 0.14 - viewW) / 2);
      maxY = topY + 0.09 - viewH / 2;
      minY = viewH / 2 - 0.03;
      if (minY > maxY) minY = maxY = (topY + 0.06) / 2;
      scroll.set(
        clamp(scroll.x, -maxPanX, maxPanX),
        clamp(scroll.y, minY, maxY)
      );
    }

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const forRows = (n) => (n * rowPitch + 0.1) / 2 / tanHalf;
      widthDist = (totalW + 0.14) / 2 / (tanHalf * camera.aspect);
      baseDist = Math.max(forRows(2), Math.min(widthDist, forRows(3.2)));
      minZoom = Math.min(1, baseDist / widthDist);
      applyZoom(zoom);
    }
    scroll.y = Infinity;
    resize();
    scroll.x = -maxPanX;
    const restSpan = 2 * (dist - LAMP_Z) * tanHalf;
    if (camera.aspect < 1) lampOffset.set(0, 0.37);
    else lampOffset.set(-0.3 / (restSpan * camera.aspect), 0.3 / restSpan);
    lampOffsetTarget.copy(lampOffset);
    window.addEventListener('resize', resize);

    const scrollBy = (dx, dy) =>
      scroll.set(
        clamp(scroll.x + dx, -maxPanX, maxPanX),
        clamp(scroll.y + dy, minY, maxY)
      );

    const card = document.getElementById('card');
    const quotes = card.querySelector('.quotes');
    const modals = {
      about: document.getElementById('about-modal'),
      arcade: document.getElementById('arcade-modal'),
      music: document.getElementById('music-modal'),
    };
    const arcade = window.createArcade();
    let modal = null;
    let lampOn = true;
    let dark = 0;
    let tug = 0;
    let passage = false;
    let passageAt = 0;
    let swing = 0;
    let pull = 0;
    let reading = false;
    let direct = false;
    let shake = 0;
    const reader = createReader(() => closePassage());
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let selected = null;
    let focus = null;
    let down = null;

    const lampPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -LAMP_Z);
    const lampHit = new THREE.Vector3();

    function aim(x, y) {
      pointer.set(
        (x / canvas.clientWidth) * 2 - 1,
        -(y / canvas.clientHeight) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
    }

    function pickAt(x, y) {
      aim(x, y);
      if (raycaster.intersectObject(chain, true).length) return chain;
      const hit = raycaster.intersectObjects(pickables, true)[0];
      let o = hit?.object;
      while (o && !o.userData.kind) o = o.parent;
      return o || null;
    }

    function pick(ev) {
      const direct = pickAt(ev.clientX, ev.clientY);
      const solid = direct && direct.userData.kind !== 'wood';
      if (solid || ev.pointerType === 'mouse') return direct;
      for (const reach of direct ? [10] : [12, 22]) {
        for (let i = 0; i < 8; i++) {
          const near = pickAt(
            ev.clientX + Math.cos((i * Math.PI) / 4) * reach,
            ev.clientY + Math.sin((i * Math.PI) / 4) * reach
          );
          const kind = near?.userData.kind;
          if (kind === 'label' || kind === 'chain') return near;
          if (!direct && kind && kind !== 'book' && kind !== 'wood')
            return near;
        }
      }
      return direct;
    }

    function showQuote(text) {
      const p = document.createElement('p');
      p.textContent =
        text.length > 330 ? `${text.slice(0, 320).trimEnd()}…` : text;
      quotes.replaceChildren(p);
    }

    async function showHighlight(b) {
      quotes.replaceChildren();
      if (b.highlight !== undefined) {
        if (b.highlight) showQuote(b.highlight);
        return;
      }
      if (!b.highlightsId) return;
      try {
        const res = await fetch(`/all-books/highlights/${b.highlightsId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (
          selected?.userData.book === b &&
          Array.isArray(data.highlights) &&
          data.highlights.length
        ) {
          showQuote(data.highlights[0]);
        }
      } catch (error) {
        quotes.replaceChildren();
      }
    }

    function select(mesh) {
      selected = mesh;
      const b = mesh.userData.book;
      if (!mesh.material[0].map) {
        mesh.material[0].map = coverTexture(b, renderer);
        mesh.material[0].color.set('#ffffff');
        mesh.userData.tint[0].base.set('#ffffff');
        mesh.userData.fade = -1;
        mesh.material[0].needsUpdate = true;
      }
      card.querySelector('.cat').textContent = b.category;
      card.querySelector('h1').textContent = b.name;
      card.querySelector('.author').textContent = b.author
        ? `by ${b.author}`
        : '';
      card.querySelector('.buy').href = b.link;
      card.style.setProperty('--cloth', b.color);
      card.style.setProperty('--ink', b.ink);
      card.classList.add('on');
      showHighlight(b);
    }

    function deselect() {
      selected = null;
      card.classList.remove('on');
    }

    function openPassage() {
      const b = readerBook.userData.book;
      if (b.slot !== doorSlot) {
        passage = true;
        reading = true;
        direct = true;
        hovered = null;
        reader.load(b.reader);
        reader.show();
        return;
      }
      passage = true;
      passageAt = clock.elapsedTime;
      hovered = null;
      focus = null;
      scroll.set(
        clamp(doorCenter.x, -maxPanX, maxPanX),
        clamp(doorCenter.y, minY, maxY)
      );
      reader.load(b.reader);
    }

    function closePassage() {
      passage = false;
      reading = false;
      direct = false;
      reader.hide();
    }

    const crackMaps = [11, 23, 37, 51].map((seed) =>
      crackTexture(renderer, seed)
    );
    const chipGeo = new THREE.BoxGeometry(0.012, 0.004, 0.007);
    const chipMat = new THREE.MeshStandardMaterial({
      color: '#6b3d1e',
      roughness: 0.8,
    });
    const falling = [];
    const debris = [];
    const unitX = new THREE.Vector3(1, 0, 0);
    const unitZ = new THREE.Vector3(0, 0, 1);
    const tumble = () =>
      new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
    const unpick = (o) => {
      const i = pickables.indexOf(o);
      if (i >= 0) pickables.splice(i, 1);
    };

    const SPAN = 0.002;
    const spans = Math.ceil(BAY_W / SPAN);
    const groundSlots = rows * BAYS;
    const heaps = {};
    const restOn = (slot) => (slot < groundSlots ? surfaceY(slot) : 0);
    function heapScan(slot, from, to, raise, dome) {
      const x0 = cellLeft(slot) - EDGE;
      const heap = heapOf(slot);
      const a = Math.max(0, Math.floor((from + 0.0015 - x0) / SPAN));
      const b = Math.min(spans - 1, Math.floor((to - 0.0015 - x0) / SPAN));
      let top = dome === -1 ? -Infinity : 0;
      for (let i = a; i <= b; i++) {
        if (raise === undefined)
          top = Math.max(top, dome === -1 ? -heap[i] : heap[i]);
        else if (dome) {
          const dx = x0 + (i + 0.5) * SPAN - (from + to) / 2;
          heap[i] =
            raise +
            (Math.abs(dx) < dome.r
              ? dome.c + Math.sqrt(dome.r * dome.r - dx * dx)
              : 0.01);
        } else heap[i] = raise;
      }
      return top;
    }
    const seat = (slot, o, x, base) =>
      heapScan(
        slot,
        x - o.userData.wide / 2,
        x + o.userData.wide / 2,
        base + (o.userData.dome ? 0 : o.userData.tall),
        o.userData.dome
      );
    function heapOf(slot) {
      if (heaps[slot]) return heaps[slot];
      heaps[slot] = new Float32Array(spans);
      for (const o of pickables) {
        const { kind, home } = o.userData;
        if (kind === 'book' && o.userData.book.slot === slot) {
          const b = o.userData.book;
          const half = (o.userData.lying ? b.h : b.t) / 2;
          heapScan(
            slot,
            home.x - half,
            home.x + half,
            o.userData.lying ? b.t : b.h
          );
        } else if (kind === 'object' && o.userData.slot === slot) {
          seat(slot, o, home.x, 0);
        }
      }
      return heaps[slot];
    }
    function shatter(mesh, count, stagger) {
      const { width, height, depth } = mesh.geometry.parameters;
      const dims = [width, height, depth];
      const along = dims.indexOf(Math.max(...dims));
      const piece = dims.slice();
      piece[along] /= count;
      for (let i = 0; i < count; i++) {
        const chunk = new THREE.Mesh(
          new THREE.BoxGeometry(...piece),
          mesh.material
        );
        chunk.castShadow = true;
        chunk.receiveShadow = true;
        chunk.position.copy(mesh.position);
        chunk.position.setComponent(
          along,
          mesh.position.getComponent(along) +
            (i + 0.5 - count / 2) * piece[along]
        );
        scene.add(chunk);
        debris.push({
          o: chunk,
          delay: Math.random() * stagger,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.6,
            Math.random() * 0.6,
            0.3 + Math.random() * 0.5
          ),
          axis: tumble(),
          rate: 1 + Math.random() * 3,
        });
      }
      mesh.visible = false;
      unpick(mesh);
    }

    function drop(o, slot) {
      const isBook = o.userData.kind === 'book';
      const x0 = cellLeft(slot) - EDGE;
      const floor = restOn(slot);
      const fall = o.userData.fall || { o, isBook, speed: 0 };
      fall.delay = Math.random() * 0.06;
      if (isBook) {
        const b = o.userData.book;
        let tip = 0;
        let x = o.userData.home.x;
        if (!o.userData.lying && hash(b.name) % 10 < 4) {
          const reach = b.h / 2;
          let flattest = 0.05;
          for (const side of [-1, 1]) {
            for (let shift = 0; shift < 4; shift++) {
              const at = x + side * ((b.h - b.t) / 2 + shift * 0.03);
              if (at - reach < x0 || at + reach > x0 + BAY_W) continue;
              const high = heapScan(slot, at - reach, at + reach);
              const low = -heapScan(
                slot,
                at - reach,
                at + reach,
                undefined,
                -1
              );
              if (high - low >= flattest) continue;
              flattest = high - low;
              tip = side;
              fall.tipX = at;
            }
          }
          if (tip) {
            o.userData.lying = true;
            x = fall.tipX;
          }
        }
        const half = (o.userData.lying ? b.h : b.t) / 2;
        const tall = o.userData.lying ? b.t : b.h;
        const top = heapScan(slot, x - half, x + half);
        b.slot = slot;
        heapScan(slot, x - half, x + half, top + tall);
        fall.restX = x;
        fall.restY = floor + top + tall / 2;
        fall.restZ = o.userData.home.z;
        if (tip) {
          fall.quat = new THREE.Quaternion().setFromAxisAngle(
            unitZ,
            -tip * (Math.PI / 2 + (Math.random() - 0.5) * 0.06)
          );
        } else {
          fall.quat =
            o.userData.homeQ ||
            new THREE.Quaternion().setFromAxisAngle(
              unitZ,
              top > 0 ? (Math.random() - 0.5) * 0.16 : 0
            );
        }
      } else {
        const half = o.userData.wide / 2;
        fall.restX = clamp(o.position.x, x0 + half, x0 + BAY_W - half);
        const top = heapScan(slot, fall.restX - half, fall.restX + half);
        o.userData.slot = slot;
        seat(slot, o, fall.restX, top);
        fall.restY = floor + top;
        fall.restZ = o.position.z;
      }
      if (!o.userData.fall) falling.push(fall);
      o.userData.fall = fall;
    }

    function collapse(part) {
      part.gone = true;
      part.sag = 0;
      shake = 1.6;
      if (part.kind === 'segment') {
        let below = part.slot + BAYS;
        while (below < groundSlots && segParts[below].gone) below += BAYS;
        for (const mesh of part.meshes) {
          const { width, height, depth } = mesh.geometry.parameters;
          const half = width / 4;
          for (const side of [-1, 1]) {
            const plank = new THREE.Mesh(
              new THREE.BoxGeometry(half * 2, height, depth - 0.04),
              mesh.material
            );
            plank.castShadow = true;
            plank.receiveShadow = true;
            plank.position.copy(mesh.position);
            plank.position.x += side * half;
            scene.add(plank);
            debris.push({
              o: plank,
              delay: 0,
              vel: new THREE.Vector3(side * 0.15, 0.2, 0.7),
              axis: unitZ,
              rate: side * 2.4,
            });
          }
          mesh.visible = false;
          unpick(mesh);
        }
        const movers = pickables
          .filter(
            (o) =>
              (o.userData.kind === 'book' &&
                o.userData.book.slot === part.slot) ||
              (o.userData.kind === 'object' && o.userData.slot === part.slot)
          )
          .sort((a, b) => a.position.y - b.position.y);
        for (const o of movers) drop(o, below);
        for (const o of pickables.slice()) {
          if (o.userData.kind !== 'label' || o.userData.slot !== part.slot)
            continue;
          unpick(o);
          debris.push({
            o,
            delay: 0,
            vel: new THREE.Vector3(0, 0.3, 0.5),
            axis: tumble(),
            rate: 6,
          });
        }
        for (const end of doorExtras) {
          if (end.userData.slot !== part.slot) continue;
          end.userData.slot = -1;
          debris.push({
            o: end,
            delay: 0,
            vel: new THREE.Vector3(0, 0.2, 0.5),
            axis: tumble(),
            rate: 4,
          });
        }
        delete heaps[part.slot];
      } else if (part.kind === 'upright') {
        for (const mesh of part.meshes) shatter(mesh, 6, 0.4);
        for (const bay of [part.index - 1, part.index]) {
          if (bay < 0 || bay >= BAYS) continue;
          for (let row = 0; row < rows; row++) {
            const seg = segParts[row * BAYS + bay];
            if (!seg.gone) collapse(seg);
          }
        }
        if (uprights.every((u) => u.gone)) collapse(capPart);
      } else if (part.kind === 'cap') {
        for (const mesh of part.meshes) shatter(mesh, 6, 0.6);
      } else if (part.kind === 'back') {
        for (const mesh of part.meshes) {
          const { width, height } = mesh.geometry.parameters;
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ]) {
            const shard = new THREE.Mesh(
              new THREE.PlaneGeometry(width / 2, height / 2),
              mesh.material
            );
            shard.position.copy(mesh.position);
            shard.position.x += (sx * width) / 4;
            shard.position.y += (sy * height) / 4;
            scene.add(shard);
            debris.push({
              o: shard,
              delay: Math.random() * 0.15,
              vel: new THREE.Vector3(sx * 0.3, 0.4, -0.5),
              axis: tumble(),
              rate: 2 + Math.random() * 3,
              floor: -1.5,
            });
          }
          mesh.visible = false;
          unpick(mesh);
        }
        sky.visible = true;
      } else {
        const from = part.struck ?? 0;
        const slide = (o) =>
          debris.push({
            o,
            delay: Math.abs(o.position.x - from) * 0.14,
            vel: new THREE.Vector3(),
            axis: unitZ,
            rate: (Math.random() - 0.5) * 0.3,
            floor: -wallH - 2,
          });
        for (const piece of part.meshes) {
          unpick(piece);
          const full = piece.userData.full;
          if (!full) {
            slide(piece);
            continue;
          }
          const { width, height } = piece.geometry.parameters;
          const x0 = piece.position.x - width / 2;
          const y0 = piece.position.y - height / 2;
          const strips = Math.max(1, Math.round(width / 0.6));
          for (let i = 0; i < strips; i++) {
            slide(
              sheet(
                piece.material,
                x0 + (i * width) / strips,
                x0 + ((i + 1) * width) / strips,
                y0,
                y0 + height,
                piece.position.z,
                full
              )
            );
          }
          piece.visible = false;
        }
        sky.visible = true;
      }
    }

    function strike(target, press) {
      const part = target.userData.part;
      if (part.gone) return;
      aim(press.clientX, press.clientY);
      const hit = raycaster.intersectObject(target)[0];
      if (!hit) return;
      part.hits++;
      part.jolt = 1;
      part.struck = hit.point.x;
      shake = Math.max(shake, 0.5);

      const params = target.geometry.parameters;
      const half = [
        params.width / 2,
        params.height / 2,
        (params.depth || 0) / 2,
      ];
      const local = target.worldToLocal(hit.point.clone()).toArray();
      const normal = hit.face.normal.toArray();
      const n = normal.indexOf(
        normal.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
      );
      const u = (n + 1) % 3;
      const v = (n + 2) % 3;
      const reach = 0.045 + part.hits * 0.006;
      const sizeU = Math.min(reach, half[u]);
      const sizeV = Math.min(reach, half[v]);
      const at = [0, 0, 0];
      at[u] = clamp(local[u], -half[u] + sizeU, half[u] - sizeU);
      at[v] = clamp(local[v], -half[v] + sizeV, half[v] - sizeV);
      at[n] = Math.sign(normal[n]) * (half[n] + 0.0007 + part.hits * 0.00005);
      const eu = new THREE.Vector3().setComponent(u, Math.sign(normal[n]));
      const ev = new THREE.Vector3().setComponent(v, 1);
      const en = new THREE.Vector3().setComponent(n, Math.sign(normal[n]));
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(sizeU * 2, sizeV * 2),
        new THREE.MeshBasicMaterial({
          map: crackMaps[part.hits % crackMaps.length],
          transparent: true,
          depthWrite: false,
        })
      );
      decal.raycast = () => {};
      decal.position.fromArray(at);
      decal.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(eu, ev, en)
      );
      target.add(decal);

      for (let i = 0; i < 5; i++) {
        const chip = new THREE.Mesh(chipGeo, chipMat);
        chip.position.copy(hit.point);
        scene.add(chip);
        debris.push({
          o: chip,
          delay: 0,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            0.4 + Math.random() * 0.9,
            0.3 + Math.random() * 0.7
          ),
          axis: tumble(),
          rate: 8 + Math.random() * 10,
        });
      }
      if (part.hits >= 10) collapse(part);
    }

    function launchPlane(globe) {
      if (flight) return;
      clearFocus();
      const from = globe.position;
      const cx = scroll.x;
      const cy = scroll.y;
      const hw = viewW / 2;
      const hh = viewH / 2;
      const side = from.x > cx ? -1 : 1;
      const stops = [
        [from.x, from.y + 0.24, 0.08],
        [from.x + side * 0.06, from.y + 0.34, 0.36],
        [cx + side * hw * 0.72, cy + hh * 0.5, 0.5],
        [cx + side * hw * 0.15, cy + hh * 0.78, 0.36],
        [cx - side * hw * 0.74, cy + hh * 0.42, 0.46],
        [cx - side * hw * 0.78, cy - hh * 0.4, 0.4],
        [cx - side * hw * 0.1, cy - hh * 0.74, 0.56],
        [cx + side * hw * 0.7, cy - hh * 0.3, 0.42],
        [cx + side * hw * 0.25, cy + hh * 0.12, 0.72],
        [cx - side * hw * 0.45, cy + hh * 0.55, 0.9],
        [cx - side * hw * 1.6, cy + hh * 1.4, 0.7],
      ];
      flight = {
        curve: new THREE.CatmullRomCurve3(
          stops.map((p) => new THREE.Vector3(...p)),
          false,
          'centripetal'
        ),
        t: 0,
        bank: 0,
      };
      paperPlane.visible = true;
    }

    function openModal(name) {
      modal = name;
      hovered = null;
      pointerInside = false;
      modals[name].classList.add('on');
      if (name === 'arcade') arcade.start();
      const embed = modals[name].querySelector('iframe[data-src]');
      if (embed && !embed.src) embed.src = embed.dataset.src;
    }

    function closeModal() {
      if (!modal) return;
      if (modal === 'arcade') arcade.stop();
      modals[modal].classList.remove('on');
      modal = null;
    }

    for (const el of Object.values(modals)) {
      el.addEventListener('click', (ev) => {
        if (ev.target === el || ev.target.closest('.modal-close')) closeModal();
      });
    }

    const focusCenter = new THREE.Vector2();
    const focusSize = new THREE.Vector2();

    function clearFocus() {
      if (!focus) return;
      categoryBounds[focus].getCenter(focusCenter);
      scroll.set(
        clamp(focusCenter.x, -maxPanX, maxPanX),
        clamp(focusCenter.y, minY, maxY)
      );
      focus = null;
    }

    const fingers = new Map();
    const fling = new THREE.Vector2();
    let pinch = null;
    const spread = () => {
      const [a, b] = [...fingers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    canvas.addEventListener('pointerdown', (ev) => {
      fling.set(0, 0);
      canvas.setPointerCapture(ev.pointerId);
      if (ev.pointerType === 'touch') {
        fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (fingers.size === 2 && !selected && !passage) {
          clearFocus();
          pinch = { spread: spread(), zoom };
          down = null;
          return;
        }
      }
      const grabbed = selected || passage ? null : pick(ev);
      down = {
        x: ev.clientX,
        y: ev.clientY,
        from: scroll.clone(),
        moved: false,
        slop: ev.pointerType === 'mouse' ? 5 : 12,
        speed: new THREE.Vector2(),
        moveX: ev.clientX,
        moveY: ev.clientY,
        moveTime: performance.now(),
        lamp: grabbed?.userData.kind === 'lamp',
        globe: grabbed?.userData.globe ? grabbed : null,
        lastX: ev.clientX,
        lastTime: performance.now(),
      };
      if (down.lamp || down.globe) canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (fingers.has(ev.pointerId)) {
        fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      }
      if (pinch) {
        if (fingers.size > 1) applyZoom((pinch.zoom * spread()) / pinch.spread);
        return;
      }
      pointerNorm.set(
        (ev.clientX / canvas.clientWidth) * 2 - 1,
        (ev.clientY / canvas.clientHeight) * 2 - 1
      );
      pointerInside = ev.pointerType === 'mouse';
      if (down?.globe) {
        if (Math.abs(ev.clientX - down.x) > down.slop) down.moved = true;
        if (down.moved) {
          const now = performance.now();
          const turn = (ev.clientX - down.lastX) * 0.012;
          down.globe.userData.globe.rotation.y += turn;
          down.globe.userData.spin = clamp(
            (turn / Math.max(now - down.lastTime, 8)) * 1000,
            -6,
            6
          );
          down.lastX = ev.clientX;
          down.lastTime = now;
        }
        return;
      }
      if (down?.lamp) {
        down.moved = true;
        aim(ev.clientX, ev.clientY);
        if (raycaster.ray.intersectPlane(lampPlane, lampHit)) {
          const span = 2 * (camera.position.z - LAMP_Z) * tanHalf;
          lampOffsetTarget.set(
            clamp(
              (lampHit.x - camera.position.x) / (span * camera.aspect),
              -0.4,
              0.4
            ),
            clamp((lampHit.y - 0.03 - camera.position.y) / span, -0.4, 0.4)
          );
        }
        return;
      }
      if (down) {
        const dx = ev.clientX - down.x;
        const dy = ev.clientY - down.y;
        if (Math.abs(dx) > down.slop || Math.abs(dy) > down.slop)
          down.moved = true;
        const worldPerPx = viewH / canvas.clientHeight;
        const now = performance.now();
        const elapsed = Math.max(now - down.moveTime, 8) / 1000;
        down.speed.lerp(
          target.set(
            (-(ev.clientX - down.moveX) * worldPerPx) / elapsed,
            ((ev.clientY - down.moveY) * worldPerPx) / elapsed,
            0
          ),
          0.5
        );
        down.moveX = ev.clientX;
        down.moveY = ev.clientY;
        down.moveTime = now;
        if (down.moved && focus && !selected) {
          clearFocus();
          down.from.copy(scroll);
          down.x = ev.clientX;
          down.y = ev.clientY;
        } else if (down.moved && !selected) {
          scroll.set(
            clamp(down.from.x - dx * worldPerPx, -maxPanX, maxPanX),
            clamp(down.from.y + dy * worldPerPx, minY, maxY)
          );
        }
        return;
      }
      hovered = selected || passage ? null : pick(ev);
      if (hovered?.userData.kind === 'wood') hovered = null;
      canvas.style.cursor = hovered
        ? hovered.userData.kind === 'lamp' || hovered.userData.globe
          ? 'grab'
          : 'pointer'
        : 'default';
    });

    canvas.addEventListener('pointercancel', (ev) => {
      fingers.delete(ev.pointerId);
      if (fingers.size < 2) pinch = null;
      down = null;
    });

    canvas.addEventListener('pointerup', (ev) => {
      fingers.delete(ev.pointerId);
      if (pinch) {
        if (!fingers.size) pinch = null;
        return;
      }
      const wasClick = down && !down.moved;
      const pressed = down && {
        clientX: down.x,
        clientY: down.y,
        pointerType: ev.pointerType,
      };
      const spun = down?.moved ? down.globe : null;
      if (
        down?.moved &&
        ev.pointerType !== 'mouse' &&
        !down.lamp &&
        !down.globe &&
        !selected &&
        !passage &&
        performance.now() - down.moveTime < 90
      ) {
        fling.set(down.speed.x, down.speed.y).clampLength(0, 6);
      }
      down = null;
      if (spun && Math.abs(spun.userData.spin) > 3.2) launchPlane(spun);
      if (!wasClick) return;
      if (passage) {
        closePassage();
        return;
      }
      if (selected) {
        deselect();
        return;
      }
      const target = pick(pressed);
      if (!target) {
        clearFocus();
        return;
      }
      if (target.userData.kind === 'wood') {
        if (focus) clearFocus();
        else strike(target, pressed);
        return;
      }
      if (target.userData.kind === 'label') {
        if (focus === target.userData.category) clearFocus();
        else focus = target.userData.category;
      } else if (target === readerBook) openPassage();
      else if (target.userData.kind === 'book') select(target);
      else if (target.userData.kind === 'chain') {
        lampOn = !lampOn;
        tug = 1;
      } else if (target.userData.focus) {
        if (focus === target.userData.focus) clearFocus();
        else focus = target.userData.focus;
      } else if (target.userData.kind === 'object')
        openModal(target.userData.modal);
    });

    canvas.addEventListener('pointerleave', () => {
      hovered = null;
      pointerInside = false;
    });

    window.addEventListener(
      'wheel',
      (ev) => {
        if (modal || reading) return;
        ev.preventDefault();
        if (selected || passage) return;
        clearFocus();
        if (ev.ctrlKey) {
          applyZoom(zoom * Math.exp(-ev.deltaY * 0.01));
          return;
        }
        scrollBy(ev.deltaX * 0.0016, -ev.deltaY * 0.0016);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        if (modal) closeModal();
        else if (passage) closePassage();
        else if (selected) deselect();
        else clearFocus();
      }
      if (reading && ev.key === 'ArrowRight') reader.step(1);
      if (reading && ev.key === 'ArrowLeft') reader.step(-1);
      if (selected || modal || passage) return;
      const steps = {
        ArrowDown: [0, -rowPitch],
        ArrowUp: [0, rowPitch],
        PageDown: [0, -viewH * 0.8],
        PageUp: [0, viewH * 0.8],
        ' ': [0, -viewH * 0.8],
        Home: [0, Infinity],
        End: [0, -Infinity],
        ArrowRight: [0.3, 0],
        ArrowLeft: [-0.3, 0],
      };
      const step = steps[ev.key];
      if (!step) return;
      ev.preventDefault();
      clearFocus();
      scrollBy(step[0], step[1]);
    });

    const clock = new THREE.Clock();
    const target = new THREE.Vector3();
    const targetQ = new THREE.Quaternion();
    const identityQ = new THREE.Quaternion();
    const showcaseTurn = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.03, -Math.PI / 2 + 0.3, 0)
    );
    const forward = new THREE.Vector3();
    const rightV = new THREE.Vector3();
    const cam = new THREE.Vector3(scroll.x, scroll.y, dist);
    let lastCamY = cam.y;
    let sway = 0;
    let swaySpeed = 0;

    function frame() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = 1 - Math.exp(-dt * 9);
      const kSlow = 1 - Math.exp(-dt * 5);

      const edge = Math.abs(pointerNorm.y) - 0.78;
      if (
        pointerInside &&
        !selected &&
        !down &&
        !focus &&
        !modal &&
        !passage &&
        edge > 0
      ) {
        const speed = Math.min(1, edge / 0.22) ** 2 * 0.9;
        scrollBy(0, -Math.sign(pointerNorm.y) * speed * dt);
      }
      let wantX = scroll.x;
      let wantY = scroll.y;
      let wantD = dist;
      if (focus) {
        const box = categoryBounds[focus];
        box.getCenter(focusCenter);
        box.getSize(focusSize);
        wantX = focusCenter.x;
        wantY = focusCenter.y;
        const fit = Math.max(
          (focusSize.y / 2 + 0.05) / tanHalf,
          (focusSize.x / 2 + 0.07) / (tanHalf * camera.aspect)
        );
        wantD = clamp(
          fit + DEPTH / 2,
          0.55,
          Math.max(dist, widthDist + DEPTH / 2)
        );
        const halfH = (wantD - DEPTH / 2) * tanHalf;
        const slackX = Math.max(0, (totalW + 0.14) / 2 - halfH * camera.aspect);
        wantX = clamp(wantX, -slackX, slackX);
        if (topY + 0.09 - halfH > halfH - 0.03)
          wantY = clamp(wantY, halfH - 0.03, topY + 0.09 - halfH);
      }

      if (fling.lengthSq() > 0.0004) {
        scrollBy(fling.x * dt, fling.y * dt);
        fling.multiplyScalar(Math.exp(-dt * 3.2));
      } else fling.set(0, 0);

      const now = clock.elapsedTime;
      pull += ((passage && !direct ? 1 : 0) - pull) * kSlow;
      const swingTo = passage && !direct && now - passageAt > 0.45 ? 1 : 0;
      swing += (swingTo - swing) * (1 - Math.exp(-dt * (passage ? 1.7 : 3)));
      if (passage && !direct) {
        const fit = Math.max(
          (ROW_H / 2 + 0.06) / tanHalf,
          (BAY_W / 2 + 0.08) / (tanHalf * camera.aspect)
        );
        const dive = THREE.MathUtils.smoothstep(swing, 0.45, 1);
        wantX = doorCenter.x;
        wantY = doorCenter.y;
        wantD = THREE.MathUtils.lerp(
          Math.min(fit + DEPTH / 2, dist),
          0.34,
          dive
        );
        if (!reading && swing > 0.86) {
          reading = true;
          reader.show();
        }
      }
      const doorOpen = swing > 0.0005;
      doorQ.setFromAxisAngle(upAxis, swing * 1.62);
      pullQ.setFromAxisAngle(pullAxis, pull * 0.3);
      if (readerBook) {
        const shine = THREE.MathUtils.smoothstep(swing, 0.03, 0.6);
        portal.visible = doorOpen;
        portal.material.color.setScalar(
          shine * (0.92 + 0.08 * Math.sin(now * 1.3))
        );
        portalLight.intensity = shine * 0.5;
        const pulse = 0.5 + 0.5 * Math.sin(now * 1.6);
        const glow = dark * (0.75 + 0.25 * pulse) * (1 - shine);
        readerBook.material[4].emissiveIntensity = glow * 1.6;
        readerBook.userData.halo.opacity = glow * 0.45;
      }

      dark += ((lampOn ? 0 : 1) - dark) * kSlow;
      lampLight.intensity = 1.7 * (1 - dark);
      bulb.material.color.lerpColors(bulbOn, bulbOff, dark);
      hemi.intensity = 0.26 - 0.2 * dark;
      fill.intensity = 0.34 - 0.28 * dark;
      scene.environmentIntensity = 0.16 - 0.12 * dark;
      tug += (0 - tug) * k;
      chain.position.y = 0.014 - Math.sin(tug * Math.PI) * 0.022;
      chain.rotation.z = -sway * 1.6;

      if (flight) {
        flight.t += dt / 7.5;
        if (flight.t >= 1) {
          flight = null;
          paperPlane.visible = false;
        } else {
          const u = flight.t;
          flight.curve.getPointAt(u, paperPlane.position);
          flight.curve.getTangentAt(u, forward);
          flight.curve.getTangentAt(Math.min(1, u + 0.02), rightV);
          const turn = forward.x * rightV.z - forward.z * rightV.x;
          flight.bank += (clamp(turn * 9, -0.9, 0.9) - flight.bank) * k;
          paperPlane.position.y += Math.sin(now * 3.1) * 0.006;
          target.copy(paperPlane.position).add(forward);
          paperPlane.lookAt(target);
          paperPlane.rotateZ(flight.bank);
          paperPlane.scale.setScalar(
            1.5 * Math.min(1, u * 14 + 0.15) * Math.min(1, (1 - u) * 12)
          );
        }
      }
      cam.x += (wantX - cam.x) * kSlow;
      cam.y += (wantY - cam.y) * kSlow * (focus ? 1 : 1.8);
      cam.z += (wantD - cam.z) * kSlow;
      camera.position.copy(cam);
      camera.lookAt(cam.x, cam.y, 0);
      if (sky.visible) sky.material.uniforms.time.value = now;
      shake *= Math.exp(-dt * 7);
      camera.position.x += Math.sin(now * 83) * 0.004 * shake;
      camera.position.y += Math.sin(now * 97) * 0.004 * shake;
      camera.updateMatrixWorld();

      for (const part of segParts) {
        if (part.gone) continue;
        part.jolt *= Math.exp(-dt * 6);
        part.sag = part.hits * 0.0007 + Math.sin(part.jolt * Math.PI) * 0.005;
        part.meshes[0].position.y = part.meshes[0].userData.baseY - part.sag;
      }
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        if ((f.delay -= dt) > 0) continue;
        const o = f.o;
        const ease = 1 - Math.exp(-dt * 6);
        f.speed -= 9.8 * dt;
        o.position.y += f.speed * dt;
        o.position.x += (f.restX - o.position.x) * ease;
        o.position.z += (f.restZ - o.position.z) * ease;
        if (f.isBook) o.quaternion.slerp(f.quat, ease);
        else o.rotation.z = Math.sin(now * 14 + i) * 0.08;
        if (o.position.y > f.restY) continue;
        if (f.speed < -1.4) {
          o.position.y = f.restY;
          f.speed *= -0.22;
          continue;
        }
        o.userData.home.set(f.restX, f.restY, f.restZ);
        if (f.isBook) o.userData.homeQ = f.quat;
        else {
          o.position.copy(o.userData.home);
          o.rotation.z = 0;
          if (o.userData.focus) {
            categoryBounds[o.userData.focus].set(
              new THREE.Vector2(f.restX - 0.12, f.restY - 0.02),
              new THREE.Vector2(f.restX + 0.12, f.restY + 0.26)
            );
          }
        }
        o.userData.fall = null;
        falling.splice(i, 1);
      }
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        if ((d.delay -= dt) > 0) continue;
        const o = d.o;
        if (d.fade !== undefined) {
          d.fade -= dt;
          o.scale.setScalar(Math.max(0.001, d.fade / 0.25));
          if (d.fade <= 0) {
            o.removeFromParent();
            debris.splice(i, 1);
          }
          continue;
        }
        d.vel.y -= 9.8 * dt;
        o.position.addScaledVector(d.vel, dt);
        o.rotateOnWorldAxis(d.axis, d.rate * dt);
        if (d.floor === undefined) {
          if (o.position.y < 0.03) d.fade = 0.25;
        } else if (o.position.y < d.floor) {
          o.removeFromParent();
          debris.splice(i, 1);
        }
      }

      lampOffset.lerp(lampOffsetTarget, kSlow);
      const drift = (cam.y - lastCamY) / Math.max(dt, 0.001);
      lastCamY = cam.y;
      swaySpeed +=
        (-24 * sway - 1.7 * swaySpeed + clamp(drift, -2, 2) * 0.45) * dt;
      sway = clamp(sway + swaySpeed * dt, -0.045, 0.045);
      const lampSpan = 2 * Math.max(0.2, cam.z - LAMP_Z) * tanHalf;
      lampPivot.position.set(
        cam.x + lampOffset.x * lampSpan * camera.aspect,
        cam.y + lampOffset.y * lampSpan + LAMP_DROP,
        LAMP_Z
      );
      lampPivot.rotation.z = sway;
      readLight.position.set(cam.x + 0.1, cam.y + 0.25, cam.z);
      for (const o of globes) {
        o.userData.globe.material.emissiveIntensity = dark * 1.2;
        if (down?.globe === o) continue;
        o.userData.globe.rotation.y += o.userData.spin * dt;
        o.userData.spin += (GLOBE_IDLE_SPIN - o.userData.spin) * kSlow * 0.25;
      }
      readLight.intensity +=
        ((selected ? 1.5 : 0) - readLight.intensity) * kSlow;

      camera.getWorldDirection(forward);
      rightV.setFromMatrixColumn(camera.matrixWorld, 0);
      const wide = camera.aspect > 1;

      for (const o of pickables) {
        if (o.userData.fall) continue;
        if (o.userData.kind === 'book') {
          let size = 1;
          if (o === selected) {
            const full = wide ? 0.7 : 0.95;
            const reach = Math.min(full, cam.z - DEPTH / 2 - 0.1);
            size = reach / full;
            target
              .copy(camera.position)
              .addScaledVector(forward, reach)
              .addScaledVector(rightV, wide ? -0.1 * size : 0);
            if (!wide) target.y += 0.07 * size;
            targetQ.copy(camera.quaternion).multiply(showcaseTurn);
          } else {
            const seg = segParts[o.userData.book.slot];
            target.copy(o.userData.home);
            targetQ.copy(o.userData.homeQ || identityQ);
            if (seg) target.y -= seg.sag;
            if (o === hovered) target.z += 0.04;
            if (o === readerBook) {
              target.z += 0.05 * pull;
              targetQ.copy(pullQ);
            }
            if (doorOpen && o.userData.book.slot === doorSlot) {
              target.sub(hinge).applyQuaternion(doorQ).add(hinge);
              targetQ.premultiply(doorQ);
            }
          }
          o.castShadow = o !== hovered;
          o.position.lerp(target, k);
          o.quaternion.slerp(targetQ, k);
          o.scale.x += (size - o.scale.x) * k;
          o.scale.y = o.scale.z = o.scale.x;
          const wantFade =
            !focus || o.userData.book.category === focus || o === selected
              ? 1
              : 0.3;
          if (Math.abs(wantFade - o.userData.fade) > 0.003) {
            o.userData.fade =
              o.userData.fade < 0
                ? wantFade
                : o.userData.fade + (wantFade - o.userData.fade) * kSlow;
            for (const t of o.userData.tint)
              t.material.color.copy(t.base).multiplyScalar(o.userData.fade);
          }
        } else if (o.userData.kind === 'object') {
          const turn =
            o.userData.baseTurn + (o === hovered ? o.userData.hoverTurn : 0);
          o.userData.turn =
            (o.userData.turn ?? turn) +
            (turn - (o.userData.turn ?? turn)) * kSlow;
          o.rotation.y = o.userData.turn;
          const seg = segParts[o.userData.slot];
          if (seg) o.position.y = o.userData.home.y - seg.sag;
          if (o.userData.slot === doorSlot) {
            o.position
              .copy(o.userData.home)
              .sub(hinge)
              .applyQuaternion(doorQ)
              .add(hinge);
            o.rotation.y += swing * 1.62;
          }
        } else if (o.userData.kind === 'label') {
          o.position.y = o.userData.baseY - segParts[o.userData.slot].sag;
          const glow =
            o === hovered || o.userData.category === focus ? 0.22 : dark * 0.05;
          o.material.emissiveIntensity +=
            (glow - o.material.emissiveIntensity) * k;
        }
      }

      for (const o of doorExtras) {
        if (o.userData.slot !== doorSlot) continue;
        o.position
          .copy(o.userData.home)
          .sub(hinge)
          .applyQuaternion(doorQ)
          .add(hinge);
        o.rotation.y = swing * 1.62;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    frame();
  }

  main();
})();
