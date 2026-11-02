import React, { useState } from 'react';
import { DemandRow, RmpmPartRow, Mb51Row, UnitMode, BtsMode, DashboardMeta } from '../../types';
import { calcPartMetrics, pickUnit } from '../../utils/calculations';
import { SvgComboChart } from '../charts/SvgComboChart';
import { Last7DaysLineChart } from '../charts/Last7DaysLineChart';

interface OverviewTabProps {
  meta: DashboardMeta;
  fDemand: DemandRow[];
  fRmpmParts: RmpmPartRow[];
  fMb51: Mb51Row[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  theme: 'dark' | 'light';
  onFilterMf?: (mf: string) => void;
  onFilterCustomer?: (cust: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  meta,
  fDemand,
  fRmpmParts,
  fMb51,
  unitMode,
  btsMode,
  theme,
  onFilterMf,
  onFilterCustomer
}) => {
  const [maximizedPanel, setMaximizedPanel] = useState<'none' | 'trend7d' | 'mf' | 'cust' | 'rmpm'>('none');
  const [chartMode2, setChartMode2] = useState<'7day_line' | 'month_combo'>('7day_line');

  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);

  // 1. Minifactory Aggregation
  const mfAgg: Record<string, { plan: number; ttd: number; prod: number }> = {};
  fDemand.forEach(r => {
    const k = r.minifactory || r.line || 'MF';
    if (!mfAgg[k]) mfAgg[k] = { plan: 0, ttd: 0, prod: 0 };
    const m = calcPartMetrics(r, btsMode, meta);
    mfAgg[k].plan += pick(m.planQ, m.planV);
    mfAgg[k].ttd += pick(m.ttdQ, m.ttdV);
    mfAgg[k].prod += pick(m.prodQ, m.prodV);
  });
  const mfs = Object.keys(mfAgg).sort();

  // 2. Full Month MB51 Aggregation (for optional monthly combo view)
  const dMap: Record<string, { fgProd: number; rmpmGrn: number; d601: number; d641: number }> = {};
  fMb51.forEach(r => {
    const d = r.date || 'Post';
    if (!dMap[d]) dMap[d] = { fgProd: 0, rmpmGrn: 0, d601: 0, d641: 0 };
    const v = pick(r.qty, r.val);
    if (r.mvt === 101 || r.mvt === 102) {
      if (r.type === 'RMPM') dMap[d].rmpmGrn += v;
      else dMap[d].fgProd += v;
    } else if (r.mvt === 601 || r.mvt === 602) {
      dMap[d].d601 += v;
    } else if (r.mvt === 641) {
      dMap[d].d641 += v;
    }
  });
  const dates = Object.keys(dMap).sort();

  // 3. Customer-wise Performance
  const cMap: Record<string, { plan: number; ttd: number; prod: number }> = {};
  fDemand.forEach(r => {
    const c = r.customer || r.desc;
    if (!cMap[c]) cMap[c] = { plan: 0, ttd: 0, prod: 0 };
    const m = calcPartMetrics(r, btsMode, meta);
    cMap[c].plan += pick(m.planQ, m.planV);
    cMap[c].ttd += pick(m.ttdQ, m.ttdV);
    cMap[c].prod += pick(m.prodQ, m.prodV);
  });
  const custs = Object.keys(cMap).sort((a, b) => cMap[b].plan - cMap[a].plan);

  // 4. Monitored RMPM Overview
  const rmMf: Record<string, { sched: number; grn: number; stk: number }> = {};
  fRmpmParts.forEach(r => {
    const k = r.minifactory || r.line || r.desc || r.part;
    if (!rmMf[k]) rmMf[k] = { sched: 0, grn: 0, stk: 0 };
    rmMf[k].sched += pick(r.sched_total_qty, r.sched_total_val);
    rmMf[k].grn += pick(r.grn_qty, r.grn_val);
    rmMf[k].stk += pick(r.total_stock_qty, r.total_stock_val);
  });
  const rmKeys = Object.keys(rmMf).sort();

  // If a panel is maximized
  if (maximizedPanel === 'trend7d') {
    return (
      <div className="w-full h-full p-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[var(--text-main)]">
              Expanded View: 7-Day Production vs. Dispatch Trend
            </span>
          </div>
          <button
            onClick={() => setMaximizedPanel('none')}
            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-semibold transition-colors"
          >
            ✕ Restore Grid
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Last7DaysLineChart
            fMb51={fMb51}
            unitMode={unitMode}
            meta={meta}
            theme={theme}
            defaultDays={7}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-1.5 w-full h-full min-h-0 overflow-hidden">
      {/* 1. Minifactory Performance */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
        <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
            Minifactory Performance: Plan vs TTD vs Production (101/102)
          </span>
          <span className="text-[9.5px] text-blue-400 font-semibold cursor-default">
            Click bar to filter MF
          </span>
        </div>
        <div className="flex-1 min-h-0 p-1">
          <SvgComboChart
            categories={mfs}
            series={[
              { name: 'Monthly Plan', values: mfs.map(k => mfAgg[k].plan), color: '#64748b' },
              { name: 'Target Till Date', values: mfs.map(k => mfAgg[k].ttd), color: '#f59e0b' },
              { name: 'Prod Till Date', values: mfs.map(k => mfAgg[k].prod), color: '#10b981' }
            ]}
            onClickCategory={onFilterMf}
            theme={theme}
          />
        </div>
      </div>

      {/* 2. Last 7 Days Trend: Production vs. Dispatch Volumes */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs ring-1 ring-emerald-500/20">
        {chartMode2 === '7day_line' ? (
          <div className="flex flex-col h-full w-full min-h-0">
            {/* Header controls embedded in Last7DaysLineChart, with toggle to switch back to monthly combo & expand */}
            <div className="flex-1 min-h-0">
              <Last7DaysLineChart
                fMb51={fMb51}
                unitMode={unitMode}
                meta={meta}
                theme={theme}
                defaultDays={7}
              />
            </div>
            {/* Bottom utility bar */}
            <div className="px-2 py-0.5 border-t border-[var(--border)] bg-[var(--bg-hdr)]/40 flex items-center justify-between text-[9px] text-[var(--text-muted)] flex-shrink-0">
              <span>Immediate 7-Day Trend: Net Prod (101/102) vs Total Disp (601+641)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChartMode2('month_combo')}
                  className="hover:text-blue-400 text-slate-400 underline decoration-dotted transition-colors"
                >
                  Switch to Month Combo View
                </button>
                <span>•</span>
                <button
                  onClick={() => setMaximizedPanel('trend7d')}
                  className="hover:text-emerald-400 text-slate-400 font-semibold transition-colors"
                >
                  ⛶ Expand Chart
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full min-h-0">
            <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
                MB51 Full Month: Daily Production &amp; Dispatch
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setChartMode2('7day_line')}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9.5px] transition-colors shadow-xs"
                >
                  ◀ Back to 7-Day Line Trend
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-1">
              <SvgComboChart
                categories={dates}
                series={[
                  { name: 'FG Prod (101/102)', values: dates.map(d => dMap[d].fgProd), color: '#10b981' },
                  { name: 'RMPM GRN (101/102)', values: dates.map(d => dMap[d].rmpmGrn), color: '#f59e0b' },
                  { name: 'Cust Disp (601)', values: dates.map(d => dMap[d].d601), color: '#3b82f6', type: 'line' },
                  { name: 'STO Disp (641)', values: dates.map(d => dMap[d].d641), color: '#06b6d4', type: 'line', dash: true }
                ]}
                theme={theme}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Customer Wise Performance */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
        <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
            Customer Wise Plan vs Target Till Date vs Production Till Date
          </span>
          <span className="text-[9.5px] text-blue-400 font-semibold cursor-default">
            Click bar to filter Customer
          </span>
        </div>
        <div className="flex-1 min-h-0 p-1">
          <SvgComboChart
            categories={custs}
            series={[
              { name: 'Monthly Plan', values: custs.map(c => cMap[c].plan), color: '#64748b' },
              { name: 'Target Till Date', values: custs.map(c => cMap[c].ttd), color: '#f59e0b' },
              { name: 'Prod Till Date', values: custs.map(c => cMap[c].prod), color: '#10b981' }
            ]}
            onClickCategory={onFilterCustomer}
            theme={theme}
          />
        </div>
      </div>

      {/* 4. Monitored RMPM Summary */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
        <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
            Monitored RMPM: Supplier Schedule vs MB51 Receipt vs MB52 Stock
          </span>
        </div>
        <div className="flex-1 min-h-0 p-1">
          <SvgComboChart
            categories={rmKeys}
            series={[
              { name: 'Supplier Schedule', values: rmKeys.map(k => rmMf[k].sched), color: '#f59e0b' },
              { name: 'Received (101/102)', values: rmKeys.map(k => rmMf[k].grn), color: '#10b981' },
              { name: 'MB52 Stock (Unr+QA)', values: rmKeys.map(k => rmMf[k].stk), color: '#8b5cf6' }
            ]}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
};
