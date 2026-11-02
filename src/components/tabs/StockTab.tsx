import React, { useState } from 'react';
import { Mb51Row, Mb52Row, UnitMode, DashboardMeta } from '../../types';
import { pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { SvgComboChart } from '../charts/SvgComboChart';
import { Download, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface StockTabProps {
  meta: DashboardMeta;
  fMb51: Mb51Row[];
  fMb52: Mb52Row[];
  unitMode: UnitMode;
  theme: 'dark' | 'light';
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export const StockTab: React.FC<StockTabProps> = ({
  meta,
  fMb51,
  fMb52,
  unitMode,
  theme,
  leftCollapsed,
  setLeftCollapsed
}) => {
  const [tableType, setTableType] = useState<'MB52_ALL' | 'MB52_RMPM' | 'MB52_FG' | 'MB51_ALL'>('MB52_ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chart1Collapsed, setChart1Collapsed] = useState(false);
  const [chart2Collapsed, setChart2Collapsed] = useState(false);

  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);
  const q = searchQuery.toLowerCase().trim();

  // Chart 1 & Chart 2 Aggregation
  const mfMap: Record<string, { fg: number; rmpm: number; unr: number; qa: number; blk: number; trn: number }> = {};
  fMb52.forEach(r => {
    const k = r.minifactory || r.line || r.type || 'Stock';
    if (!mfMap[k]) mfMap[k] = { fg: 0, rmpm: 0, unr: 0, qa: 0, blk: 0, trn: 0 };
    const tot = pick(r.total_qty, r.total_val);
    if (r.type === 'RMPM') mfMap[k].rmpm += tot;
    else mfMap[k].fg += tot;
    mfMap[k].unr += pick(r.unrest_qty, r.unrest_val);
    mfMap[k].qa += pick(r.qual_qty, r.qual_val);
    mfMap[k].blk += pick(r.block_qty, r.block_val);
    mfMap[k].trn += pick(r.trans_qty, r.trans_val);
  });
  const mfs = Object.keys(mfMap).sort();

  // Filtered rows for MB52
  const filteredMb52 = fMb52.filter(r => {
    if (tableType === 'MB52_RMPM' && r.type !== 'RMPM') return false;
    if (tableType === 'MB52_FG' && r.type !== 'FG') return false;
    if (
      q &&
      !(
        r.part.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.line.toLowerCase().includes(q) ||
        r.minifactory.toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  // Filtered rows for MB51
  const filteredMb51 = fMb51.filter(r => {
    if (
      q &&
      !(
        r.part.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        String(r.mvt).includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  const handleExportCSV = () => {
    if (tableType.startsWith('MB52_')) {
      const rows = filteredMb52.map(r => ({
        type: r.type,
        part: r.part,
        desc: r.desc,
        mf: r.minifactory,
        line: r.line,
        totStock: pick(r.total_qty, r.total_val),
        unrest: pick(r.unrest_qty, r.unrest_val),
        qual: pick(r.qual_qty, r.qual_val),
        block: pick(r.block_qty, r.block_val),
        trans: pick(r.trans_qty, r.trans_val)
      }));
      exportToCSV(
        rows,
        [
          { key: 'type', label: 'Type' },
          { key: 'part', label: 'Material Number' },
          { key: 'desc', label: 'Description' },
          { key: 'mf', label: 'Minifactory' },
          { key: 'line', label: 'Line' },
          { key: 'totStock', label: 'Total Stock (Unr + Qual)' },
          { key: 'unrest', label: 'Unrestricted' },
          { key: 'qual', label: 'In Quality Insp.' },
          { key: 'block', label: 'Blocked' },
          { key: 'trans', label: 'Transit/Transf.' }
        ],
        'MB52_Stock_Position.csv'
      );
    } else {
      const rows = filteredMb51.map(r => ({
        date: r.date,
        mvt: r.mvt,
        type: r.type,
        part: r.part,
        desc: r.desc,
        mf: r.minifactory,
        line: r.line,
        qtyVal: pick(r.qty, r.val),
        supplier: r.supplier,
        customer: r.customer,
        po: r.po,
        doc: r.doc
      }));
      exportToCSV(
        rows,
        [
          { key: 'date', label: 'Posting Date' },
          { key: 'mvt', label: 'Movement Type (MvT)' },
          { key: 'type', label: 'Type' },
          { key: 'part', label: 'Material' },
          { key: 'desc', label: 'Description' },
          { key: 'mf', label: 'Minifactory' },
          { key: 'line', label: 'Line' },
          { key: 'qtyVal', label: 'Quantity / Value' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'customer', label: 'Customer' },
          { key: 'po', label: 'PO' },
          { key: 'doc', label: 'Mat. Doc.' }
        ],
        'MB51_Movement_Ledger.csv'
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-1.5 w-full h-full min-h-0 overflow-hidden">
      {/* COLLAPSED RAIL FOR LEFT GRAPHS */}
      {leftCollapsed ? (
        <div
          onClick={() => setLeftCollapsed(false)}
          title="Click to expand Left-Hand Stock Graphs"
          className="hidden lg:flex flex-col items-center justify-between py-2.5 px-1 w-7 bg-[var(--bg-panel)] border border-[var(--border)] hover:border-purple-500 rounded-md cursor-pointer transition-all shrink-0 shadow-xs group"
        >
          <PanelLeftOpen className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-extrabold tracking-widest uppercase text-[var(--text-muted)] group-hover:text-purple-400 whitespace-nowrap">
            Show MB52 Stock Graphs (2)
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        </div>
      ) : (
        /* LEFT COLUMN: 2 CHARTS (32% width) */
        <div className="w-full lg:w-[32%] flex flex-col gap-1.5 min-h-0 overflow-hidden shrink-0">
          {/* Chart 1: MB52 Stock by Minifactory */}
          <div
            className={`${
              chart1Collapsed ? 'flex-none' : 'flex-1'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart1Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] hover:text-purple-400 truncate cursor-pointer"
              >
                {chart1Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">MB52 Stock (Unr + QA) by Minifactory</span>
              </button>
              <button
                onClick={() => setLeftCollapsed(true)}
                title="Collapse Left Graphs for Full-Face Report View"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-3 h-3" />
                <span>Hide</span>
              </button>
            </div>
            {!chart1Collapsed && (
              <div className="flex-1 min-h-[140px] p-1">
                <SvgComboChart
                  categories={mfs}
                  series={[
                    { name: 'FG Stock (Unr+QA)', values: mfs.map(k => mfMap[k].fg), color: '#3b82f6' },
                    { name: 'RMPM Stock (Unr+QA)', values: mfs.map(k => mfMap[k].rmpm), color: '#8b5cf6' }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>

          {/* Chart 2: Stock Split */}
          <div
            className={`${
              chart2Collapsed ? 'flex-none' : 'flex-1'
            } bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs`}
          >
            <div className="px-2 py-1 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setChart2Collapsed(p => !p)}
                className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--text-main)] hover:text-purple-400 truncate cursor-pointer"
              >
                {chart2Collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="truncate">MB52 Breakdown: Unrest vs QA vs Blocked</span>
              </button>
            </div>
            {!chart2Collapsed && (
              <div className="flex-1 min-h-[140px] p-1">
                <SvgComboChart
                  categories={mfs}
                  series={[
                    { name: 'Unrestricted', values: mfs.map(k => mfMap[k].unr), color: '#10b981' },
                    { name: 'In Quality Insp.', values: mfs.map(k => mfMap[k].qa), color: '#f59e0b' },
                    { name: 'Blocked', values: mfs.map(k => mfMap[k].blk), color: '#64748b' },
                    { name: 'Transit', values: mfs.map(k => mfMap[k].trn), color: '#06b6d4' }
                  ]}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* RIGHT COLUMN: STOCK & LEDGER TABLE */}
      <div className="flex-1 min-w-0 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
        {/* Table header bar */}
        <div className="px-2 py-1 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-hdr)] flex-wrap gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLeftCollapsed(p => !p)}
              title={leftCollapsed ? 'Show Left Graphs' : 'Collapse Left Graphs to View Report Full-Face'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                leftCollapsed
                  ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                  : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)] hover:border-purple-400'
              }`}
            >
              {leftCollapsed ? (
                <>
                  <PanelLeftOpen className="w-3 h-3" />
                  <span>Show Graphs</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3 h-3 text-purple-400" />
                  <span>Full Report</span>
                </>
              )}
            </button>

            <span className="text-[11.5px] font-extrabold text-[var(--text-main)] tracking-wide">
              MB52 Stock Position &amp; MB51 Movement Ledger
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search Part / Desc..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[10.5px] w-36 focus:outline-none focus:border-blue-400"
            />

            <select
              value={tableType}
              onChange={e => setTableType(e.target.value as any)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[10.5px] font-semibold cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="MB52_ALL">MB52 Stock (All)</option>
              <option value="MB52_RMPM">MB52 Stock (RMPM Only)</option>
              <option value="MB52_FG">MB52 Stock (FG Only)</option>
              <option value="MB51_ALL">MB51 Movements</option>
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
          {tableType.startsWith('MB52_') ? (
            <table className="w-full text-[10.5px] border-collapse">
              <thead className="sticky top-0 bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[9.5px] z-10 border-b border-[var(--border)] uppercase">
                <tr>
                  <th className="px-1.5 py-1 text-left">Type</th>
                  <th className="px-1.5 py-1 text-left">Material Number</th>
                  <th className="px-1.5 py-1 text-left">Description</th>
                  <th className="px-1.5 py-1 text-left">Minifactory</th>
                  <th className="px-1.5 py-1 text-left">Line</th>
                  <th className="px-1.5 py-1 text-right font-mono">Total Stock (Unr+QA)</th>
                  <th className="px-1.5 py-1 text-right font-mono">Unrestricted</th>
                  <th className="px-1.5 py-1 text-right font-mono">Quality Insp</th>
                  <th className="px-1.5 py-1 text-right font-mono">Blocked</th>
                  <th className="px-1.5 py-1 text-right font-mono">Transit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {filteredMb52.map(r => {
                  const isDeficit = r.unrest_qty <= 0;
                  return (
                    <tr
                      key={r.part}
                      data-deficit={isDeficit}
                      className="hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <td className="px-1.5 py-1">
                        <span
                          className={`px-1 py-0.2 rounded text-[8.5px] font-bold ${
                            r.type === 'RMPM'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {r.type || '-'}
                        </span>
                      </td>
                      <td className="px-1.5 py-1 font-bold text-blue-400 font-mono whitespace-nowrap">
                        {r.part}
                      </td>
                      <td className="px-1.5 py-1 font-medium text-[var(--text-main)] max-w-[150px] truncate" title={r.desc}>
                        {r.desc}
                      </td>
                      <td className="px-1.5 py-1 text-[var(--text-sub)] text-[10px] truncate">{r.minifactory}</td>
                      <td className="px-1.5 py-1 text-[var(--text-muted)] text-[10px] truncate">{r.line}</td>
                      <td className="px-1.5 py-1 text-right font-mono font-bold text-[var(--text-main)]">
                        {fmt(pick(r.total_qty, r.total_val))}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-emerald-400 font-semibold">
                        {fmt(pick(r.unrest_qty, r.unrest_val))}
                      </td>
                      <td className={`px-1.5 py-1 text-right font-mono ${r.qual_qty > 0 ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
                        {fmt(pick(r.qual_qty, r.qual_val))}
                      </td>
                      <td className={`px-1.5 py-1 text-right font-mono ${r.block_qty > 0 ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                        {fmt(pick(r.block_qty, r.block_val))}
                      </td>
                      <td className="px-1.5 py-1 text-right font-mono text-cyan-400 font-semibold">
                        {fmt(pick(r.trans_qty, r.trans_val))}
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
                  <th className="px-1.5 py-1 text-left">Posting Date</th>
                  <th className="px-1.5 py-1 text-left">MvT</th>
                  <th className="px-1.5 py-1 text-left">Type</th>
                  <th className="px-1.5 py-1 text-left">Material</th>
                  <th className="px-1.5 py-1 text-left">Description</th>
                  <th className="px-1.5 py-1 text-left">MF / Line</th>
                  <th className="px-1.5 py-1 text-right font-mono">Qty / Val</th>
                  <th className="px-1.5 py-1 text-left">Supplier</th>
                  <th className="px-1.5 py-1 text-left">Customer</th>
                  <th className="px-1.5 py-1 text-left">PO / Mat Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {filteredMb51.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-1.5 py-1 font-mono text-slate-400 whitespace-nowrap">{r.date}</td>
                    <td className="px-1.5 py-1">
                      <span
                        className={`px-1 py-0.2 rounded text-[8.5px] font-bold ${
                          r.mvt === 101 || r.mvt === 102
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {r.mvt}
                      </span>
                    </td>
                    <td className="px-1.5 py-1 text-[10px] text-slate-400">{r.type}</td>
                    <td className="px-1.5 py-1 font-bold text-blue-400 font-mono whitespace-nowrap">{r.part}</td>
                    <td className="px-1.5 py-1 font-medium text-[var(--text-main)] max-w-[150px] truncate">{r.desc}</td>
                    <td className="px-1.5 py-1 text-[var(--text-muted)] text-[10px] truncate">
                      {r.minifactory} {r.line ? `(${r.line})` : ''}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono font-bold text-slate-200">
                      {fmt(pick(r.qty, r.val))}
                    </td>
                    <td className="px-1.5 py-1 text-[var(--text-sub)] text-[10px] truncate">{r.supplier || '-'}</td>
                    <td className="px-1.5 py-1 text-[var(--text-sub)] text-[10px] truncate">{r.customer || '-'}</td>
                    <td className="px-1.5 py-1 text-[var(--text-muted)] font-mono text-[10px] truncate">
                      {r.po || r.doc || '-'}
                    </td>
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
