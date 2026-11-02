import React, { useState } from 'react';
import { DemandRow, UnitMode, BtsMode, DashboardMeta, PopoutReportMode } from '../../types';
import { calcDispatchMetrics, pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { SvgComboChart } from '../charts/SvgComboChart';
import { Maximize2, Download, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight, Truck, Factory } from 'lucide-react';

interface DispatchTabProps {
  meta: DashboardMeta;
  fDemand: DemandRow[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  theme: 'dark' | 'light';
  leftCollapsed: boolean;
  setLeftCollapsed: (fn: (prev: boolean) => boolean) => void;
  openPopoutWithMode: (mode: PopoutReportMode) => void;
  onSelectPart?: (part: string) => void;
  onSwitchToProdDemand?: () => void;
}

export const DispatchTab: React.FC<DispatchTabProps> = ({
  meta,
  fDemand,
  unitMode,
  btsMode,
  theme,
  leftCollapsed,
  setLeftCollapsed,
  openPopoutWithMode,
  onSelectPart,
  onSwitchToProdDemand
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [chart2GroupMode, setChart2GroupMode] = useState<'CUSTOMER' | 'LINE'>('CUSTOMER');
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

  // Top parts for Chart 1: Material-Wise Plan vs TTD vs Dispatch Till Date
  const topParts = [...fDemand]
    .sort((a, b) => {
      const ma = calcDispatchMetrics(a, btsMode, meta);
      const mb = calcDispatchMetrics(b, btsMode, meta);
      return pick(mb.planQ, mb.planV) - pick(ma.planQ, ma.planV);
    })
    .slice(0, 10);

  // Customer / Line-wise Dispatch Run Rate vs Dispatch Asking Rate for Chart 2
  const groupMap: Record<string, { run: number; ask: number; disp: number; ttd: number }> = {};
  fDemand.forEach(r => {
    const k =
      chart2GroupMode === 'CUSTOMER'
        ? r.customer || 'Customer'
        : r.line || r.minifactory || 'Line';
    if (!groupMap[k]) groupMap[k] = { run: 0, ask: 0, disp: 0, ttd: 0 };
    const m = calcDispatchMetrics(r, btsMode, meta);
    groupMap[k].run += pick(m.runRateQ, m.runRateV);
    groupMap[k].ask += pick(m.askRateQ, m.askRateV);
    groupMap[k].disp += pick(m.dispQ, m.dispV);
    groupMap[k].ttd += pick(m.ttdQ, m.ttdV);
  });
  const groupKeys = Object.keys(groupMap).sort((a, b) => groupMap[b].ask - groupMap[a].ask);

  // Export Table CSV
  const handleExportCSV = () => {
    const rows = filteredDemand.map(r => {
      const m = calcDispatchMetrics(r, btsMode, meta);
      return {
        part: r.part,
        desc: r.desc,
        customer: r.customer,
        mf: r.minifactory + (r.line ? ' / ' + r.line : ''),
        plan: pick(m.planQ, m.planV),
        ttd: pick(m.ttdQ, m.ttdV),
        dispTotal: pick(m.dispQ, m.dispV),
        disp601: pick(m.disp601Q, m.disp601V),
        disp641: pick(m.disp641Q, m.disp641V),
        stock: pick(r.stock_total_qty, r.stock_total_val),
        achTd: m.pctAchTd.toFixed(1) + '%',
        pendDisp: pick(m.pendDispQ, m.pendDispV),
        yestDisp: pick(r.yest_disp_qty, r.yest_disp_val),
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
        { key: 'plan', label: `Monthly Dispatch Plan (${btsMode === 'WITH_BTS' ? 'With BTS' : 'Without BTS'})` },
        { key: 'ttd', label: 'Target Dispatch Till Date' },
        { key: 'dispTotal', label: 'Dispatch Till Date (601+641)' },
        { key: 'disp601', label: 'Customer Dispatch (601)' },
        { key: 'disp641', label: 'STO Dispatch (641)' },
        { key: 'stock', label: 'Current Stock (MB52)' },
        { key: 'achTd', label: '% Dispatch Ach TTD' },
        { key: 'pendDisp', label: 'Pending for Dispatch' },
        { key: 'yestDisp', label: 'Yesterday Dispatch' },
        { key: 'runRate', label: 'Dispatch Run Rate / Day' },
        { key: 'askRate', label: 'Dispatch Asking Rate / Day' },
        { key: 'achMon', label: '% Monthly Dispatch' },
        { key: 'remarks', label: 'Dispatch & Stock Cover Remarks' }
      ],
      'Dispatch_Demand_Review_Report.csv'
    );
  };

  // Totals for table footer
  let totPlan = 0;
  let totTtd = 0;
  let totDisp = 0;
  let totDisp601 = 0;
  let totDisp641 = 0;
  let totStk = 0;
  let totPend = 0;
  let totYest = 0;
  let totRun = 0;
  let totAsk = 0;

  filteredDemand.forEach(r => {
    const m = calcDispatchMetrics(r, btsMode, meta);
    totPlan += pick(m.planQ, m.planV);
    totTtd += pick(m.ttdQ, m.ttdV);
    totDisp += pick(m.dispQ, m.dispV);
    totDisp601 += pick(m.disp601Q, m.disp601V);
    totDisp641 += pick(m.disp641Q, m.disp641V);
    totStk += pick(r.stock_total_qty, r.stock_total_val);
    totPend += pick(m.pendDispQ, m.pendDispV);
    totYest += pick(r.yest_disp_qty, r.yest_disp_val);
    totRun += pick(m.runRateQ, m.runRateV);
    totAsk += pick(m.askRateQ, m.askRateV);
  });

  const totAchTd = totTtd > 0 ? (totDisp / totTtd) * 100.0 : 0.0;
  const totAchMon = totPlan > 0 ? (totDisp / totPlan) * 100.0 : 0.0;

  return (
    <div className="flex w-full h-full min-h-0 gap-1.5 overflow-hidden">
      {/* COLLAPSIBLE LEFT COLUMN: 2 DISPATCH CHARTS */}
      {!leftCollapsed ? (
        <div className="w-full lg:w-[29%] xl:w-[28%] flex flex-col gap-1.5 min-h-0 overflow-hidden shrink-0 transition-all">
          {/* Chart 1: Material-Wise Plan vs TTD vs Dispatch */}
          <div
            className={`${
              chart1Collapsed ? 'h-8 flex-shrink-0' : 'flex-1 min-h-0'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart1Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] truncate cursor-pointer hover:text-cyan-400"
                title="Click to collapse/expand this chart"
              >
                {chart1Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="truncate">Material-Wise Plan vs TTD vs Dispatch</span>
              </button>
              <button
                onClick={() => setLeftCollapsed(() => true)}
                title="Collapse left charts to view Dispatch Report in full width"
                className="flex items-center gap-0.5 text-[9.5px] font-bold text-slate-400 hover:text-white bg-[var(--bg-card)] border border-[var(--border)] px-1.5 py-0.5 rounded cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-3 h-3 text-cyan-400" />
                <span>Hide</span>
              </button>
            </div>
            {!chart1Collapsed && (
              <div className="flex-1 min-h-0 p-1">
                <SvgComboChart
                  categories={topParts.map(r => r.desc || r.part)}
                  subtitles={topParts.map(r => `Part: ${r.part} | Cust: ${r.customer}`)}
                  series={[
                    {
                      name: 'Monthly Plan',
                      values: topParts.map(r =>
                        pick(
                          calcDispatchMetrics(r, btsMode, meta).planQ,
                          calcDispatchMetrics(r, btsMode, meta).planV
                        )
                      ),
                      color: '#64748b'
                    },
                    {
                      name: 'Target Till Date',
                      values: topParts.map(r =>
                        pick(
                          calcDispatchMetrics(r, btsMode, meta).ttdQ,
                          calcDispatchMetrics(r, btsMode, meta).ttdV
                        )
                      ),
                      color: '#f59e0b'
                    },
                    {
                      name: 'Dispatch Till Date',
                      values: topParts.map(r => pick(r.total_disp_qty, r.total_disp_val)),
                      color: '#06b6d4'
                    }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>

          {/* Chart 2: Customer / Line-Wise Dispatch Run Rate vs Asking Rate */}
          <div
            className={`${
              chart2Collapsed ? 'h-8 flex-shrink-0' : 'flex-1 min-h-0'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0 gap-1">
              <button
                onClick={() => setChart2Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] truncate cursor-pointer hover:text-cyan-400"
                title="Click to collapse/expand this chart"
              >
                {chart2Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="truncate">
                  {chart2GroupMode === 'CUSTOMER' ? 'Customer-Wise' : 'Line-Wise'} Dispatch Run vs Asking Rate
                </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setChart2GroupMode('CUSTOMER')}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold cursor-pointer ${
                    chart2GroupMode === 'CUSTOMER'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'
                  }`}
                >
                  Cust
                </button>
                <button
                  onClick={() => setChart2GroupMode('LINE')}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold cursor-pointer ${
                    chart2GroupMode === 'LINE'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'
                  }`}
                >
                  Line
                </button>
              </div>
            </div>
            {!chart2Collapsed && (
              <div className="flex-1 min-h-0 p-1">
                <SvgComboChart
                  categories={groupKeys}
                  series={[
                    {
                      name: 'Dispatch Run Rate',
                      values: groupKeys.map(k => groupMap[k].run),
                      color: '#06b6d4'
                    },
                    {
                      name: 'Dispatch Asking Rate / Day',
                      values: groupKeys.map(k => groupMap[k].ask),
                      color: '#f59e0b'
                    }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Slim Collapsed Rail so user can expand charts with 1 click */
        <button
          onClick={() => setLeftCollapsed(() => false)}
          title="Click to expand Left Dispatch Charts"
          className="w-6 bg-[var(--bg-panel)] border border-[var(--border)] hover:border-cyan-400 rounded-md flex flex-col items-center justify-center gap-2 py-2 cursor-pointer shrink-0 transition-colors group"
        >
          <PanelLeftOpen className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className="text-[9.5px] font-extrabold text-[var(--text-muted)] group-hover:text-cyan-400 [writing-mode:vertical-rl] rotate-180 tracking-wider uppercase">
            Show Dispatch Graphs
          </span>
        </button>
      )}

      {/* RIGHT COLUMN: FULL-FACE AUTOMATED DISPATCH & DEMAND REVIEW REPORT */}
      <div className="flex-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 min-w-0 overflow-hidden shadow-xs">
        {/* Compact Table Header Bar */}
        <div className="px-2.5 py-1 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-hdr)] flex-wrap gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setLeftCollapsed(p => !p)}
              title={leftCollapsed ? 'Show left-side graphs' : 'Collapse left-side graphs for Full-Face Report'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                leftCollapsed
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/25'
                  : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)] hover:border-cyan-400'
              }`}
            >
              {leftCollapsed ? (
                <>
                  <PanelLeftOpen className="w-3 h-3 text-cyan-400" />
                  <span>Show Graphs</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3 h-3 text-cyan-400" />
                  <span>Full Report</span>
                </>
              )}
            </button>

            <div
              onClick={() => openPopoutWithMode('DISPATCH')}
              className="flex items-center gap-1.5 cursor-pointer text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span className="text-[11.5px] font-extrabold tracking-wide">
                Automated Customer &amp; STO Dispatch Review Report (601 + 641)
              </span>
              <span className="text-[9.5px] font-bold bg-cyan-500/15 border border-cyan-500/40 px-1.5 py-0.2 rounded flex items-center gap-1">
                <Maximize2 className="w-2.5 h-2.5" /> Popout
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSwitchToProdDemand && (
              <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border)] rounded p-0.5 text-[10px] font-bold">
                <button
                  onClick={onSwitchToProdDemand}
                  className="px-2 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer"
                >
                  <Factory className="w-3 h-3" />
                  <span>Production</span>
                </button>
                <button className="px-2 py-0.5 rounded bg-cyan-600 text-white flex items-center gap-1 cursor-pointer">
                  <Truck className="w-3 h-3" />
                  <span>Dispatch</span>
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="Search Part / Desc / Cust..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[10.5px] w-44 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] hover:border-cyan-400 text-[10px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* High-Density Dispatch Report Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-[10.5px] border-collapse">
            <thead className="sticky top-0 bg-[var(--green-th-bg)] text-[var(--green-th-text)] font-bold text-[9.5px] z-10 border-b-2 border-emerald-900 uppercase">
              <tr>
                <th className="px-1.5 py-1.5 text-left">Part Number</th>
                <th className="px-1.5 py-1.5 text-left">Description</th>
                <th className="px-1.5 py-1.5 text-left">Customer</th>
                <th className="px-1.5 py-1.5 text-left">MF / Line</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Monthly Plan</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Target Till Date</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Disp Till Date</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Cust (601)</th>
                <th className="px-1.5 py-1.5 text-right font-mono">STO (641)</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Stock</th>
                <th className="px-1.5 py-1.5 text-right font-mono">% Ach TTD</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Pending Disp</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Yest Disp</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Run Rate</th>
                <th className="px-1.5 py-1.5 text-right font-mono">Asking Rate</th>
                <th className="px-1.5 py-1.5 text-right font-mono">% Monthly</th>
                <th className="px-1.5 py-1.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {filteredDemand.map(r => {
                const m = calcDispatchMetrics(r, btsMode, meta);
                const vPlan = pick(m.planQ, m.planV);
                const vTtd = pick(m.ttdQ, m.ttdV);
                const vDisp = pick(m.dispQ, m.dispV);
                const v601 = pick(m.disp601Q, m.disp601V);
                const v641 = pick(m.disp641Q, m.disp641V);
                const vStk = pick(r.stock_total_qty, r.stock_total_val);
                const vPend = pick(m.pendDispQ, m.pendDispV);
                const vYest = pick(r.yest_disp_qty, r.yest_disp_val);
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
                      className="px-1.5 py-1 font-medium text-[var(--text-main)] max-w-[145px] truncate"
                      title={r.desc}
                    >
                      {r.desc}
                    </td>
                    <td className="px-1.5 py-1 text-[var(--text-sub)] whitespace-nowrap">
                      {r.customer}
                    </td>
                    <td className="px-1.5 py-1 text-[var(--text-muted)] text-[10px] whitespace-nowrap">
                      {r.line}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-semibold">{fmt(vPlan)}</td>
                    <td className="px-1.5 py-1 text-right font-mono text-[var(--text-muted)]">
                      {fmt(vTtd)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-cyan-400">
                      {fmt(vDisp)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono text-blue-400">{fmt(v601)}</td>
                    <td className="px-1.5 py-1 text-right font-mono text-[var(--text-muted)]">
                      {fmt(v641)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-semibold">{fmt(vStk)}</td>
                    <td
                      className={`px-1.5 py-1 text-right font-mono font-bold ${
                        m.pctAchTd >= 100
                          ? 'text-emerald-400'
                          : m.pctAchTd >= 85
                          ? 'text-amber-400'
                          : 'text-rose-400'
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
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-blue-400">
                      {fmt(vYest)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono text-[var(--text-muted)]">
                      {fmt(vRun)}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-amber-400">
                      {fmt(vAsk)}
                    </td>
                    <td
                      className={`px-1.5 py-1 text-right font-mono font-bold ${
                        m.pctAchMon >= 100 ? 'text-emerald-400' : 'text-[var(--text-main)]'
                      }`}
                    >
                      {m.pctAchMon.toFixed(1)}%
                    </td>
                    <td
                      className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] max-w-[150px] truncate"
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
                  <td colSpan={4} className="px-1.5 py-1.5 text-[var(--text-main)]">
                    TOTAL ({filteredDemand.length} Parts)
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-[var(--text-main)]">
                    {fmt(totPlan)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-[var(--text-main)]">
                    {fmt(totTtd)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-cyan-400 font-black">
                    {fmt(totDisp)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-blue-400">
                    {fmt(totDisp601)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-[var(--text-muted)]">
                    {fmt(totDisp641)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-[var(--text-main)]">
                    {fmt(totStk)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-amber-400">
                    {totAchTd.toFixed(1)}%
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-amber-400">
                    {fmt(totPend)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-blue-400">
                    {fmt(totYest)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-[var(--text-main)]">
                    {fmt(totRun)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-amber-400">
                    {fmt(totAsk)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-emerald-400">
                    {totAchMon.toFixed(1)}%
                  </td>
                  <td className="px-1.5 py-1.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
