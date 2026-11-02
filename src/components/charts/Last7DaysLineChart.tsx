import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mb51Row, UnitMode, DashboardMeta } from '../../types';
import { pickUnit, shortNumber } from '../../utils/calculations';

interface Last7DaysLineChartProps {
  fMb51: Mb51Row[];
  unitMode: UnitMode;
  meta: DashboardMeta;
  theme: 'dark' | 'light';
  title?: string;
  defaultDays?: number;
  className?: string;
}

interface DailyPoint {
  date: string;
  displayDate: string;
  dayName: string;
  prod: number;
  custDisp: number;
  stoDisp: number;
  totalDisp: number;
  gap: number; // prod - totalDisp
  ratio: number; // (totalDisp / prod) * 100
}

export const Last7DaysLineChart: React.FC<Last7DaysLineChartProps> = ({
  fMb51,
  unitMode,
  meta,
  theme,
  title = 'Last 7 Days: Daily Production vs. Dispatch Volume Trend',
  defaultDays = 7,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(550);
  const [timeRange, setTimeRange] = useState<'7' | '14' | 'ALL'>('7');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showDataLabels, setShowDataLabels] = useState(true);
  const [activeDateIndex, setActiveDateIndex] = useState<number | null>(null);

  // Resize observer
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth || 550);
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const isLight = theme === 'light';
  const txtColor = isLight ? '#0f172a' : '#f8fafc';
  const mutedColor = isLight ? '#64748b' : '#94a3b8';
  const gridColor = isLight ? '#e2e8f0' : '#1e293b';
  const cardBg = isLight ? '#ffffff' : '#0f172a';
  const cardBorder = isLight ? '#cbd5e1' : '#334155';

  // 1. Aggregate MB51 by date
  const allDailyData = useMemo(() => {
    const map: Record<string, { prod: number; cust: number; sto: number }> = {};

    fMb51.forEach(r => {
      const d = r.date || 'Unknown';
      if (!map[d]) map[d] = { prod: 0, cust: 0, sto: 0 };
      const v = pickUnit(r.qty, r.val, unitMode, meta.fx_list);

      if (r.mvt === 101 && r.type !== 'RMPM') {
        map[d].prod += v;
      } else if (r.mvt === 102 && r.type !== 'RMPM') {
        map[d].prod -= v;
      } else if (r.mvt === 601) {
        map[d].cust += v;
      } else if (r.mvt === 602) {
        map[d].cust -= v;
      } else if (r.mvt === 641) {
        map[d].sto += v;
      }
    });

    const sortedDates = Object.keys(map).sort();

    return sortedDates.map(d => {
      const p = Math.max(0, map[d].prod);
      const c = Math.max(0, map[d].cust);
      const s = Math.max(0, map[d].sto);
      const tot = c + s;
      const gap = p - tot;
      const ratio = p > 0 ? (tot / p) * 100 : 0;

      // Format date for display
      let displayDate = d;
      let dayName = '';
      try {
        const parts = d.split('-');
        let dtObj: Date;
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            dtObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            // DD-MM-YYYY
            dtObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          displayDate = `${dtObj.getDate()} ${months[dtObj.getMonth()]}`;
          dayName = days[dtObj.getDay()];
        }
      } catch {
        displayDate = d;
      }

      return {
        date: d,
        displayDate,
        dayName,
        prod: p,
        custDisp: c,
        stoDisp: s,
        totalDisp: tot,
        gap,
        ratio
      } as DailyPoint;
    });
  }, [fMb51, unitMode, meta.fx_list]);

  // Filter based on selected time range
  const chartData = useMemo(() => {
    if (!allDailyData.length) return [];
    if (timeRange === '7') return allDailyData.slice(-7);
    if (timeRange === '14') return allDailyData.slice(-14);
    return allDailyData;
  }, [allDailyData, timeRange]);

  // Compute 7-day summary metrics
  const summary = useMemo(() => {
    if (!chartData.length) {
      return { totalProd: 0, totalDisp: 0, netGap: 0, avgProd: 0, avgDisp: 0, overallRatio: 0, count: 0 };
    }
    const totalProd = chartData.reduce((acc, d) => acc + d.prod, 0);
    const totalDisp = chartData.reduce((acc, d) => acc + d.totalDisp, 0);
    const netGap = totalProd - totalDisp;
    const count = chartData.length;
    const avgProd = count > 0 ? totalProd / count : 0;
    const avgDisp = count > 0 ? totalDisp / count : 0;
    const overallRatio = totalProd > 0 ? (totalDisp / totalProd) * 100 : 0;

    return { totalProd, totalDisp, netGap, avgProd, avgDisp, overallRatio, count };
  }, [chartData]);

  // Dimensions
  const H = 220;
  const padL = 54;
  const padR = 24;
  const padT = 32;
  const padB = 44;
  const W = Math.max(340, width);
  const plotW = Math.max(50, W - padL - padR);
  const plotH = Math.max(40, H - padT - padB);

  // Maximum scale
  const maxVal = useMemo(() => {
    let m = 0;
    chartData.forEach(d => {
      if (d.prod > m) m = d.prod;
      if (d.totalDisp > m) m = d.totalDisp;
      if (showBreakdown) {
        if (d.custDisp > m) m = d.custDisp;
        if (d.stoDisp > m) m = d.stoDisp;
      }
    });
    return (m <= 0 ? 100 : m) * 1.18;
  }, [chartData, showBreakdown]);

  // Calculate coordinates
  const n = chartData.length;
  const stepX = n > 1 ? plotW / (n - 1) : plotW / 2;

  const getX = (idx: number) => {
    if (n === 1) return padL + plotW / 2;
    return padL + idx * stepX;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    return padT + plotH - (clamped / maxVal) * plotH;
  };

  // Build SVG path strings
  const prodPoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.prod) }));
  const dispPoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.totalDisp) }));
  const custPoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.custDisp) }));
  const stoPoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.stoDisp) }));

  const buildPath = (pts: { x: number; y: number }[]) => {
    if (!pts.length) return '';
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`, '');
  };

  const buildAreaPath = (pts: { x: number; y: number }[]) => {
    if (!pts.length) return '';
    const linePath = buildPath(pts);
    const bottomY = (padT + plotH).toFixed(1);
    const lastX = pts[pts.length - 1].x.toFixed(1);
    const firstX = pts[0].x.toFixed(1);
    return `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  const activePoint = activeDateIndex !== null && chartData[activeDateIndex] ? chartData[activeDateIndex] : null;

  return (
    <div className={`flex flex-col h-full w-full select-none ${className}`}>
      {/* Top Header & Executive KPI ribbon */}
      <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex flex-wrap items-center justify-between gap-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-[var(--text-main)] truncate tracking-wide">
            {title}
          </span>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold">
            {timeRange === '7' ? '7-Day View' : timeRange === '14' ? '14-Day View' : 'Full Month'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 text-[10px]">
          {/* Time range toggle */}
          <div className="inline-flex rounded-sm bg-slate-800/60 p-0.5 border border-[var(--border)]">
            <button
              onClick={() => setTimeRange('7')}
              className={`px-1.5 py-0.5 rounded-xs font-semibold transition-colors ${
                timeRange === '7' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('14')}
              className={`px-1.5 py-0.5 rounded-xs font-semibold transition-colors ${
                timeRange === '14' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              14D
            </button>
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-1.5 py-0.5 rounded-xs font-semibold transition-colors ${
                timeRange === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
          </div>

          {/* Breakdown toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            title="Toggle Cust (601) vs STO (641) breakdown"
            className={`px-1.5 py-0.5 rounded border text-[9.5px] font-medium transition-colors ${
              showBreakdown
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-transparent border-[var(--border)] text-slate-400 hover:text-slate-200'
            }`}
          >
            {showBreakdown ? 'Hide 601/641' : 'Split 601/641'}
          </button>

          {/* Value Labels toggle */}
          <button
            onClick={() => setShowDataLabels(!showDataLabels)}
            title="Toggle data labels above vertices"
            className={`px-1.5 py-0.5 rounded border text-[9.5px] font-medium transition-colors ${
              showDataLabels
                ? 'bg-slate-700/60 border-slate-600 text-slate-200'
                : 'bg-transparent border-[var(--border)] text-slate-400 hover:text-slate-200'
            }`}
          >
            Labels
          </button>
        </div>
      </div>

      {/* Mini 7-Day KPI Strip */}
      <div className="px-2.5 py-1 bg-[var(--bg-card)]/50 border-b border-[var(--border)] flex items-center justify-between text-[10px] flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[var(--text-muted)] font-medium">{timeRange === '7' ? '7D' : `${summary.count}D`} Prod:</span>
            <span className="font-bold text-emerald-400">{shortNumber(summary.totalProd)}</span>
            <span className="text-[9px] text-[var(--text-muted)]">({shortNumber(summary.avgProd)}/d)</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[var(--text-muted)] font-medium">{timeRange === '7' ? '7D' : `${summary.count}D`} Disp:</span>
            <span className="font-bold text-blue-400">{shortNumber(summary.totalDisp)}</span>
            <span className="text-[9px] text-[var(--text-muted)]">({shortNumber(summary.avgDisp)}/d)</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[var(--text-muted)] font-medium">Net Gap:</span>
            <span
              className={`font-bold px-1 py-0.2 rounded text-[9.5px] ${
                summary.netGap >= 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {summary.netGap >= 0 ? `+${shortNumber(summary.netGap)} (Surplus)` : `${shortNumber(summary.netGap)} (Drawdown)`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] font-medium">Disp/Prod Ratio:</span>
          <span className={`font-bold ${summary.overallRatio >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {summary.overallRatio.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full p-1 overflow-hidden">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
            No MB51 production or dispatch records found for the selected range
          </div>
        ) : (
          <>
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-full"
              onMouseLeave={() => setActiveDateIndex(null)}
            >
              <defs>
                {/* Emerald Gradient for Production Area */}
                <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="90%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>

                {/* Blue Gradient for Dispatch Area */}
                <linearGradient id="gradDisp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                  <stop offset="90%" stopColor="#3b82f6" stopOpacity="0.01" />
                </linearGradient>

                {/* Glow Filter */}
                <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Legend Row */}
              <g transform="translate(54, 15)">
                {/* Production */}
                <g className="cursor-default">
                  <line x1="0" y1="0" x2="16" y2="0" stroke="#10b981" strokeWidth="2.5" />
                  <circle cx="8" cy="0" r="3" fill="#10b981" />
                  <text x="22" y="3.5" fill={txtColor} fontSize="10" fontWeight="600">
                    Net Production (101/102)
                  </text>
                </g>

                {/* Total Dispatch */}
                <g transform="translate(160, 0)" className="cursor-default">
                  <line x1="0" y1="0" x2="16" y2="0" stroke="#3b82f6" strokeWidth="2.5" />
                  <circle cx="8" cy="0" r="3" fill="#3b82f6" />
                  <text x="22" y="3.5" fill={txtColor} fontSize="10" fontWeight="600">
                    Total Dispatch (601+641)
                  </text>
                </g>

                {/* Breakdown legends if active */}
                {showBreakdown && (
                  <>
                    <g transform="translate(315, 0)">
                      <line x1="0" y1="0" x2="14" y2="0" stroke="#60a5fa" strokeWidth="1.8" strokeDasharray="3 2" />
                      <text x="18" y="3.5" fill={mutedColor} fontSize="9.5">
                        Cust (601)
                      </text>
                    </g>
                    <g transform="translate(395, 0)">
                      <line x1="0" y1="0" x2="14" y2="0" stroke="#06b6d4" strokeWidth="1.8" strokeDasharray="3 2" />
                      <text x="18" y="3.5" fill={mutedColor} fontSize="9.5">
                        STO (641)
                      </text>
                    </g>
                  </>
                )}
              </g>

              {/* Grid Lines & Y-Axis Labels */}
              {[0, 1, 2, 3, 4].map(i => {
                const val = (maxVal / 4) * i;
                const y = padT + plotH - plotH * (i / 4);
                return (
                  <g key={`y-axis-${i}`}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={gridColor} strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 2'} />
                    <text x={padL - 8} y={y + 3.5} fill={mutedColor} fontSize="9.5" textAnchor="end" fontFamily="monospace">
                      {shortNumber(val)}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Area Under Curves */}
              <path d={buildAreaPath(prodPoints)} fill="url(#gradProd)" />
              <path d={buildAreaPath(dispPoints)} fill="url(#gradDisp)" />

              {/* Breakdown Lines if enabled */}
              {showBreakdown && (
                <>
                  <path
                    d={buildPath(custPoints)}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    opacity="0.85"
                  />
                  <path
                    d={buildPath(stoPoints)}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.85"
                  />
                </>
              )}

              {/* Main Line: Total Dispatch (Blue) */}
              <path
                d={buildPath(dispPoints)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glowBlue)"
              />

              {/* Main Line: Production (Emerald Green) */}
              <path
                d={buildPath(prodPoints)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glowGreen)"
              />

              {/* Vertical Guide Line on Active Hover */}
              {activeDateIndex !== null && chartData[activeDateIndex] && (
                <g>
                  <line
                    x1={getX(activeDateIndex)}
                    y1={padT}
                    x2={getX(activeDateIndex)}
                    y2={padT + plotH}
                    stroke={isLight ? '#3b82f6' : '#60a5fa'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.75"
                  />
                  {/* Subtle highlight pill at bottom */}
                  <rect
                    x={getX(activeDateIndex) - 28}
                    y={padT + plotH + 4}
                    width={56}
                    height={16}
                    rx="3"
                    fill={isLight ? '#e0e7ff' : '#1e3a8a'}
                    stroke="#3b82f6"
                    strokeWidth="1"
                  />
                  <text
                    x={getX(activeDateIndex)}
                    y={padT + plotH + 15}
                    fill={isLight ? '#1e40af' : '#bfdbfe'}
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {chartData[activeDateIndex].dayName || chartData[activeDateIndex].displayDate}
                  </text>
                </g>
              )}

              {/* Vertex Markers & Data Labels */}
              {chartData.map((d, i) => {
                const px = getX(i);
                const pyProd = getY(d.prod);
                const pyDisp = getY(d.totalDisp);
                const isHovered = activeDateIndex === i;

                return (
                  <g key={`pts-${i}`}>
                    {/* Interactive hover column rect */}
                    <rect
                      x={px - stepX / 2}
                      y={padT}
                      width={Math.max(20, stepX)}
                      height={plotH}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveDateIndex(i)}
                    />

                    {/* Dispatch Vertex Dot */}
                    <circle
                      cx={px}
                      cy={pyDisp}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#3b82f6"
                      stroke={cardBg}
                      strokeWidth="2"
                      className="transition-all"
                    />

                    {/* Production Vertex Dot */}
                    <circle
                      cx={px}
                      cy={pyProd}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#10b981"
                      stroke={cardBg}
                      strokeWidth="2"
                      className="transition-all"
                    />

                    {/* Optional Value Labels above/below points */}
                    {showDataLabels && (
                      <>
                        {/* Production Label (Green) */}
                        <text
                          x={px}
                          y={pyProd - 7}
                          fill="#10b981"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {shortNumber(d.prod)}
                        </text>

                        {/* Dispatch Label (Blue) */}
                        <text
                          x={px}
                          y={Math.abs(pyProd - pyDisp) < 14 ? pyDisp + 12 : pyDisp - 7}
                          fill="#3b82f6"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {shortNumber(d.totalDisp)}
                        </text>
                      </>
                    )}

                    {/* X-Axis Date Label */}
                    <text
                      x={px}
                      y={padT + plotH + 18}
                      fill={isHovered ? txtColor : mutedColor}
                      fontSize="9"
                      fontWeight={isHovered ? '700' : '500'}
                      textAnchor="middle"
                    >
                      {d.displayDate}
                    </text>
                    {d.dayName && (
                      <text
                        x={px}
                        y={padT + plotH + 28}
                        fill={mutedColor}
                        fontSize="8"
                        textAnchor="middle"
                        opacity="0.8"
                      >
                        {d.dayName}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Floating Hover Card */}
            {activePoint && (
              <div
                className="absolute z-20 pointer-events-none rounded-md p-2 shadow-xl border text-[10.5px] min-w-[190px] transition-all"
                style={{
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  left: Math.min(W - 210, Math.max(10, getX(activeDateIndex!) + 12)),
                  top: Math.max(10, Math.min(H - 120, getY(activePoint.prod) - 30))
                }}
              >
                <div className="font-bold text-[11.5px] pb-1 border-b border-[var(--border)] flex items-center justify-between">
                  <span>{activePoint.date}</span>
                  <span className="text-[9.5px] px-1 py-0.2 rounded bg-slate-700/50 text-slate-300 font-mono">
                    {activePoint.dayName || 'MB51'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 pt-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300 font-sans font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Net Production (101/102):
                    </span>
                    <span className="font-bold text-emerald-400">
                      {activePoint.prod.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300 font-sans font-medium">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Total Dispatch (601+641):
                    </span>
                    <span className="font-bold text-blue-400">
                      {activePoint.totalDisp.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                    </span>
                  </div>

                  {showBreakdown && (
                    <div className="pl-3.5 flex flex-col gap-0.5 text-[9.5px] text-slate-400">
                      <div className="flex justify-between">
                        <span>• Customer (601):</span>
                        <span className="text-blue-300 font-mono">
                          {activePoint.custDisp.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>• STO (641):</span>
                        <span className="text-cyan-300 font-mono">
                          {activePoint.stoDisp.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-1 mt-0.5 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-slate-400 font-sans">Daily Balance:</span>
                    <span
                      className={`font-bold ${
                        activePoint.gap >= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {activePoint.gap >= 0 ? `+${activePoint.gap.toLocaleString('en-IN', { maximumFractionDigits: 1 })} (Surplus)` : `${activePoint.gap.toLocaleString('en-IN', { maximumFractionDigits: 1 })} (Deficit)`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9.5px]">
                    <span className="text-slate-400 font-sans">Dispatch/Prod Ratio:</span>
                    <span className="font-bold text-slate-200">
                      {activePoint.ratio.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
