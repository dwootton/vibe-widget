import * as d3 from "https://esm.sh/d3@7";

const CHROM_LEN = 50000000;
const BASE_COLORS = {
  A: "#2b8a3e",
  C: "#1971c2",
  G: "#e67700",
  T: "#c92a2a",
};

function formatCoord(bp) {
  const rounded = Math.round(bp);
  if (rounded >= 1000000) {
    return (rounded / 1000000).toFixed(rounded % 1000000 === 0 ? 0 : 2) + " Mb";
  }
  if (rounded >= 1000) {
    return (rounded / 1000).toFixed(rounded % 1000 === 0 ? 0 : 1) + " kb";
  }
  return rounded.toLocaleString() + " bp";
}

function normalizeDF(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return [];
    if (typeof raw[keys[0]] === "object" && raw[keys[0]] !== null) {
      const rowKeys = Object.keys(raw[keys[0]]);
      const list = [];
      for (let i = 0; i < rowKeys.length; i++) {
        const row = {};
        const rk = rowKeys[i];
        for (let k of keys) {
          row[k] = raw[k][rk];
        }
        list.push(row);
      }
      return list;
    }
  }
  return [];
}

export const LevelBadge = ({ level, React }) => {
  const labels = {
    1: "1 · density",
    2: "2 · gene arrows",
    3: "3 · exon structure",
    4: "4 · sequence",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontSize: "11px",
        fontWeight: 400,
        color: "#111111",
        border: "1px solid #d9d9d9",
        background: "#ffffff",
        letterSpacing: "0.02em",
      }}
    >
      {labels[level] || `L${level}`}
    </span>
  );
};

export const NavButtons = ({ onZoomIn, onZoomOut, onPanLeft, onPanRight, onReset, React }) => {
  const btnStyle = {
    height: "24px",
    padding: "0 8px",
    background: "#ffffff",
    border: "1px solid #d9d9d9",
    color: "#111111",
    fontSize: "11px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    cursor: "pointer",
    lineHeight: "22px",
  };
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      <button style={btnStyle} onClick={onPanLeft} title="Pan left (Left Arrow)">←</button>
      <button style={btnStyle} onClick={onPanRight} title="Pan right (Right Arrow)">→</button>
      <button style={btnStyle} onClick={onZoomIn} title="Zoom in (+)">+</button>
      <button style={btnStyle} onClick={onZoomOut} title="Zoom out (-)">−</button>
      <button style={btnStyle} onClick={onReset} title="Reset view">reset</button>
    </div>
  );
};

export default function GenomeBrowserWidget({ model, React }) {
  const [genesRaw, setGenesRaw] = React.useState(() => model.get("genes"));
  const [exonsRaw, setExonsRaw] = React.useState(() => model.get("exons"));
  const [seqRaw, setSeqRaw] = React.useState(() => model.get("seq"));
  const [variantsRaw, setVariantsRaw] = React.useState(() => model.get("data"));

  const [view, setView] = React.useState([0, CHROM_LEN]);
  const viewRef = React.useRef([0, CHROM_LEN]);
  viewRef.current = view;

  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [canvasWidth, setCanvasWidth] = React.useState(760);

  const span = view[1] - view[0];
  const level = span > 5000000 ? 1 : span > 100000 ? 2 : span > 2000 ? 3 : 4;

  React.useEffect(() => {
    model.set("view", [Math.round(view[0]), Math.round(view[1])]);
    model.set("level", level);
    model.save_changes();
  }, [view, level]);

  React.useEffect(() => {
    const handleGenes = () => setGenesRaw(model.get("genes"));
    const handleExons = () => setExonsRaw(model.get("exons"));
    const handleSeq = () => setSeqRaw(model.get("seq"));
    const handleData = () => setVariantsRaw(model.get("data"));

    model.on("change:genes", handleGenes);
    model.on("change:exons", handleExons);
    model.on("change:seq", handleSeq);
    model.on("change:data", handleData);

    return () => {
      model.off("change:genes", handleGenes);
      model.off("change:exons", handleExons);
      model.off("change:seq", handleSeq);
      model.off("change:data", handleData);
    };
  }, [model]);

  const genes = React.useMemo(() => {
    const arr = normalizeDF(genesRaw);
    return arr.map((g) => ({
      gene: String(g.gene),
      start: Number(g.start),
      end: Number(g.end),
      strand: g.strand === "-" ? "-" : "+",
    }));
  }, [genesRaw]);

  const exonsByGene = React.useMemo(() => {
    const arr = normalizeDF(exonsRaw);
    const map = new Map();
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      const g = String(e.gene);
      let list = map.get(g);
      if (!list) {
        list = [];
        map.set(g, list);
      }
      list.push({ start: Number(e.start), end: Number(e.end) });
    }
    return map;
  }, [exonsRaw]);

  const variants = React.useMemo(() => {
    const arr = normalizeDF(variantsRaw);
    return arr.map((v) => ({
      pos: Number(v.pos),
      af: Number(v.af ?? 0),
      ref: String(v.ref || ""),
      alt: String(v.alt || ""),
    }));
  }, [variantsRaw]);

  const seqObj = React.useMemo(() => {
    if (!seqRaw) return { start: 70000, seq: "" };
    if (typeof seqRaw === "string") {
      return { start: 70000, seq: seqRaw };
    }
    if (Array.isArray(seqRaw)) {
      const s0 = seqRaw[0];
      if (typeof s0 === "string") return { start: 70000, seq: s0 };
      if (typeof s0 === "object" && s0 !== null) {
        return { start: Number(s0.start ?? 70000), seq: String(s0.seq ?? "") };
      }
    }
    if (typeof seqRaw === "object") {
      let s = "";
      let st = 70000;
      if (seqRaw.seq) {
        if (typeof seqRaw.seq === "string") s = seqRaw.seq;
        else if (typeof seqRaw.seq === "object") {
          const vals = Object.values(seqRaw.seq);
          if (vals.length > 0) s = String(vals[0]);
        }
      }
      if (seqRaw.start !== undefined) {
        if (typeof seqRaw.start === "number") st = seqRaw.start;
        else if (typeof seqRaw.start === "object") {
          const vals = Object.values(seqRaw.start);
          if (vals.length > 0) st = Number(vals[0]);
        }
      }
      return { start: st, seq: s };
    }
    return { start: 70000, seq: "" };
  }, [seqRaw]);

  const bins100k = React.useMemo(() => {
    const nBins = Math.ceil(CHROM_LEN / 100000);
    const geneBins = new Uint16Array(nBins);
    const varBins = new Uint16Array(nBins);

    for (let i = 0; i < genes.length; i++) {
      const mid = (genes[i].start + genes[i].end) / 2;
      const b = Math.floor(mid / 100000);
      if (b >= 0 && b < nBins) geneBins[b]++;
    }
    for (let i = 0; i < variants.length; i++) {
      const b = Math.floor(variants[i].pos / 100000);
      if (b >= 0 && b < nBins) varBins[b]++;
    }

    let maxGene = 1;
    for (let i = 0; i < nBins; i++) if (geneBins[i] > maxGene) maxGene = geneBins[i];
    let maxVar = 1;
    for (let i = 0; i < nBins; i++) if (varBins[i] > maxVar) maxVar = varBins[i];

    return { geneBins, varBins, maxGene, maxVar, nBins };
  }, [genes, variants]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (let e of entries) {
        const w = e.contentRect.width;
        if (w > 200) setCanvasWidth(w);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const clampView = React.useCallback((s, e) => {
    let width = e - s;
    if (width < 30) width = 30;
    if (width > CHROM_LEN) width = CHROM_LEN;
    if (s < 0) {
      s = 0;
      e = s + width;
    }
    if (e > CHROM_LEN) {
      e = CHROM_LEN;
      s = e - width;
    }
    if (s < 0) s = 0;
    return [s, e];
  }, []);

  const panBy = React.useCallback((fraction) => {
    const cur = viewRef.current;
    const w = cur[1] - cur[0];
    const shift = w * fraction;
    setView((prev) => clampView(prev[0] + shift, prev[1] + shift));
  }, [clampView]);

  const zoomCenter = React.useCallback((factor) => {
    const cur = viewRef.current;
    const mid = (cur[0] + cur[1]) / 2;
    const half = ((cur[1] - cur[0]) * factor) / 2;
    setView(clampView(mid - half, mid + half));
  }, [clampView]);

  const resetView = React.useCallback(() => {
    setView([0, CHROM_LEN]);
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvasWidth;
    const height = 420;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    const [vStart, vEnd] = view;
    const vSpan = vEnd - vStart;

    const scaleX = (bp) => ((bp - vStart) / vSpan) * width;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Ruler
    const rulerY = 32;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerY);
    ctx.lineTo(width, rulerY);
    ctx.stroke();

    const targetTicks = Math.max(4, Math.floor(width / 110));
    const rawStep = vSpan / targetTicks;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const rel = rawStep / pow10;
    let step = pow10;
    if (rel >= 5) step = 5 * pow10;
    else if (rel >= 2) step = 2 * pow10;

    const firstTick = Math.ceil(vStart / step) * step;
    ctx.font = "11px ui-monospace, SF Mono, Menlo, monospace";
    ctx.fillStyle = "#777777";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    for (let t = firstTick; t <= vEnd; t += step) {
      const x = scaleX(t);
      ctx.beginPath();
      ctx.moveTo(x, rulerY);
      ctx.lineTo(x, rulerY - 6);
      ctx.stroke();

      let lbl = "";
      if (t >= 1000000) {
        lbl = (t / 1000000).toFixed(t % 1000000 === 0 ? 0 : 2) + " Mb";
      } else if (t >= 1000) {
        lbl = (t / 1000).toFixed(t % 1000 === 0 ? 0 : 1) + " kb";
      } else {
        lbl = t.toString() + " bp";
      }
      ctx.fillText(lbl, x, rulerY - 8);
    }

    // Sub-ticks
    const subStep = step / 5;
    if (scaleX(vStart + subStep) - scaleX(vStart) > 6) {
      const firstSub = Math.ceil(vStart / subStep) * subStep;
      ctx.strokeStyle = "#d9d9d9";
      for (let t = firstSub; t <= vEnd; t += subStep) {
        if (t % step === 0) continue;
        const x = scaleX(t);
        ctx.beginPath();
        ctx.moveTo(x, rulerY);
        ctx.lineTo(x, rulerY - 3);
        ctx.stroke();
      }
    }

    // Tracks layout
    const trackDividerY = 220;
    ctx.strokeStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.moveTo(0, trackDividerY);
    ctx.lineTo(width, trackDividerY);
    ctx.stroke();

    // Labels for tracks
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#777777";
    ctx.fillText("genes", 8, rulerY + 6);
    ctx.fillText("variants", 8, trackDividerY + 6);

    // LEVEL 1: Over 5 Mb
    if (level === 1) {
      const gStripY = 80;
      const gStripH = 90;
      const vStripY = 250;
      const vStripH = 90;

      const { geneBins, varBins, maxGene, maxVar } = bins100k;
      const startBin = Math.max(0, Math.floor(vStart / 100000));
      const endBin = Math.min(bins100k.nBins - 1, Math.ceil(vEnd / 100000));

      // Gene density heat strip
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#111111";
      ctx.fillText("gene density · 100 kb bins", 8, gStripY - 18);

      for (let b = startBin; b <= endBin; b++) {
        const x1 = scaleX(b * 100000);
        const x2 = scaleX((b + 1) * 100000);
        const count = geneBins[b];
        if (count > 0) {
          const intensity = Math.min(1, count / maxGene);
          ctx.fillStyle = `rgba(17, 17, 17, ${0.1 + intensity * 0.9})`;
          ctx.fillRect(x1, gStripY, Math.max(1, x2 - x1), gStripH);
        }
      }
      ctx.strokeStyle = "#d9d9d9";
      ctx.strokeRect(0, gStripY, width, gStripH);

      // Variant density strip
      ctx.fillStyle = "#111111";
      ctx.fillText("variant density · 100 kb bins", 8, vStripY - 18);

      for (let b = startBin; b <= endBin; b++) {
        const x1 = scaleX(b * 100000);
        const x2 = scaleX((b + 1) * 100000);
        const count = varBins[b];
        if (count > 0) {
          const intensity = Math.min(1, count / maxVar);
          ctx.fillStyle = `rgba(217, 72, 15, ${0.12 + intensity * 0.88})`;
          ctx.fillRect(x1, vStripY, Math.max(1, x2 - x1), vStripH);
        }
      }
      ctx.strokeStyle = "#d9d9d9";
      ctx.strokeRect(0, vStripY, width, vStripH);
    }

    // LEVEL 2: 100 kb to 5 Mb
    else if (level === 2) {
      // Genes as arrows (strand direction)
      const geneTrackY = 110;
      const arrowH = 14;
      const headW = 7;

      for (let i = 0; i < genes.length; i++) {
        const g = genes[i];
        if (g.end < vStart || g.start > vEnd) continue;
        const x1 = scaleX(g.start);
        const x2 = scaleX(g.end);
        const w = Math.max(2, x2 - x1);
        const yMid = geneTrackY + arrowH / 2;

        ctx.fillStyle = "#111111";
        ctx.strokeStyle = "#111111";

        if (w <= headW + 2) {
          ctx.fillRect(x1, geneTrackY, w, arrowH);
        } else {
          ctx.beginPath();
          if (g.strand === "+") {
            ctx.moveTo(x1, geneTrackY + 2);
            ctx.lineTo(x2 - headW, geneTrackY + 2);
            ctx.lineTo(x2 - headW, geneTrackY);
            ctx.lineTo(x2, yMid);
            ctx.lineTo(x2 - headW, geneTrackY + arrowH);
            ctx.lineTo(x2 - headW, geneTrackY + arrowH - 2);
            ctx.lineTo(x1, geneTrackY + arrowH - 2);
          } else {
            ctx.moveTo(x2, geneTrackY + 2);
            ctx.lineTo(x1 + headW, geneTrackY + 2);
            ctx.lineTo(x1 + headW, geneTrackY);
            ctx.lineTo(x1, yMid);
            ctx.lineTo(x1 + headW, geneTrackY + arrowH);
            ctx.lineTo(x1 + headW, geneTrackY + arrowH - 2);
            ctx.lineTo(x2, geneTrackY + arrowH - 2);
          }
          ctx.closePath();
          ctx.fill();
        }

        // Gene name if fits
        ctx.font = "11px ui-monospace, SF Mono, Menlo, monospace";
        const nameW = ctx.measureText(g.gene).width;
        if (w > nameW + 8) {
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const textX = g.strand === "+" ? x1 + (w - headW) / 2 : x1 + headW + (w - headW) / 2;
          ctx.fillText(g.gene, textX, yMid);
        } else if (w > 20) {
          ctx.fillStyle = "#111111";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(g.gene, (x1 + x2) / 2, geneTrackY - 3);
        }
      }

      // Variants as thin ticks
      const vTop = trackDividerY + 24;
      const vBottom = 390;
      ctx.strokeStyle = "#d9480f";
      ctx.lineWidth = 1;
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (v.pos < vStart || v.pos > vEnd) continue;
        const x = scaleX(v.pos);
        ctx.beginPath();
        ctx.moveTo(x, vTop);
        ctx.lineTo(x, vBottom);
        ctx.stroke();
      }
    }

    // LEVEL 3: under 100 kb (down to 2 kb)
    else if (level === 3) {
      const geneY = 110;
      const exonH = 18;
      const exonTop = geneY - exonH / 2;

      for (let i = 0; i < genes.length; i++) {
        const g = genes[i];
        if (g.end < vStart || g.start > vEnd) continue;
        const gx1 = scaleX(g.start);
        const gx2 = scaleX(g.end);

        // Thin intron line
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx1, geneY);
        ctx.lineTo(gx2, geneY);
        ctx.stroke();

        // Direction carats on intron line
        const dirStep = 40;
        const nSteps = Math.floor((gx2 - gx1) / dirStep);
        if (nSteps > 0) {
          ctx.lineWidth = 1;
          for (let s = 1; s <= nSteps; s++) {
            const cx = gx1 + s * dirStep;
            ctx.beginPath();
            if (g.strand === "+") {
              ctx.moveTo(cx - 3, geneY - 3);
              ctx.lineTo(cx + 1, geneY);
              ctx.lineTo(cx - 3, geneY + 3);
            } else {
              ctx.moveTo(cx + 3, geneY - 3);
              ctx.lineTo(cx - 1, geneY);
              ctx.lineTo(cx + 3, geneY + 3);
            }
            ctx.stroke();
          }
        }

        // Exon boxes
        const gExons = exonsByGene.get(g.gene) || [];
        ctx.fillStyle = "#111111";
        for (let j = 0; j < gExons.length; j++) {
          const ex = gExons[j];
          const ex1 = scaleX(ex.start);
          const ex2 = scaleX(ex.end);
          ctx.fillRect(ex1, exonTop, Math.max(2, ex2 - ex1), exonH);
        }

        // Name
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#111111";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${g.gene} (${g.strand})`, Math.max(8, gx1), exonTop - 4);
      }

      // Variants as lollipops: height = af, ref>alt when room
      const lolliBaseline = 380;
      const lolliMaxH = 120;
      ctx.strokeStyle = "#d9d9d9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lolliBaseline);
      ctx.lineTo(width, lolliBaseline);
      ctx.stroke();

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (v.pos < vStart || v.pos > vEnd) continue;
        const x = scaleX(v.pos);
        const h = Math.max(6, v.af * lolliMaxH);
        const tipY = lolliBaseline - h;

        ctx.strokeStyle = "#d9480f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, lolliBaseline);
        ctx.lineTo(x, tipY);
        ctx.stroke();

        ctx.fillStyle = "#d9480f";
        ctx.beginPath();
        ctx.arc(x, tipY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Label if room (view span < 40000 or sparse)
        if (vSpan < 45000) {
          ctx.font = "11px ui-monospace, SF Mono, Menlo, monospace";
          ctx.fillStyle = "#111111";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${v.ref}>${v.alt}`, x, tipY - 4);
          ctx.fillStyle = "#777777";
          ctx.fillText(v.af.toFixed(2), x, lolliBaseline + 14);
        }
      }
    }

    // LEVEL 4: under 2 kb
    else {
      // Sequence track
      const seqY = 160;
      const seqH = 26;
      const seqStart = seqObj.start;
      const seqText = seqObj.seq;
      const seqEnd = seqStart + (seqText ? seqText.length : 0);

      // Check overlap
      const hasOverlap = vEnd > seqStart && vStart < seqEnd && seqText && seqText.length > 0;

      if (!hasOverlap) {
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#777777";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("sequence not loaded here", width / 2, seqY + seqH / 2);
      } else {
        const charStartIdx = Math.max(0, Math.floor(vStart - seqStart));
        const charEndIdx = Math.min(seqText.length - 1, Math.ceil(vEnd - seqStart));

        const charW = scaleX(seqStart + 1) - scaleX(seqStart);
        ctx.font = `${Math.min(18, Math.max(10, Math.floor(charW * 0.9)))}px ui-monospace, SF Mono, Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Map variants in range
        const varMap = new Map();
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          if (v.pos >= vStart && v.pos <= vEnd) {
            varMap.set(v.pos, v);
          }
        }

        for (let idx = charStartIdx; idx <= charEndIdx; idx++) {
          const pos = seqStart + idx;
          const char = seqText[idx] || "";
          const cx = scaleX(pos) + charW / 2;
          const cy = seqY + seqH / 2;

          const variant = varMap.get(pos);
          if (variant) {
            ctx.fillStyle = "rgba(217, 72, 15, 0.18)";
            ctx.fillRect(scaleX(pos), seqY - 4, Math.max(1, charW), seqH + 8);
            ctx.strokeStyle = "#d9480f";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(scaleX(pos), seqY - 4, Math.max(1, charW), seqH + 8);
          }

          ctx.fillStyle = BASE_COLORS[char] || "#111111";
          if (charW > 7) {
            ctx.fillText(char, cx, cy);
          } else {
            ctx.fillRect(scaleX(pos), seqY, Math.max(1, charW), seqH);
          }
        }
      }

      // Variants track beneath sequence
      const lolliBaseline = 370;
      const lolliMaxH = 110;
      ctx.strokeStyle = "#d9d9d9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lolliBaseline);
      ctx.lineTo(width, lolliBaseline);
      ctx.stroke();

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (v.pos < vStart || v.pos > vEnd) continue;
        const x = scaleX(v.pos);
        const h = Math.max(10, v.af * lolliMaxH);
        const tipY = lolliBaseline - h;

        ctx.strokeStyle = "#d9480f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, lolliBaseline);
        ctx.lineTo(x, tipY);
        ctx.stroke();

        ctx.fillStyle = "#d9480f";
        ctx.beginPath();
        ctx.arc(x, tipY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "12px ui-monospace, SF Mono, Menlo, monospace";
        ctx.fillStyle = "#111111";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${v.ref}>${v.alt}`, x, tipY - 4);
        ctx.fillStyle = "#777777";
        ctx.fillText(`af ${v.af.toFixed(3)}`, x, lolliBaseline + 14);
      }

      // Gene context on top
      const geneY = 80;
      for (let i = 0; i < genes.length; i++) {
        const g = genes[i];
        if (g.end < vStart || g.start > vEnd) continue;
        const gx1 = scaleX(g.start);
        const gx2 = scaleX(g.end);
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx1, geneY);
        ctx.lineTo(gx2, geneY);
        ctx.stroke();

        const gExons = exonsByGene.get(g.gene) || [];
        ctx.fillStyle = "#111111";
        for (let j = 0; j < gExons.length; j++) {
          const ex = gExons[j];
          const ex1 = scaleX(ex.start);
          const ex2 = scaleX(ex.end);
          ctx.fillRect(ex1, geneY - 6, Math.max(2, ex2 - ex1), 12);
        }
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${g.gene} (${g.strand})`, Math.max(8, gx1), geneY - 8);
      }
    }
  }, [view, level, canvasWidth, genes, exonsByGene, variants, seqObj, bins100k]);

  // Pointer interactions: drag, wheel, double-click
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let dragStartX = 0;
    let initialStart = 0;
    let initialEnd = 0;

    const onPointerDown = (e) => {
      e.preventDefault();
      canvas.focus();
      isDragging = true;
      dragStartX = e.clientX;
      initialStart = viewRef.current[0];
      initialEnd = viewRef.current[1];
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const curSpan = initialEnd - initialStart;
      const bpPerPx = curSpan / canvas.clientWidth;
      const shift = -dx * bpPerPx;
      setView(clampView(initialStart + shift, initialEnd + shift));
    };

    const onPointerUp = (e) => {
      if (isDragging) {
        isDragging = false;
        try {
          canvas.releasePointerCapture?.(e.pointerId);
        } catch (_) {}
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const cur = viewRef.current;
      const curSpan = cur[1] - cur[0];
      const pointerBp = cur[0] + (mouseX / rect.width) * curSpan;

      const zoomFactor = e.deltaY > 0 ? 1.25 : 0.8;
      const newSpan = curSpan * zoomFactor;
      const mouseFrac = mouseX / rect.width;
      const newStart = pointerBp - mouseFrac * newSpan;
      const newEnd = newStart + newSpan;

      setView(clampView(newStart, newEnd));
    };

    const onDblClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const cur = viewRef.current;
      const curSpan = cur[1] - cur[0];
      const clickBp = cur[0] + (mouseX / rect.width) * curSpan;

      let hitGene = null;
      for (let i = 0; i < genes.length; i++) {
        const g = genes[i];
        if (clickBp >= g.start - 500 && clickBp <= g.end + 500) {
          hitGene = g;
          break;
        }
      }
      if (!hitGene) {
        let closestDist = Infinity;
        for (let i = 0; i < genes.length; i++) {
          const g = genes[i];
          const mid = (g.start + g.end) / 2;
          const d = Math.abs(mid - clickBp);
          if (d < closestDist) {
            closestDist = d;
            hitGene = g;
          }
        }
      }

      if (hitGene) {
        const geneLen = hitGene.end - hitGene.start;
        const padding = Math.max(500, geneLen * 0.2);
        setView(clampView(hitGene.start - padding, hitGene.end + padding));
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        panBy(-0.1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        panBy(0.1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomCenter(0.8);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomCenter(1.25);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("keydown", onKeyDown);
    };
  }, [genes, clampView, panBy, zoomCenter]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: "1000px",
        background: "#ffffff",
        color: "#111111",
        padding: "12px",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <span
            style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            chr1:{Math.round(view[0]).toLocaleString()}–{Math.round(view[1]).toLocaleString()}
          </span>
          <span
            style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontSize: "11px",
              color: "#777777",
            }}
          >
            span {formatCoord(span)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <NavButtons
            React={React}
            onPanLeft={() => panBy(-0.1)}
            onPanRight={() => panBy(0.1)}
            onZoomIn={() => zoomCenter(0.8)}
            onZoomOut={() => zoomCenter(1.25)}
            onReset={resetView}
          />
          <LevelBadge level={level} React={React} />
        </div>
      </header>

      <div
        style={{
          width: "100%",
          height: "420px",
          position: "relative",
          border: "1px solid #d9d9d9",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "grab",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}