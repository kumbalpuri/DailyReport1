import React, { useState } from 'react';
import { RmpmPartRow, VendorScheduleRow, Mb51Row, UnitMode, DashboardMeta } from '../../types';
import { pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { SvgComboChart } from '../charts/SvgComboChart';
import { Download, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface RmpmTabProps {
  meta: DashboardMeta;
  fRmpmParts: RmpmPartRow[];
  fVendorSched: VendorScheduleRow[];
  fMb51: Mb51Row[];
  unitMode: UnitMode;
  theme: 'dark' | 'light';
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export const RmpmTab: React.FC<RmpmTabProps> = ({
  meta,
  fRmpmParts,
  fVendorSched,
  fMb51,
  unitMode,
  theme,
  leftCollapsed,
  setLeftCollapsed
}) => {
  const [tableMode, setTableMode] = useState<'SUMMARY' | 'SCHEDULE'>('SUMMARY');
  const [searchQuery, setSearchQuery] = useState('');
  const [chart1Collapsed, setChart1Collapsed] = useState(false);
  const [chart2Collapsed, setChart2Collapsed] = useState(false);

  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);
  const q = searchQuery.toLowerCase().trim();

  // Chart 1: Daily Vendor Schedule vs MB51 Receipt
  const dtMap: Record<string, { sched: number; grn: number }> = {};
  fVendorSched.forEach(r => {
    const d = r.date || 'Sched';
    if (!dtMap[d]) dtMap[d] = { sched: 0, grn: 0 };
    dtMap[d].sched += pick(r.sched_qty, r.sched_val);
  });
  fMb51.forEach(r => {
    if ((r.mvt === 101 || r.mvt === 102) && r.type === 'RMPM') {
      const d = r.date || 'Recd';
      if (!dtMap[d]) dtMap[d] = { sched: 0, grn: 0 };
      dtMap[d].grn += pick(r.qty, r.val);
    }
  });
  const dKeys = Object.keys(dtMap).sort();

  // Chart 2: Monitored RMPM: Schedule vs Received vs MB52 Stock
  const sortedParts = [...fRmpmParts]
    .sort((a, b) => pick(b.sched_total_qty, b.sched_total_val) - pick(a.sched_total_qty, a.sched_total_val))
    .slice(0, 8);

  const filteredSummary = fRmpmParts.filter(
    r =>
      !q ||
      r.part.toLowerCase().includes(q) ||
      r.desc.toLowerCase().includes(q) ||
      r.line.toLowerCase().includes(q) ||
      r.minifactory.toLowerCase().includes(q) ||
      r.supplier.toLowerCase().includes(q)
  );

  const filteredSchedule = fVendorSched.filter(
    r =>
      !q ||
      r.part.toLowerCase().includes(q) ||
      r.desc.toLowerCase().includes(q) ||
      r.date.toLowerCase().includes(q) ||
      r.line.toLowerCase().includes(q)
  );

  const handleExportCSV = () => {
    if (tableMode === 'SUMMARY') {
      const rows = filteredSummary.map(r => ({
        part: r.part,
        desc: r.desc,
        mf: r.minifactory,
        line: r.line,
        sched: pick(r.sched_total_qty, r.sched_total_val),
        recd: pick(r.grn_qty, r.grn_val),
        gap: pick(r.gap_total_qty, r.gap_total_val),
        yestGrn: pick(r.yest_grn_qty, r.yest_grn_val),
        unrest: pick(r.unrest_qty, r.unrest_val),
        qual: pick(r.qual_qty, r.qual_val),
        totStock: pick(r.total_stock_qty, r.total_stock_val),
        supplier: r.supplier
      }));
      exportToCSV(
        rows,
        [
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'mf', label: 'Minifactory' },
          { key: 'line', label: 'Line' },
          { key: 'sched', label: 'Vendor Schedule' },
          { key: 'recd', label: 'Received (101/102)' },
          { key: 'gap', label: 'Pending Gap' },
          { key: 'yestGrn', label: 'Yesterday GRN' },
          { key: 'unrest', label: 'MB52 Unrestricted' },
          { key: 'qual', label: 'MB52 Quality Insp' },
          { key: 'totStock', label: 'MB52 Total Stock' },
          { key: 'supplier', label: 'Supplier' }
        ],
        'RMPM_Supplier_Summary.csv'
      );
    } else {
      const rows = filteredSchedule.map(r => ({
        date: r.date,
        part: r.part,
        desc: r.desc,
        mf: r.minifactory,
        line: r.line,
        sched: pick(r.sched_qty, r.sched_val),
        grn: pick(r.grn_qty, r.grn_val)
      }));
      exportToCSV(
        rows,
        [
          { key: 'date', label: 'Date' },
          { key: 'part', label: 'Product / Part #' },
          { key: 'desc', label: 'Description' },
          { key: 'mf', label: 'Minifactory' },
          { key: 'line', label: 'Line' },
          { key: 'sched', label: 'Scheduled' },
          { key: 'grn', label: 'MB51 Receipt on Date' }
        ],
        'RMPM_Daily_Vendor_Schedule.csv'
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-1.5 w-full h-full min-h-0 overflow-hidden">
      {/* COLLAPSED RAIL FOR LEFT GRAPHS */}
      {leftCollapsed ? (
        <div
          onClick={() => setLeftCollapsed(false)}
          title="Click to expand Left-Hand RMPM Graphs"
          className="hidden lg:flex flex-col items-center justify-between py-2.5 px-1 w-7 bg-[var(--bg-panel)] border border-[var(--border)] hover:border-amber-500 rounded-md cursor-pointer transition-all shrink-0 shadow-xs group"
        >
          <PanelLeftOpen className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-extrabold tracking-widest uppercase text-[var(--text-muted)] group-hover:text-amber-400 whitespace-nowrap">
            Show RMPM Graphs (2)
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        </div>
      ) : (
        /* LEFT COLUMN: 2 CHARTS (32% width) */
        <div className="w-full lg:w-[32%] flex flex-col gap-1.5 min-h-0 overflow-hidden shrink-0">
          {/* Chart 1: Daily Vendor Schedule vs MB51 Receipt */}
          <div
            className={`${
              chart1Collapsed ? 'flex-none' : 'flex-1'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart1Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] hover:text-amber-400 truncate cursor-pointer"
              >
                {chart1Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">Daily Supplier Schedule vs RMPM Receipt</span>
              </button>
              <button
                onClick={() => setLeftCollapsed(true)}
                title="Collapse Left Graphs for Full-Face Report View"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-3 h-3" />
                <span>Hide</span>
              </button>
            </div>
            {!chart1Collapsed && (
              <div className="flex-1 min-h-[140px] p-1">
                <SvgComboChart
                  categories={dKeys}
                  series={[
                    {
                      name: 'Vendor Schedule',
                      values: dKeys.map(d => dtMap[d].sched),
                      color: '#f59e0b'
                    },
                    {
                      name: 'MB51 Receipt (101/102)',
                      values: dKeys.map(d => dtMap[d].grn),
                      color: '#10b981'
                    }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>

          {/* Chart 2: Monitored RMPM breakdown */}
          <div
            className={`${
              chart2Collapsed ? 'flex-none' : 'flex-1'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart2Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] hover:text-amber-400 truncate cursor-pointer"
              >
                {chart2Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">Monitored RMPM: Schedule vs Received vs Stock</span>
              </button>
            </div>
            {!chart2Collapsed && (
              <div className="flex-1 min-h-[140px] p-1">
                <SvgComboChart
                  categories={sortedParts.map(r => r.desc || r.part)}
                  subtitles={sortedParts.map(r => `Part: ${r.part}`)}
                  series={[
                    {
                      name: 'Vendor Schedule',
                      values: sortedParts.map(r => pick(r.sched_total_qty, r.sched_total_val)),
                      color: '#f59e0b'
                    },
                    {
                      name: 'Received (101/102)',
                      values: sortedParts.map(r => pick(r.grn_qty, r.grn_val)),
                      color: '#10b981'
                    },
                    {
                      name: 'MB52 Stock (Unr+QA)',
                      values: sortedParts.map(r => pick(r.total_stock_qty, r.total_stock_val)),
                      color: '#3b82f6'
                    }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* RIGHT COLUMN: RMPM TABLES */}
      <div className="flex-1 min-w-0 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
        {/* Table header bar */}
        <div className="px-2 py-1 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-hdr)] flex-wrap gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLeftCollapsed(p => !p)}
              title={leftCollapsed ? 'Show Left Graphs' : 'Collapse Left Graphs to View Report Full-Face'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                leftCollapsed
                  ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                  : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)] hover:border-amber-400'
              }`}
            >
              {leftCollapsed ? (
                <>
                  <PanelLeftOpen className="w-3 h-3" />
                  <span>Show Graphs</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3 h-3 text-amber-400" />
                  <span>Full Report</span>
                </>
              )}
            </button>

            <span className="text-[11.5px] font-extrabold text-[var(--text-main)] tracking-wide">
              Monitored RMPM Supplier Schedule &amp; Stock Position
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Filter Part / Desc / Line..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[10.5px] w-40 focus:outline-none focus:border-blue-400"
            />

            <select
              value={tableMode}
              onChange={e => setTableMode(e.target.value as 'SUMMARY' | 'SCHEDULE')}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[10.5px] font-semibold cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="SUMMARY">Part Summary</option>
              <option value="SCHEDULE">Date-Wise Vendor Schedule</option>
            </select>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] hover:border-blue-400 text-[10px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Table content */}
        <div className="flex-1 overflow-auto min-h-0">
          {tableMode === 'SUMMARY' ? (
            <table className="w-full text-[10.5px] border-collapse">
              <thead className="sticky top-0 bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[9.5px] z-10 border-b border-[var(--border)] uppercase">
                <tr>
                  <th className="px-1.5 py-1 text-left">Part Number</th>
                  <th className="px-1.5 py-1 text-left">Description</th>
                  <th className="px-1.5 py-1 text-left">Minifactory</th>
                  <th className="px-1.5 py-1 text-left">Line</th>
                  <th className="px-1.5 py-1 text-right font-mono">Vendor Sched</th>
                  <th className="px-1.5 py-1 text-right font-mono">Recd (101/102)</th>
                  <th className="px-1.5 py-1 text-right font-mono">Pending Gap</th>
                  <th className="px-1.5 py-1 text-right font-mono">Yest GRN</th>
                  <th className="px-1.5 py-1 text-right font-mono">Unrestricted</th>
                  <th className="px-1.5 py-1 text-right font-mono">Quality Insp</th>
                  <th className="px-1.5 py-1 text-right font-mono">Total Stock</th>
                  <th className="px-1.5 py-1 text-left">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {filteredSummary.map(r => {
                  const isDeficit = r.gap_total_qty > 0;
                  return (
                    <tr
                      key={r.part}
                      data-deficit={isDeficit}
                      className="hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <td className="px-1.5 py-1 font-bold text-blue-400 font-mono whitespace-nowrap">
                        {r.part}
                      </td>
                      <td className="px-1.5 py-1 font-medium text-[var(--text-main)] max-w-[150px] truncate" title={r.desc}>
                        {r.desc}
                      </td>
                      <td className="px-1.5 py-1 text-[var(--text-sub)] text-[10px] truncate">{r.minifactory}</td>
                      <td className="px-1.5 py-1 text-[var(--text-muted)] text-[10px] truncate">{r.line}</td>
                      <td className="px-1.5 py-1 text-right font-mono">{fmt(pick(r.sched_total_qty, r.sched_total_val))}</td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-emerald-400">{fmt(pick(r.grn_qty, r.grn_val))}</td>
                      <td className={`px-1.5 py-1 text-right font-mono font-bold ${r.gap_total_qty > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {fmt(pick(r.gap_total_qty, r.gap_total_val))}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-blue-400">{fmt(pick(r.yest_grn_qty, r.yest_grn_val))}</td>
                      <td className="px-1.5 py-1 text-right font-mono">{fmt(pick(r.unrest_qty, r.unrest_val))}</td>
                      <td className={`px-1.5 py-1 text-right font-mono ${r.qual_qty > 0 ? 'text-amber-400 font-semibold' : ''}`}>
                        {fmt(pick(r.qual_qty, r.qual_val))}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-[var(--text-main)]">
                        {fmt(pick(r.total_stock_qty, r.total_stock_val))}
                      </td>
                      <td className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] max-w-[140px] truncate" title={r.supplier}>
                        {r.supplier}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-[10.5px] border-collapse">
              <thead className="sticky top-0 bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[9.5px] z-10 border-b border-[var(--border)] uppercase">
                <tr>
                  <th className="px-1.5 py-1 text-left">Date</th>
                  <th className="px-1.5 py-1 text-left">Part Number</th>
                  <th className="px-1.5 py-1 text-left">Description</th>
                  <th className="px-1.5 py-1 text-left">Minifactory</th>
                  <th className="px-1.5 py-1 text-left">Line</th>
                  <th className="px-1.5 py-1 text-right font-mono">Scheduled</th>
                  <th className="px-1.5 py-1 text-right font-mono">MB51 Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {filteredSchedule.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-1.5 py-1 font-mono text-slate-400 whitespace-nowrap">{r.date}</td>
                    <td className="px-1.5 py-1 font-bold text-blue-400 font-mono whitespace-nowrap">{r.part}</td>
                    <td className="px-1.5 py-1 font-medium text-[var(--text-main)] max-w-[180px] truncate">{r.desc}</td>
                    <td className="px-1.5 py-1 text-[var(--text-sub)] text-[10px] truncate">{r.minifactory}</td>
                    <td className="px-1.5 py-1 text-[var(--text-muted)] text-[10px] truncate">{r.line}</td>
                    <td className="px-1.5 py-1 text-right font-mono font-semibold">{fmt(pick(r.sched_qty, r.sched_val))}</td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-emerald-400">{fmt(pick(r.grn_qty, r.grn_val))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
