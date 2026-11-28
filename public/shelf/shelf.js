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
      label: 'About Milo',
    },
    {
      kind: 'record',
      width: 0.24,
      minSlot: 2,
      hoverTurn: 0.3,
      modal: 'music',
      label: 'Almost Classical',
    },
    {
      kind: 'toy',
      width: 0.15,
      minSlot: 4,
      hoverTurn: -0.6,
      modal: 'arcade',
      label: 'Play Sokobox',
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

  function buildGlobe(renderer) {
    const R = 0.092;
    const ring = R + 0.007;
    const center = 0.038 + ring;
    const canvas = makeCanvas(2048, 1024);
    const g = canvas.getContext('2d');
    g.fillStyle = '#7f9a9a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const map = toTexture(canvas, renderer);
    const brass = new THREE.MeshStandardMaterial({
      color: '#b08a3c',
      metalness: 0.8,
      roughness: 0.35,
    });

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 48),
      new THREE.MeshStandardMaterial({ map, roughness: 0.6 })
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
        drawGlobeMap(canvas, decodeAtlas(topology), visited);
        map.needsUpdate = true;
      })
      .catch(() => {});
    return group;
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
    for (let i = 0; i <= rows; i++) {
      add(new THREE.BoxGeometry(totalW, BOARD, DEPTH), wood, 0, boardY(i), 0);
    }
    for (let b = 0; b <= BAYS; b++) {
      add(
        new THREE.BoxGeometry(BOARD, totalH, DEPTH + 0.004),
        woodV,
        left + BOARD / 2 + b * (BAY_W + BOARD),
        centerY,
        0
      );
    }
    add(
      new THREE.BoxGeometry(totalW, totalH, 0.012),
      woodBack,
      0,
      centerY,
      -DEPTH / 2 - 0.006
    );
    add(
      new THREE.BoxGeometry(totalW - 0.04, PLINTH, DEPTH - 0.03),
      woodBack,
      0,
      PLINTH / 2,
      -0.01
    );
    add(
      new THREE.BoxGeometry(totalW + 0.05, 0.035, DEPTH + 0.03),
      wood,
      0,
      topY + 0.0175,
      0.008
    );
    scene.add(shelf);

    const wallH = totalH + 6;
    const wallMap = woodTexture(renderer, '#2b180d', 57, 0.6);
    wallMap.rotation = Math.PI / 2;
    wallMap.repeat.set(wallH / 2.3, (totalW + 12) / 1.5);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallMap,
      roughness: 0.6,
    });
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW + 12, wallH),
      wallMat
    );
    wall.position.set(0, wallH / 2 - 1, -DEPTH / 2 - 0.013);
    wall.receiveShadow = true;
    scene.add(wall);
    const trimMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      roughness: 0.5,
    });
    for (let px = -totalW / 2 - 5.7; px <= totalW / 2 + 5.7; px += 0.6) {
      const stile = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, wallH, 0.02),
        trimMat
      );
      stile.position.set(px, wallH / 2 - 1, -DEPTH / 2 - 0.003);
      stile.receiveShadow = true;
      scene.add(stile);
    }
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 12, 0.09, 0.03),
      trimMat
    );
    rail.position.set(0, topY + 0.2, -DEPTH / 2);
    rail.receiveShadow = true;
    scene.add(rail);

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

    scene.add(new THREE.HemisphereLight('#ffe2bd', '#1a0f08', 0.26));
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
    lamp.add(shade, cap, cord, bulb, grip, lampLight);
    lamp.userData = { kind: 'lamp' };
    lamp.position.y = -LAMP_DROP;
    const lampPivot = new THREE.Group();
    lampPivot.add(lamp);
    scene.add(lampPivot);
    const lampOffset = new THREE.Vector2(-0.3, 0.3);
    const lampOffsetTarget = lampOffset.clone();

    const readLight = new THREE.PointLight('#ffe6c4', 0, 0, 2);
    scene.add(readLight);

    const pageMat = new THREE.MeshStandardMaterial({
      color: '#efe6d2',
      roughness: 0.95,
    });
    const pickables = [];
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
        label: b.name,
        sublabel: b.author,
        tint: [cover, cloth, spine].map((m) => ({
          material: m,
          base: m.color.clone(),
        })),
        fade: 1,
      };
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
      plate.userData = { kind: 'label', category: l.text };
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
        modal: def.modal,
        label: def.label,
        baseTurn: obj.rotation.y,
        hoverTurn: def.hoverTurn,
        focus: def.focus,
        globe: obj.getObjectByName('globe'),
        spin: GLOBE_IDLE_SPIN,
      };
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
      scene.add(bookend);
    }
    pickables.push(lamp);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const { clamp } = THREE.MathUtils;
    const rowPitch = ROW_H + BOARD;
    let dist = 3;
    let viewW = 1;
    let viewH = 1;
    let maxPanX = 0;
    let minY = 0;
    let maxY = 0;
    let pointerInside = false;
    const scroll = new THREE.Vector2();
    const pointerNorm = new THREE.Vector2();

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const forWidth = (totalW + 0.14) / 2 / (tanHalf * camera.aspect);
      const forRows = (n) => (n * rowPitch + 0.1) / 2 / tanHalf;
      dist = Math.max(forRows(2), Math.min(forWidth, forRows(3.2))) + DEPTH / 2;
      viewH = 2 * (dist - DEPTH / 2) * tanHalf;
      viewW = viewH * camera.aspect;
      maxPanX = Math.max(0, (totalW + 0.14 - viewW) / 2);
      maxY = topY + 0.09 - viewH / 2;
      minY = Math.min(maxY, viewH / 2 - 0.03);
      scroll.set(
        clamp(scroll.x, -maxPanX, maxPanX),
        clamp(scroll.y, minY, maxY)
      );
    }
    scroll.y = Infinity;
    resize();
    scroll.x = -maxPanX;
    window.addEventListener('resize', resize);

    const scrollBy = (dx, dy) =>
      scroll.set(
        clamp(scroll.x + dx, -maxPanX, maxPanX),
        clamp(scroll.y + dy, minY, maxY)
      );

    const tip = document.getElementById('tip');
    const card = document.getElementById('card');
    const quotes = card.querySelector('.quotes');
    const modals = {
      about: document.getElementById('about-modal'),
      arcade: document.getElementById('arcade-modal'),
      music: document.getElementById('music-modal'),
    };
    const arcade = window.createArcade();
    let modal = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let selected = null;
    let focus = null;
    let down = null;

    const lampPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -LAMP_Z);
    const lampHit = new THREE.Vector3();

    function aim(ev) {
      pointer.set(
        (ev.clientX / window.innerWidth) * 2 - 1,
        -(ev.clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
    }

    function pick(ev) {
      aim(ev);
      const hit = raycaster.intersectObjects(pickables, true)[0];
      let o = hit?.object;
      while (o && !o.userData.kind) o = o.parent;
      return o || null;
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
      tip.classList.remove('on');
      showHighlight(b);
    }

    function deselect() {
      selected = null;
      card.classList.remove('on');
    }

    function openModal(name) {
      modal = name;
      hovered = null;
      pointerInside = false;
      tip.classList.remove('on');
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

    canvas.addEventListener('pointerdown', (ev) => {
      const grabbed = selected ? null : pick(ev);
      down = {
        x: ev.clientX,
        y: ev.clientY,
        from: scroll.clone(),
        moved: false,
        lamp: grabbed?.userData.kind === 'lamp',
        globe: grabbed?.userData.globe ? grabbed : null,
        lastX: ev.clientX,
        lastTime: performance.now(),
      };
      if (down.lamp || down.globe) canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture(ev.pointerId);
    });

    canvas.addEventListener('pointermove', (ev) => {
      pointerNorm.set(
        (ev.clientX / window.innerWidth) * 2 - 1,
        (ev.clientY / window.innerHeight) * 2 - 1
      );
      pointerInside = true;
      if (down?.globe) {
        if (Math.abs(ev.clientX - down.x) > 5) down.moved = true;
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
        aim(ev);
        if (raycaster.ray.intersectPlane(lampPlane, lampHit)) {
          lampOffsetTarget.set(
            clamp(lampHit.x - camera.position.x, -viewW * 0.36, viewW * 0.36),
            clamp(
              lampHit.y - 0.03 - camera.position.y,
              -viewH * 0.3,
              viewH * 0.3
            )
          );
        }
        return;
      }
      if (down) {
        const dx = ev.clientX - down.x;
        const dy = ev.clientY - down.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) down.moved = true;
        if (down.moved && focus && !selected) {
          clearFocus();
          down.from.copy(scroll);
          down.x = ev.clientX;
          down.y = ev.clientY;
        } else if (down.moved && !selected) {
          const worldPerPx = viewH / window.innerHeight;
          scroll.set(
            clamp(down.from.x - dx * worldPerPx, -maxPanX, maxPanX),
            clamp(down.from.y + dy * worldPerPx, minY, maxY)
          );
        }
        return;
      }
      hovered = selected ? null : pick(ev);
      canvas.style.cursor = hovered
        ? hovered.userData.kind === 'lamp' || hovered.userData.globe
          ? 'grab'
          : 'pointer'
        : 'default';
      if (hovered?.userData.label) {
        const title = document.createElement('strong');
        title.textContent = hovered.userData.label;
        tip.replaceChildren(title);
        if (hovered.userData.sublabel) {
          const sub = document.createElement('span');
          sub.textContent = hovered.userData.sublabel;
          tip.append(sub);
        }
        tip.style.left = `${Math.min(ev.clientX + 16, window.innerWidth - 340)}px`;
        tip.style.top = `${ev.clientY + 16}px`;
        tip.classList.add('on');
      } else {
        tip.classList.remove('on');
      }
    });

    canvas.addEventListener('pointerup', (ev) => {
      const wasClick = down && !down.moved;
      down = null;
      if (!wasClick) return;
      if (selected) {
        deselect();
        return;
      }
      const target = pick(ev);
      if (!target) {
        clearFocus();
        return;
      }
      if (target.userData.kind === 'label') {
        if (focus === target.userData.category) clearFocus();
        else focus = target.userData.category;
      } else if (target.userData.kind === 'book') select(target);
      else if (target.userData.focus) {
        if (focus === target.userData.focus) clearFocus();
        else focus = target.userData.focus;
      } else if (target.userData.kind === 'object')
        openModal(target.userData.modal);
    });

    canvas.addEventListener('pointerleave', () => {
      hovered = null;
      pointerInside = false;
      tip.classList.remove('on');
    });

    window.addEventListener(
      'wheel',
      (ev) => {
        if (modal) return;
        ev.preventDefault();
        if (selected) return;
        clearFocus();
        scrollBy(ev.deltaX * 0.0016, -ev.deltaY * 0.0016);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        if (modal) closeModal();
        else if (selected) deselect();
        else clearFocus();
      }
      if (selected || modal) return;
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
      if (pointerInside && !selected && !down && !focus && !modal && edge > 0) {
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
        wantD = clamp(fit + DEPTH / 2, 0.55, dist);
      }
      cam.x += (wantX - cam.x) * kSlow;
      cam.y += (wantY - cam.y) * kSlow * (focus ? 1 : 1.8);
      cam.z += (wantD - cam.z) * kSlow;
      camera.position.copy(cam);
      camera.lookAt(cam.x, cam.y, 0);
      camera.updateMatrixWorld();

      lampOffset.lerp(lampOffsetTarget, kSlow);
      const drift = (cam.y - lastCamY) / Math.max(dt, 0.001);
      lastCamY = cam.y;
      swaySpeed +=
        (-24 * sway - 1.7 * swaySpeed + clamp(drift, -2, 2) * 0.45) * dt;
      sway = clamp(sway + swaySpeed * dt, -0.045, 0.045);
      lampPivot.position.set(
        cam.x + lampOffset.x,
        cam.y + lampOffset.y + LAMP_DROP,
        LAMP_Z
      );
      lampPivot.rotation.z = sway;
      readLight.position.set(cam.x + 0.1, cam.y + 0.25, cam.z);
      for (const o of globes) {
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
            target.copy(o.userData.home);
            if (o === hovered) target.z += 0.04;
            targetQ.copy(identityQ);
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
          o.rotation.y += (turn - o.rotation.y) * kSlow;
        } else if (o.userData.kind === 'label') {
          const glow =
            o === hovered || o.userData.category === focus ? 0.22 : 0;
          o.material.emissiveIntensity +=
            (glow - o.material.emissiveIntensity) * k;
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    frame();
  }

  main();
})();
