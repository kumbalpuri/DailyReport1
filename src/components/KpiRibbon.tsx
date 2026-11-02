import React from 'react';
import { DemandRow, RmpmPartRow, Mb51Row, Mb52Row, UnitMode, BtsMode, DashboardMeta, TabType } from '../types';
import { calcPartMetrics, calcDispatchMetrics, pickUnit, formatUnit } from '../utils/calculations';
import { ChevronDown } from 'lucide-react';

interface KpiRibbonProps {
  meta: DashboardMeta;
  activeTab: TabType;
  fDemand: DemandRow[];
  fRmpmParts: RmpmPartRow[];
  fMb51: Mb51Row[];
  fMb52: Mb52Row[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  collapsed?: boolean;
  onExpand?: () => void;
  onCardClick?: (e: React.MouseEvent) => void;
}

export const KpiRibbon: React.FC<KpiRibbonProps> = ({
  meta,
  activeTab,
  fDemand,
  fRmpmParts,
  fMb51,
  fMb52,
  unitMode,
  btsMode,
  collapsed = false,
  onExpand,
  onCardClick
}) => {
  let planSum = 0;
  let targetTdSum = 0;
  let prodSum = 0;
  let yestSum = 0;
  let runRateSum = 0;
  let askSum = 0;
  let btsSum = 0;
  let yestDispSum = 0;

  // Dispatch-specific sums from Demand rows
  let dispTdSum = 0;
  let disp601DemandSum = 0;
  let disp641DemandSum = 0;
  let dispRunRateSum = 0;
  let dispAskSum = 0;
  let dispPendSum = 0;

  fDemand.forEach(r => {
    const m = calcPartMetrics(r, btsMode, meta);
    const dm = calcDispatchMetrics(r, btsMode, meta);
    planSum += pickUnit(m.planQ, m.planV, unitMode, meta.fx_list);
    targetTdSum += pickUnit(m.ttdQ, m.ttdV, unitMode, meta.fx_list);
    prodSum += pickUnit(m.prodQ, m.prodV, unitMode, meta.fx_list);
    yestSum += pickUnit(r.yest_prod_qty, r.yest_prod_val, unitMode, meta.fx_list);
    runRateSum += pickUnit(m.runRateQ, m.runRateV, unitMode, meta.fx_list);
    askSum += pickUnit(m.askRateQ, m.askRateV, unitMode, meta.fx_list);
    btsSum += pickUnit(r.bts_qty, r.bts_val, unitMode, meta.fx_list);
    yestDispSum += pickUnit(r.yest_disp_qty, r.yest_disp_val, unitMode, meta.fx_list);

    dispTdSum += pickUnit(dm.dispQ, dm.dispV, unitMode, meta.fx_list);
    disp601DemandSum += pickUnit(dm.disp601Q, dm.disp601V, unitMode, meta.fx_list);
    disp641DemandSum += pickUnit(dm.disp641Q, dm.disp641V, unitMode, meta.fx_list);
    dispRunRateSum += pickUnit(dm.runRateQ, dm.runRateV, unitMode, meta.fx_list);
    dispAskSum += pickUnit(dm.askRateQ, dm.askRateV, unitMode, meta.fx_list);
    dispPendSum += pickUnit(dm.pendDispQ, dm.pendDispV, unitMode, meta.fx_list);
  });

  let disp601 = 0;
  let disp641 = 0;
  let yestDispMb51 = 0;
  const latestIso = meta.latest_date_iso;

  fMb51.forEach(r => {
    const v = pickUnit(r.qty, r.val, unitMode, meta.fx_list);
    if (r.mvt === 601 || r.mvt === 602) {
      disp601 += v;
      if (r.date === latestIso) yestDispMb51 += v;
    } else if (r.mvt === 641) {
      disp641 += v;
      if (r.date === latestIso) yestDispMb51 += v;
    }
  });

  const effectiveDispTot = dispTdSum > 0 ? dispTdSum : disp601 + disp641;
  const effectiveDisp601 = disp601DemandSum > 0 ? disp601DemandSum : disp601;
  const effectiveDisp641 = disp641DemandSum > 0 ? disp641DemandSum : disp641;

  const achTdPct = targetTdSum > 0 ? (prodSum / targetTdSum) * 100.0 : 0.0;
  const achMonthPct = planSum > 0 ? (prodSum / planSum) * 100.0 : 0.0;

  const dispAchTdPct = targetTdSum > 0 ? (effectiveDispTot / targetTdSum) * 100.0 : 0.0;
  const dispAchMonthPct = planSum > 0 ? (effectiveDispTot / planSum) * 100.0 : 0.0;

  let unrSum = 0;
  let qaSum = 0;
  let totStk = 0;
  fMb52.forEach(r => {
    unrSum += pickUnit(r.unrest_qty, r.unrest_val, unitMode, meta.fx_list);
    qaSum += pickUnit(r.qual_qty, r.qual_val, unitMode, meta.fx_list);
    totStk += pickUnit(r.total_qty, r.total_val, unitMode, meta.fx_list);
  });

  let rmpmSched = 0;
  let rmpmYestGrn = 0;
  let rmpmGap = 0;
  fRmpmParts.forEach(r => {
    rmpmSched += pickUnit(r.sched_total_qty, r.sched_total_val, unitMode, meta.fx_list);
    rmpmYestGrn += pickUnit(r.yest_grn_qty, r.yest_grn_val, unitMode, meta.fx_list);
    rmpmGap += pickUnit(r.gap_total_qty, r.gap_total_val, unitMode, meta.fx_list);
  });

  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const isDispatchView = activeTab === 'dispatch';

  if (collapsed) {
    return (
      <section className="flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border)] rounded-md px-2.5 py-1 text-[10.5px] flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span>
            <span className="text-[var(--text-muted)] uppercase font-bold">Plan: </span>
            <strong className="font-mono text-[var(--text-main)]">{fmt(planSum)}</strong>
          </span>
          <span>
            <span className="text-[var(--text-muted)] uppercase font-bold">TTD: </span>
            <strong className="font-mono text-amber-400">{fmt(targetTdSum)}</strong>
          </span>
          <span>
            <span className="text-[var(--text-muted)] uppercase font-bold">Prod: </span>
            <strong className="font-mono text-emerald-400">
              {fmt(prodSum)} ({achTdPct.toFixed(1)}%)
            </strong>
          </span>
          <span>
            <span className="text-[var(--text-muted)] uppercase font-bold">Dispatch (601+641): </span>
            <strong className="font-mono text-cyan-400">
              {fmt(effectiveDispTot)} ({dispAchTdPct.toFixed(1)}%)
            </strong>
          </span>
          <span>
            <span className="text-[var(--text-muted)] uppercase font-bold">
              {isDispatchView ? 'Disp Ask/Day: ' : 'Prod Ask/Day: '}
            </span>
            <strong className="font-mono text-amber-400">
              {fmt(isDispatchView ? dispAskSum : askSum)}
            </strong>
          </span>
          <span>
            <span className="text-[var(--text-muted)] uppercase font-bold">MB52 Stock: </span>
            <strong className="font-mono text-purple-400">{fmt(totStk)}</strong>
          </span>
        </div>
        {onExpand && (
          <button
            onClick={onExpand}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 text-[9.5px] font-bold cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
            <span>Expand KPIs</span>
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5 h-auto lg:h-[64px] w-full flex-shrink-0">
      {/* 1. Plan Card */}
      <div
        onClick={onCardClick}
        className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-blue-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
      >
        <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          <span className="truncate">
            {isDispatchView ? 'Dispatch Plan' : 'Plan'} ({btsMode === 'WITH_BTS' ? 'With BTS' : 'No BTS'})
          </span>
          <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
            {meta.prorata_pct}% DUE
          </span>
        </div>
        <div className="text-[15px] font-black text-[var(--text-main)] truncate font-mono leading-tight">
          {fmt(planSum)}
        </div>
        <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
          <span>Target Till Date:</span>
          <strong className="text-[var(--text-main)] font-semibold font-mono">{fmt(targetTdSum)}</strong>
        </div>
      </div>

      {/* 2. Dispatch or Prod Till Date Card (swaps priority on Dispatch tab) */}
      {isDispatchView ? (
        <div
          onClick={onCardClick}
          className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-cyan-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
        >
          <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span className="truncate">Dispatch Till Date (601+641)</span>
            <span className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
              {dispAchTdPct.toFixed(1)}% vs TTD
            </span>
          </div>
          <div className="text-[15px] font-black text-cyan-400 truncate font-mono leading-tight">
            {fmt(effectiveDispTot)}
          </div>
          <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
            <span>Yest: {fmt(yestDispMb51 || yestDispSum)}</span>
            <span className="font-semibold text-slate-300">Month: {dispAchMonthPct.toFixed(1)}%</span>
          </div>
        </div>
      ) : (
        <div
          onClick={onCardClick}
          className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-emerald-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
        >
          <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span className="truncate">Prod Till Date (101/102)</span>
            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
              {achTdPct.toFixed(1)}% vs TTD
            </span>
          </div>
          <div className="text-[15px] font-black text-emerald-400 truncate font-mono leading-tight">
            {fmt(prodSum)}
          </div>
          <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
            <span>Yest: {fmt(yestSum)}</span>
            <span className="font-semibold text-slate-300">Month: {achMonthPct.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* 3. Asking Rate Card (Dispatch Asking Rate when on Dispatch Tab, Prod Asking Rate otherwise) */}
      <div
        onClick={onCardClick}
        className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-amber-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
      >
        <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          <span className="truncate">
            {isDispatchView ? 'Dispatch Asking / Day' : 'Asking Rate / Day'}
          </span>
          <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
            {meta.remaining_working_days} Days Left
          </span>
        </div>
        <div className="text-[15px] font-black text-amber-400 truncate font-mono leading-tight">
          {fmt(isDispatchView ? dispAskSum : askSum)}
        </div>
        <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
          <span>Run Rate: {fmt(isDispatchView ? dispRunRateSum : runRateSum)}</span>
          <span>{isDispatchView ? `Pend: ${fmt(dispPendSum)}` : `BTS: ${fmt(btsSum)}`}</span>
        </div>
      </div>

      {/* 4. Dispatch Breakdown or Prod Comparison Card */}
      {isDispatchView ? (
        <div
          onClick={onCardClick}
          className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-emerald-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
        >
          <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span className="truncate">Cust (601) vs STO (641)</span>
            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
              PROD: {achTdPct.toFixed(0)}%
            </span>
          </div>
          <div className="text-[15px] font-black text-blue-400 truncate font-mono leading-tight">
            {fmt(effectiveDisp601)} <span className="text-[10px] text-cyan-400 font-normal">/ {fmt(effectiveDisp641)}</span>
          </div>
          <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
            <span>Prod TTD: {fmt(prodSum)}</span>
            <span>Yest Prod: {fmt(yestSum)}</span>
          </div>
        </div>
      ) : (
        <div
          onClick={onCardClick}
          className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-cyan-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
        >
          <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span className="truncate">Dispatch (Yesterday/MTD)</span>
            <span className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
              601/602 + 641
            </span>
          </div>
          <div className="text-[15px] font-black text-cyan-400 truncate font-mono leading-tight">
            {fmt(effectiveDispTot)}
          </div>
          <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
            <span>Yest: {fmt(yestDispMb51 || yestDispSum)}</span>
            <span>601: {fmt(effectiveDisp601)}</span>
          </div>
        </div>
      )}

      {/* 5. Stock Card */}
      <div
        onClick={onCardClick}
        className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-purple-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
      >
        <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          <span className="truncate">Current Stock (MB52)</span>
          <span className="bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
            MB52
          </span>
        </div>
        <div className="text-[15px] font-black text-purple-400 truncate font-mono leading-tight">
          {fmt(totStk)}
        </div>
        <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
          <span>Unrest: {fmt(unrSum)}</span>
          <span>Qual: {fmt(qaSum)}</span>
        </div>
      </div>

      {/* 6. RMPM & Vendor Card */}
      <div
        onClick={onCardClick}
        className="kpi-card bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-rose-500 rounded-md px-2 py-1 flex flex-col justify-between shadow-xs transition-transform hover:translate-y-[-1px]"
      >
        <div className="flex justify-between items-center text-[8.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          <span className="truncate">RMPM &amp; Vendor Adherence</span>
          <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 px-1 py-0 rounded text-[8px] font-extrabold flex-shrink-0">
            VENDOR
          </span>
        </div>
        <div className="text-[15px] font-black text-slate-200 truncate font-mono leading-tight">
          {fmt(rmpmSched)}
        </div>
        <div className="flex justify-between items-center text-[8.5px] text-[var(--text-muted)] truncate">
          <span>Yest GRN: {fmt(rmpmYestGrn)}</span>
          <span className="text-amber-400 font-semibold">Gap: {fmt(rmpmGap)}</span>
        </div>
      </div>
    </section>
  );
};
