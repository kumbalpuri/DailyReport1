import React, { useState } from 'react';
import { DemandRow, UnitMode, BtsMode, DashboardMeta, PopoutReportMode } from '../../types';
import { calcPartMetrics, pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { SvgComboChart } from '../charts/SvgComboChart';
import {
  Maximize2,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Factory,
  Truck
} from 'lucide-react';

interface DemandTabProps {
  meta: DashboardMeta;
  fDemand: DemandRow[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  theme: 'dark' | 'light';
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  openPopoutWithMode: (mode: PopoutReportMode) => void;
  onSelectPart?: (part: string) => void;
  onSwitchToDispatch?: () => void;
}

export const DemandTab: React.FC<DemandTabProps> = ({
  meta,
  fDemand,
  unitMode,
  btsMode,
  theme,
  leftCollapsed,
  setLeftCollapsed,
  openPopoutWithMode,
  onSelectPart,
  onSwitchToDispatch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [chart1Collapsed, setChart1Collapsed] = useState(false);
  const [chart2Collapsed, setChart2Collapsed] = useState(false);

  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);
  const q = searchQuery.toLowerCase().trim();

  const filteredDemand = fDemand.filter(
    r =>
      !q ||
      r.part.toLowerCase().includes(q) ||
      r.desc.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.line.toLowerCase().includes(q) ||
      r.minifactory.toLowerCase().includes(q)
  );

  // Top parts for Chart 1
  const topParts = [...fDemand]
    .sort((a, b) => {
      const ma = calcPartMetrics(a, btsMode, meta);
      const mb = calcPartMetrics(b, btsMode, meta);
      return pick(mb.planQ, mb.planV) - pick(ma.planQ, ma.planV);
    })
    .slice(0, 10);

  // Line-wise run rate vs asking rate for Chart 2
  const lineMap: Record<string, { run: number; ask: number }> = {};
  fDemand.forEach(r => {
    const k = r.line || r.minifactory || 'Line';
    if (!lineMap[k]) lineMap[k] = { run: 0, ask: 0 };
    const m = calcPartMetrics(r, btsMode, meta);
    lineMap[k].run += pick(m.runRateQ, m.runRateV);
    lineMap[k].ask += pick(m.askRateQ, m.askRateV);
  });
  const lineKeys = Object.keys(lineMap).sort();

  // Export Table CSV
  const handleExportCSV = () => {
    const rows = filteredDemand.map(r => {
      const m = calcPartMetrics(r, btsMode, meta);
      return {
        part: r.part,
        desc: r.desc,
        customer: r.customer,
        mf: r.minifactory + (r.line ? ' / ' + r.line : ''),
        plan: pick(m.planQ, m.planV),
        ttd: pick(m.ttdQ, m.ttdV),
        prod: pick(m.prodQ, m.prodV),
        stock: pick(r.stock_total_qty, r.stock_total_val),
        achTd: m.pctAchTd.toFixed(1) + '%',
        pend: pick(m.pendQ, m.pendV),
        yest: pick(r.yest_prod_qty, r.yest_prod_val),
        runRate: pick(m.runRateQ, m.runRateV),
        askRate: pick(m.askRateQ, m.askRateV),
        achMon: m.pctAchMon.toFixed(1) + '%',
        remarks: m.remStr
      };
    });

    exportToCSV(
      rows,
      [
        { key: 'part', label: 'Part Number' },
        { key: 'desc', label: 'Description' },
        { key: 'customer', label: 'Customer' },
        { key: 'mf', label: 'MF / Line' },
        { key: 'plan', label: `Monthly Plan (${btsMode === 'WITH_BTS' ? 'With BTS' : 'Without BTS'})` },
        { key: 'ttd', label: 'Target Till Date' },
        { key: 'prod', label: 'Prod Till Date' },
        { key: 'stock', label: 'Current Stock' },
        { key: 'achTd', label: '% Achievement TTD' },
        { key: 'pend', label: 'Pending for Production' },
        { key: 'yest', label: 'Yesterday Production' },
        { key: 'runRate', label: 'Current Run Rate' },
        { key: 'askRate', label: 'Asking Rate / Day' },
        { key: 'achMon', label: '% Achievement Monthly' },
        { key: 'remarks', label: 'Remarks' }
      ],
      'Demand_Review_Report.csv'
    );
  };

  // Totals for table
  let totPlan = 0;
  let totTtd = 0;
  let totProd = 0;
  let totStk = 0;
  let totPend = 0;
  let totYest = 0;
  let totRun = 0;
  let totAsk = 0;

  filteredDemand.forEach(r => {
    const m = calcPartMetrics(r, btsMode, meta);
    totPlan += pick(m.planQ, m.planV);
    totTtd += pick(m.ttdQ, m.ttdV);
    totProd += pick(m.prodQ, m.prodV);
    totStk += pick(r.stock_total_qty, r.stock_total_val);
    totPend += pick(m.pendQ, m.pendV);
    totYest += pick(r.yest_prod_qty, r.yest_prod_val);
    totRun += pick(m.runRateQ, m.runRateV);
    totAsk += pick(m.askRateQ, m.askRateV);
  });

  const totAchTd = totTtd > 0 ? (totProd / totTtd) * 100.0 : 0.0;
  const totAchMon = totPlan > 0 ? (totProd / totPlan) * 100.0 : 0.0;

  return (
    <div className="flex flex-col lg:flex-row gap-1.5 w-full h-full min-h-0 overflow-hidden">
      {/* COLLAPSED RAIL FOR LEFT GRAPHS */}
      {leftCollapsed ? (
        <div
          onClick={() => setLeftCollapsed(false)}
          title="Click to expand Left-Hand Graphs"
          className="hidden lg:flex flex-col items-center justify-between py-2.5 px-1 w-7 bg-[var(--bg-panel)] border border-[var(--border)] hover:border-blue-500 rounded-md cursor-pointer transition-all shrink-0 shadow-xs group"
        >
          <PanelLeftOpen className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-extrabold tracking-widest uppercase text-[var(--text-muted)] group-hover:text-blue-400 whitespace-nowrap">
            Show Production Graphs (2)
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        </div>
      ) : (
        /* LEFT COLUMN: 2 CHARTS (28% on wide screen) */
        <div className="w-full lg:w-[28%] xl:w-[27%] flex flex-col gap-1.5 min-h-0 overflow-hidden shrink-0 transition-all">
          {/* Chart 1: Plan vs TTD vs Prod */}
          <div
            className={`${
              chart1Collapsed ? 'flex-none' : 'flex-1'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart1Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] hover:text-blue-400 truncate cursor-pointer"
                title="Collapse / Expand this chart"
              >
                {chart1Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">Material-Wise Plan vs TTD vs Prod</span>
              </button>
              <button
                onClick={() => setLeftCollapsed(true)}
                title="Collapse Left Graphs for Full-Face Report View"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-3 h-3" />
                <span>Hide</span>
              </button>
            </div>
            {!chart1Collapsed && (
              <div className="flex-1 min-h-[150px] p-1">
                <SvgComboChart
                  categories={topParts.map(r => r.desc || r.part)}
                  subtitles={topParts.map(r => `Part: ${r.part} | Cust: ${r.customer}`)}
                  series={[
                    {
                      name: 'Monthly Plan',
                      values: topParts.map(r =>
                        pick(calcPartMetrics(r, btsMode, meta).planQ, calcPartMetrics(r, btsMode, meta).planV)
                      ),
                      color: '#64748b'
                    },
                    {
                      name: 'Target Till Date',
                      values: topParts.map(r =>
                        pick(calcPartMetrics(r, btsMode, meta).ttdQ, calcPartMetrics(r, btsMode, meta).ttdV)
                      ),
                      color: '#f59e0b'
                    },
                    {
                      name: 'Prod Till Date',
                      values: topParts.map(r => pick(r.prod_td_qty, r.prod_td_val)),
                      color: '#10b981'
                    }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>

          {/* Chart 2: Run Rate vs Asking Rate */}
          <div
            className={`${
              chart2Collapsed ? 'flex-none' : 'flex-1'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart2Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] hover:text-blue-400 truncate cursor-pointer"
                title="Collapse / Expand this chart"
              >
                {chart2Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">Line-Wise Run Rate vs Asking Rate</span>
              </button>
            </div>
            {!chart2Collapsed && (
              <div className="flex-1 min-h-[150px] p-1">
                <SvgComboChart
                  categories={lineKeys}
                  series={[
                    {
                      name: 'Current Run Rate',
                      values: lineKeys.map(k => lineMap[k].run),
                      color: '#10b981'
                    },
                    {
                      name: 'Asking Rate / Day',
                      values: lineKeys.map(k => lineMap[k].ask),
                      color: '#f59e0b'
                    }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* RIGHT COLUMN: REPORT TABLE (100% full-face when collapsed, 72% otherwise) */}
      <div className="flex-1 min-w-0 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
        {/* Table header bar */}
        <div className="px-2 py-1 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-hdr)] flex-wrap gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setLeftCollapsed(p => !p)}
              title={leftCollapsed ? 'Show Left Graphs' : 'Collapse Left Graphs to View Report Full-Face'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                leftCollapsed
                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                  : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)] hover:border-blue-400'
              }`}
            >
              {leftCollapsed ? (
                <>
                  <PanelLeftOpen className="w-3 h-3" />
                  <span>Show Graphs</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3 h-3 text-blue-400" />
                  <span>Full Report</span>
                </>
              )}
            </button>

            <div
              onClick={() => openPopoutWithMode('DEMAND')}
              className="flex items-center gap-1.5 cursor-pointer text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span className="text-[11.5px] font-extrabold tracking-wide">
                Automated Production &amp; Demand Review Report
              </span>
              <span className="text-[9.5px] font-bold bg-blue-500/15 border border-blue-500/40 px-1.5 py-0.2 rounded flex items-center gap-1">
                <Maximize2 className="w-2.5 h-2.5" /> Popout
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSwitchToDispatch && (
              <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border)] rounded p-0.5 text-[10px] font-bold">
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                  <Factory className="w-2.5 h-2.5" /> Production
                </span>
                <button
                  onClick={onSwitchToDispatch}
                  className="px-1.5 py-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer"
                  title="Switch to Dispatch & Asking Rate Dashboard"
                >
                  <Truck className="w-2.5 h-2.5 text-cyan-400" /> Dispatch
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="Search Part / Desc / Cust..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[10.5px] w-44 focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] hover:border-blue-400 text-[10px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Report Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-[10.5px] border-collapse">
            <thead className="sticky top-0 bg-[var(--green-th-bg)] text-[var(--green-th-text)] font-bold text-[9.5px] z-10 border-b-2 border-emerald-900 uppercase">
              <tr>
                <th className="px-1.5 py-1 text-left">Part Number</th>
                <th className="px-1.5 py-1 text-left">Description</th>
                <th className="px-1.5 py-1 text-left">Customer</th>
                <th className="px-1.5 py-1 text-left">MF / Line</th>
                <th className="px-1.5 py-1 text-right font-mono">Monthly Plan</th>
                <th className="px-1.5 py-1 text-right font-mono">Target Till Date</th>
                <th className="px-1.5 py-1 text-right font-mono">Prod Till Date</th>
                <th className="px-1.5 py-1 text-right font-mono">Stock</th>
                <th className="px-1.5 py-1 text-right font-mono">% Ach TTD</th>
                <th className="px-1.5 py-1 text-right font-mono">Pending Prod</th>
                <th className="px-1.5 py-1 text-right font-mono">Yesterday Prod</th>
                <th className="px-1.5 py-1 text-right font-mono">Run Rate</th>
                <th className="px-1.5 py-1 text-right font-mono">Asking Rate</th>
                <th className="px-1.5 py-1 text-right font-mono">% Monthly</th>
                <th className="px-1.5 py-1 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {filteredDemand.map(r => {
                const m = calcPartMetrics(r, btsMode, meta);
                const vPlan = pick(m.planQ, m.planV);
                const vTtd = pick(m.ttdQ, m.ttdV);
                const vProd = pick(m.prodQ, m.prodV);
                const vStk = pick(r.stock_total_qty, r.stock_total_val);
                const vPend = pick(m.pendQ, m.pendV);
                const vYest = pick(r.yest_prod_qty, r.yest_prod_val);
                const vRun = pick(m.runRateQ, m.runRateV);
                const vAsk = pick(m.askRateQ, m.askRateV);
                const isDeficit = m.pctAchTd < 85 && vPlan > 0;

                return (
                  <tr
                    key={r.part}
                    data-deficit={isDeficit}
                    onClick={() => onSelectPart?.(r.part)}
                    className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  >
                    <td className="px-1.5 py-1 font-bold text-blue-400 font-mono whitespace-nowrap">
                      {r.part}
                    </td>
                    <td
                      className={`px-1.5 py-1 font-medium text-[var(--text-main)] ${
                        leftCollapsed ? 'max-w-[230px]' : 'max-w-[140px]'
                      } truncate`}
                      title={r.desc}
                    >
                      {r.desc}
                    </td>
                    <td className="px-1.5 py-1 text-[var(--text-sub)] whitespace-nowrap">{r.customer}</td>
                    <td className="px-1.5 py-1 text-[var(--text-muted)] text-[10px] whitespace-nowrap">{r.line}</td>
                    <td className="px-1.5 py-1 text-right font-mono font-semibold">{fmt(vPlan)}</td>
                    <td className="px-1.5 py-1 text-right font-mono text-[var(--text-muted)]">{fmt(vTtd)}</td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-emerald-400">{fmt(vProd)}</td>
                    <td className="px-1.5 py-1 text-right font-mono">{fmt(vStk)}</td>
                    <td
                      className={`px-1.5 py-1 text-right font-mono font-bold ${
                        m.pctAchTd >= 100 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {m.pctAchTd.toFixed(1)}%
                    </td>
                    <td
                      className={`px-1.5 py-1 text-right font-mono font-semibold ${
                        vPend > 0 ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      {fmt(vPend)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-blue-400">{fmt(vYest)}</td>
                    <td className="px-1.5 py-1 text-right font-mono text-[var(--text-muted)]">{fmt(vRun)}</td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-amber-400">{fmt(vAsk)}</td>
                    <td
                      className={`px-1.5 py-1 text-right font-mono font-bold ${
                        m.pctAchMon >= 100 ? 'text-emerald-400' : 'text-[var(--text-main)]'
                      }`}
                    >
                      {m.pctAchMon.toFixed(1)}%
                    </td>
                    <td
                      className={`px-1.5 py-1 text-[10px] text-[var(--text-muted)] ${
                        leftCollapsed ? 'max-w-[260px]' : 'max-w-[140px]'
                      } truncate`}
                      title={m.remStr}
                    >
                      {m.remStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredDemand.length > 0 && (
              <tfoot className="sticky bottom-0 bg-[var(--bg-card)] font-bold text-[10.5px] border-t-2 border-[var(--border)] shadow-md">
                <tr>
                  <td colSpan={4} className="px-1.5 py-1 text-[var(--text-main)]">
                    TOTAL ({filteredDemand.length} Parts)
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono text-[var(--text-main)]">{fmt(totPlan)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-[var(--text-main)]">{fmt(totTtd)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-emerald-400 font-black">{fmt(totProd)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-[var(--text-main)]">{fmt(totStk)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-amber-400">{totAchTd.toFixed(1)}%</td>
                  <td className="px-1.5 py-1 text-right font-mono text-amber-400">{fmt(totPend)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-blue-400">{fmt(totYest)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-[var(--text-main)]">{fmt(totRun)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-amber-400">{fmt(totAsk)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-emerald-400">{totAchMon.toFixed(1)}%</td>
                  <td className="px-1.5 py-1"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
