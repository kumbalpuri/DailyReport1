import React, { useState } from 'react';
import { CommentRecord, DashboardMeta } from '../../types';
import { exportToCSV } from '../../utils/calculations';
import { Search, SearchCode, Download } from 'lucide-react';

interface ActionTrackerTabProps {
  meta: DashboardMeta;
  comments: CommentRecord[];
  selectedMf: string;
  selectedLine: string;
  selectedCustomer: string;
  onQuickActionStatusUpdate: (id: string, newStatus: string) => void;
  onOpenDrill: (part: string) => void;
}

export const ActionTrackerTab: React.FC<ActionTrackerTabProps> = ({
  comments,
  selectedMf,
  selectedLine,
  selectedCustomer,
  onQuickActionStatusUpdate,
  onOpenDrill
}) => {
  const [dueFilter, setDueFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NO_DATE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'OPEN_ONLY' | 'ALL' | 'Closed'>('OPEN_ONLY');
  const [escOnly, setEscOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime();

  const enriched = comments.map(c => {
    const tDate = (c.target_date || '').slice(0, 10);
    let dueCategory: 'CLOSED' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'NO_DATE' = 'NO_DATE';
    let badgeText = 'No Target Date';
    let badgeClass = 'bg-slate-700/50 text-slate-400 border-slate-600/50';

    if (c.status === 'Closed') {
      dueCategory = 'CLOSED';
      badgeText = '✓ CLOSED';
      badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
    } else if (tDate) {
      const diffDays = Math.round((new Date(tDate + 'T00:00:00').getTime() - todayMs) / 86400000);
      if (diffDays < 0) {
        dueCategory = 'OVERDUE';
        badgeText = `OVERDUE (${Math.abs(diffDays)}d)`;
        badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/50 font-black animate-pulse';
      } else if (diffDays === 0) {
        dueCategory = 'DUE_SOON';
        badgeText = 'DUE TODAY';
        badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/50 font-black';
      } else if (diffDays <= 3) {
        dueCategory = 'DUE_SOON';
        badgeText = `IN ${diffDays}d`;
        badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/40 font-bold';
      } else {
        dueCategory = 'UPCOMING';
        badgeText = `IN ${diffDays}d`;
        badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-semibold';
      }
    }
    return { c, tDate, dueCategory, badgeText, badgeClass };
  });

  const q = searchQuery.toLowerCase().trim();

  const filtered = enriched.filter(x => {
    const c = x.c;
    if (selectedMf !== 'ALL' && c.minifactory !== selectedMf) return false;
    if (selectedLine !== 'ALL' && c.line !== selectedLine) return false;
    if (selectedCustomer !== 'ALL' && c.customer !== selectedCustomer) return false;

    if (statusFilter === 'OPEN_ONLY' && c.status === 'Closed') return false;
    if (statusFilter === 'Closed' && c.status !== 'Closed') return false;

    if (escOnly && c.needs_escalation !== 'Yes') return false;

    if (dueFilter !== 'ALL' && x.dueCategory !== dueFilter) return false;

    if (
      q &&
      !(
        (c.desc || '').toLowerCase().includes(q) ||
        (c.part || '').toLowerCase().includes(q) ||
        (c.stakeholder || '').toLowerCase().includes(q) ||
        (c.owner || '').toLowerCase().includes(q) ||
        (c.discussion || '').toLowerCase().includes(q) ||
        (c.action || '').toLowerCase().includes(q)
      )
    )
      return false;

    return true;
  });

  // Sort by Target Date ascending (overdue & urgent first)
  filtered.sort((a, b) => (a.tDate || '9999-12-31').localeCompare(b.tDate || '9999-12-31'));

  const overdueCount = filtered.filter(x => x.dueCategory === 'OVERDUE').length;
  const dueSoonCount = filtered.filter(x => x.dueCategory === 'DUE_SOON').length;

  const handleExportCSV = () => {
    const rows = filtered.map(x => ({
      due: x.badgeText,
      tDate: x.tDate,
      mf: x.c.minifactory + (x.c.line ? ' / ' + x.c.line : ''),
      desc: x.c.desc || x.c.part,
      stakeholder: x.c.stakeholder,
      owner: x.c.owner,
      category: x.c.category,
      discussion: x.c.discussion,
      action: x.c.action,
      escalation: x.c.needs_escalation === 'Yes' ? `YES (${x.c.escalation_details})` : 'No',
      status: x.c.status
    }));

    exportToCSV(
      rows,
      [
        { key: 'due', label: 'Follow-up Due' },
        { key: 'tDate', label: 'Target Date' },
        { key: 'mf', label: 'MF / Line' },
        { key: 'desc', label: 'FG Description' },
        { key: 'stakeholder', label: 'Stakeholder' },
        { key: 'owner', label: 'Owner' },
        { key: 'category', label: 'Category' },
        { key: 'discussion', label: 'Discussion / Root Cause' },
        { key: 'action', label: 'Action Being Taken' },
        { key: 'escalation', label: 'Escalation' },
        { key: 'status', label: 'Status' }
      ],
      'Action_Tracker_Followup.csv'
    );
  };

  return (
    <div className="flex flex-col bg-[var(--bg-panel)] border border-[var(--border)] rounded-md w-full h-full min-h-0 overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[13px] font-extrabold text-[var(--text-main)] tracking-wide">
            📅 Stakeholder Action Tracker &amp; Follow-up Schedule
          </span>
          <span className="text-[11px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-400 px-2 py-0.5 rounded">
            {filtered.length} Actions | {overdueCount} Overdue | {dueSoonCount} Due Soon
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Timeline:</span>
            <select
              value={dueFilter}
              onChange={e => setDueFilter(e.target.value as any)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[11.5px] font-semibold cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Target Dates</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="DUE_SOON">Due Today / Next 3 Days</option>
              <option value="UPCOMING">Upcoming (&gt;3 Days)</option>
              <option value="NO_DATE">No Target Date</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-0.5 text-[11.5px] font-semibold cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="OPEN_ONLY">Open &amp; In Progress</option>
              <option value="ALL">All Statuses</option>
              <option value="Closed">Closed Only</option>
            </select>
          </div>

          <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-main)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={escOnly}
              onChange={e => setEscOnly(e.target.checked)}
              className="rounded accent-blue-500 cursor-pointer"
            />
            <span>Need Escalation Only</span>
          </label>

          <div className="relative">
            <input
              type="text"
              placeholder="Search Owner / FG / Input..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded pl-2 pr-6 py-0.5 text-[11px] w-40 focus:outline-none focus:border-blue-400"
            />
            <Search className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] hover:border-blue-400 text-[10.5px] font-bold cursor-pointer"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Action Tracker Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[11px] z-10 border-b border-[var(--border)] uppercase">
            <tr>
              <th className="p-2 text-center w-28">Follow-up Due</th>
              <th className="p-2 text-center w-24">Target Date</th>
              <th className="p-2 text-left w-28">MF / Line</th>
              <th className="p-2 text-left w-44">FG Description</th>
              <th className="p-2 text-left w-36">Stakeholder / Owner</th>
              <th className="p-2 text-left w-28">Category</th>
              <th className="p-2 text-left">Discussion / Root Cause</th>
              <th className="p-2 text-left">Action Being Taken</th>
              <th className="p-2 text-center w-24">Escalation</th>
              <th className="p-2 text-center w-32">Status / Drill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/40">
            {filtered.length > 0 ? (
              filtered.map(x => {
                const c = x.c;
                return (
                  <tr
                    key={c.id}
                    data-deficit={x.dueCategory === 'OVERDUE'}
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="p-2 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${x.badgeClass}`}>
                        {x.badgeText}
                      </span>
                    </td>
                    <td className={`p-2 text-center font-mono font-bold whitespace-nowrap ${
                      x.dueCategory === 'OVERDUE' ? 'text-rose-400' : 'text-slate-200'
                    }`}>
                      {x.tDate || '-'}
                    </td>
                    <td className="p-2 font-semibold text-blue-400 text-[11px] truncate">
                      {c.minifactory}
                      {c.line && <div className="text-[10px] text-slate-400">{c.line}</div>}
                    </td>
                    <td className="p-2 font-bold text-[var(--text-main)] truncate" title={c.desc || c.part}>
                      <div>{c.desc || c.part}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-normal">{c.part}</div>
                    </td>
                    <td className="p-2">
                      <div className="font-bold text-[var(--text-main)] text-[11.5px]">{c.stakeholder}</div>
                      <div className="text-[10.5px] text-slate-400">Owner: {c.owner || '-'}</div>
                    </td>
                    <td className="p-2 text-[var(--text-sub)] text-[11px] whitespace-nowrap">{c.category}</td>
                    <td className="p-2 text-[11.5px] text-[var(--text-sub)] leading-snug max-w-[200px]" title={c.discussion}>
                      <div className="line-clamp-2">{c.discussion}</div>
                    </td>
                    <td className="p-2 text-[11.5px] font-medium text-emerald-400 leading-snug max-w-[200px]" title={c.action}>
                      <div className="line-clamp-2">{c.action || '-'}</div>
                    </td>
                    <td className="p-2 text-center">
                      {c.needs_escalation === 'Yes' ? (
                        <div>
                          <span className="bg-amber-500/20 text-amber-400 border border-amber-500/50 px-2 py-0.5 rounded text-[10px] font-black">
                            YES
                          </span>
                          {c.escalation_details && (
                            <div className="text-[9.5px] text-amber-300/80 mt-0.5 truncate max-w-[100px]" title={c.escalation_details}>
                              {c.escalation_details}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <select
                          value={c.status}
                          onChange={e => onQuickActionStatusUpdate(c.id, e.target.value)}
                          className={`bg-[var(--bg-card)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[11px] font-bold cursor-pointer focus:outline-none ${
                            c.status === 'Closed'
                              ? 'text-emerald-400'
                              : (c.status === 'In Progress' ? 'text-blue-400' : 'text-amber-400')
                          }`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <button
                          onClick={() => onOpenDrill(c.part)}
                          title="Open Full Drilldown"
                          className="p-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30 cursor-pointer"
                        >
                          <SearchCode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 text-xs">
                  No logged actions match the current filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
