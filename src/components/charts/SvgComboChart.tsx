import React, { useState, useRef, useEffect } from 'react';
import { shortNumber } from '../../utils/calculations';

export interface ChartSeries {
  name: string;
  values: number[];
  color: string;
  type?: 'bar' | 'line';
  dash?: boolean;
}

interface SvgComboChartProps {
  categories: string[];
  series: ChartSeries[];
  subtitles?: string[];
  onClickCategory?: (cat: string) => void;
  height?: number;
  theme?: 'dark' | 'light';
}

export const SvgComboChart: React.FC<SvgComboChartProps> = ({
  categories,
  series,
  subtitles,
  onClickCategory,
  height = 200,
  theme = 'dark'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(450);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    sub?: string;
    items: { name: string; val: number; color: string }[];
  } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth || 450);
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
  const txtColor = isLight ? '#1e293b' : '#cbd5e1';
  const mutedColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? '#e2e8f0' : '#1e293b';
  const axisColor = isLight ? '#94a3b8' : '#334155';

  if (!categories || categories.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center text-xs text-slate-400"
        style={{ height }}
      >
        No matching data records to plot
      </div>
    );
  }

  const padL = 52;
  const padR = 16;
  const padT = 28;
  const padB = 46;
  const W = Math.max(260, width);
  const H = Math.max(140, height);
  const plotW = Math.max(50, W - padL - padR);
  const plotH = Math.max(40, H - padT - padB);

  let maxVal = 0;
  series.forEach(s => {
    (s.values || []).forEach(v => {
      if (Number(v) > maxVal) maxVal = Number(v);
    });
  });
  maxVal = (maxVal <= 0 ? 10 : maxVal) * 1.15;

  const barSeries = series.filter(s => s.type !== 'line');
  const lineSeries = series.filter(s => s.type === 'line');
  const nCat = categories.length;
  const catStep = plotW / nCat;
  const groupW = Math.min(catStep * 0.78, 68);
  const nBar = Math.max(1, barSeries.length);
  const barW = Math.max(2.5, groupW / nBar - 2);

  const rotate = nCat > 7;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Legend */}
        {(() => {
          let lx = padL;
          return series.map((s, idx) => {
            const curX = lx;
            lx += s.name.length * 6.5 + 24;
            return (
              <g key={`leg-${idx}`}>
                <rect x={curX} y={6} width={10} height={10} rx={2} fill={s.color} />
                <text x={curX + 14} y={15} fill={txtColor} fontSize={10} fontWeight={600}>
                  {s.name}
                </text>
              </g>
            );
          });
        })()}

        {/* Grid lines and Y labels */}
        {[0, 1, 2, 3, 4].map(i => {
          const val = (maxVal / 4) * i;
          const y = padT + plotH - plotH * (i / 4);
          return (
            <g key={`y-axis-${i}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={gridColor} strokeWidth={1} />
              <text x={padL - 6} y={y + 3.5} fill={mutedColor} fontSize={9.5} textAnchor="end">
                {shortNumber(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {barSeries.map((s, sIdx) => {
          return categories.map((cat, cIdx) => {
            const rawV = Number(s.values[cIdx] || 0);
            const h = Math.max(0, (rawV / maxVal) * plotH);
            const x = padL + cIdx * catStep + catStep / 2 - groupW / 2 + sIdx * (barW + 2);
            const y = padT + plotH - h;

            const handleHover = (e: React.MouseEvent) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              setTooltip({
                x: Math.min(rect.width - 200, e.clientX - rect.left + 12),
                y: Math.max(10, e.clientY - rect.top - 40),
                title: cat,
                sub: subtitles ? subtitles[cIdx] : undefined,
                items: series.map(ser => ({
                  name: ser.name,
                  val: ser.values[cIdx] || 0,
                  color: ser.color
                }))
              });
            };

            return (
              <g key={`bar-${sIdx}-${cIdx}`}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1.5, h)}
                  rx={2}
                  fill={s.color}
                  className={onClickCategory ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                  onClick={() => onClickCategory?.(cat)}
                  onMouseMove={handleHover}
                />
                {rawV > 0 && nCat <= 8 && barW >= 12 && (
                  <text
                    x={x + barW / 2}
                    y={Math.max(padT + 8, y - 3)}
                    fill={txtColor}
                    fontSize={8.5}
                    fontWeight={600}
                    textAnchor="middle"
                  >
                    {shortNumber(rawV)}
                  </text>
                )}
              </g>
            );
          });
        })}

        {/* Lines */}
        {lineSeries.map((s, sIdx) => {
          const pts = categories.map((cat, cIdx) => {
            const v = Number(s.values[cIdx] || 0);
            const x = padL + cIdx * catStep + catStep / 2;
            const y = padT + plotH - Math.max(0, (v / maxVal) * plotH);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          });

          if (pts.length <= 1) return null;
          return (
            <polyline
              key={`line-${sIdx}`}
              fill="none"
              stroke={s.color}
              strokeWidth={2.2}
              strokeDasharray={s.dash ? '4,3' : undefined}
              points={pts.join(' ')}
            />
          );
        })}

        {/* Baseline */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={W - padR}
          y2={padT + plotH}
          stroke={axisColor}
          strokeWidth={1}
        />

        {/* X Category labels */}
        {categories.map((cat, cIdx) => {
          const x = padL + cIdx * catStep + catStep / 2;
          const y = padT + plotH + 13;
          const label = String(cat || '');
          const truncated = label.length > 15 ? label.slice(0, 14) + '…' : label;

          return (
            <text
              key={`cat-lbl-${cIdx}`}
              x={x}
              y={y}
              fill={txtColor}
              fontSize={rotate ? 9 : 9.5}
              textAnchor={rotate ? 'end' : 'middle'}
              transform={rotate ? `rotate(-25, ${x}, ${y})` : undefined}
              className={onClickCategory ? 'cursor-pointer hover:underline' : ''}
              onClick={() => onClickCategory?.(cat)}
            >
              {truncated}
            </text>
          );
        })}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-slate-900/95 border border-slate-700 text-slate-100 px-3 py-2 rounded-md shadow-2xl text-xs backdrop-blur-sm max-w-xs"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-slate-100">{tooltip.title}</div>
          {tooltip.sub && <div className="text-[10.5px] text-slate-400">{tooltip.sub}</div>}
          <div className="mt-1 space-y-0.5 border-t border-slate-700/60 pt-1">
            {tooltip.items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: it.color }} />
                  <span className="text-slate-300">{it.name}:</span>
                </span>
                <span className="font-mono font-semibold text-slate-100">
                  {it.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
