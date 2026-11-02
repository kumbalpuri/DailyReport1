import React from 'react';
import { TabType, UnitMode, BtsMode, DashboardMeta } from '../types';
import {
  Sun,
  Moon,
  Highlighter,
  Zap,
  RotateCcw,
  FolderOpen,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface TopBarProps {
  meta: DashboardMeta;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedYestDate: string;
  setSelectedYestDate: (dateIso: string) => void;
  selectedMf: string;
  setSelectedMf: (mf: string) => void;
  selectedLine: string;
  setSelectedLine: (line: string) => void;
  selectedCustomer: string;
  setSelectedCustomer: (cust: string) => void;
  btsMode: BtsMode;
  setBtsMode: (mode: BtsMode) => void;
  unitMode: UnitMode;
  setUnitMode: (mode: UnitMode) => void;
  highlighterActive: boolean;
  setHighlighterActive: (fn: (prev: boolean) => boolean) => void;
  autoHighlightDeficits: () => void;
  theme: 'dark' | 'light';
  setTheme: (fn: (prev: 'dark' | 'light') => 'dark' | 'light') => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (fn: (prev: boolean) => boolean) => void;
  kpiCollapsed: boolean;
  setKpiCollapsed: (fn: (prev: boolean) => boolean) => void;
  resetAllFilters: () => void;
  openDataModal: () => void;
  exportCommentsLog: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  meta,
  activeTab,
  setActiveTab,
  selectedYestDate,
  setSelectedYestDate,
  selectedMf,
  setSelectedMf,
  selectedLine,
  setSelectedLine,
  selectedCustomer,
  setSelectedCustomer,
  btsMode,
  setBtsMode,
  unitMode,
  setUnitMode,
  highlighterActive,
  setHighlighterActive,
  autoHighlightDeficits,
  theme,
  setTheme,
  leftCollapsed,
  setLeftCollapsed,
  kpiCollapsed,
  setKpiCollapsed,
  resetAllFilters,
  openDataModal,
  exportCommentsLog
}) => {
  return (
    <header className="flex flex-col bg-[var(--bg-panel)] border border-[var(--border)] rounded-md px-2.5 py-1 gap-1 w-full flex-shrink-0 shadow-xs">
      {/* Row 1: Title, Subtitle, Slicers & Tools */}
      <div className="flex items-center justify-between w-full flex-wrap gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-6 bg-blue-500 rounded-full flex-shrink-0" />
          <div>
            <div className="text-[12px] font-extrabold text-[var(--text-main)] tracking-wide leading-tight">
              KSPG SALES, DISPATCH &amp; PRODUCTION COMMAND CENTER
            </div>
            <div className="text-[9.5px] text-[var(--text-muted)] flex items-center gap-1.5 leading-tight mt-0.5">
              <span className="font-semibold text-slate-300">
                Yesterday: <strong className="text-emerald-400 font-mono">{meta.cutoff_date}</strong>
              </span>
              <span className="bg-blue-500/15 border border-blue-500/40 text-blue-400 px-1.5 py-0 rounded text-[9px] font-bold">
                Working Days: {meta.elapsed_working_days}/{meta.total_working_days} ({meta.remaining_working_days} Left | {meta.prorata_pct}% Elapsed)
              </span>
            </div>
          </div>
        </div>

        {/* Slicers and Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {/* Yesterday Date selector */}
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase text-emerald-400 leading-none mb-0.5">
              Yesterday Date (MB51)
            </span>
            <select
              value={selectedYestDate}
              onChange={e => setSelectedYestDate(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-emerald-500/60 rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-emerald-400 max-w-[195px] cursor-pointer"
            >
              {(meta.mb51_dates || []).map(d => (
                <option key={d.iso} value={d.iso}>
                  {d.display} (Disp: {d.disp_qty.toLocaleString('en-IN')} | Prod: {d.prod_qty.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Minifactory */}
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase text-[var(--text-muted)] leading-none mb-0.5">
              Minifactory
            </span>
            <select
              value={selectedMf}
              onChange={e => {
                setSelectedMf(e.target.value);
                setSelectedLine('ALL');
              }}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-500 max-w-[135px] cursor-pointer"
            >
              <option value="ALL">All Minifactories</option>
              {meta.minifactories.map(mf => (
                <option key={mf} value={mf}>
                  {mf}
                </option>
              ))}
            </select>
          </div>

          {/* Line */}
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase text-[var(--text-muted)] leading-none mb-0.5">
              Line
            </span>
            <select
              value={selectedLine}
              onChange={e => setSelectedLine(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-500 max-w-[135px] cursor-pointer"
            >
              <option value="ALL">All Lines</option>
              {meta.lines.map(line => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase text-[var(--text-muted)] leading-none mb-0.5">
              Customer
            </span>
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-500 max-w-[130px] cursor-pointer"
            >
              <option value="ALL">All Customers</option>
              {meta.customers.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* BTS Option */}
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase text-blue-400 leading-none mb-0.5">
              BTS Option
            </span>
            <select
              value={btsMode}
              onChange={e => setBtsMode(e.target.value as BtsMode)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-blue-500/50 rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              <option value="WITH_BTS">With BTS (Incl.)</option>
              <option value="WITHOUT_BTS">Without BTS (-BTS)</option>
            </select>
          </div>

          {/* Qty / Money Unit */}
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase text-[var(--text-muted)] leading-none mb-0.5">
              Unit
            </span>
            <select
              value={unitMode}
              onChange={e => setUnitMode(e.target.value as UnitMode)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
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
          </div>

          {/* Space Optimization & Utility Tools */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setLeftCollapsed(p => !p)}
              title={
                leftCollapsed
                  ? 'Show Left-Hand Side Graphs'
                  : 'Collapse Left-Hand Side Graphs to View Report Full-Face'
              }
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-bold transition-colors cursor-pointer ${
                leftCollapsed
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-inner'
                  : 'bg-[var(--bg-card)] text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10'
              }`}
            >
              {leftCollapsed ? (
                <>
                  <PanelLeftOpen className="w-3 h-3" />
                  <span>Show Graphs</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3 h-3" />
                  <span>Full Report</span>
                </>
              )}
            </button>

            <button
              onClick={() => setKpiCollapsed(p => !p)}
              title={kpiCollapsed ? 'Expand KPI Ribbon Cards' : 'Collapse KPI Ribbon to Save Vertical Space'}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10.5px] font-bold transition-colors cursor-pointer ${
                kpiCollapsed
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)] hover:border-blue-400'
              }`}
            >
              {kpiCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              <span>KPIs</span>
            </button>

            <button
              onClick={() => setHighlighterActive(p => !p)}
              title="Click rows to highlight in amber/yellow"
              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-bold transition-colors cursor-pointer ${
                highlighterActive
                  ? 'bg-amber-500 text-white border-amber-600 shadow-inner'
                  : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border)] hover:border-amber-400'
              }`}
            >
              <Highlighter className="w-3 h-3 text-amber-400" />
              <span>Highlight</span>
            </button>

            <button
              onClick={autoHighlightDeficits}
              title="Auto highlight all parts falling behind daily target or having raw material deficit"
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-[var(--bg-card)] hover:bg-amber-500/10 text-[10.5px] font-bold transition-colors cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>Auto</span>
            </button>

            <button
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              title="Toggle Light / Dark mode"
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-blue-500 text-[10.5px] font-bold transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3 h-3 text-amber-300" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3 h-3 text-blue-500" />
                  <span>Dark</span>
                </>
              )}
            </button>

            <button
              onClick={resetAllFilters}
              title="Reset all filters to default"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-slate-400 text-[10.5px] font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset</span>
            </button>

            <button
              onClick={openDataModal}
              title="Upload custom Excel files or manage demo dataset"
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-blue-500/60 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-[10.5px] font-bold transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3 h-3" />
              <span>Data</span>
            </button>

            <button
              onClick={exportCommentsLog}
              title="Download Critical_FG_Comments_Log.xlsx"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-[10.5px] font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Log.xlsx</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Navigation Tabs */}
      <div className="flex items-center w-full border-t border-[var(--border)] pt-1">
        <div className="flex items-center gap-1 w-full flex-wrap">
          <button
            onClick={() => setActiveTab('yesterday')}
            className={`flex-1 min-w-[120px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'yesterday'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-emerald-500'
            }`}
          >
            1. Yesterday Performance
          </button>

          <button
            onClick={() => setActiveTab('demand')}
            className={`flex-1 min-w-[130px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'demand'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-blue-500'
            }`}
          >
            2. Prod Demand &amp; Asking Rate
          </button>

          <button
            onClick={() => setActiveTab('dispatch')}
            className={`flex-1 min-w-[130px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'dispatch'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/10'
            }`}
          >
            3. Dispatch &amp; Asking Rate
          </button>

          <button
            onClick={() => setActiveTab('rmpm')}
            className={`flex-1 min-w-[120px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'rmpm'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-slate-400'
            }`}
          >
            4. RMPM Supplier &amp; Stock
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 min-w-[125px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-blue-500'
            }`}
          >
            5. Minifactory &amp; S&amp;OP
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className={`flex-1 min-w-[120px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-blue-500'
            }`}
          >
            6. MB52 Stock &amp; MB51
          </button>

          <button
            onClick={() => setActiveTab('critical')}
            className={`flex-1 min-w-[115px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'critical'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-purple-500'
            }`}
          >
            7. Critical FG Review
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`flex-1 min-w-[115px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)] hover:border-amber-500'
            }`}
          >
            8. Action Tracker
          </button>

          <button
            onClick={() => setActiveTab('capacity')}
            className={`flex-1 min-w-[125px] text-center px-2 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
              activeTab === 'capacity'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10'
            }`}
          >
            9. Capacity &amp; Shifts
          </button>
        </div>
      </div>
    </header>
  );
};
