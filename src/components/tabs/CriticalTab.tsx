import React, { useState } from 'react';
import { DemandRow, CommentRecord, UnitMode, BtsMode, DashboardMeta } from '../../types';
import { calcPartMetrics, pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { Search, Plus, Minus, SearchCode, ArrowRight, Download } from 'lucide-react';

interface CriticalTabProps {
  meta: DashboardMeta;
  fDemand: DemandRow[];
  comments: CommentRecord[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  onQuickStatusUpdate: (part: string, nextStatus: 'Critical' | 'Normal') => void;
  onOpenDrill: (part: string) => void;
  onSwitchToActions: () => void;
}

export const CriticalTab: React.FC<CriticalTabProps> = ({
  meta,
  fDemand,
  comments,
  unitMode,
  btsMode,
  onQuickStatusUpdate,
  onOpenDrill,
  onSwitchToActions
}) => {
  const [topN, setTopN] = useState<number>(10);
  const [hideNormal, setHideNormal] = useState<boolean>(false);
  const [onlyHelp, setOnlyHelp] = useState<boolean>(false);
  const [onlyOpen, setOnlyOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  const nQ = (v: number) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);

  const commentsFor = (part: string) => {
    return comments
      .filter(c => c.part === part)
      .sort((a, b) => String(b.updated || b.created).localeCompare(String(a.updated || a.created)));
  };

  const toggleExpand = (part: string) => {
    setExpandedParts(prev => {
      const next = new Set(prev);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  };

  // Rank by pending value
  const allCritical = fDemand
    .map(r => {
      const m = calcPartMetrics(r, btsMode, meta);
      return { r, m, pendV: m.pendV };
    })
    .filter(x => x.m.planV > 0 && x.pendV > 0);

  allCritical.sort((a, b) => b.pendV - a.pendV);
  allCritical.forEach((x, idx) => {
    (x as any).rank = idx + 1;
  });

  const totPendingAll = allCritical.reduce((s, x) => s + x.pendV, 0);

  // Apply Top N slice
  const topList = topN > 0 ? allCritical.slice(0, topN) : allCritical;
  const totPendingTop = topList.reduce((s, x) => s + x.pendV, 0);
  const coverPct = totPendingAll > 0 ? (totPendingTop / totPendingAll) * 100.0 : 0.0;

  // Apply user filters
  const q = searchQuery.toLowerCase().trim();
  const filteredList = topList.filter(x => {
    const cs = commentsFor(x.r.part);
    const last = cs[0];
    const isNormal = last && last.criticality === 'Normal';
    const openCs = cs.filter(c => c.status !== 'Closed');

    if (hideNormal && isNormal) return false;
    if (onlyHelp && !openCs.some(c => c.needs_escalation === 'Yes')) return false;
    if (onlyOpen && openCs.length === 0) return false;
    if (
      q &&
      !(
        (x.r.desc || '').toLowerCase().includes(q) ||
        (x.r.customer || '').toLowerCase().includes(q) ||
        (x.r.line || '').toLowerCase().includes(q) ||
        (x.r.minifactory || '').toLowerCase().includes(q) ||
        x.r.part.toLowerCase().includes(q)
      )
    )
      return false;

    return true;
  });

  // Calculate totals
  let tPlanQ = 0;
  let tProdQ = 0;
  let tPendV = 0;

  filteredList.forEach(x => {
    tPlanQ += x.m.planQ;
    tProdQ += x.m.prodQ;
    tPendV += pick(0, x.m.pendV);
  });

  const handleExportCSV = () => {
    const rows = filteredList.map((x, idx) => {
      const cs = commentsFor(x.r.part);
      const last = cs[0];
      return {
        rank: (x as any).rank || idx + 1,
        part: x.r.part,
        mf: x.r.minifactory + (x.r.line ? ' / ' + x.r.line : ''),
        desc: x.r.desc,
        customer: x.r.customer,
        planQ: x.m.planQ,
        prodQ: x.m.prodQ,
        pendV: x.m.pendV,
        ach: x.m.pctAchMon.toFixed(1) + '%',
        control: last?.criticality || 'Critical',
        needEsc: cs.some(c => c.needs_escalation === 'Yes') ? 'YES' : 'No',
        lastInput: last?.discussion || ''
      };
    });

    exportToCSV(
      rows,
      [
        { key: 'rank', label: 'Rank #' },
        { key: 'part', label: 'Part Number' },
        { key: 'mf', label: 'MF / Line' },
        { key: 'desc', label: 'Description' },
        { key: 'customer', label: 'Customer' },
        { key: 'planQ', label: 'Plan Qty' },
        { key: 'prodQ', label: 'Actual Qty' },
        { key: 'pendV', label: 'Pending Value (INR)' },
        { key: 'ach', label: '% Achievement' },
        { key: 'control', label: 'Control Status' },
        { key: 'needEsc', label: 'Need Escalation' },
        { key: 'lastInput', label: 'Latest Stakeholder Input' }
      ],
      'Critical_FG_Review.csv'
    );
  };

  return (
    <div className="flex flex-col bg-[var(--bg-panel)] border border-[var(--border)] rounded-md w-full h-full min-h-0 overflow-hidden shadow-xs">
      {/* Top Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[13px] font-extrabold text-[var(--text-main)] tracking-wide">
            Critical FG Review &mdash; Ranked by Pending Value
          </span>
          <span className="text-[11.5px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
            Top {topList.length} of {allCritical.length} FG = {coverPct.toFixed(1)}% of total pending {fmt(pick(0, totPendingAll))}
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Show:</span>
            <select
              value={topN}
              onChange={e => setTopN(parseInt(e.target.value, 10))}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[11.5px] font-semibold cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="15">Top 15</option>
              <option value="20">Top 20</option>
              <option value="25">Top 25</option>
              <option value="50">Top 50</option>
              <option value="0">All</option>
            </select>
          </div>

          <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-main)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideNormal}
              onChange={e => setHideNormal(e.target.checked)}
              className="rounded accent-blue-500 cursor-pointer"
            />
            <span>Hide ✓ Normal</span>
          </label>

          <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-main)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyHelp}
              onChange={e => setOnlyHelp(e.target.checked)}
              className="rounded accent-blue-500 cursor-pointer"
            />
            <span>Need Escalation only</span>
          </label>

          <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-main)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={e => setOnlyOpen(e.target.checked)}
              className="rounded accent-blue-500 cursor-pointer"
            />
            <span>Open/In-progress</span>
          </label>

          <div className="relative">
            <input
              type="text"
              placeholder="Search Desc / MF / Cust..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded pl-2 pr-6 py-0.5 text-[11px] w-36 focus:outline-none focus:border-blue-400"
            />
            <Search className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
          </div>

          <button
            onClick={onSwitchToActions}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/40 text-blue-400 hover:bg-blue-500/25 text-[11px] font-bold cursor-pointer"
          >
            <span>Action Tracker</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] hover:border-blue-400 text-[10.5px] font-bold cursor-pointer"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span>CSV</span>
          </button>

          <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
            ● Auto-save Active
          </span>
        </div>
      </div>

      {/* Critical FG Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[11px] z-10 border-b border-[var(--border)] uppercase">
            <tr>
              <th className="p-2 text-center w-8">#</th>
              <th className="p-2 text-left w-28">MF / Line</th>
              <th className="p-2 text-left w-48">Description</th>
              <th className="p-2 text-left w-28">Customer</th>
              <th className="p-2 text-right font-mono w-20">Plan Qty</th>
              <th className="p-2 text-right font-mono w-20">Actual Qty</th>
              <th className="p-2 text-right font-mono w-28">Pending Value</th>
              <th className="p-2 text-right font-mono w-16">% Ach</th>
              <th className="p-2 text-center w-28">Control Status</th>
              <th className="p-2 text-center w-24">Need Escalation</th>
              <th className="p-2 text-left">Latest Stakeholder Input</th>
              <th className="p-2 text-center w-28">Log / Drill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/40">
            {filteredList.map((x, idx) => {
              const r = x.r;
              const m = x.m;
              const cs = commentsFor(r.part);
              const last = cs[0];
              const isNormal = last && last.criticality === 'Normal';
              const needEsc = cs.some(c => c.status !== 'Closed' && c.needs_escalation === 'Yes');
              const escDet = last && last.escalation_details ? last.escalation_details : '';
              const isExpanded = expandedParts.has(r.part);
              const rankNum = (x as any).rank || idx + 1;

              const lastTxt = last
                ? `[${last.status}${last.target_date ? ' | Target: ' + last.target_date : ''}] ${last.stakeholder}: ${last.discussion}${last.action ? ' -> Action: ' + last.action : ''}`
                : 'No stakeholder input recorded yet. Click Drill to record.';

              const isDeficit = !isNormal && m.pctAchTd < 85;

              return (
                <React.Fragment key={r.part}>
                  <tr
                    data-deficit={isDeficit}
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="p-2 text-center font-bold text-slate-400 font-mono">
                      {rankNum}
                    </td>
                    <td className="p-2 font-semibold text-blue-400 text-[11px] truncate" title={r.minifactory}>
                      {r.minifactory}
                      {r.line && <div className="text-[10px] text-slate-400">{r.line}</div>}
                    </td>
                    <td className="p-2 font-bold text-[var(--text-main)]">
                      <div>{r.desc}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-normal">{r.part}</div>
                    </td>
                    <td className="p-2 text-[var(--text-sub)] text-[11.5px] truncate">{r.customer}</td>
                    <td className="p-2 text-right font-mono font-semibold">{nQ(m.planQ)}</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-400">{nQ(m.prodQ)}</td>
                    <td className="p-2 text-right font-mono font-extrabold text-amber-400">
                      {fmt(pick(0, m.pendV))}
                    </td>
                    <td className={`p-2 text-right font-mono font-bold ${m.pctAchMon >= 100 ? 'text-emerald-400' : (m.pctAchMon >= 85 ? 'text-amber-400' : 'text-slate-300')}`}>
                      {m.pctAchMon.toFixed(1)}%
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => onQuickStatusUpdate(r.part, isNormal ? 'Critical' : 'Normal')}
                        title={`Click to mark as ${isNormal ? 'Focus' : 'Normal (In Control)'}`}
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer transition-all ${
                          isNormal
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/25'
                        }`}
                      >
                        {isNormal ? '✓ Normal' : '● Focus'}
                      </button>
                    </td>
                    <td className="p-2 text-center" title={escDet}>
                      {needEsc ? (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/50 px-2 py-0.5 rounded text-[10.5px] font-black animate-pulse">
                          YES
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No</span>
                      )}
                    </td>
                    <td className="p-2 text-[11.5px] text-[var(--text-sub)] leading-snug">
                      <div className="line-clamp-2" title={lastTxt}>
                        {lastTxt}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => toggleExpand(r.part)}
                          title={isExpanded ? 'Hide discussion log' : 'Show recent stakeholder inputs'}
                          className={`w-7 h-6 rounded flex items-center justify-center border text-[13px] font-black cursor-pointer transition-colors ${
                            isExpanded
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                          }`}
                        >
                          {isExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => onOpenDrill(r.part)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30 text-[11px] font-extrabold cursor-pointer transition-colors"
                        >
                          <SearchCode className="w-3 h-3" />
                          <span>Drill</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline Expanded Log (Last 3 Inputs) */}
                  {isExpanded && (
                    <tr className="bg-[var(--bg-main)] border-b-2 border-blue-500/80">
                      <td colSpan={12} className="p-2.5">
                        <div className="bg-[var(--bg-panel)] border border-blue-500/60 rounded-md overflow-hidden shadow-lg">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-blue-500/15 border-b border-[var(--border)]">
                            <span className="text-[11.5px] font-extrabold text-[var(--text-main)] flex items-center gap-2">
                              <span>📋 Last {Math.min(3, cs.length)} Stakeholder Inputs:</span>
                              <span className="text-blue-400 font-bold">{r.desc}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onOpenDrill(r.part)}
                                className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10.5px] font-bold hover:bg-blue-500 cursor-pointer"
                              >
                                + Add Input / Full Drilldown
                              </button>
                              <button
                                onClick={() => toggleExpand(r.part)}
                                className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[10.5px] font-bold hover:text-white cursor-pointer"
                              >
                                ✕ Close
                              </button>
                            </div>
                          </div>
                          <div className="p-1">
                            {cs.length > 0 ? (
                              <table className="w-full text-[11px] border-collapse">
                                <thead className="bg-[var(--bg-card)] text-[var(--text-muted)] font-bold text-[10px] uppercase border-b border-[var(--border)]">
                                  <tr>
                                    <th className="p-1 text-center w-6">#</th>
                                    <th className="p-1 text-left w-20">Date</th>
                                    <th className="p-1 text-left w-24">Stakeholder</th>
                                    <th className="p-1 text-left w-24">Category</th>
                                    <th className="p-1 text-left">Discussion / Root Cause</th>
                                    <th className="p-1 text-left">Action Being Taken</th>
                                    <th className="p-1 text-left w-24">Owner</th>
                                    <th className="p-1 text-left w-20">Target Date</th>
                                    <th className="p-1 text-center w-20">Status</th>
                                    <th className="p-1 text-center w-16">Escalation</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]/30">
                                  {cs.slice(0, 3).map((c, cIdx) => (
                                    <tr key={c.id || cIdx} className="hover:bg-[var(--bg-hover)]">
                                      <td className="p-1.5 text-center font-bold text-slate-500">{cIdx + 1}</td>
                                      <td className="p-1.5 font-mono text-[10px] text-slate-400">{c.updated?.slice(0, 10) || c.created?.slice(0, 10)}</td>
                                      <td className="p-1.5 font-bold text-blue-400">{c.stakeholder}</td>
                                      <td className="p-1.5 text-[var(--text-sub)]">{c.category}</td>
                                      <td className="p-1.5 text-[var(--text-main)] leading-tight">{c.discussion}</td>
                                      <td className="p-1.5 font-medium text-emerald-400 leading-tight">{c.action || '-'}</td>
                                      <td className="p-1.5 text-[var(--text-sub)]">{c.owner || '-'}</td>
                                      <td className="p-1.5 font-bold text-amber-400 font-mono text-[10.5px]">{c.target_date || '-'}</td>
                                      <td className="p-1.5 text-center">
                                        <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                                          c.status === 'Closed'
                                            ? 'bg-emerald-500/15 text-emerald-400'
                                            : (c.status === 'In Progress' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400')
                                        }`}>
                                          {c.status}
                                        </span>
                                      </td>
                                      <td className="p-1.5 text-center">
                                        {c.needs_escalation === 'Yes' ? (
                                          <span className="bg-amber-500/20 text-amber-400 text-[9.5px] px-1 rounded font-bold">YES</span>
                                        ) : (
                                          <span className="text-slate-500 text-[10px]">No</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="p-3 text-center text-slate-400 text-xs">
                                No stakeholder discussion inputs logged yet. Click <b>+ Add Input</b> to record.
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {filteredList.length > 0 && (
            <tfoot className="sticky bottom-0 bg-[var(--bg-card)] font-bold text-[12px] border-t-2 border-[var(--border)] shadow-md">
              <tr>
                <td colSpan={4} className="p-2 text-[var(--text-main)]">
                  TOTAL ({filteredList.length} Critical FG Shown)
                </td>
                <td className="p-2 text-right font-mono text-[var(--text-main)]">{nQ(tPlanQ)}</td>
                <td className="p-2 text-right font-mono text-emerald-400">{nQ(tProdQ)}</td>
                <td className="p-2 text-right font-mono text-amber-400 font-black">{fmt(tPendV)}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
