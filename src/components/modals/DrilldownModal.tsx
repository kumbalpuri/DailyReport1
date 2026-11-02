import React, { useState, useEffect } from 'react';
import { DemandRow, RmpmPartRow, Mb51Row, Mb52Row, CommentRecord, UnitMode, BtsMode, DashboardMeta } from '../../types';
import { calcPartMetrics, pickUnit, formatUnit, exportToCSV } from '../../utils/calculations';
import { SvgComboChart } from '../charts/SvgComboChart';
import { X, Download, Save, RefreshCw, Trash2, Edit3 } from 'lucide-react';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  partCode: string | null;
  meta: DashboardMeta;
  demand: DemandRow[];
  rmpmParts: RmpmPartRow[];
  mb51: Mb51Row[];
  mb52: Mb52Row[];
  comments: CommentRecord[];
  unitMode: UnitMode;
  btsMode: BtsMode;
  theme: 'dark' | 'light';
  onSaveComment: (comment: Partial<CommentRecord>) => void;
  onDeleteComment: (id: string) => void;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({
  isOpen,
  onClose,
  partCode,
  meta,
  demand,
  rmpmParts,
  mb51,
  mb52,
  comments,
  unitMode,
  btsMode,
  theme,
  onSaveComment,
  onDeleteComment
}) => {
  const [chartMode, setChartMode] = useState<'VAL' | 'QTY'>('VAL');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [stakeholder, setStakeholder] = useState('');
  const [category, setCategory] = useState('RM Shortage');
  const [criticality, setCriticality] = useState<'Critical' | 'Normal'>('Critical');
  const [discussion, setDiscussion] = useState('');
  const [action, setAction] = useState('');
  const [owner, setOwner] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState('Open');
  const [needEscalation, setNeedEscalation] = useState<'Yes' | 'No'>('No');
  const [escalationDetails, setEscalationDetails] = useState('');

  const r = demand.find(x => x.part === partCode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (partCode) {
      resetForm();
      const partComments = comments.filter(c => c.part === partCode);
      if (partComments.length > 0 && partComments[0].criticality) {
        setCriticality(partComments[0].criticality as any);
      }
    }
  }, [partCode, isOpen]);

  if (!isOpen || !r) return null;

  const m = calcPartMetrics(r, btsMode, meta);
  const nQ = (v: number) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const fmt = (v: number) => formatUnit(v, unitMode, meta.fx_list);
  const pick = (qty: number, val: number) => pickUnit(qty, val, unitMode, meta.fx_list);

  // Comments for this part
  const partComments = comments
    .filter(c => c.part === partCode)
    .sort((a, b) => String(b.updated || b.created).localeCompare(String(a.updated || a.created)));

  // Daily MB51 Trend
  const useQty = chartMode === 'QTY';
  const byDate: Record<string, { prod: number; d601: number; d641: number }> = {};
  mb51
    .filter(x => x.part === partCode)
    .forEach(x => {
      const d = x.date || '?';
      if (!byDate[d]) byDate[d] = { prod: 0, d601: 0, d641: 0 };
      const v = useQty ? Number(x.qty || 0) : pick(0, x.val);
      if (x.mvt === 101 || x.mvt === 102) byDate[d].prod += v;
      else if (x.mvt === 601 || x.mvt === 602) byDate[d].d601 += v;
      else if (x.mvt === 641) byDate[d].d641 += v;
    });

  const dates = Object.keys(byDate).sort();
  const dailyPlanVal = useQty ? m.yestPlanQ : pick(0, m.yestPlanV);

  // MB52 Stock item
  const s = mb52.find(x => x.part === partCode);

  // Monitored RM gaps in same minifactory / line
  const rmGaps = rmpmParts
    .filter(
      x =>
        x.gap_total_qty > 0 &&
        (!r.minifactory || x.minifactory === r.minifactory) &&
        (!r.line || !x.line || x.line === r.line)
    )
    .sort((a, b) => b.gap_total_val - a.gap_total_val)
    .slice(0, 6);

  const resetForm = () => {
    setEditingId(null);
    setStakeholder('');
    setCategory('RM Shortage');
    setCriticality('Critical');
    setDiscussion('');
    setAction('');
    setOwner('');
    setTargetDate('');
    setStatus('Open');
    setNeedEscalation('No');
    setEscalationDetails('');
  };

  const handleEdit = (c: CommentRecord) => {
    setEditingId(c.id);
    setStakeholder(c.stakeholder || '');
    setCategory(c.category || 'Other');
    setCriticality((c.criticality as any) || 'Critical');
    setDiscussion(c.discussion || '');
    setAction(c.action || '');
    setOwner(c.owner || '');
    setTargetDate((c.target_date || '').slice(0, 10));
    setStatus(c.status || 'Open');
    setNeedEscalation(c.needs_escalation === 'Yes' ? 'Yes' : 'No');
    setEscalationDetails(c.escalation_details || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeholder.trim()) {
      alert('Please specify the Stakeholder / Team.');
      return;
    }
    if (!discussion.trim() && !action.trim()) {
      alert('Please provide Stakeholder Input / Discussion or Action Being Taken.');
      return;
    }

    onSaveComment({
      id: editingId || undefined,
      part: r.part,
      desc: r.desc || r.products,
      customer: r.customer,
      minifactory: r.minifactory,
      line: r.line,
      stakeholder,
      category,
      criticality,
      discussion,
      action,
      owner,
      target_date: targetDate,
      status,
      needs_escalation: needEscalation,
      escalation_details: escalationDetails,
      plan_val: Math.round(m.planV),
      pending_val: Math.round(m.pendV)
    });

    resetForm();
  };

  const handleExportHistory = () => {
    const rows = partComments.map(c => ({
      id: c.id,
      created: c.created,
      updated: c.updated,
      part: c.part,
      stakeholder: c.stakeholder,
      category: c.category,
      discussion: c.discussion,
      action: c.action,
      owner: c.owner,
      targetDate: c.target_date,
      control: c.criticality,
      status: c.status,
      escalation: c.needs_escalation === 'Yes' ? `YES (${c.escalation_details})` : 'No'
    }));

    exportToCSV(
      rows,
      [
        { key: 'id', label: 'ID' },
        { key: 'created', label: 'Created' },
        { key: 'updated', label: 'Updated' },
        { key: 'part', label: 'Part Number' },
        { key: 'stakeholder', label: 'Stakeholder' },
        { key: 'category', label: 'Category' },
        { key: 'discussion', label: 'Stakeholder Input' },
        { key: 'action', label: 'Action Taken' },
        { key: 'owner', label: 'Owner' },
        { key: 'targetDate', label: 'Target Date' },
        { key: 'control', label: 'Control Status' },
        { key: 'status', label: 'Status' },
        { key: 'escalation', label: 'Escalation' }
      ],
      `Comments_${partCode}.csv`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-main)]/95 flex flex-col p-2.5 gap-2 backdrop-blur-xs select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[var(--bg-panel)] border border-blue-500 rounded-md px-3 py-2 flex-shrink-0 shadow-lg flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-black text-[var(--text-main)]">
            {r.part} &mdash; {r.desc || r.products}
          </span>
          <span className="bg-blue-500/15 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded text-[10px] font-bold">
            {r.customer || '-'} | {r.minifactory}{r.line ? ' / ' + r.line : ''}
          </span>
          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9.5px] font-bold">
            ● Auto-save Ready
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportHistory}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--bg-card)] text-slate-200 border border-[var(--border)] hover:border-blue-400 text-[11px] font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export History CSV</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-700/80 text-white hover:bg-slate-600 text-[11.5px] font-extrabold cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close (Esc)</span>
          </button>
        </div>
      </div>

      {/* 6 Part KPIs Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5 flex-shrink-0">
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md p-2 flex flex-col justify-between shadow-xs">
          <div className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Monthly Plan</div>
          <div className="text-[16px] font-black text-[var(--text-main)] font-mono">{fmt(pick(m.planQ, m.planV))}</div>
          <div className="text-[9px] text-[var(--text-muted)]">Plan: {nQ(m.planQ)} units</div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-emerald-500 rounded-md p-2 flex flex-col justify-between shadow-xs">
          <div className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Prod Till Date</div>
          <div className="text-[16px] font-black text-emerald-400 font-mono">{fmt(pick(m.prodQ, m.prodV))}</div>
          <div className="text-[9px] text-[var(--text-muted)]">{nQ(m.prodQ)} units ({m.pctAchMon.toFixed(1)}%)</div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-amber-500 rounded-md p-2 flex flex-col justify-between shadow-xs">
          <div className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Pending Value</div>
          <div className="text-[16px] font-black text-amber-400 font-mono">{fmt(pick(0, m.pendV))}</div>
          <div className="text-[9px] text-[var(--text-muted)]">Pending: {nQ(m.pendQ)} units</div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-amber-500 rounded-md p-2 flex flex-col justify-between shadow-xs">
          <div className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Asking Rate / Day</div>
          <div className="text-[16px] font-black text-amber-400 font-mono">{fmt(pick(m.askRateQ, m.askRateV))}</div>
          <div className="text-[9px] text-[var(--text-muted)]">{nQ(m.askRateQ)} u/d | Run: {nQ(m.runRateQ)}</div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-cyan-500 rounded-md p-2 flex flex-col justify-between shadow-xs">
          <div className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Target Till Date</div>
          <div className="text-[16px] font-black text-cyan-400 font-mono">{fmt(pick(m.ttdQ, m.ttdV))}</div>
          <div className="text-[9px] text-[var(--text-muted)]">Ach vs TTD: {m.pctAchTd.toFixed(1)}%</div>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border)] border-t-[3px] border-t-purple-500 rounded-md p-2 flex flex-col justify-between shadow-xs">
          <div className="text-[9px] uppercase font-bold text-[var(--text-muted)]">FG Stock (MB52)</div>
          <div className="text-[16px] font-black text-purple-400 font-mono">{fmt(pick(r.stock_total_qty, r.stock_total_val))}</div>
          <div className="text-[9px] text-[var(--text-muted)]">{nQ(r.stock_total_qty)} units | BTS {nQ(r.bts_qty)}</div>
        </div>
      </div>

      {/* 4 Quadrants Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 grid-rows-2 gap-2 min-h-0 overflow-hidden">
        {/* Quadrant 1: Daily Production & Dispatch (MB51) Chart */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
          <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
              Daily Production &amp; Dispatch (MB51) vs Daily Plan
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartMode('VAL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  chartMode === 'VAL' ? 'bg-blue-600 text-white' : 'bg-[var(--bg-card)] text-slate-300'
                }`}
              >
                Value (₹)
              </button>
              <button
                onClick={() => setChartMode('QTY')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  chartMode === 'QTY' ? 'bg-blue-600 text-white' : 'bg-[var(--bg-card)] text-slate-300'
                }`}
              >
                Quantity (Nos)
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-1">
            <SvgComboChart
              categories={dates}
              series={[
                {
                  name: useQty ? 'Prod Qty (101/102)' : 'Prod Val (101/102)',
                  values: dates.map(d => byDate[d].prod),
                  color: '#10b981'
                },
                {
                  name: useQty ? 'Cust Disp Qty (601)' : 'Cust Disp Val (601)',
                  values: dates.map(d => byDate[d].d601),
                  color: '#3b82f6'
                },
                {
                  name: useQty ? 'STO Qty (641)' : 'STO Val (641)',
                  values: dates.map(d => byDate[d].d641),
                  color: '#06b6d4'
                },
                {
                  name: useQty ? 'Daily Plan Qty' : 'Daily Plan Val',
                  values: dates.map(() => dailyPlanVal),
                  color: '#f59e0b',
                  type: 'line',
                  dash: true
                }
              ]}
              theme={theme}
            />
          </div>
        </div>

        {/* Quadrant 2: Stock, Movements & RM Gaps */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
          <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex-shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
              Stock, Movements &amp; Raw Material Gaps (same Minifactory / Line)
            </span>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-2">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[10px] uppercase border-b border-[var(--border)]">
                <tr>
                  <th className="p-1 text-left">MB52 Stock / Movement</th>
                  <th className="p-1 text-right font-mono">Qty (Units)</th>
                  <th className="p-1 text-right font-mono">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {s ? (
                  <>
                    <tr>
                      <td className="p-1">Unrestricted Stock</td>
                      <td className="p-1 text-right font-mono">{nQ(s.unrest_qty)}</td>
                      <td className="p-1 text-right font-mono">{fmt(pick(s.unrest_qty, s.unrest_val))}</td>
                    </tr>
                    <tr>
                      <td className="p-1">In Quality Insp.</td>
                      <td className="p-1 text-right font-mono">{nQ(s.qual_qty)}</td>
                      <td className="p-1 text-right font-mono">{fmt(pick(s.qual_qty, s.qual_val))}</td>
                    </tr>
                    <tr>
                      <td className="p-1">Blocked Stock</td>
                      <td className={`p-1 text-right font-mono ${s.block_qty > 0 ? 'text-amber-400 font-bold' : ''}`}>
                        {nQ(s.block_qty)}
                      </td>
                      <td className="p-1 text-right font-mono">{fmt(pick(s.block_qty, s.block_val))}</td>
                    </tr>
                    <tr>
                      <td className="p-1">Transit / Transfer</td>
                      <td className="p-1 text-right font-mono">{nQ(s.trans_qty)}</td>
                      <td className="p-1 text-right font-mono">{fmt(pick(s.trans_qty, s.trans_val))}</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} className="p-1 text-slate-400">No MB52 stock row found for this part</td>
                  </tr>
                )}
                <tr className="font-bold border-t border-[var(--border)]">
                  <td className="p-1 text-emerald-400">Yesterday Production</td>
                  <td className="p-1 text-right font-mono text-emerald-400">{nQ(r.yest_prod_qty)}</td>
                  <td className="p-1 text-right font-mono text-emerald-400">{fmt(pick(r.yest_prod_qty, r.yest_prod_val))}</td>
                </tr>
                <tr>
                  <td className="p-1 text-blue-400">Yesterday Dispatch (601+641)</td>
                  <td className="p-1 text-right font-mono text-blue-400">{nQ(r.yest_disp_qty)}</td>
                  <td className="p-1 text-right font-mono text-blue-400">{fmt(pick(r.yest_disp_qty, r.yest_disp_val))}</td>
                </tr>
              </tbody>
            </table>

            {/* Sub-table: Monitored Raw Material with Gaps */}
            <div className="pt-1">
              <div className="text-[10.5px] font-bold text-amber-400 mb-1">
                Monitored Raw Material with Pending Vendor Gap (Same Line)
              </div>
              <table className="w-full text-[10.5px] border-collapse">
                <thead className="bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[9.5px] uppercase border-b border-[var(--border)]">
                  <tr>
                    <th className="p-1 text-left">RM Part #</th>
                    <th className="p-1 text-left">Description</th>
                    <th className="p-1 text-left">Supplier</th>
                    <th className="p-1 text-right font-mono">Gap Qty</th>
                    <th className="p-1 text-right font-mono">Stock Qty</th>
                    <th className="p-1 text-right font-mono">Yest GRN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {rmGaps.length > 0 ? (
                    rmGaps.map(rm => (
                      <tr key={rm.part} className="hover:bg-[var(--bg-hover)]">
                        <td className="p-1 font-bold text-blue-400 font-mono">{rm.part}</td>
                        <td className="p-1 max-w-[120px] truncate">{rm.desc}</td>
                        <td className="p-1 text-[var(--text-muted)] truncate">{rm.supplier}</td>
                        <td className="p-1 text-right font-mono font-bold text-amber-400">{nQ(rm.gap_total_qty)}</td>
                        <td className="p-1 text-right font-mono">{nQ(rm.total_stock_qty)}</td>
                        <td className="p-1 text-right font-mono text-emerald-400">{nQ(rm.yest_grn_qty)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-400">
                        No pending raw material gaps found in this line
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quadrant 3: Add / Edit Stakeholder Input Form */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
          <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
              {editingId ? `Editing Stakeholder Input #${editingId}` : 'Add Stakeholder Input (Auto-Saves to Database)'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={resetForm}
                className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] hover:border-slate-400 text-[10.5px] font-semibold text-slate-300 cursor-pointer"
              >
                New / Clear
              </button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Stakeholder / Team
              </label>
              <input
                type="text"
                list="drill-stakeholders"
                value={stakeholder}
                onChange={e => setStakeholder(e.target.value)}
                placeholder="e.g. Logistics"
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400"
                required
              />
              <datalist id="drill-stakeholders">
                <option value="Logistics" />
                <option value="Purchase / SCM" />
                <option value="Quality" />
                <option value="Planning" />
                <option value="Production" />
                <option value="Maintenance" />
                <option value="Tooling" />
                <option value="Supplier" />
                <option value="Customer Service" />
                <option value="Plant Head" />
              </datalist>
            </div>

            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Issue Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400 cursor-pointer"
              >
                <option>RM Shortage</option>
                <option>Machine / Breakdown</option>
                <option>Quality</option>
                <option>Manpower</option>
                <option>Tooling / Fixture</option>
                <option>Logistics / Transport</option>
                <option>Customer Schedule</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Control Status
              </label>
              <select
                value={criticality}
                onChange={e => setCriticality(e.target.value as any)}
                className={`w-full bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] font-extrabold focus:outline-none cursor-pointer ${
                  criticality === 'Normal' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                <option value="Critical">● Focus / Needs Review</option>
                <option value="Normal">✓ Normal (In Control)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Stakeholder Input / Discussion (Root Cause)
              </label>
              <textarea
                value={discussion}
                onChange={e => setDiscussion(e.target.value)}
                placeholder="What did the stakeholder explain about the deficit or delay?"
                rows={2}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Action Being Taken (Recovery Plan)
              </label>
              <textarea
                value={action}
                onChange={e => setAction(e.target.value)}
                placeholder="What specific recovery action is being executed?"
                rows={2}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Owner
              </label>
              <input
                type="text"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="Person responsible"
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Action Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] font-semibold focus:outline-none cursor-pointer"
              >
                <option>Open</option>
                <option>In Progress</option>
                <option>Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Need Escalation?
              </label>
              <select
                value={needEscalation}
                onChange={e => setNeedEscalation(e.target.value as any)}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] font-bold focus:outline-none cursor-pointer"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[9.5px] font-extrabold uppercase text-[var(--text-muted)] mb-0.5">
                Escalation Details (if Escalation Needed)
              </label>
              <input
                type="text"
                value={escalationDetails}
                onChange={e => setEscalationDetails(e.target.value)}
                placeholder="e.g. Plant Head approval for premium freight"
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-2 py-1 text-[11.5px] focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[12px] shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingId ? 'Update Comment' : 'Save Comment'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Quadrant 4: Discussion History Table */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
          <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
              Discussion History ({partComments.length} Records)
            </span>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-[var(--tbl-th-bg)] text-[var(--tbl-th-text)] font-bold text-[10px] uppercase border-b border-[var(--border)] z-10">
                <tr>
                  <th className="p-1.5 text-left w-20">Date</th>
                  <th className="p-1.5 text-left w-24">Stakeholder</th>
                  <th className="p-1.5 text-left w-20">Category</th>
                  <th className="p-1.5 text-left">Input / Discussion</th>
                  <th className="p-1.5 text-left">Action Taken</th>
                  <th className="p-1.5 text-left w-24">Owner / Date</th>
                  <th className="p-1.5 text-center w-16">Status</th>
                  <th className="p-1.5 text-center w-12">Edit</th>
                  <th className="p-1.5 text-center w-10">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/30">
                {partComments.length > 0 ? (
                  partComments.map(c => (
                    <tr key={c.id} className="hover:bg-[var(--bg-hover)]">
                      <td className="p-1.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {c.updated?.slice(0, 10) || c.created?.slice(0, 10)}
                      </td>
                      <td className="p-1.5 font-bold text-blue-400 whitespace-nowrap">{c.stakeholder}</td>
                      <td className="p-1.5 text-[var(--text-muted)]">{c.category}</td>
                      <td className="p-1.5 text-[var(--text-main)] leading-tight">{c.discussion}</td>
                      <td className="p-1.5 text-emerald-400 font-medium leading-tight">{c.action || '-'}</td>
                      <td className="p-1.5">
                        <div className="font-semibold text-slate-300">{c.owner || '-'}</div>
                        {c.target_date && <div className="text-[10px] text-amber-400 font-mono font-bold">{c.target_date}</div>}
                      </td>
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
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1 rounded bg-[var(--bg-card)] text-slate-300 hover:text-white hover:border-blue-400 border border-[var(--border)] cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`Delete comment ${c.id}?`)) {
                              onDeleteComment(c.id);
                            }
                          }}
                          className="p-1 rounded bg-rose-500/15 text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400 text-xs">
                      No stakeholder comments recorded yet for this part. Fill the form to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
