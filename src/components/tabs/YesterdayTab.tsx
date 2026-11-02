import React, { useState, useMemo } from 'react';
import {
  DemandRow,
  RmpmPartRow,
  Mb51Row,
  UnitMode,
  BtsMode,
  DashboardMeta,
  YesterdaySubView,
  PopoutReportMode
} from '../../types';
import { calcPartMetrics, pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import {
  Maximize2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Factory,
  Package,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles
} from 'lucide-react';

interface YesterdayTabProps {
  meta: DashboardMeta;
  fDemand: DemandRow[];
  fRmpmParts: RmpmPartRow[];
  fMb51: Mb51Row[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  openPopoutWithMode: (mode: PopoutReportMode) => void;
  onSelectPart?: (part: string) => void;
}

export const YesterdayTab: React.FC<YesterdayTabProps> = ({
  meta,
  fDemand,
  fRmpmParts,
  fMb51,
  unitMode,
  btsMode,
  leftCollapsed,
  setLeftCollapsed,
  openPopoutWithMode,
  onSelectPart
}) => {
  // Default to 'PROD' so user instantly sees "How much qty produced", with 1-click toggles to DISPATCH and RMPM
  const [subView, setSubView] = useState<YesterdaySubView>('PROD');
  const [searchQuery, setSearchQuery] = useState('');

  const nQ = (v: number) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);
  const latestIso = meta.latest_date_iso;

  // -------------------------------------------------------------
  // 1. DISPATCH CALCULATIONS (Yesterday MB51 MvT 601, 602, 641)
  // -------------------------------------------------------------
  let yestDisp601Q = 0;
  let yestDisp602RevQ = 0;
  let yestDisp641Q = 0;
  let yestDispPriceVal = 0;
  let yestDisp601Val = 0;
  let yestDisp641Val = 0;
  let mtdDisp601Q = 0;
  let mtdDisp641Q = 0;
  let mtdDispPriceVal = 0;
  const yestCustomersServed = new Set<string>();
  const yestPartsDispatched = new Set<string>();

  fMb51.forEach(r => {
    if (r.mvt === 601 || r.mvt === 602 || r.mvt === 641) {
      if (r.date <= latestIso) {
        if (r.mvt === 601 || r.mvt === 602) mtdDisp601Q += r.qty;
        if (r.mvt === 641) mtdDisp641Q += r.qty;
        mtdDispPriceVal += r.price_val || 0;
      }
      if (r.date === latestIso) {
        if (r.mvt === 601 || r.mvt === 602) {
          yestDisp601Q += r.qty;
          yestDisp601Val += r.price_val || 0;
          if (r.mvt === 602) yestDisp602RevQ += Math.abs(r.qty);
        }
        if (r.mvt === 641) {
          yestDisp641Q += r.qty;
          yestDisp641Val += r.price_val || 0;
        }
        yestDispPriceVal += r.price_val || 0;
        if (r.qty > 0) {
          if (r.customer) yestCustomersServed.add(r.customer);
          if (r.part) yestPartsDispatched.add(r.part);
        }
      }
    }
  });

  const yestDispTotQ = yestDisp601Q + yestDisp641Q;
  const yestDispMn = yestDispPriceVal / 1000000.0;
  const mtdDispTotQ = mtdDisp601Q + mtdDisp641Q;
  const mtdDispMn = mtdDispPriceVal / 1000000.0;

  // -------------------------------------------------------------
  // 2. PRODUCTION CALCULATIONS (Yesterday MB51 MvT 101, 102 & Demand)
  // -------------------------------------------------------------
  let yestProd101Gross = 0;
  let yestProd102Rev = 0;
  fMb51.forEach(r => {
    if (r.date === latestIso) {
      if (r.mvt === 101) yestProd101Gross += r.qty;
      if (r.mvt === 102) yestProd102Rev += Math.abs(r.qty);
    }
  });

  const fgRowsWithMetrics = useMemo(() => {
    return fDemand.map(r => ({
      row: r,
      m: calcPartMetrics(r, btsMode, meta)
    }));
  }, [fDemand, btsMode, meta]);

  let yestProdTotQ = 0;
  let yestProdTotVal = 0;
  let yestPlanTotQ = 0;
  let yestPlanTotVal = 0;
  let yestProdHitsCount = 0;
  let yestProdMissCount = 0;

  fgRowsWithMetrics.forEach(({ row: r, m }) => {
    yestProdTotQ += r.yest_prod_qty || 0;
    yestProdTotVal += r.yest_prod_val || 0;
    yestPlanTotQ += m.yestPlanQ || 0;
    yestPlanTotVal += m.yestPlanV || 0;
    if (m.yestPlanQ > 0) {
      if ((r.yest_prod_qty || 0) >= m.yestPlanQ * 0.95) {
        yestProdHitsCount++;
      } else {
        yestProdMissCount++;
      }
    }
  });

  const yestProdAchPct = yestPlanTotQ > 0 ? (yestProdTotQ / yestPlanTotQ) * 100 : 0;
  const yestProdMn = yestProdTotVal / 1000000.0;
  const yestProdGapQ = yestProdTotQ - yestPlanTotQ;

  // -------------------------------------------------------------
  // 3. RM / PM CALCULATIONS (Yesterday Scheduled Plan vs Actual GRN)
  // -------------------------------------------------------------
  let yestRmSchedQ = 0;
  let yestRmSchedVal = 0;
  let yestRmActQ = 0;
  let yestRmActVal = 0;
  let yestRmGapQ = 0;
  let yestRmHitVendors = 0;
  let yestRmMissVendors = 0;

  fRmpmParts.forEach(r => {
    yestRmSchedQ += r.sched_yest_qty || 0;
    yestRmSchedVal += r.sched_yest_val || 0;
    yestRmActQ += r.yest_grn_qty || 0;
    yestRmActVal += r.yest_grn_val || 0;
    yestRmGapQ += r.yest_gap_qty || 0;
    if (r.sched_yest_qty > 0) {
      if (r.yest_grn_qty >= r.sched_yest_qty * 0.95) {
        yestRmHitVendors++;
      } else {
        yestRmMissVendors++;
      }
    }
  });

  const yestRmAdhPct = yestRmSchedQ > 0 ? (yestRmActQ / yestRmSchedQ) * 100 : 100;
  const yestRmActMn = yestRmActVal / 1000000.0;
  const yestRmSchedMn = yestRmSchedVal / 1000000.0;

  // -------------------------------------------------------------
  // Line & Customer Aggregations for Breakdown Tables & Charts
  // -------------------------------------------------------------
  const lineProductionData = useMemo(() => {
    const map: Record<string, { line: string; planQ: number; prodQ: number; valMn: number }> = {};
    fgRowsWithMetrics.forEach(({ row: r, m }) => {
      const line = r.line || 'Unassigned';
      if (!map[line]) map[line] = { line, planQ: 0, prodQ: 0, valMn: 0 };
      map[line].planQ += m.yestPlanQ || 0;
      map[line].prodQ += r.yest_prod_qty || 0;
      map[line].valMn += (r.yest_prod_val || 0) / 1000000.0;
    });
    return Object.values(map).sort((a, b) => b.prodQ - a.prodQ);
  }, [fgRowsWithMetrics]);

  const customerDispatchData = useMemo(() => {
    const map: Record<string, { customer: string; disp601: number; disp641: number; dispTot: number; valMn: number }> = {};
    fgRowsWithMetrics.forEach(({ row: r }) => {
      const cust = r.customer || 'Other';
      if (!map[cust]) map[cust] = { customer: cust, disp601: 0, disp641: 0, dispTot: 0, valMn: 0 };
      map[cust].disp601 += r.yest_disp_601_qty || 0;
      map[cust].disp641 += r.yest_disp_641_qty || 0;
      map[cust].dispTot += r.yest_disp_qty || 0;
      map[cust].valMn += (r.yest_disp_val || 0) / 1000000.0;
    });
    return Object.values(map).sort((a, b) => b.dispTot - a.dispTot);
  }, [fgRowsWithMetrics]);

  // Filtering for table rows
  const queryStr = searchQuery.toLowerCase().trim();

  const filteredProdRows = useMemo(() => {
    return fgRowsWithMetrics.filter(({ row: r }) => {
      if (!queryStr) return true;
      return (
        r.part.toLowerCase().includes(queryStr) ||
        r.desc.toLowerCase().includes(queryStr) ||
        r.customer.toLowerCase().includes(queryStr) ||
        r.line.toLowerCase().includes(queryStr)
      );
    });
  }, [fgRowsWithMetrics, queryStr]);

  const filteredDispatchRows = useMemo(() => {
    return fgRowsWithMetrics.filter(({ row: r }) => {
      if (!queryStr) return true;
      return (
        r.part.toLowerCase().includes(queryStr) ||
        r.desc.toLowerCase().includes(queryStr) ||
        r.customer.toLowerCase().includes(queryStr) ||
        r.line.toLowerCase().includes(queryStr)
      );
    });
  }, [fgRowsWithMetrics, queryStr]);

  const filteredRmpmRows = useMemo(() => {
    return fRmpmParts.filter(r => {
      if (!queryStr) return true;
      return (
        r.part.toLowerCase().includes(queryStr) ||
        r.desc.toLowerCase().includes(queryStr) ||
        (r.supplier && r.supplier.toLowerCase().includes(queryStr)) ||
        (r.line && r.line.toLowerCase().includes(queryStr))
      );
    });
  }, [fRmpmParts, queryStr]);

  const yesterdayMisses = useMemo(() => {
    return fgRowsWithMetrics
      .filter(({ row: r, m }) => {
        if (
          queryStr &&
          !(
            r.part.toLowerCase().includes(queryStr) ||
            r.desc.toLowerCase().includes(queryStr) ||
            r.customer.toLowerCase().includes(queryStr) ||
            r.line.toLowerCase().includes(queryStr)
          )
        ) {
          return false;
        }
        return m.yestPlanQ > 0 && (r.yest_prod_qty || 0) < m.yestPlanQ * 0.95;
      })
      .sort((a, b) => {
        const gapA = a.m.yestPlanQ - (a.row.yest_prod_qty || 0);
        const gapB = b.m.yestPlanQ - (b.row.yest_prod_qty || 0);
        return gapB - gapA;
      });
  }, [fgRowsWithMetrics, queryStr]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (subView === 'PROD') {
      const rows = filteredProdRows.map(({ row: r, m }) => ({
        part: r.part,
        desc: r.desc,
        customer: r.customer,
        line: r.line,
        dailyPlan: pick(m.yestPlanQ, m.yestPlanV),
        yestProd: pick(r.yest_prod_qty, r.yest_prod_val),
        achPct: m.yestPlanQ > 0 ? ((r.yest_prod_qty / m.yestPlanQ) * 100).toFixed(1) + '%' : '100%',
        gap: pick(m.yestPlanQ, m.yestPlanV) - pick(r.yest_prod_qty, r.yest_prod_val),
        stock: pick(r.stock_total_qty, r.stock_total_val),
        prodVal: r.yest_prod_val
      }));
      exportToCSV(
        rows,
        [
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'customer', label: 'Customer' },
          { key: 'line', label: 'Line' },
          { key: 'dailyPlan', label: 'Daily Plan Target' },
          { key: 'yestProd', label: 'Yesterday Produced (101/102)' },
          { key: 'achPct', label: '% Achieved' },
          { key: 'gap', label: 'Shortfall/Surplus' },
          { key: 'stock', label: 'Current MB52 Stock' },
          { key: 'prodVal', label: 'Production Value (INR)' }
        ],
        `Yesterday_Production_${latestIso}.csv`
      );
    } else if (subView === 'DISPATCH') {
      const rows = filteredDispatchRows.map(({ row: r }) => ({
        part: r.part,
        desc: r.desc,
        customer: r.customer,
        line: r.line,
        disp601: pick(r.yest_disp_601_qty, r.yest_disp_601_val),
        disp641: pick(r.yest_disp_641_qty, r.yest_disp_641_val),
        dispTot: pick(r.yest_disp_qty, r.yest_disp_val),
        dispVal: r.yest_disp_val,
        stock: pick(r.stock_total_qty, r.stock_total_val)
      }));
      exportToCSV(
        rows,
        [
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'customer', label: 'Customer' },
          { key: 'line', label: 'Line' },
          { key: 'disp601', label: 'Customer Dispatch (601)' },
          { key: 'disp641', label: 'STO Inter-Plant (641)' },
          { key: 'dispTot', label: 'Total Yesterday Dispatched' },
          { key: 'dispVal', label: 'Invoiced Value (INR)' },
          { key: 'stock', label: 'Current Stock' }
        ],
        `Yesterday_Dispatch_${latestIso}.csv`
      );
    } else if (subView === 'RMPM') {
      const rows = filteredRmpmRows.map(r => ({
        part: r.part,
        desc: r.desc,
        supplier: r.supplier,
        line: r.line,
        plan: pick(r.sched_yest_qty, r.sched_yest_val),
        grn: pick(r.yest_grn_qty, r.yest_grn_val),
        gap: pick(r.yest_gap_qty, r.yest_gap_val),
        adherence: r.sched_yest_qty > 0 ? ((r.yest_grn_qty / r.sched_yest_qty) * 100).toFixed(1) + '%' : '100%',
        stock: pick(r.total_stock_qty, r.total_stock_val)
      }));
      exportToCSV(
        rows,
        [
          { key: 'part', label: 'RM Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'supplier', label: 'Vendor / Supplier' },
          { key: 'line', label: 'Line' },
          { key: 'plan', label: 'Vendor Delivery Plan' },
          { key: 'grn', label: 'Actual GRN Received' },
          { key: 'gap', label: 'Shortfall / Gap' },
          { key: 'adherence', label: 'Plan Adherence' },
          { key: 'stock', label: 'Current RM Stock' }
        ],
        `Yesterday_RM_Received_${latestIso}.csv`
      );
    } else {
      // All 3 Pillars
      const rows: any[] = [];
      fDemand.forEach(r => {
        const m = calcPartMetrics(r, btsMode, meta);
        rows.push({
          pillar: '1. PRODUCTION',
          part: r.part,
          desc: r.desc,
          partner: r.customer,
          mf: r.line,
          plan: pick(m.yestPlanQ, m.yestPlanV),
          actual: pick(r.yest_prod_qty, r.yest_prod_val),
          diff: (r.yest_prod_qty || 0) - (m.yestPlanQ || 0),
          status: (r.yest_prod_qty || 0) >= (m.yestPlanQ || 0) ? 'Achieved' : 'Deficit'
        });
        if (r.yest_disp_qty > 0) {
          rows.push({
            pillar: '2. DISPATCH',
            part: r.part,
            desc: r.desc,
            partner: r.customer,
            mf: r.line,
            plan: '-',
            actual: pick(r.yest_disp_qty, r.yest_disp_val),
            diff: '-',
            status: `601: ${nQ(r.yest_disp_601_qty)} | 641: ${nQ(r.yest_disp_641_qty)}`
          });
        }
      });
      fRmpmParts.forEach(r => {
        if (r.sched_yest_qty > 0 || r.yest_grn_qty > 0) {
          rows.push({
            pillar: '3. RM RECEIVED',
            part: r.part,
            desc: r.desc,
            partner: r.supplier,
            mf: r.line,
            plan: pick(r.sched_yest_qty, r.sched_yest_val),
            actual: pick(r.yest_grn_qty, r.yest_grn_val),
            diff: (r.yest_grn_qty || 0) - (r.sched_yest_qty || 0),
            status: r.yest_gap_qty > 0 ? `Gap: ${nQ(r.yest_gap_qty)}` : 'On Schedule'
          });
        }
      });
      exportToCSV(
        rows,
        [
          { key: 'pillar', label: 'Pillar' },
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'partner', label: 'Customer / Supplier' },
          { key: 'mf', label: 'Line' },
          { key: 'plan', label: 'Planned Target' },
          { key: 'actual', label: 'Actual Qty' },
          { key: 'diff', label: 'Difference' },
          { key: 'status', label: 'Status' }
        ],
        `Yesterday_3Pillars_Overview_${latestIso}.csv`
      );
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 overflow-hidden gap-1.5 p-1">
      {/* ========================================================================= */}
      {/* 1. TOP HERO BANNER: THE 3 PILLARS OF YESTERDAY PERFORMANCE                */}
      {/* Unmistakable answers to: Qty Produced, Qty Dispatched, and RM Received    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
        {/* PILLAR 1: PRODUCTION */}
        <div
          onClick={() => setSubView('PROD')}
          className={`cursor-pointer rounded-lg border p-2.5 transition-all shadow-sm flex flex-col justify-between ${
            subView === 'PROD'
              ? 'bg-gradient-to-br from-emerald-950/40 via-[var(--bg-panel)] to-[var(--bg-panel)] border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-[var(--bg-panel)] border-[var(--border)] hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                <Factory className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--text-muted)] block">
                  Pillar 1: Production Yesterday
                </span>
                <span className="text-[12px] font-bold text-emerald-400">How Much Qty Produced?</span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                yestProdAchPct >= 95
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : yestProdAchPct >= 80
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              }`}
            >
              {yestProdAchPct.toFixed(1)}% Achieved
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-[22px] font-black font-mono text-emerald-400 leading-none">
                {unitMode === 'QTY' ? nQ(yestProdTotQ) : fmt(pick(yestProdTotQ, yestProdTotVal))}
                {unitMode === 'QTY' && <span className="text-[11px] font-sans font-medium text-[var(--text-muted)] ml-1">Nos</span>}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                Gross 101: <b className="text-[var(--text-main)]">+{nQ(yestProd101Gross || yestProdTotQ)}</b> | Reversal 102: <b className="text-rose-400">-{nQ(yestProd102Rev)}</b>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[var(--text-muted)]">Target Plan</div>
              <div className="text-[13px] font-bold font-mono text-[var(--text-main)]">
                {unitMode === 'QTY' ? nQ(yestPlanTotQ) : fmt(pick(yestPlanTotQ, yestPlanTotVal))}
              </div>
              <div className="text-[9.5px] font-medium text-cyan-400">
                ₹{yestProdMn.toFixed(2)} M Value
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-[var(--border)] flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">
              Gap: <b className={yestProdGapQ >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{yestProdGapQ >= 0 ? `+${nQ(yestProdGapQ)}` : nQ(yestProdGapQ)}</b>
            </span>
            <span className="text-emerald-400 font-bold hover:underline flex items-center gap-0.5">
              Click to view parts & lines &rarr;
            </span>
          </div>
        </div>

        {/* PILLAR 2: DISPATCH */}
        <div
          onClick={() => setSubView('DISPATCH')}
          className={`cursor-pointer rounded-lg border p-2.5 transition-all shadow-sm flex flex-col justify-between ${
            subView === 'DISPATCH'
              ? 'bg-gradient-to-br from-blue-950/40 via-[var(--bg-panel)] to-[var(--bg-panel)] border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-[var(--bg-panel)] border-[var(--border)] hover:border-blue-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded bg-blue-500/20 text-blue-400">
                <Truck className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--text-muted)] block">
                  Pillar 2: Dispatch Yesterday
                </span>
                <span className="text-[12px] font-bold text-blue-400">How Much Qty Dispatched?</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold border bg-blue-500/20 text-blue-400 border-blue-500/40">
              {yestCustomersServed.size} Customers | {yestPartsDispatched.size} Parts
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-[22px] font-black font-mono text-blue-400 leading-none">
                {unitMode === 'QTY' ? nQ(yestDispTotQ) : fmt(pick(yestDispTotQ, yestDispPriceVal))}
                {unitMode === 'QTY' && <span className="text-[11px] font-sans font-medium text-[var(--text-muted)] ml-1">Nos</span>}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                Customer (601): <b className="text-[var(--text-main)]">{nQ(yestDisp601Q)}</b> | STO (641): <b className="text-cyan-400">{nQ(yestDisp641Q)}</b>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[var(--text-muted)]">Invoiced Value</div>
              <div className="text-[13px] font-bold font-mono text-cyan-400">
                ₹{yestDispMn.toFixed(2)} M
              </div>
              <div className="text-[9.5px] font-medium text-[var(--text-muted)]">
                MTD: {nQ(mtdDispTotQ)} (₹{mtdDispMn.toFixed(1)}M)
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-[var(--border)] flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">
              Returns (602): <b className="text-[var(--text-main)]">{nQ(yestDisp602RevQ)}</b>
            </span>
            <span className="text-blue-400 font-bold hover:underline flex items-center gap-0.5">
              Click to view customers &rarr;
            </span>
          </div>
        </div>

        {/* PILLAR 3: RM RECEIVED */}
        <div
          onClick={() => setSubView('RMPM')}
          className={`cursor-pointer rounded-lg border p-2.5 transition-all shadow-sm flex flex-col justify-between ${
            subView === 'RMPM'
              ? 'bg-gradient-to-br from-purple-950/40 via-[var(--bg-panel)] to-[var(--bg-panel)] border-purple-500 ring-2 ring-purple-500/20'
              : 'bg-[var(--bg-panel)] border-[var(--border)] hover:border-purple-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded bg-purple-500/20 text-purple-400">
                <Package className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--text-muted)] block">
                  Pillar 3: Raw Materials Yesterday
                </span>
                <span className="text-[12px] font-bold text-purple-400">How Much RM Received?</span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                yestRmAdhPct >= 95
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : yestRmAdhPct >= 80
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              }`}
            >
              {yestRmAdhPct.toFixed(1)}% Inflow Adherence
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-[22px] font-black font-mono text-purple-400 leading-none">
                {unitMode === 'QTY' ? nQ(yestRmActQ) : fmt(pick(yestRmActQ, yestRmActVal))}
                {unitMode === 'QTY' && <span className="text-[11px] font-sans font-medium text-[var(--text-muted)] ml-1">Nos / Kg</span>}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                Actual GRN: <b className="text-[var(--text-main)]">{nQ(yestRmActQ)}</b> | Plan: <b className="text-[var(--text-muted)]">{nQ(yestRmSchedQ)}</b>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-[var(--text-muted)]">Shortfall / Gap</div>
              <div className={`text-[13px] font-bold font-mono ${yestRmGapQ > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {yestRmGapQ > 0 ? `-${nQ(yestRmGapQ)}` : '0 (On Plan)'}
              </div>
              <div className="text-[9.5px] font-medium text-purple-300">
                ₹{yestRmActMn.toFixed(2)} M GRN Value
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-[var(--border)] flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">
              Suppliers Met: <b className="text-emerald-400">{yestRmHitVendors}</b> | Deficit: <b className="text-rose-400">{yestRmMissVendors}</b>
            </span>
            <span className="text-purple-400 font-bold hover:underline flex items-center gap-0.5">
              Click to view RM details &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-NAVIGATION TABS & SEARCH BAR                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-[var(--bg-panel)] border border-[var(--border)] px-2 py-1.5 rounded-md shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <button
            onClick={() => setSubView('PROD')}
            className={`px-3 py-1 rounded text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm ${
              subView === 'PROD'
                ? 'bg-emerald-600 text-white shadow-emerald-900/30 ring-1 ring-emerald-400'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-emerald-400 hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>1. How Much Produced?</span>
            <span className="ml-1 px-1.5 py-0.2 text-[9.5px] rounded bg-black/20 font-mono">
              {nQ(yestProdTotQ)}
            </span>
          </button>

          <button
            onClick={() => setSubView('DISPATCH')}
            className={`px-3 py-1 rounded text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm ${
              subView === 'DISPATCH'
                ? 'bg-blue-600 text-white shadow-blue-900/30 ring-1 ring-blue-400'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-blue-400 hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>2. How Much Dispatched?</span>
            <span className="ml-1 px-1.5 py-0.2 text-[9.5px] rounded bg-black/20 font-mono">
              {nQ(yestDispTotQ)}
            </span>
          </button>

          <button
            onClick={() => setSubView('RMPM')}
            className={`px-3 py-1 rounded text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm ${
              subView === 'RMPM'
                ? 'bg-purple-600 text-white shadow-purple-900/30 ring-1 ring-purple-400'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-purple-400 hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>3. How Much RM Received?</span>
            <span className="ml-1 px-1.5 py-0.2 text-[9.5px] rounded bg-black/20 font-mono">
              {nQ(yestRmActQ)}
            </span>
          </button>

          <button
            onClick={() => setSubView('SNAPSHOT')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              subView === 'SNAPSHOT'
                ? 'bg-slate-700 text-white ring-1 ring-slate-400'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Executive 3-Pillar View</span>
          </button>

          <button
            onClick={() => setSubView('MISSES')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              subView === 'MISSES'
                ? 'bg-rose-900/80 text-rose-200 ring-1 ring-rose-500'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-rose-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Gaps & Deficits ({yesterdayMisses.length})</span>
          </button>

          <button
            onClick={() => setSubView('ALL')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              subView === 'ALL'
                ? 'bg-amber-800 text-amber-100 ring-1 ring-amber-400'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-amber-400'
            }`}
          >
            <span>Master 3-Pillars Table</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative w-48 lg:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search part, desc, line..."
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded pl-7 pr-2 py-0.5 text-[11px] text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Popout Button */}
          <button
            onClick={() => openPopoutWithMode('YESTERDAY')}
            title="Popout Yesterday Performance Report in dedicated window"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-emerald-400 border border-[var(--border)] text-[10.5px] font-bold"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Popout</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            title="Export current Yesterday table to CSV"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKBENCH: DEDICATED REPORT VIEWS                                  */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--bg-panel)] border border-[var(--border)] rounded-md">
        {/* VIEW 1: HOW MUCH PRODUCED? (PRODUCTION DEEP DIVE) */}
        {subView === 'PROD' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Context Sub-Bar */}
            <div className="px-3 py-1.5 bg-emerald-950/20 border-b border-[var(--border)] flex flex-wrap items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                  <Factory className="w-4 h-4" />
                  Yesterday Production Breakdown (Part-Wise & Line-Wise)
                </span>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="text-[var(--text-muted)]">
                  Total Produced: <b className="text-emerald-400 font-mono">{nQ(yestProdTotQ)} Nos</b> (Gross 101: {nQ(yestProd101Gross || yestProdTotQ)}, Rev 102: {nQ(yestProd102Rev)})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-muted)]">
                  Plan Target: <b className="text-[var(--text-main)] font-mono">{nQ(yestPlanTotQ)} Nos</b>
                </span>
                <span className="text-[var(--text-muted)]">
                  Total Value: <b className="text-cyan-400 font-mono">₹{yestProdMn.toFixed(2)} M</b>
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.2 rounded border border-emerald-500/20">
                  {yestProdAchPct.toFixed(1)}% Achieved
                </span>
              </div>
            </div>

            {/* Production Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-[var(--header-bg)] text-[var(--header-text)] shadow-sm uppercase font-extrabold text-[9.5px] tracking-wider z-10">
                  <tr>
                    <th className="p-1.5 border-r border-[var(--border)]">Part Number</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Description</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Customer</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Line</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Yesterday Plan</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)] bg-emerald-950/40 text-emerald-300">Yesterday Produced (101/102)</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">% Achieved</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Shortfall / Surplus</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Prod Value (₹)</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Current Stock (MB52)</th>
                    <th className="p-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-main)]">
                  {filteredProdRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-[var(--text-muted)] italic">
                        No production records matched your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProdRows.map(({ row: r, m }, idx) => {
                      const yPlan = m.yestPlanQ;
                      const yProd = r.yest_prod_qty || 0;
                      const ach = yPlan > 0 ? (yProd / yPlan) * 100 : (yProd > 0 ? 100 : 0);
                      const diff = yProd - yPlan;
                      const isDeficit = yPlan > 0 && yProd < yPlan * 0.95;

                      return (
                        <tr
                          key={r.part + idx}
                          onClick={() => onSelectPart && onSelectPart(r.part)}
                          className={`hover:bg-[var(--hover-bg)] cursor-pointer transition-colors ${
                            isDeficit ? 'bg-rose-950/10' : idx % 2 === 0 ? 'bg-[var(--bg-panel)]' : 'bg-[var(--bg-card)]'
                          }`}
                        >
                          <td className="p-1.5 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {r.part}
                          </td>
                          <td className="p-1.5 font-medium truncate max-w-[220px]" title={r.desc}>
                            {r.desc}
                          </td>
                          <td className="p-1.5 text-[var(--text-muted)] whitespace-nowrap">
                            {r.customer}
                          </td>
                          <td className="p-1.5 text-[var(--text-muted)] whitespace-nowrap">
                            {r.line}
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold text-[var(--text-main)]">
                            {nQ(yPlan)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-extrabold text-emerald-400 bg-emerald-950/15">
                            {nQ(yProd)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-extrabold">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] ${
                                ach >= 95
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : ach >= 80
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {ach.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold">
                            <span className={diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {diff >= 0 ? `+${nQ(diff)}` : nQ(diff)}
                            </span>
                          </td>
                          <td className="p-1.5 text-right font-mono text-cyan-400">
                            ₹{(r.yest_prod_val || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">
                            {nQ(r.stock_total_qty)}
                          </td>
                          <td className="p-1.5 text-center whitespace-nowrap">
                            {ach >= 100 ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Met
                              </span>
                            ) : ach >= 90 ? (
                              <span className="text-amber-400 font-bold text-[10px]">Close</span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-rose-400 font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3" /> Shortfall
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-[var(--header-bg)] text-[var(--header-text)] font-extrabold text-[11px] border-t-2 border-[var(--border)] z-10">
                  <tr>
                    <td colSpan={4} className="p-2 uppercase tracking-wider">
                      TOTAL PRODUCTION ({filteredProdRows.length} Parts)
                    </td>
                    <td className="p-2 text-right font-mono text-[var(--text-main)]">
                      {nQ(yestPlanTotQ)}
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-400 text-[12px] bg-emerald-950/40">
                      {nQ(yestProdTotQ)} Nos
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-400">
                      {yestProdAchPct.toFixed(1)}%
                    </td>
                    <td className="p-2 text-right font-mono">
                      <span className={yestProdGapQ >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {yestProdGapQ >= 0 ? `+${nQ(yestProdGapQ)}` : nQ(yestProdGapQ)}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono text-cyan-400">
                      ₹{yestProdMn.toFixed(2)} M
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: HOW MUCH DISPATCHED? (DISPATCH DEEP DIVE) */}
        {subView === 'DISPATCH' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Context Sub-Bar */}
            <div className="px-3 py-1.5 bg-blue-950/20 border-b border-[var(--border)] flex flex-wrap items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-blue-400 flex items-center gap-1">
                  <Truck className="w-4 h-4" />
                  Yesterday Dispatch Breakdown (Part-Wise & Customer-Wise)
                </span>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="text-[var(--text-muted)]">
                  Total Dispatched: <b className="text-blue-400 font-mono">{nQ(yestDispTotQ)} Nos</b> (Customer 601: {nQ(yestDisp601Q)}, Inter-Plant STO 641: {nQ(yestDisp641Q)})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-muted)]">
                  Total Invoiced: <b className="text-cyan-400 font-mono">₹{yestDispMn.toFixed(2)} M</b>
                </span>
                <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.2 rounded border border-blue-500/20">
                  {yestCustomersServed.size} Active Customers
                </span>
              </div>
            </div>

            {/* Dispatch Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-[var(--header-bg)] text-[var(--header-text)] shadow-sm uppercase font-extrabold text-[9.5px] tracking-wider z-10">
                  <tr>
                    <th className="p-1.5 border-r border-[var(--border)]">Part Number</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Description</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Customer</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Line</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Cust Dispatch (601)</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">STO Transfer (641)</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)] bg-blue-950/40 text-blue-300">Total Yesterday Dispatched</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Invoiced Value (₹)</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Current Stock (MB52)</th>
                    <th className="p-1.5 text-right">Unit Price (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-main)]">
                  {filteredDispatchRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-[var(--text-muted)] italic">
                        No dispatch records matched your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDispatchRows.map(({ row: r }, idx) => {
                      const d601 = r.yest_disp_601_qty || 0;
                      const d641 = r.yest_disp_641_qty || 0;
                      const dTot = r.yest_disp_qty || 0;
                      const dVal = r.yest_disp_val || 0;

                      return (
                        <tr
                          key={r.part + idx}
                          onClick={() => onSelectPart && onSelectPart(r.part)}
                          className={`hover:bg-[var(--hover-bg)] cursor-pointer transition-colors ${
                            dTot > 0 ? 'bg-blue-950/5' : idx % 2 === 0 ? 'bg-[var(--bg-panel)]' : 'bg-[var(--bg-card)]'
                          }`}
                        >
                          <td className="p-1.5 font-mono font-bold text-blue-400 whitespace-nowrap">
                            {r.part}
                          </td>
                          <td className="p-1.5 font-medium truncate max-w-[220px]" title={r.desc}>
                            {r.desc}
                          </td>
                          <td className="p-1.5 text-[var(--text-muted)] whitespace-nowrap">
                            {r.customer}
                          </td>
                          <td className="p-1.5 text-[var(--text-muted)] whitespace-nowrap">
                            {r.line}
                          </td>
                          <td className="p-1.5 text-right font-mono text-[var(--text-main)]">
                            {nQ(d601)}
                          </td>
                          <td className="p-1.5 text-right font-mono text-cyan-400">
                            {nQ(d641)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-extrabold text-blue-400 bg-blue-950/15">
                            {nQ(dTot)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold text-cyan-400">
                            ₹{dVal.toLocaleString('en-IN')}
                          </td>
                          <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">
                            {nQ(r.stock_total_qty)}
                          </td>
                          <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">
                            {r.price > 0 ? `₹${r.price.toFixed(0)}` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-[var(--header-bg)] text-[var(--header-text)] font-extrabold text-[11px] border-t-2 border-[var(--border)] z-10">
                  <tr>
                    <td colSpan={4} className="p-2 uppercase tracking-wider">
                      TOTAL DISPATCH ({filteredDispatchRows.length} Parts)
                    </td>
                    <td className="p-2 text-right font-mono text-[var(--text-main)]">
                      {nQ(yestDisp601Q)}
                    </td>
                    <td className="p-2 text-right font-mono text-cyan-400">
                      {nQ(yestDisp641Q)}
                    </td>
                    <td className="p-2 text-right font-mono text-blue-400 text-[12px] bg-blue-950/40">
                      {nQ(yestDispTotQ)} Nos
                    </td>
                    <td className="p-2 text-right font-mono text-cyan-400">
                      ₹{yestDispMn.toFixed(2)} M
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: HOW MUCH RM RECEIVED? (RM / PM INFLOW DEEP DIVE) */}
        {subView === 'RMPM' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Context Sub-Bar */}
            <div className="px-3 py-1.5 bg-purple-950/20 border-b border-[var(--border)] flex flex-wrap items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-purple-400 flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  Yesterday Raw Material Receipts (Vendor Inflow vs Plan)
                </span>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="text-[var(--text-muted)]">
                  Total RM Received: <b className="text-purple-400 font-mono">{nQ(yestRmActQ)} Nos / Kg</b> (Scheduled: {nQ(yestRmSchedQ)})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-muted)]">
                  GRN Value: <b className="text-purple-300 font-mono">₹{yestRmActMn.toFixed(2)} M</b>
                </span>
                <span className={`px-2 py-0.2 rounded border font-bold ${
                  yestRmGapQ > 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {yestRmGapQ > 0 ? `Shortfall: -${nQ(yestRmGapQ)}` : 'Zero Deficit'}
                </span>
              </div>
            </div>

            {/* RM Receipts Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-[var(--header-bg)] text-[var(--header-text)] shadow-sm uppercase font-extrabold text-[9.5px] tracking-wider z-10">
                  <tr>
                    <th className="p-1.5 border-r border-[var(--border)]">RM Part Number</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Material Description</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Vendor / Supplier</th>
                    <th className="p-1.5 border-r border-[var(--border)]">Line</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Scheduled Plan</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)] bg-purple-950/40 text-purple-300">Actual GRN Received</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Shortfall / Gap</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Adherence %</th>
                    <th className="p-1.5 text-right border-r border-[var(--border)]">Current Stock (MB52)</th>
                    <th className="p-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-main)]">
                  {filteredRmpmRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-[var(--text-muted)] italic">
                        No raw material records matched your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRmpmRows.map((r, idx) => {
                      const sched = r.sched_yest_qty || 0;
                      const act = r.yest_grn_qty || 0;
                      const gap = r.yest_gap_qty || 0;
                      const adh = sched > 0 ? (act / sched) * 100 : (act > 0 ? 100 : 0);
                      const isShortfall = gap > 0;

                      return (
                        <tr
                          key={r.part + idx}
                          className={`hover:bg-[var(--hover-bg)] transition-colors ${
                            isShortfall ? 'bg-rose-950/10' : idx % 2 === 0 ? 'bg-[var(--bg-panel)]' : 'bg-[var(--bg-card)]'
                          }`}
                        >
                          <td className="p-1.5 font-mono font-bold text-purple-400 whitespace-nowrap">
                            {r.part}
                          </td>
                          <td className="p-1.5 font-medium truncate max-w-[220px]" title={r.desc}>
                            {r.desc}
                          </td>
                          <td className="p-1.5 text-[var(--text-muted)] whitespace-nowrap">
                            {r.supplier || 'Vendor'}
                          </td>
                          <td className="p-1.5 text-[var(--text-muted)] whitespace-nowrap">
                            {r.line}
                          </td>
                          <td className="p-1.5 text-right font-mono text-[var(--text-main)]">
                            {nQ(sched)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-extrabold text-purple-400 bg-purple-950/15">
                            {nQ(act)}
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold">
                            <span className={gap > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                              {gap > 0 ? `-${nQ(gap)}` : '0'}
                            </span>
                          </td>
                          <td className="p-1.5 text-right font-mono font-extrabold">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] ${
                                adh >= 95
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : adh >= 80
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {adh.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">
                            {nQ(r.total_stock_qty)}
                          </td>
                          <td className="p-1.5 text-center whitespace-nowrap">
                            {gap === 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Received
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-rose-400 font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3" /> Deficit
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-[var(--header-bg)] text-[var(--header-text)] font-extrabold text-[11px] border-t-2 border-[var(--border)] z-10">
                  <tr>
                    <td colSpan={4} className="p-2 uppercase tracking-wider">
                      TOTAL RM RECEIPTS ({filteredRmpmRows.length} Items)
                    </td>
                    <td className="p-2 text-right font-mono text-[var(--text-main)]">
                      {nQ(yestRmSchedQ)}
                    </td>
                    <td className="p-2 text-right font-mono text-purple-400 text-[12px] bg-purple-950/40">
                      {nQ(yestRmActQ)}
                    </td>
                    <td className="p-2 text-right font-mono text-rose-400">
                      {yestRmGapQ > 0 ? `-${nQ(yestRmGapQ)}` : '0'}
                    </td>
                    <td className="p-2 text-right font-mono text-purple-400">
                      {yestRmAdhPct.toFixed(1)}%
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: EXECUTIVE 3-PILLAR COMPARISON SNAPSHOT */}
        {subView === 'SNAPSHOT' && (
          <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Pillar 1 Quick Breakdown */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-[13px] text-[var(--text-main)]">1. Production by Line</span>
                  </div>
                  <button onClick={() => setSubView('PROD')} className="text-[10px] text-emerald-400 hover:underline">
                    View Full Table &rarr;
                  </button>
                </div>
                <div className="divide-y divide-[var(--border)] mt-2">
                  {lineProductionData.map(l => (
                    <div key={l.line} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-bold text-[var(--text-main)]">{l.line}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">Plan: {nQ(l.planQ)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-emerald-400">{nQ(l.prodQ)}</div>
                        <div className="text-[10px] text-cyan-400">₹{l.valMn.toFixed(2)} M</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 2 Quick Breakdown */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-[13px] text-[var(--text-main)]">2. Dispatch by Customer</span>
                  </div>
                  <button onClick={() => setSubView('DISPATCH')} className="text-[10px] text-blue-400 hover:underline">
                    View Full Table &rarr;
                  </button>
                </div>
                <div className="divide-y divide-[var(--border)] mt-2">
                  {customerDispatchData.slice(0, 8).map(c => (
                    <div key={c.customer} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-bold text-[var(--text-main)] truncate max-w-[150px]">{c.customer}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">601: {nQ(c.disp601)} | 641: {nQ(c.disp641)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-blue-400">{nQ(c.dispTot)}</div>
                        <div className="text-[10px] text-cyan-400">₹{c.valMn.toFixed(2)} M</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pillar 3 Quick Breakdown */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-[13px] text-[var(--text-main)]">3. Top RM Inflows</span>
                  </div>
                  <button onClick={() => setSubView('RMPM')} className="text-[10px] text-purple-400 hover:underline">
                    View Full Table &rarr;
                  </button>
                </div>
                <div className="divide-y divide-[var(--border)] mt-2">
                  {filteredRmpmRows.slice(0, 8).map(r => (
                    <div key={r.part} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="font-bold text-[var(--text-main)] truncate max-w-[150px]">{r.desc}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{r.supplier || 'Vendor'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-purple-400">{nQ(r.yest_grn_qty)}</div>
                        <div className={`text-[10px] ${r.yest_gap_qty > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {r.yest_gap_qty > 0 ? `Gap: -${nQ(r.yest_gap_qty)}` : 'Met'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: GAPS & DEFICITS */}
        {subView === 'MISSES' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-1.5 bg-rose-950/20 border-b border-[var(--border)] flex items-center justify-between text-[11px] shrink-0">
              <span className="font-extrabold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Yesterday Gaps & Missed Targets ({yesterdayMisses.length} Production Deficits)
              </span>
              <span className="text-[var(--text-muted)]">
                Parts that achieved &lt; 95% of daily target
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-[var(--header-bg)] text-[var(--header-text)] uppercase font-extrabold text-[9.5px]">
                  <tr>
                    <th className="p-1.5">Part Number</th>
                    <th className="p-1.5">Description</th>
                    <th className="p-1.5">Line</th>
                    <th className="p-1.5">Customer</th>
                    <th className="p-1.5 text-right">Daily Plan</th>
                    <th className="p-1.5 text-right">Produced</th>
                    <th className="p-1.5 text-right">Deficit</th>
                    <th className="p-1.5 text-right">% Ach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-main)]">
                  {yesterdayMisses.map(({ row: r, m }, idx) => {
                    const deficit = m.yestPlanQ - (r.yest_prod_qty || 0);
                    const pct = m.yestPlanQ > 0 ? ((r.yest_prod_qty || 0) / m.yestPlanQ) * 100 : 0;
                    return (
                      <tr key={r.part + idx} className="hover:bg-[var(--hover-bg)] bg-rose-950/10">
                        <td className="p-1.5 font-mono font-bold text-rose-400">{r.part}</td>
                        <td className="p-1.5 font-medium">{r.desc}</td>
                        <td className="p-1.5 text-[var(--text-muted)]">{r.line}</td>
                        <td className="p-1.5 text-[var(--text-muted)]">{r.customer}</td>
                        <td className="p-1.5 text-right font-mono">{nQ(m.yestPlanQ)}</td>
                        <td className="p-1.5 text-right font-mono font-bold text-emerald-400">{nQ(r.yest_prod_qty)}</td>
                        <td className="p-1.5 text-right font-mono font-extrabold text-rose-400">-{nQ(deficit)}</td>
                        <td className="p-1.5 text-right font-mono font-bold text-rose-400">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 6: MASTER 3-PILLARS TABLE */}
        {subView === 'ALL' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-1.5 bg-[var(--header-bg)] border-b border-[var(--border)] flex items-center justify-between text-[11px] shrink-0">
              <span className="font-extrabold text-amber-400">
                Master 3-Pillars Side-by-Side (Production, Dispatch & RM Flow)
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-[var(--header-bg)] text-[var(--header-text)] uppercase font-extrabold text-[9.5px]">
                  <tr>
                    <th className="p-1.5">Part Number</th>
                    <th className="p-1.5">Description</th>
                    <th className="p-1.5">Customer / Line</th>
                    <th className="p-1.5 text-right text-emerald-400">Prod (101/102)</th>
                    <th className="p-1.5 text-right text-blue-400">Disp (601+641)</th>
                    <th className="p-1.5 text-right text-purple-400">Stock (MB52)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-main)]">
                  {filteredProdRows.map(({ row: r }, idx) => (
                    <tr key={r.part + idx} className="hover:bg-[var(--hover-bg)]">
                      <td className="p-1.5 font-mono font-bold text-[var(--text-main)]">{r.part}</td>
                      <td className="p-1.5 truncate max-w-[200px]">{r.desc}</td>
                      <td className="p-1.5 text-[var(--text-muted)]">{r.customer} ({r.line})</td>
                      <td className="p-1.5 text-right font-mono font-bold text-emerald-400">{nQ(r.yest_prod_qty)}</td>
                      <td className="p-1.5 text-right font-mono font-bold text-blue-400">{nQ(r.yest_disp_qty)}</td>
                      <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">{nQ(r.stock_total_qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
