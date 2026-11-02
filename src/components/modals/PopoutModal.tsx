import React, { useState, useEffect, useRef } from 'react';
import { DemandRow, RmpmPartRow, UnitMode, BtsMode, DashboardMeta, PopoutReportMode } from '../../types';
import { calcPartMetrics, calcDispatchMetrics, pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { X, Download, Highlighter, Zap, ChevronDown } from 'lucide-react';

interface PopoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: PopoutReportMode;
  meta: DashboardMeta;
  demand: DemandRow[];
  rmpmParts: RmpmPartRow[];
  btsMode: BtsMode;
  setBtsMode: (mode: BtsMode) => void;
  unitMode: UnitMode;
  setUnitMode: (mode: UnitMode) => void;
  highlighterActive: boolean;
  setHighlighterActive: (fn: (prev: boolean) => boolean) => void;
  autoHighlightDeficits: () => void;
  clearHighlights: () => void;
}

export const PopoutModal: React.FC<PopoutModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  meta,
  demand,
  rmpmParts,
  btsMode,
  setBtsMode,
  unitMode,
  setUnitMode,
  highlighterActive,
  setHighlighterActive,
  autoHighlightDeficits,
  clearHighlights
}) => {
  const [reportMode, setReportMode] = useState<PopoutReportMode>(initialMode);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-select dropdown filters
  const [selectedMfs, setSelectedMfs] = useState<Set<string>>(new Set(meta.minifactories));
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set(meta.lines));
  const [selectedCusts, setSelectedCusts] = useState<Set<string>>(new Set(meta.customers));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(['BEHIND_TTD', 'ON_TRACK', 'ZERO_PROD'])
  );

  const [openDropdown, setOpenDropdown] = useState<'mf' | 'line' | 'cust' | 'status' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReportMode(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);
  const q = searchQuery.toLowerCase().trim();

  // Filter demand
  const popDemand = demand.filter(r => {
    if (r.minifactory && !selectedMfs.has(r.minifactory)) return false;
    if (r.line && !selectedLines.has(r.line)) return false;
    if (r.customer && !selectedCusts.has(r.customer)) return false;

    if (
      q &&
      !(
        r.part.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.line.toLowerCase().includes(q)
      )
    )
      return false;

    if (reportMode === 'DISPATCH') {
      const dm = calcDispatchMetrics(r, btsMode, meta);
      const isZero = dm.dispQ === 0 && dm.planQ > 0;
      const isBehind = dm.pctAchTd < 100 && !isZero;
      const isOnTrack = dm.pctAchTd >= 100;

      if (isZero && !selectedStatuses.has('ZERO_PROD')) return false;
      if (isBehind && !selectedStatuses.has('BEHIND_TTD')) return false;
      if (isOnTrack && !selectedStatuses.has('ON_TRACK')) return false;
      return true;
    }

    const m = calcPartMetrics(r, btsMode, meta);
    const isZero = m.prodQ === 0 && m.planQ > 0;
    const isBehind = m.pctAchTd < 100 && !isZero;
    const isOnTrack = m.pctAchTd >= 100;

    if (isZero && !selectedStatuses.has('ZERO_PROD')) return false;
    if (isBehind && !selectedStatuses.has('BEHIND_TTD')) return false;
    if (isOnTrack && !selectedStatuses.has('ON_TRACK')) return false;

    return true;
  });

  const handleExportCSV = () => {
    if (reportMode === 'DEMAND') {
      const rows = popDemand.map(r => {
        const m = calcPartMetrics(r, btsMode, meta);
        return {
          part: r.part,
          desc: r.desc,
          cust: r.customer,
          mf: r.minifactory + (r.line ? ' / ' + r.line : ''),
          plan: pick(m.planQ, m.planV),
          ttd: pick(m.ttdQ, m.ttdV),
          prod: pick(m.prodQ, m.prodV),
          stock: pick(r.stock_total_qty, r.stock_total_val),
          achTd: m.pctAchTd.toFixed(1) + '%',
          pend: pick(m.pendQ, m.pendV),
          yest: pick(r.yest_prod_qty, r.yest_prod_val),
          run: pick(m.runRateQ, m.runRateV),
          ask: pick(m.askRateQ, m.askRateV),
          achMon: m.pctAchMon.toFixed(1) + '%',
          remarks: m.remStr
        };
      });
      exportToCSV(
        rows,
        [
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'cust', label: 'Customer' },
          { key: 'mf', label: 'MF / Line' },
          { key: 'plan', label: 'Monthly Plan' },
          { key: 'ttd', label: 'Target Till Date' },
          { key: 'prod', label: 'Prod Till Date' },
          { key: 'stock', label: 'Current Stock' },
          { key: 'achTd', label: '% Achievement' },
          { key: 'pend', label: 'Pending for Production' },
          { key: 'yest', label: 'Yesterday Production' },
          { key: 'run', label: 'Current Run Rate' },
          { key: 'ask', label: 'Asking Rate' },
          { key: 'achMon', label: '% Monthly' },
          { key: 'remarks', label: 'Remarks' }
        ],
        'KSPG_Demand_Popout_Report.csv'
      );
    } else if (reportMode === 'DISPATCH') {
      const rows = popDemand.map(r => {
        const m = calcDispatchMetrics(r, btsMode, meta);
        return {
          part: r.part,
          desc: r.desc,
          cust: r.customer,
          mf: r.minifactory + (r.line ? ' / ' + r.line : ''),
          plan: pick(m.planQ, m.planV),
          ttd: pick(m.ttdQ, m.ttdV),
          dispTot: pick(m.dispQ, m.dispV),
          disp601: pick(m.disp601Q, m.disp601V),
          disp641: pick(m.disp641Q, m.disp641V),
          stock: pick(r.stock_total_qty, r.stock_total_val),
          achTd: m.pctAchTd.toFixed(1) + '%',
          pendDisp: pick(m.pendDispQ, m.pendDispV),
          yestDisp: pick(r.yest_disp_qty, r.yest_disp_val),
          run: pick(m.runRateQ, m.runRateV),
          ask: pick(m.askRateQ, m.askRateV),
          achMon: m.pctAchMon.toFixed(1) + '%',
          remarks: m.remStr
        };
      });
      exportToCSV(
        rows,
        [
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Description' },
          { key: 'cust', label: 'Customer' },
          { key: 'mf', label: 'MF / Line' },
          { key: 'plan', label: 'Monthly Plan' },
          { key: 'ttd', label: 'Target Till Date' },
          { key: 'dispTot', label: 'Dispatch Till Date (601+641)' },
          { key: 'disp601', label: 'Customer Dispatch (601)' },
          { key: 'disp641', label: 'STO Dispatch (641)' },
          { key: 'stock', label: 'Current Stock (MB52)' },
          { key: 'achTd', label: '% Ach TTD' },
          { key: 'pendDisp', label: 'Pending Dispatch' },
          { key: 'yestDisp', label: 'Yesterday Dispatch' },
          { key: 'run', label: 'Dispatch Run Rate' },
          { key: 'ask', label: 'Dispatch Asking Rate' },
          { key: 'achMon', label: '% Monthly' },
          { key: 'remarks', label: 'Dispatch Remarks' }
        ],
        'KSPG_Dispatch_Popout_Report.csv'
      );
    } else {
      const rows: any[] = [];
      popDemand.forEach(r => {
        const m = calcPartMetrics(r, btsMode, meta);
        rows.push({
          pillar: '1. PRODUCTION',
          part: r.part,
          desc: r.desc,
          partner: r.customer,
          mf: r.minifactory + (r.line ? ' / ' + r.line : ''),
          plan: pick(m.yestPlanQ, m.yestPlanV),
          act: pick(r.yest_prod_qty, r.yest_prod_val),
          gap: Math.max(0, pick(m.yestPlanQ, m.yestPlanV) - pick(r.yest_prod_qty, r.yest_prod_val)),
          stock: pick(r.stock_total_qty, r.stock_total_val)
        });
      });
      exportToCSV(
        rows,
        [
          { key: 'pillar', label: 'Pillar' },
          { key: 'part', label: 'Part Number' },
          { key: 'desc', label: 'Material Description' },
          { key: 'partner', label: 'Customer / Supplier' },
          { key: 'mf', label: 'MF / Line' },
          { key: 'plan', label: 'Yesterday Plan' },
          { key: 'act', label: 'Yesterday Actual' },
          { key: 'gap', label: 'Yesterday Gap' },
          { key: 'stock', label: 'Current Stock' }
        ],
        'KSPG_Yesterday_Popout_Report.csv'
      );
    }
  };

  const toggleSetItem = (set: Set<string>, item: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setter(next);
  };

  const toggleAllInSet = (items: string[], set: Set<string>, setter: (s: Set<string>) => void) => {
    if (set.size === items.length) {
      setter(new Set());
    } else {
      setter(new Set(items));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-main)]/95 flex flex-col p-2 gap-1.5 backdrop-blur-xs select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[var(--bg-panel)] border border-blue-500 rounded-md px-3 py-1.5 flex-shrink-0 shadow-lg flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black tracking-wide text-[var(--text-main)]">
            {reportMode === 'DEMAND'
              ? 'AUTOMATED PRODUCTION & DEMAND REVIEW REPORT'
              : reportMode === 'DISPATCH'
              ? 'AUTOMATED DISPATCH & ASKING RATE REVIEW REPORT'
              : 'YESTERDAY PERFORMANCE REPORT'}
          </span>
          <span className="bg-blue-500/15 border border-blue-500/40 text-blue-400 px-2 py-0.5 rounded text-[10px] font-extrabold">
            {btsMode === 'WITH_BTS' ? 'With BTS' : 'Without BTS'}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          <button
            onClick={() => setReportMode('DEMAND')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
              reportMode === 'DEMAND'
                ? 'bg-blue-600 text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white'
            }`}
          >
            Production Demand
          </button>
          <button
            onClick={() => setReportMode('DISPATCH')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
              reportMode === 'DISPATCH'
                ? 'bg-cyan-600 text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white'
            }`}
          >
            Dispatch &amp; Asking Rate
          </button>
          <button
            onClick={() => setReportMode('YESTERDAY')}
            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${
              reportMode === 'YESTERDAY'
                ? 'bg-emerald-600 text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white'
            }`}
          >
            Yesterday Performance
          </button>

          <button
            onClick={() => setHighlighterActive(p => !p)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-bold cursor-pointer transition-colors ${
              highlighterActive
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)]'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400" />
            <span>Highlight</span>
          </button>

          <button
            onClick={autoHighlightDeficits}
            className="flex items-center gap-1 px-2 py-1 rounded border border-amber-500/40 text-amber-400 bg-[var(--bg-card)] hover:bg-amber-500/15 text-[11px] font-bold cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto</span>
          </button>

          <button
            onClick={clearHighlights}
            className="px-2 py-1 rounded bg-[var(--bg-card)] text-slate-300 border border-[var(--border)] hover:text-white text-[11px] font-semibold cursor-pointer"
          >
            Clear
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--bg-card)] text-slate-200 border border-[var(--border)] hover:border-blue-400 text-[11px] font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700/80 text-white hover:bg-slate-600 text-[11px] font-extrabold cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close (Esc)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar with Checkbox Dropdowns */}
      <div
        ref={dropdownRef}
        className="flex items-center gap-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md px-3 py-1 flex-shrink-0 flex-wrap shadow-xs"
      >
        <span className="font-extrabold text-[10.5px] text-blue-400 uppercase tracking-wide">
          ☑ Filters:
        </span>

        {/* Minifactory Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(p => (p === 'mf' ? null : 'mf'))}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
          >
            <span>
              Minifactory ({selectedMfs.size === meta.minifactories.length ? 'All' : `${selectedMfs.size}/${meta.minifactories.length}`})
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {openDropdown === 'mf' && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-blue-500 rounded-md p-2 shadow-2xl z-50 min-w-[210px] max-h-64 overflow-y-auto">
              <label className="flex items-center gap-2 p-1 text-[11px] font-bold border-b border-[var(--border)] cursor-pointer text-blue-400">
                <input
                  type="checkbox"
                  checked={selectedMfs.size === meta.minifactories.length}
                  onChange={() => toggleAllInSet(meta.minifactories, selectedMfs, setSelectedMfs)}
                  className="rounded accent-blue-500"
                />
                <span>Select All</span>
              </label>
              {meta.minifactories.map(mf => (
                <label key={mf} className="flex items-center gap-2 p-1 text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] rounded">
                  <input
                    type="checkbox"
                    checked={selectedMfs.has(mf)}
                    onChange={() => toggleSetItem(selectedMfs, mf, setSelectedMfs)}
                    className="rounded accent-blue-500"
                  />
                  <span>{mf}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Line Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(p => (p === 'line' ? null : 'line'))}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
          >
            <span>
              Line ({selectedLines.size === meta.lines.length ? 'All' : `${selectedLines.size}/${meta.lines.length}`})
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {openDropdown === 'line' && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-blue-500 rounded-md p-2 shadow-2xl z-50 min-w-[210px] max-h-64 overflow-y-auto">
              <label className="flex items-center gap-2 p-1 text-[11px] font-bold border-b border-[var(--border)] cursor-pointer text-blue-400">
                <input
                  type="checkbox"
                  checked={selectedLines.size === meta.lines.length}
                  onChange={() => toggleAllInSet(meta.lines, selectedLines, setSelectedLines)}
                  className="rounded accent-blue-500"
                />
                <span>Select All</span>
              </label>
              {meta.lines.map(line => (
                <label key={line} className="flex items-center gap-2 p-1 text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] rounded">
                  <input
                    type="checkbox"
                    checked={selectedLines.has(line)}
                    onChange={() => toggleSetItem(selectedLines, line, setSelectedLines)}
                    className="rounded accent-blue-500"
                  />
                  <span>{line}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Customer Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(p => (p === 'cust' ? null : 'cust'))}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
          >
            <span>
              Customer ({selectedCusts.size === meta.customers.length ? 'All' : `${selectedCusts.size}/${meta.customers.length}`})
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {openDropdown === 'cust' && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-blue-500 rounded-md p-2 shadow-2xl z-50 min-w-[210px] max-h-64 overflow-y-auto">
              <label className="flex items-center gap-2 p-1 text-[11px] font-bold border-b border-[var(--border)] cursor-pointer text-blue-400">
                <input
                  type="checkbox"
                  checked={selectedCusts.size === meta.customers.length}
                  onChange={() => toggleAllInSet(meta.customers, selectedCusts, setSelectedCusts)}
                  className="rounded accent-blue-500"
                />
                <span>Select All</span>
              </label>
              {meta.customers.map(c => (
                <label key={c} className="flex items-center gap-2 p-1 text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] rounded">
                  <input
                    type="checkbox"
                    checked={selectedCusts.has(c)}
                    onChange={() => toggleSetItem(selectedCusts, c, setSelectedCusts)}
                    className="rounded accent-blue-500"
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Performance Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(p => (p === 'status' ? null : 'status'))}
            className="flex items-center gap-1.5 bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
          >
            <span>
              Performance ({selectedStatuses.size === 3 ? 'All' : selectedStatuses.size})
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {openDropdown === 'status' && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-panel)] border border-blue-500 rounded-md p-2 shadow-2xl z-50 min-w-[240px]">
              <label className="flex items-center gap-2 p-1.5 text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] rounded">
                <input
                  type="checkbox"
                  checked={selectedStatuses.has('BEHIND_TTD')}
                  onChange={() => toggleSetItem(selectedStatuses, 'BEHIND_TTD', setSelectedStatuses)}
                  className="rounded accent-blue-500"
                />
                <span>Behind Target Till Date (&lt;100%)</span>
              </label>
              <label className="flex items-center gap-2 p-1.5 text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] rounded">
                <input
                  type="checkbox"
                  checked={selectedStatuses.has('ON_TRACK')}
                  onChange={() => toggleSetItem(selectedStatuses, 'ON_TRACK', setSelectedStatuses)}
                  className="rounded accent-blue-500"
                />
                <span>On Track / Achieved (&ge;100%)</span>
              </label>
              <label className="flex items-center gap-2 p-1.5 text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] rounded">
                <input
                  type="checkbox"
                  checked={selectedStatuses.has('ZERO_PROD')}
                  onChange={() => toggleSetItem(selectedStatuses, 'ZERO_PROD', setSelectedStatuses)}
                  className="rounded accent-blue-500"
                />
                <span>Zero Prod / Dispatch Logged</span>
              </label>
            </div>
          )}
        </div>

        {/* Right side controls: BTS mode, unit, search */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[9px] font-bold uppercase text-slate-400">BTS:</span>
          <select
            value={btsMode}
            onChange={e => setBtsMode(e.target.value as BtsMode)}
            className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] font-semibold"
          >
            <option value="WITH_BTS">With BTS</option>
            <option value="WITHOUT_BTS">Without BTS</option>
          </select>

          <span className="text-[9px] font-bold uppercase text-slate-400 ml-1">Unit:</span>
          <select
            value={unitMode}
            onChange={e => setUnitMode(e.target.value as UnitMode)}
            className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] font-semibold"
          >
            <option value="QTY">Quantity (Units)</option>
            <option value="INR">Money (₹ INR)</option>
            <option value="LAKH">Money (₹ Lakhs)</option>
            {meta.fx_list.map((fx, idx) => (
              <option key={idx} value={`FX_${idx}`}>
                Money ({fx.from} @ {fx.rate})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search Part / Desc / Cust..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2.5 py-0.5 text-[11px] w-48 focus:outline-none focus:border-blue-400 ml-1"
          />
        </div>
      </div>

      {/* Popout Table Body */}
      <div className="flex-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md overflow-auto min-h-0 shadow-inner">
        {reportMode === 'DEMAND' ? (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-[var(--green-th-bg)] text-[var(--green-th-text)] font-bold text-[10px] z-10 border-b-2 border-emerald-900 uppercase">
              <tr>
                <th className="p-1.5 text-left">Part Number</th>
                <th className="p-1.5 text-left">Description</th>
                <th className="p-1.5 text-left">Customer</th>
                <th className="p-1.5 text-left">MF / Line</th>
                <th className="p-1.5 text-right font-mono">Monthly Plan</th>
                <th className="p-1.5 text-right font-mono">Target Till Date</th>
                <th className="p-1.5 text-right font-mono">Prod Till Date</th>
                <th className="p-1.5 text-right font-mono">Current Stock</th>
                <th className="p-1.5 text-right font-mono">% Ach TTD</th>
                <th className="p-1.5 text-right font-mono">Pending Prod</th>
                <th className="p-1.5 text-right font-mono">Yesterday Prod</th>
                <th className="p-1.5 text-right font-mono">Run Rate</th>
                <th className="p-1.5 text-right font-mono">Asking Rate</th>
                <th className="p-1.5 text-right font-mono">% Monthly</th>
                <th className="p-1.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {popDemand.map(r => {
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
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="p-1.5 font-bold text-blue-400 font-mono whitespace-nowrap">{r.part}</td>
                    <td className="p-1.5 font-medium text-[var(--text-main)] max-w-[160px] truncate">{r.desc}</td>
                    <td className="p-1.5 text-[var(--text-sub)] whitespace-nowrap">{r.customer}</td>
                    <td className="p-1.5 text-[var(--text-muted)] text-[10px] whitespace-nowrap">{r.line}</td>
                    <td className="p-1.5 text-right font-mono font-semibold">{fmt(vPlan)}</td>
                    <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">{fmt(vTtd)}</td>
                    <td className="p-1.5 text-right font-mono font-bold text-emerald-400">{fmt(vProd)}</td>
                    <td className="p-1.5 text-right font-mono">{fmt(vStk)}</td>
                    <td className={`p-1.5 text-right font-mono font-bold ${m.pctAchTd >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {m.pctAchTd.toFixed(1)}%
                    </td>
                    <td className={`p-1.5 text-right font-mono font-semibold ${vPend > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {fmt(vPend)}
                    </td>
                    <td className="p-1.5 text-right font-mono font-bold text-blue-400">{fmt(vYest)}</td>
                    <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">{fmt(vRun)}</td>
                    <td className="p-1.5 text-right font-mono font-bold text-amber-400">{fmt(vAsk)}</td>
                    <td className={`p-1.5 text-right font-mono font-bold ${m.pctAchMon >= 100 ? 'text-emerald-400' : 'text-[var(--text-main)]'}`}>
                      {m.pctAchMon.toFixed(1)}%
                    </td>
                    <td className="p-1.5 text-[10px] text-[var(--text-muted)] max-w-[180px] truncate" title={m.remStr}>
                      {m.remStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : reportMode === 'DISPATCH' ? (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-[var(--green-th-bg)] text-[var(--green-th-text)] font-bold text-[10px] z-10 border-b-2 border-emerald-900 uppercase">
              <tr>
                <th className="p-1.5 text-left">Part Number</th>
                <th className="p-1.5 text-left">Description</th>
                <th className="p-1.5 text-left">Customer</th>
                <th className="p-1.5 text-left">MF / Line</th>
                <th className="p-1.5 text-right font-mono">Monthly Plan</th>
                <th className="p-1.5 text-right font-mono">Target Till Date</th>
                <th className="p-1.5 text-right font-mono">Disp Till Date</th>
                <th className="p-1.5 text-right font-mono">Cust (601)</th>
                <th className="p-1.5 text-right font-mono">STO (641)</th>
                <th className="p-1.5 text-right font-mono">Stock</th>
                <th className="p-1.5 text-right font-mono">% Ach TTD</th>
                <th className="p-1.5 text-right font-mono">Pending Disp</th>
                <th className="p-1.5 text-right font-mono">Yest Disp</th>
                <th className="p-1.5 text-right font-mono">Run Rate</th>
                <th className="p-1.5 text-right font-mono">Asking Rate</th>
                <th className="p-1.5 text-right font-mono">% Monthly</th>
                <th className="p-1.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {popDemand.map(r => {
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
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="p-1.5 font-bold text-blue-400 font-mono whitespace-nowrap">{r.part}</td>
                    <td className="p-1.5 font-medium text-[var(--text-main)] max-w-[150px] truncate">{r.desc}</td>
                    <td className="p-1.5 text-[var(--text-sub)] whitespace-nowrap">{r.customer}</td>
                    <td className="p-1.5 text-[var(--text-muted)] text-[10px] whitespace-nowrap">{r.line}</td>
                    <td className="p-1.5 text-right font-mono font-semibold">{fmt(vPlan)}</td>
                    <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">{fmt(vTtd)}</td>
                    <td className="p-1.5 text-right font-mono font-bold text-cyan-400">{fmt(vDisp)}</td>
                    <td className="p-1.5 text-right font-mono text-blue-400">{fmt(v601)}</td>
                    <td className="p-1.5 text-right font-mono text-purple-400">{fmt(v641)}</td>
                    <td className="p-1.5 text-right font-mono">{fmt(vStk)}</td>
                    <td className={`p-1.5 text-right font-mono font-bold ${m.pctAchTd >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {m.pctAchTd.toFixed(1)}%
                    </td>
                    <td className={`p-1.5 text-right font-mono font-semibold ${vPend > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {fmt(vPend)}
                    </td>
                    <td className="p-1.5 text-right font-mono font-bold text-blue-400">{fmt(vYest)}</td>
                    <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">{fmt(vRun)}</td>
                    <td className="p-1.5 text-right font-mono font-bold text-amber-400">{fmt(vAsk)}</td>
                    <td className={`p-1.5 text-right font-mono font-bold ${m.pctAchMon >= 100 ? 'text-emerald-400' : 'text-[var(--text-main)]'}`}>
                      {m.pctAchMon.toFixed(1)}%
                    </td>
                    <td className="p-1.5 text-[10px] text-[var(--text-muted)] max-w-[180px] truncate" title={m.remStr}>
                      {m.remStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-[var(--green-th-bg)] text-[var(--green-th-text)] font-bold text-[10px] z-10 border-b-2 border-emerald-900 uppercase">
              <tr>
                <th className="p-1.5 text-left">Pillar / Category</th>
                <th className="p-1.5 text-left">Part #</th>
                <th className="p-1.5 text-left">Description</th>
                <th className="p-1.5 text-left">Customer / Supplier</th>
                <th className="p-1.5 text-left">MF / Line</th>
                <th className="p-1.5 text-right font-mono">Yesterday Plan</th>
                <th className="p-1.5 text-right font-mono">Yesterday Actual</th>
                <th className="p-1.5 text-right font-mono">Yesterday Gap</th>
                <th className="p-1.5 text-right font-mono">Yesterday Ach %</th>
                <th className="p-1.5 text-right font-mono">Stock (MB52)</th>
                <th className="p-1.5 text-left">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {popDemand.map(r => {
                const m = calcPartMetrics(r, btsMode, meta);
                const yPlan = pick(m.yestPlanQ, m.yestPlanV);
                const yProd = pick(r.yest_prod_qty, r.yest_prod_val);
                const yGap = Math.max(0, yPlan - yProd);
                const isLag = m.pctYestProd < 85 && yPlan > 0;
                return (
                  <tr key={`pop-prod-${r.part}`} data-deficit={isLag} className="hover:bg-[var(--bg-hover)]">
                    <td className="p-1.5">
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold">
                        1. PROD
                      </span>
                    </td>
                    <td className="p-1.5 font-bold text-blue-400 font-mono whitespace-nowrap">{r.part}</td>
                    <td className="p-1.5 font-medium text-[var(--text-main)] max-w-[150px] truncate">{r.desc}</td>
                    <td className="p-1.5 text-[var(--text-sub)] whitespace-nowrap">{r.customer}</td>
                    <td className="p-1.5 text-[var(--text-muted)] text-[10px]">{r.line}</td>
                    <td className="p-1.5 text-right font-mono">{fmt(yPlan)}</td>
                    <td className="p-1.5 text-right font-mono font-bold text-emerald-400">{fmt(yProd)}</td>
                    <td className={`p-1.5 text-right font-mono font-bold ${yGap > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {fmt(yGap)}
                    </td>
                    <td className={`p-1.5 text-right font-mono font-bold ${isLag ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {m.pctYestProd.toFixed(1)}%
                    </td>
                    <td className="p-1.5 text-right font-mono">{fmt(pick(r.stock_total_qty, r.stock_total_val))}</td>
                    <td className="p-1.5 text-[10px] text-[var(--text-muted)]">
                      {m.pctYestProd >= 100 ? 'Target Achieved' : 'Below Daily Plan'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
