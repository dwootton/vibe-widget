import * as d3 from "https://esm.sh/d3@7";

const CHROMOSOME_LENGTH = 50000000;
const TRACK_HEIGHT = 420;

export const LevelBadge = ({ level, view }) => {
  const levelNames = {
    1: "1: Whole Chromosome (Density Heatmaps)",
    2: "2: Regional View (Gene Arrows & Variants)",
    3: "3: Gene Structure (Exons & Lollipops)",
    4: "4: Base Resolution (Sequence Letters)",
  };

  const span = Math.round(view[1] - view[0]);
  const formatSpan = (bp) => {
    if (bp >= 1000000) return (bp / 1000000).toFixed(2) + " Mb";
    if (bp >= 1000) return (bp / 1000).toFixed(1) + " kb";
    return bp + " bp";
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(35, 33, 30, 0.06)",
        border: "1px solid rgba(35, 33, 30, 0.15)",
        borderRadius: "4px",
        padding: "4px 10px",
        fontFamily: "'Fira Code', 'Pitch', monospace",
        fontSize: "12px",
        color: "#23211e",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor:
            level === 4
              ? "#16a34a"
              : level === 3
              ? "#2563eb"
              : level === 2
              ? "#d97706"
              : "#dc2626",
        }}
      />
      <span style={{ fontWeight: 600 }}>Level {levelNames[level]}</span>
      <span style={{ color: "#78716c", borderLeft: "1px solid #d6d3d1", paddingLeft: "6px" }}>
        span: {formatSpan(span)}
      </span>
    </div>
  );
};

export const BrowserControls = ({ onPan, onZoom, onReset }) => {
  const btnStyle = {
    background: "#ffffff",
    border: "1px solid #d6d3d1",
    borderRadius: "4px",
    padding: "4px 10px",
    fontFamily: "'Fira Code', monospace",
    fontSize: "12px",
    fontWeight: 600,
    color: "#23211e",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    transition: "all 0.15s ease",
  };

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      <button style={btnStyle} onClick={() => onPan(-0.1)} title="Pan left (or Left Arrow)">
        ◀ Pan 10%
      </button>
      <button style={btnStyle} onClick={() => onPan(0.1)} title="Pan right (or Right Arrow)">
        Pan 10% ▶
      </button>
      <button style={btnStyle} onClick={() => onZoom(0.5)} title="Zoom in (+ key)">
        ＋ Zoom In
      </button>
      <button style={btnStyle} onClick={() => onZoom(2.0)} title="Zoom out (- key)">
        － Zoom Out
      </button>
      <button style={btnStyle} onClick={onReset} title="Reset view">
        Whole Chr
      </button>
    </div>
  );
};

export default function Widget({ model, React }) {
  const genesData = model.get("genes") || [];
  const exonsData = model.get("exons") || [];
  const seqData = model.get("seq") || "";
  const variantsData = model.get("data") || [];

  const rawGenes = React.useMemo(() => {
    if (!genesData) return [];
    if (Array.isArray(genesData)) return genesData;
    if (typeof genesData === "object") {
      const keys = Object.keys(genesData);
      if (keys.length > 0 && Array.isArray(genesData[keys[0]])) {
        const len = genesData[keys[0]].length;
        const res = [];
        for (let i = 0; i < len; i++) {
          const row = {};
          keys.forEach((k) => (row[k] = genesData[k][i]));
          res.push(row);
        }
        return res;
      }
    }
    return [];
  }, [genesData]);

  const rawExons = React.useMemo(() => {
    if (!exonsData) return [];
    if (Array.isArray(exonsData)) return exonsData;
    if (typeof exonsData === "object") {
      const keys = Object.keys(exonsData);
      if (keys.length > 0 && Array.isArray(exonsData[keys[0]])) {
        const len = exonsData[keys[0]].length;
        const res = [];
        for (let i = 0; i < len; i++) {
          const row = {};
          keys.forEach((k) => (row[k] = exonsData[k][i]));
          res.push(row);
        }
        return res;
      }
    }
    return [];
  }, [exonsData]);

  const rawVariants = React.useMemo(() => {
    if (!variantsData) return [];
    if (Array.isArray(variantsData)) return variantsData;
    if (typeof variantsData === "object") {
      const keys = Object.keys(variantsData);
      if (keys.length > 0 && Array.isArray(variantsData[keys[0]])) {
        const len = variantsData[keys[0]].length;
        const res = [];
        for (let i = 0; i < len; i++) {
          const row = {};
          keys.forEach((k) => (row[k] = variantsData[k][i]));
          res.push(row);
        }
        return res;
      }
    }
    return [];
  }, [variantsData]);

  const rawSeq = React.useMemo(() => {
    if (!seqData) return { start: 0, seq: "" };
    if (typeof seqData === "string") {
      return { start: 0, seq: seqData };
    }
    if (typeof seqData === "object") {
      let str = "";
      let st = 0;
      if (typeof seqData.seq === "string") str = seqData.seq;
      else if (seqData.seq && typeof seqData.seq[0] === "string") str = seqData.seq[0];
      else {
        const firstKey = Object.keys(seqData)[0];
        if (typeof seqData[firstKey] === "string") str = seqData[firstKey];
        else if (Array.isArray(seqData[firstKey])) str = seqData[firstKey][0] || "";
      }
      if (seqData.start !== undefined) {
        st = Array.isArray(seqData.start) ? seqData.start[0] : seqData.start;
      }
      return { start: Number(st) || 0, seq: str };
    }
    return { start: 0, seq: "" };
  }, [seqData]);

  const exonsByGene = React.useMemo(() => {
    const map = new Map();
    rawExons.forEach((ex) => {
      const g = ex.gene;
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(ex);
    });
    return map;
  }, [rawExons]);

  const densityBins = React.useMemo(() => {
    const BIN_SIZE = 100000;
    const numBins = Math.ceil(CHROMOSOME_LENGTH / BIN_SIZE);
    const geneCounts = new Uint32Array(numBins);
    const variantCounts = new Uint32Array(numBins);

    rawGenes.forEach((g) => {
      const mid = (g.start + g.end) / 2;
      const b = Math.floor(mid / BIN_SIZE);
      if (b >= 0 && b < numBins) geneCounts[b]++;
    });

    rawVariants.forEach((v) => {
      const b = Math.floor(v.pos / BIN_SIZE);
      if (b >= 0 && b < numBins) variantCounts[b]++;
    });

    let maxGene = 1;
    let maxVar = 1;
    for (let i = 0; i < numBins; i++) {
      if (geneCounts[i] > maxGene) maxGene = geneCounts[i];
      if (variantCounts[i] > maxVar) maxVar = variantCounts[i];
    }

    return { BIN_SIZE, numBins, geneCounts, variantCounts, maxGene, maxVar };
  }, [rawGenes, rawVariants]);

  const [viewState, setViewState] = React.useState([0, CHROMOSOME_LENGTH]);
  const [levelState, setLevelState] = React.useState(1);

  const viewRef = React.useRef([0, CHROMOSOME_LENGTH]);
  const levelRef = React.useRef(1);
  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ mouseX: 0, viewStart: 0, viewEnd: 0 });

  const computeLevel = (vStart, vEnd) => {
    const span = Math.max(1, vEnd - vStart);
    if (span > 5000000) return 1;
    if (span > 100000) return 2;
    if (span > 2000) return 3;
    return 4;
  };

  const updateView = (newStart, newEnd) => {
    let span = newEnd - newStart;
    const minSpan = 30;
    const maxSpan = CHROMOSOME_LENGTH;
    if (span < minSpan) span = minSpan;
    if (span > maxSpan) span = maxSpan;

    if (newStart < 0) {
      newStart = 0;
      newEnd = newStart + span;
    }
    if (newEnd > CHROMOSOME_LENGTH) {
      newEnd = CHROMOSOME_LENGTH;
      newStart = Math.max(0, newEnd - span);
    }

    const cur = viewRef.current;
    if (Math.abs(cur[0] - newStart) < 0.5 && Math.abs(cur[1] - newEnd) < 0.5) return;

    viewRef.current = [newStart, newEnd];
    const newLvl = computeLevel(newStart, newEnd);
    levelRef.current = newLvl;

    setViewState([newStart, newEnd]);
    setLevelState(newLvl);

    model.set("view", [Math.round(newStart), Math.round(newEnd)]);
    model.set("level", newLvl);
    model.save_changes();
  };

  React.useEffect(() => {
    const initView = [0, CHROMOSOME_LENGTH];
    const initLvl = computeLevel(0, CHROMOSOME_LENGTH);
    viewRef.current = initView;
    levelRef.current = initLvl;
    model.set("view", initView);
    model.set("level", initLvl);
    model.save_changes();
  }, []);

  const panByFraction = (fraction) => {
    const [vStart, vEnd] = viewRef.current;
    const span = vEnd - vStart;
    const shift = span * fraction;
    updateView(vStart + shift, vEnd + shift);
  };

  const zoomByFactor = (factor) => {
    const [vStart, vEnd] = viewRef.current;
    const mid = (vStart + vEnd) / 2;
    const span = (vEnd - vStart) * factor;
    updateView(mid - span / 2, mid + span / 2);
  };

  const resetView = () => {
    updateView(0, CHROMOSOME_LENGTH);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const [vStart, vEnd] = viewRef.current;
    const lvl = levelRef.current;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(0, 0, width, height);

    const bpToX = (bp) => ((bp - vStart) / (vEnd - vStart)) * width;

    // RULER
    const rulerHeight = 50;
    ctx.fillStyle = "#f7f4ed";
    ctx.fillRect(0, 0, width, rulerHeight);

    ctx.strokeStyle = "#e5e1d8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerHeight);
    ctx.lineTo(width, rulerHeight);
    ctx.stroke();

    const span = vEnd - vStart;
    const rulerScale = d3.scaleLinear().domain([vStart, vEnd]).range([0, width]);
    const numTicks = Math.max(4, Math.floor(width / 90));
    const ticks = rulerScale.ticks(numTicks);

    ctx.fillStyle = "#23211e";
    ctx.font = "11px 'Fira Code', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    ticks.forEach((tick) => {
      const x = bpToX(tick);
      if (x >= 0 && x <= width) {
        ctx.strokeStyle = "#a8a29e";
        ctx.beginPath();
        ctx.moveTo(x, rulerHeight - 8);
        ctx.lineTo(x, rulerHeight);
        ctx.stroke();

        let label = "";
        if (span >= 5000000) {
          label = (tick / 1000000).toFixed(1) + " Mb";
        } else if (span >= 100000) {
          label = (tick / 1000).toFixed(0) + " kb";
        } else if (span >= 5000) {
          label = (tick / 1000).toFixed(1) + " kb";
        } else {
          label = Math.round(tick).toLocaleString() + " bp";
        }
        ctx.fillText(label, x, rulerHeight - 11);
      }
    });

    const trackTop = rulerHeight + 10;
    const trackBottom = height - 10;
    const availHeight = trackBottom - trackTop;

    if (lvl === 1) {
      // LEVEL 1: Heatmaps
      const heatH = 95;
      const gTop = trackTop + 25;
      const vTop = gTop + heatH + 50;

      ctx.fillStyle = "#44403c";
      ctx.font = "600 13px 'Playfair Display', serif, system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        `GENE DENSITY (genes per 100 kb bin - peak ${densityBins.maxGene})`,
        14,
        gTop - 6
      );

      ctx.fillText(
        `VARIANT DENSITY (variants per 100 kb bin - peak ${densityBins.maxVar})`,
        14,
        vTop - 6
      );

      const binW = Math.max(1, (densityBins.BIN_SIZE / (vEnd - vStart)) * width);
      const startBin = Math.max(0, Math.floor(vStart / densityBins.BIN_SIZE));
      const endBin = Math.min(
        densityBins.numBins - 1,
        Math.ceil(vEnd / densityBins.BIN_SIZE)
      );

      ctx.strokeStyle = "#e5e1d8";
      ctx.strokeRect(0, gTop, width, heatH);
      ctx.strokeRect(0, vTop, heatH, heatH);

      const geneColor = d3.interpolateLab("#fef3c7", "#831843");
      const varColor = d3.interpolateLab("#e0e7ff", "#1e1b4b");

      for (let b = startBin; b <= endBin; b++) {
        const x = bpToX(b * densityBins.BIN_SIZE);
        const gVal = densityBins.geneCounts[b] / densityBins.maxGene;
        ctx.fillStyle = geneColor(Math.min(1, Math.max(0, gVal)));
        ctx.fillRect(x, gTop, binW + 0.5, heatH);

        const vVal = densityBins.variantCounts[b] / densityBins.maxVar;
        ctx.fillStyle = varColor(Math.min(1, Math.max(0, vVal)));
        ctx.fillRect(x, vTop, binW + 0.5, heatH);
      }

      ctx.fillStyle = "#78716c";
      ctx.font = "11px 'Fira Code', monospace";
      ctx.fillText("0", width - 100, gTop - 6);
      ctx.fillText(`max: ${densityBins.maxGene}`, width - 40, gTop - 6);
      ctx.fillText("0", width - 100, vTop - 6);
      ctx.fillText(`max: ${densityBins.maxVar}`, width - 40, vTop - 6);
    } else if (lvl === 2) {
      // LEVEL 2: Genes as arrows, variants as ticks
      const genesY = trackTop + 30;
      const genesH = 130;
      const varsY = genesY + genesH + 40;
      const varsH = 120;

      ctx.fillStyle = "#44403c";
      ctx.font = "600 13px 'Playfair Display', serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText("GENES (strand direction: > / <)", 14, genesY - 8);
      ctx.fillText("VARIANTS (positions along track)", 14, varsY - 8);

      // Track dividers
      ctx.strokeStyle = "#eee9de";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, varsY - 20);
      ctx.lineTo(width, varsY - 20);
      ctx.stroke();

      // Render genes in 2 alternating rows to prevent overlap
      const visibleGenes = rawGenes.filter((g) => g.end >= vStart && g.start <= vEnd);

      visibleGenes.forEach((g, idx) => {
        const gx1 = bpToX(g.start);
        const gx2 = bpToX(g.end);
        const gw = Math.max(4, gx2 - gx1);
        const row = idx % 2;
        const gy = genesY + row * 55;
        const gh = 32;

        const isFwd = g.strand === "+";
        const fillColor = isFwd ? "#2563eb" : "#7c3aed";

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;

        ctx.beginPath();
        const arrowHead = Math.min(16, gw * 0.35);
        if (isFwd) {
          ctx.moveTo(gx1, gy + gh * 0.2);
          ctx.lineTo(gx2 - arrowHead, gy + gh * 0.2);
          ctx.lineTo(gx2 - arrowHead, gy);
          ctx.lineTo(gx2, gy + gh * 0.5);
          ctx.lineTo(gx2 - arrowHead, gy + gh);
          ctx.lineTo(gx2 - arrowHead, gy + gh * 0.8);
          ctx.lineTo(gx1, gy + gh * 0.8);
          ctx.closePath();
        } else {
          ctx.moveTo(gx2, gy + gh * 0.2);
          ctx.lineTo(gx1 + arrowHead, gy + gh * 0.2);
          ctx.lineTo(gx1 + arrowHead, gy);
          ctx.lineTo(gx1, gy + gh * 0.5);
          ctx.lineTo(gx1 + arrowHead, gy + gh);
          ctx.lineTo(gx1 + arrowHead, gy + gh * 0.8);
          ctx.lineTo(gx2, gy + gh * 0.8);
          ctx.closePath();
        }
        ctx.fill();

        if (gw > 45) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px 'Fira Code', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(g.gene, (gx1 + gx2) / 2, gy + gh * 0.5);
        } else if (gw > 12) {
          ctx.fillStyle = "#23211e";
          ctx.font = "10px 'Fira Code', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(g.gene, (gx1 + gx2) / 2, gy - 2);
        }
      });

      // Variants as thin ticks
      const visibleVars = rawVariants.filter((v) => v.pos >= vStart && v.pos <= vEnd);
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = Math.min(2, Math.max(1, width / (visibleVars.length || 1)));

      visibleVars.forEach((v) => {
        const vx = bpToX(v.pos);
        ctx.beginPath();
        ctx.moveTo(vx, varsY);
        ctx.lineTo(vx, varsY + varsH);
        ctx.stroke();
      });

      ctx.fillStyle = "#78716c";
      ctx.font = "11px 'Fira Code', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${visibleGenes.length} genes, ${visibleVars.length} variants in view`, width - 14, height - 16);
    } else if (lvl === 3) {
      // LEVEL 3: Exons on intron lines, lollipops
      const genesY = trackTop + 30;
      const genesH = 140;
      const varsY = genesY + genesH + 40;
      const varsH = 110;

      ctx.fillStyle = "#44403c";
      ctx.font = "600 13px 'Playfair Display', serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText("GENES & EXON STRUCTURE (boxes = exons, line = intron)", 14, genesY - 8);
      ctx.fillText("VARIANTS (lollipop height = Allele Frequency 0..1)", 14, varsY - 8);

      // Gene models
      const visibleGenes = rawGenes.filter((g) => g.end >= vStart && g.start <= vEnd);

      visibleGenes.forEach((g, idx) => {
        const row = idx % 2;
        const gy = genesY + row * 60 + 20;
        const gx1 = bpToX(g.start);
        const gx2 = bpToX(g.end);

        // Intron line
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, gx1), gy);
        ctx.lineTo(Math.min(width, gx2), gy);
        ctx.stroke();

        // Intron directional arrows if space allows
        const intronSpan = gx2 - gx1;
        if (intronSpan > 60) {
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1.5;
          const step = 40;
          for (let ax = gx1 + 20; ax < gx2 - 10; ax += step) {
            if (ax > 0 && ax < width) {
              ctx.beginPath();
              if (g.strand === "+") {
                ctx.moveTo(ax - 4, gy - 4);
                ctx.lineTo(ax + 2, gy);
                ctx.lineTo(ax - 4, gy + 4);
              } else {
                ctx.moveTo(ax + 4, gy - 4);
                ctx.lineTo(ax - 2, gy);
                ctx.lineTo(ax + 4, gy + 4);
              }
              ctx.stroke();
            }
          }
        }

        // Exon boxes
        const geneExons = exonsByGene.get(g.gene) || [];
        geneExons.forEach((ex) => {
          if (ex.end >= vStart && ex.start <= vEnd) {
            const ex1 = bpToX(ex.start);
            const ex2 = bpToX(ex.end);
            const ew = Math.max(3, ex2 - ex1);
            ctx.fillStyle = g.strand === "+" ? "#2563eb" : "#7c3aed";
            ctx.fillRect(ex1, gy - 12, ew, 24);
            ctx.strokeStyle = "#0f172a";
            ctx.lineWidth = 1;
            ctx.strokeRect(ex1, gy - 12, ew, 24);
          }
        });

        // Label
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 12px 'Fira Code', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        const labelX = Math.max(10, gx1);
        ctx.fillText(`${g.gene} (${g.strand})`, labelX, gy - 14);
      });

      // Lollipop variants
      // AF baseline
      const baseLineY = varsY + varsH;
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseLineY);
      ctx.lineTo(width, baseLineY);
      ctx.stroke();

      // Axis ticks for AF
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px 'Fira Code', monospace";
      ctx.textAlign = "left";
      ctx.fillText("AF 1.0", 8, varsY + 10);
      ctx.fillText("AF 0.0", 8, baseLineY - 4);

      const visibleVars = rawVariants.filter((v) => v.pos >= vStart && v.pos <= vEnd);
      const isWideRoom = span < 25000;

      visibleVars.forEach((v) => {
        const vx = bpToX(v.pos);
        const af = Math.max(0, Math.min(1, v.af || 0));
        const stickTop = baseLineY - af * (varsH - 15);

        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(vx, baseLineY);
        ctx.lineTo(vx, stickTop);
        ctx.stroke();

        ctx.fillStyle = "#e11d48";
        ctx.beginPath();
        ctx.arc(vx, stickTop, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (isWideRoom && (vx > 15 && vx < width - 15)) {
          ctx.fillStyle = "#0f172a";
          ctx.font = "10px 'Fira Code', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${v.ref}>${v.alt}`, vx, stickTop - 4);
        }
      });
    } else {
      // LEVEL 4: Base Resolution (< 2 kb)
      const genesY = trackTop + 25;
      const genesH = 95;
      const seqY = genesY + genesH + 30;
      const seqH = 75;
      const varsY = seqY + seqH + 25;

      // Small gene/exon overview on top
      ctx.fillStyle = "#44403c";
      ctx.font = "600 12px 'Playfair Display', serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText("GENOMIC ARCHITECTURE", 14, genesY - 6);

      const visibleGenes = rawGenes.filter((g) => g.end >= vStart && g.start <= vEnd);
      visibleGenes.forEach((g) => {
        const gy = genesY + 20;
        const gx1 = bpToX(g.start);
        const gx2 = bpToX(g.end);

        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, gx1), gy);
        ctx.lineTo(Math.min(width, gx2), gy);
        ctx.stroke();

        const geneExons = exonsByGene.get(g.gene) || [];
        geneExons.forEach((ex) => {
          if (ex.end >= vStart && ex.start <= vEnd) {
            const ex1 = bpToX(ex.start);
            const ex2 = bpToX(ex.end);
            const ew = Math.max(3, ex2 - ex1);
            ctx.fillStyle = g.strand === "+" ? "#2563eb" : "#7c3aed";
            ctx.fillRect(ex1, gy - 10, ew, 20);
          }
        });

        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 11px 'Fira Code', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${g.gene} (${g.strand})`, Math.max(10, gx1), gy - 12);
      });

      // SEQUENCE TRACK
      ctx.fillStyle = "#44403c";
      ctx.font = "600 12px 'Playfair Display', serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText("REFERENCE SEQUENCE (A green, C blue, G orange, T red)", 14, seqY - 8);

      const seqStart = rawSeq.start;
      const seqStr = rawSeq.seq || "";
      const seqEnd = seqStart + seqStr.length;

      // Check overlap
      const hasSeqOverlap = vEnd >= seqStart && vStart <= seqEnd && seqStr.length > 0;

      if (!hasSeqOverlap) {
        ctx.fillStyle = "#f3f4f6";
        ctx.fillRect(0, seqY, width, seqH);
        ctx.strokeStyle = "#d1d5db";
        ctx.strokeRect(0, seqY, width, seqH);

        ctx.fillStyle = "#9ca3af";
        ctx.font = "italic 14px 'Playfair Display', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("sequence not loaded here", width / 2, seqY + seqH / 2);
      } else {
        const bpW = width / (vEnd - vStart);
        const charW = Math.max(1, bpW);
        const fontPx = Math.min(22, Math.max(9, Math.floor(bpW * 0.85)));

        ctx.font = `bold ${fontPx}px 'Fira Code', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const baseColors = {
          A: "#16a34a", // Green
          C: "#2563eb", // Blue
          G: "#ea580c", // Orange
          T: "#dc2626", // Red
        };

        const firstBp = Math.max(seqStart, Math.floor(vStart));
        const lastBp = Math.min(seqEnd - 1, Math.ceil(vEnd));

        // Background card
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, seqY, width, seqH);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, seqY, width, seqH);

        for (let bp = firstBp; bp <= lastBp; bp++) {
          const char = seqStr[bp - seqStart] || "";
          const bx = bpToX(bp);
          const color = baseColors[char] || "#475569";

          // If bpW is large enough, draw letter boxes
          if (bpW >= 8) {
            ctx.fillStyle = color;
            ctx.fillText(char, bx + bpW / 2, seqY + seqH / 2);
          } else {
            // Draw thin vertical colored lines
            ctx.fillStyle = color;
            ctx.fillRect(bx, seqY + 4, Math.max(1, bpW), seqH - 8);
          }
        }
      }

      // VARIANTS HIGHLIGHTED
      ctx.fillStyle = "#44403c";
      ctx.font = "600 12px 'Playfair Display', serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText("VARIANTS IN REGION", 14, varsY + 12);

      const visibleVars = rawVariants.filter((v) => v.pos >= vStart && v.pos <= vEnd);

      visibleVars.forEach((v) => {
        const vx = bpToX(v.pos);
        // Highlight beacon through the sequence track
        ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
        ctx.fillRect(vx - 6, seqY - 4, 12, seqH + 8);

        // Marker diamond / pin
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.arc(vx, varsY + 36, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = "#23211e";
        ctx.font = "bold 11px 'Fira Code', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`${v.ref}>${v.alt}`, vx, varsY + 46);
        ctx.font = "10px 'Fira Code', monospace";
        ctx.fillStyle = "#64748b";
        ctx.fillText(`af:${v.af.toFixed(3)}`, vx, varsY + 60);
      });
    }
  }, [viewState, levelState, rawGenes, rawExons, rawVariants, rawSeq, densityBins]);

  // Pointer interactions: Wheel zoom & drag pan
  const onWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const [vStart, vEnd] = viewRef.current;
    const span = vEnd - vStart;

    const mouseFrac = Math.max(0, Math.min(1, mouseX / canvas.width));
    const mouseBp = vStart + mouseFrac * span;

    const zoomFactor = e.deltaY < 0 ? 0.75 : 1.33;
    const newSpan = span * zoomFactor;

    const newStart = mouseBp - mouseFrac * newSpan;
    const newEnd = mouseBp + (1 - mouseFrac) * newSpan;
    updateView(newStart, newEnd);
  };

  const onMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.focus();
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      viewStart: viewRef.current[0],
      viewEnd: viewRef.current[1],
    };
  };

  const onMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = e.clientX - dragStartRef.current.mouseX;
    const span = dragStartRef.current.viewEnd - dragStartRef.current.viewStart;
    const bpShift = -(dx / canvas.width) * span;

    updateView(
      dragStartRef.current.viewStart + bpShift,
      dragStartRef.current.viewEnd + bpShift
    );
  };

  const onMouseUp = () => {
    isDraggingRef.current = false;
  };

  const onDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const [vStart, vEnd] = viewRef.current;
    const clickBp = vStart + (clickX / canvas.width) * (vEnd - vStart);

    // Find clicked gene
    const clicked = rawGenes.find((g) => clickBp >= g.start && clickBp <= g.end);
    if (clicked) {
      const pad = (clicked.end - clicked.start) * 0.15;
      updateView(clicked.start - pad, clicked.end + pad);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      panByFraction(-0.1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      panByFraction(0.1);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomByFactor(0.7);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomByFactor(1.4);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: "#fdfbf7",
        color: "#23211e",
        padding: "16px",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        userSelect: "none",
        outline: "none",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "12px",
          borderBottom: "1px solid #ebdccb",
          paddingBottom: "8px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              fontFamily: "'Playfair Display', serif, system-ui",
              letterSpacing: "-0.5px",
              color: "#1c1917",
            }}
          >
            Chromosome Explorer &middot; 50 Mb
          </h1>
          <p
            style={{
              margin: "3px 0 0 0",
              fontSize: "12px",
              color: "#78716c",
              fontFamily: "'Fira Code', monospace",
            }}
          >
            Scroll to zoom &middot; Drag to pan &middot; Double-click gene to inspect &middot; Keyboard [← → + -]
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          <LevelBadge level={levelState} view={viewState} />
          <BrowserControls
            onPan={panByFraction}
            onZoom={zoomByFactor}
            onReset={resetView}
          />
        </div>
      </header>

      <div
        style={{
          position: "relative",
          border: "1px solid #e7e2d7",
          borderRadius: "6px",
          overflow: "hidden",
          background: "#fdfbf7",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={920}
          height={TRACK_HEIGHT}
          tabIndex={0}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
          style={{
            display: "block",
            width: "100%",
            height: `${TRACK_HEIGHT}px`,
            cursor: isDraggingRef.current ? "grabbing" : "grab",
            outline: "none",
          }}
        />
      </div>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "10px",
          fontSize: "11px",
          fontFamily: "'Fira Code', monospace",
          color: "#78716c",
        }}
      >
        <span>
          View Window: <strong>{Math.round(viewState[0]).toLocaleString()}</strong> bp &rarr;{" "}
          <strong>{Math.round(viewState[1]).toLocaleString()}</strong> bp
        </span>
        <span>
          420 Genes &middot; 2,687 Exons &middot; 3,000 Variants
        </span>
      </footer>
    </div>
  );
}