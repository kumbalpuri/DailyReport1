import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TabType,
  UnitMode,
  BtsMode,
  PopoutReportMode,
  FullDashboardPayload,
  CommentRecord
} from './types';
import { initialDashboardData } from './data/initialData';
import { exportCommentsToExcel } from './utils/calculations';
import { TopBar } from './components/TopBar';
import { KpiRibbon } from './components/KpiRibbon';
import { YesterdayTab } from './components/tabs/YesterdayTab';
import { DemandTab } from './components/tabs/DemandTab';
import { DispatchTab } from './components/tabs/DispatchTab';
import { RmpmTab } from './components/tabs/RmpmTab';
import { OverviewTab } from './components/tabs/OverviewTab';
import { StockTab } from './components/tabs/StockTab';
import { CriticalTab } from './components/tabs/CriticalTab';
import { ActionTrackerTab } from './components/tabs/ActionTrackerTab';
import { CapacityTab } from './components/tabs/CapacityTab';
import { PopoutModal } from './components/modals/PopoutModal';
import { DrilldownModal } from './components/modals/DrilldownModal';
import { DataImportModal } from './components/modals/DataImportModal';

const STORAGE_KEY = 'kspg_dashboard_data_v1';

export const App: React.FC = () => {
  // Load initial data from localStorage if available
  const [data, setData] = useState<FullDashboardPayload>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.meta?.cutoff_date && parsed?.demand?.length) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load cached dashboard state', e);
    }
    return initialDashboardData;
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache to localStorage', e);
    }
  }, [data]);

  // Controls State — default to 'dispatch' so user immediately sees the new Dispatch Dashboard & collapsible graphs
  const [activeTab, setActiveTab] = useState<TabType>('dispatch');
  const [selectedYestDate, setSelectedYestDate] = useState<string>(data.meta.latest_date_iso);
  const [selectedMf, setSelectedMf] = useState<string>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [btsMode, setBtsMode] = useState<BtsMode>('WITH_BTS');
  const [unitMode, setUnitMode] = useState<UnitMode>('QTY');
  const [highlighterActive, setHighlighterActive] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Space optimization & Collapsible Left Graphs State
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(false);
  const [kpiCollapsed, setKpiCollapsed] = useState<boolean>(false);

  // Modals
  const [popoutMode, setPopoutMode] = useState<PopoutReportMode | null>(null);
  const [drillPart, setDrillPart] = useState<string | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Update HTML body theme and highlighter classes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.remove('bg-[#0b0f19]', 'text-[#f8fafc]');
      document.body.classList.add('bg-[#f1f5f9]', 'text-[#0f172a]');
    } else {
      document.body.classList.remove('bg-[#f1f5f9]', 'text-[#0f172a]');
      document.body.classList.add('bg-[#0b0f19]', 'text-[#f8fafc]');
    }
  }, [theme]);

  useEffect(() => {
    if (highlighterActive) {
      document.body.classList.add('highlighter-active');
    } else {
      document.body.classList.remove('highlighter-active');
    }
  }, [highlighterActive]);

  // Handle clicking rows or cards with highlighter active
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!highlighterActive) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input') ||
      target.closest('textarea')
    ) {
      return;
    }

    const row = target.closest('tbody tr');
    if (row && !row.classList.contains('inline-log-row')) {
      row.classList.toggle('red-highlighted');
      return;
    }

    const card = target.closest('.kpi-card');
    if (card) {
      card.classList.toggle('red-highlighted');
    }
  }, [highlighterActive]);

  const clearHighlights = useCallback(() => {
    document.querySelectorAll('.red-highlighted').forEach(el => {
      el.classList.remove('red-highlighted');
    });
  }, []);

  const autoHighlightDeficits = useCallback(() => {
    clearHighlights();
    document.querySelectorAll('tr[data-deficit="true"]').forEach(tr => {
      tr.classList.add('red-highlighted');
    });
    showToast('⚡ Deficit and behind-schedule items auto-highlighted');
  }, [clearHighlights, showToast]);

  // Recalculate metrics when Yesterday Date changes
  const handleYesterdayDateChange = useCallback((newIsoDate: string) => {
    setSelectedYestDate(newIsoDate);

    setData(prev => {
      const parts = newIsoDate.split('-');
      const cutoff = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : newIsoDate;
      const totW = Math.max(1, prev.meta.total_working_days);
      const elapW = prev.calendar.filter(c => c.date <= newIsoDate && c.is_working === 1).length;
      const remW = Math.max(0, totW - elapW);
      const proPct = Number(((elapW / totW) * 100).toFixed(1));

      // Re-aggregate per-part Yesterday Prod & Dispatch from MB51 on this date
      const yProdMap: Record<string, number> = {};
      const y601Map: Record<string, number> = {};
      const y641Map: Record<string, number> = {};
      const yGrnQtyMap: Record<string, number> = {};
      const yGrnValMap: Record<string, number> = {};

      prev.mb51.forEach(x => {
        if (x.date !== newIsoDate) return;
        if (x.mvt === 101 || x.mvt === 102) {
          yProdMap[x.part] = (yProdMap[x.part] || 0) + x.qty;
          yGrnQtyMap[x.part] = (yGrnQtyMap[x.part] || 0) + x.qty;
          yGrnValMap[x.part] = (yGrnValMap[x.part] || 0) + x.val;
        } else if (x.mvt === 601 || x.mvt === 602) {
          y601Map[x.part] = (y601Map[x.part] || 0) + x.qty;
        } else if (x.mvt === 641) {
          y641Map[x.part] = (y641Map[x.part] || 0) + x.qty;
        }
      });

      const updatedDemand = prev.demand.map(r => {
        const yp = yProdMap[r.part] || 0;
        const y601 = y601Map[r.part] || 0;
        const y641 = y641Map[r.part] || 0;
        const yd = y601 + y641;
        return {
          ...r,
          yest_prod_qty: yp,
          yest_prod_val: yp * r.price,
          yest_disp_601_qty: y601,
          yest_disp_601_val: y601 * r.price,
          yest_disp_641_qty: y641,
          yest_disp_641_val: y641 * r.price,
          yest_disp_qty: yd,
          yest_disp_val: yd * r.price
        };
      });

      // Vendor schedule for this date
      const vDateSched: Record<string, number> = {};
      prev.vendor_schedule.forEach(v => {
        if (v.date === newIsoDate) {
          vDateSched[v.part] = (vDateSched[v.part] || 0) + v.sched_qty;
        }
      });

      const updatedRmpm = prev.rmpm_parts.map(rm => {
        const exactS = vDateSched[rm.part] || 0;
        const planQ = exactS > 0 ? exactS : rm.sched_total_qty / totW;
        const gQ = yGrnQtyMap[rm.part] || 0;
        const gV = yGrnValMap[rm.part] || gQ * rm.unit_val;
        const gapQ = Math.max(0, planQ - gQ);
        return {
          ...rm,
          sched_yest_qty: planQ,
          sched_yest_val: planQ * rm.unit_val,
          yest_grn_qty: gQ,
          yest_grn_val: gV,
          yest_gap_qty: gapQ,
          yest_gap_val: gapQ * rm.unit_val
        };
      });

      return {
        ...prev,
        meta: {
          ...prev.meta,
          latest_date_iso: newIsoDate,
          cutoff_date: cutoff,
          elapsed_working_days: elapW,
          remaining_working_days: remW,
          prorata_pct: proPct
        },
        demand: updatedDemand,
        rmpm_parts: updatedRmpm
      };
    });

    showToast(`Yesterday Date set to ${newIsoDate}`);
  }, [showToast]);

  // Comment Operations
  const handleSaveComment = useCallback((newRec: Partial<CommentRecord>) => {
    setData(prev => {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const existing = newRec.id ? prev.comments.find(c => c.id === newRec.id) : null;
      let updatedComments: CommentRecord[];

      if (existing) {
        updatedComments = prev.comments.map(c =>
          c.id === existing.id
            ? ({ ...c, ...newRec, updated: now } as CommentRecord)
            : c
        );
      } else {
        const nums = prev.comments.map(c => {
          const digits = c.id.replace(/\D/g, '');
          return digits ? parseInt(digits, 10) : 0;
        });
        const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
        const newId = `C${String(maxNum + 1).padStart(4, '0')}`;
        const created: CommentRecord = {
          id: newId,
          created: now,
          updated: now,
          part: newRec.part || '',
          desc: newRec.desc || '',
          customer: newRec.customer || '',
          minifactory: newRec.minifactory || '',
          line: newRec.line || '',
          stakeholder: newRec.stakeholder || '',
          category: newRec.category || 'Other',
          discussion: newRec.discussion || '',
          action: newRec.action || '',
          owner: newRec.owner || '',
          target_date: newRec.target_date || '',
          status: newRec.status || 'Open',
          criticality: newRec.criticality || 'Critical',
          needs_escalation: newRec.needs_escalation || 'No',
          escalation_details: newRec.escalation_details || '',
          plan_val: newRec.plan_val || 0,
          pending_val: newRec.pending_val || 0
        };
        updatedComments = [created, ...prev.comments];
      }

      return {
        ...prev,
        comments: updatedComments
      };
    });

    showToast('✅ Comment saved to Critical_FG_Comments_Log database');
  }, [showToast]);

  const handleDeleteComment = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      comments: prev.comments.filter(c => c.id !== id)
    }));
    showToast(`🗑️ Comment ${id} deleted`);
  }, [showToast]);

  const handleQuickStatusUpdate = useCallback((part: string, nextStatus: 'Critical' | 'Normal') => {
    setData(prev => {
      const partCs = prev.comments.filter(c => c.part === part);
      const r = prev.demand.find(d => d.part === part);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (partCs.length > 0) {
        const latest = partCs[0];
        const updated = prev.comments.map(c =>
          c.id === latest.id ? { ...c, criticality: nextStatus, updated: now } : c
        );
        return { ...prev, comments: updated };
      } else if (r) {
        const nums = prev.comments.map(c => {
          const digits = c.id.replace(/\D/g, '');
          return digits ? parseInt(digits, 10) : 0;
        });
        const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
        const newId = `C${String(maxNum + 1).padStart(4, '0')}`;
        const newRec: CommentRecord = {
          id: newId,
          created: now,
          updated: now,
          part: r.part,
          desc: r.desc || r.products,
          customer: r.customer,
          minifactory: r.minifactory,
          line: r.line,
          stakeholder: 'Plant Head',
          category: 'Other',
          discussion: `Control status updated to ${nextStatus}`,
          action: '',
          owner: '',
          target_date: '',
          status: 'Open',
          criticality: nextStatus,
          needs_escalation: 'No',
          escalation_details: '',
          plan_val: Math.round(r.plan_with_bts_val),
          pending_val: Math.max(0, Math.round(r.plan_with_bts_val - r.prod_td_val))
        };
        return { ...prev, comments: [newRec, ...prev.comments] };
      }
      return prev;
    });

    showToast(`✓ Control status set to ${nextStatus === 'Normal' ? 'Normal (In Control)' : 'Focus'}`);
  }, [showToast]);

  const handleQuickActionStatusUpdate = useCallback((id: string, newStatus: string) => {
    setData(prev => {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const updated = prev.comments.map(c =>
        c.id === id ? { ...c, status: newStatus, updated: now } : c
      );
      return { ...prev, comments: updated };
    });
    showToast(`Action ${id} marked as ${newStatus}`);
  }, [showToast]);

  const handleResetFilters = useCallback(() => {
    setSelectedMf('ALL');
    setSelectedLine('ALL');
    setSelectedCustomer('ALL');
    setBtsMode('WITH_BTS');
    setUnitMode('QTY');
    clearHighlights();
    showToast('Filters reset to defaults');
  }, [clearHighlights, showToast]);

  // Filtered views
  const fDemand = useMemo(() => {
    return data.demand.filter(
      r =>
        (selectedMf === 'ALL' || r.minifactory === selectedMf) &&
        (selectedLine === 'ALL' || r.line === selectedLine) &&
        (selectedCustomer === 'ALL' || r.customer === selectedCustomer)
    );
  }, [data.demand, selectedMf, selectedLine, selectedCustomer]);

  const fRmpmParts = useMemo(() => {
    return data.rmpm_parts.filter(
      r =>
        (selectedMf === 'ALL' || !r.minifactory || r.minifactory === selectedMf) &&
        (selectedLine === 'ALL' || !r.line || r.line === selectedLine)
    );
  }, [data.rmpm_parts, selectedMf, selectedLine]);

  const fVendorSched = useMemo(() => {
    return data.vendor_schedule.filter(
      r =>
        (selectedMf === 'ALL' || !r.minifactory || r.minifactory === selectedMf) &&
        (selectedLine === 'ALL' || !r.line || r.line === selectedLine)
    );
  }, [data.vendor_schedule, selectedMf, selectedLine]);

  const fMb51 = useMemo(() => {
    return data.mb51.filter(
      r =>
        (selectedMf === 'ALL' || r.minifactory === selectedMf) &&
        (selectedLine === 'ALL' || r.line === selectedLine) &&
        (selectedCustomer === 'ALL' || !r.customer || r.customer === selectedCustomer)
    );
  }, [data.mb51, selectedMf, selectedLine, selectedCustomer]);

  const fMb52 = useMemo(() => {
    return data.mb52.filter(
      r =>
        (selectedMf === 'ALL' || r.minifactory === selectedMf) &&
        (selectedLine === 'ALL' || r.line === selectedLine)
    );
  }, [data.mb52, selectedMf, selectedLine]);

  return (
    <div
      onClick={handleContainerClick}
      className="flex flex-col h-screen w-screen overflow-hidden p-1 gap-1 max-w-[100vw] max-h-[100vh]"
    >
      {/* 2-Row Top Bar */}
      <TopBar
        meta={data.meta}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedYestDate={selectedYestDate}
        setSelectedYestDate={handleYesterdayDateChange}
        selectedMf={selectedMf}
        setSelectedMf={setSelectedMf}
        selectedLine={selectedLine}
        setSelectedLine={setSelectedLine}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        btsMode={btsMode}
        setBtsMode={setBtsMode}
        unitMode={unitMode}
        setUnitMode={setUnitMode}
        highlighterActive={highlighterActive}
        setHighlighterActive={setHighlighterActive}
        autoHighlightDeficits={autoHighlightDeficits}
        theme={theme}
        setTheme={setTheme}
        leftCollapsed={leftCollapsed}
        setLeftCollapsed={setLeftCollapsed}
        kpiCollapsed={kpiCollapsed}
        setKpiCollapsed={setKpiCollapsed}
        resetAllFilters={handleResetFilters}
        openDataModal={() => setIsDataModalOpen(true)}
        exportCommentsLog={() => exportCommentsToExcel(data.comments)}
      />

      {/* KPI Ribbon (supports collapsible mode and Dispatch-aware metrics) */}
      <KpiRibbon
        meta={data.meta}
        activeTab={activeTab}
        fDemand={fDemand}
        fRmpmParts={fRmpmParts}
        fMb51={fMb51}
        fMb52={fMb52}
        unitMode={unitMode}
        btsMode={btsMode}
        collapsed={kpiCollapsed}
        onExpand={() => setKpiCollapsed(false)}
      />

      {/* Workspace Tabs */}
      <main className="flex-1 w-full min-h-0 overflow-hidden relative">
        {activeTab === 'yesterday' && (
          <YesterdayTab
            meta={data.meta}
            fDemand={fDemand}
            fRmpmParts={fRmpmParts}
            fMb51={fMb51}
            unitMode={unitMode}
            btsMode={btsMode}
            leftCollapsed={leftCollapsed}
            setLeftCollapsed={setLeftCollapsed}
            openPopoutWithMode={mode => setPopoutMode(mode)}
            onSelectPart={part => setDrillPart(part)}
          />
        )}

        {activeTab === 'demand' && (
          <DemandTab
            meta={data.meta}
            fDemand={fDemand}
            unitMode={unitMode}
            btsMode={btsMode}
            theme={theme}
            leftCollapsed={leftCollapsed}
            setLeftCollapsed={setLeftCollapsed}
            openPopoutWithMode={mode => setPopoutMode(mode)}
            onSelectPart={part => setDrillPart(part)}
            onSwitchToDispatch={() => setActiveTab('dispatch')}
          />
        )}

        {activeTab === 'dispatch' && (
          <DispatchTab
            meta={data.meta}
            fDemand={fDemand}
            unitMode={unitMode}
            btsMode={btsMode}
            theme={theme}
            leftCollapsed={leftCollapsed}
            setLeftCollapsed={setLeftCollapsed}
            openPopoutWithMode={mode => setPopoutMode(mode)}
            onSelectPart={part => setDrillPart(part)}
            onSwitchToProdDemand={() => setActiveTab('demand')}
          />
        )}

        {activeTab === 'rmpm' && (
          <RmpmTab
            meta={data.meta}
            fRmpmParts={fRmpmParts}
            fVendorSched={fVendorSched}
            fMb51={fMb51}
            unitMode={unitMode}
            theme={theme}
            leftCollapsed={leftCollapsed}
            setLeftCollapsed={setLeftCollapsed}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab
            meta={data.meta}
            fDemand={fDemand}
            fRmpmParts={fRmpmParts}
            fMb51={fMb51}
            unitMode={unitMode}
            btsMode={btsMode}
            theme={theme}
            onFilterMf={mf => {
              setSelectedMf(prev => (prev === mf ? 'ALL' : mf));
              setSelectedLine('ALL');
            }}
            onFilterCustomer={cust => {
              setSelectedCustomer(prev => (prev === cust ? 'ALL' : cust));
            }}
          />
        )}

        {activeTab === 'stock' && (
          <StockTab
            meta={data.meta}
            fMb51={fMb51}
            fMb52={fMb52}
            unitMode={unitMode}
            theme={theme}
            leftCollapsed={leftCollapsed}
            setLeftCollapsed={setLeftCollapsed}
          />
        )}

        {activeTab === 'critical' && (
          <CriticalTab
            meta={data.meta}
            fDemand={fDemand}
            comments={data.comments}
            unitMode={unitMode}
            btsMode={btsMode}
            onQuickStatusUpdate={handleQuickStatusUpdate}
            onOpenDrill={part => setDrillPart(part)}
            onSwitchToActions={() => setActiveTab('actions')}
          />
        )}

        {activeTab === 'actions' && (
          <ActionTrackerTab
            meta={data.meta}
            comments={data.comments}
            selectedMf={selectedMf}
            selectedLine={selectedLine}
            selectedCustomer={selectedCustomer}
            onQuickActionStatusUpdate={handleQuickActionStatusUpdate}
            onOpenDrill={part => setDrillPart(part)}
          />
        )}

        {activeTab === 'capacity' && (
          <CapacityTab
            meta={data.meta}
            fDemand={fDemand}
            btsMode={btsMode}
            unitMode={unitMode}
            theme={theme}
            selectedMf={selectedMf}
            setSelectedMf={setSelectedMf}
            selectedLine={selectedLine}
            setSelectedLine={setSelectedLine}
          />
        )}
      </main>

      {/* Floating Save/Status Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white font-bold px-4 py-2 rounded-md shadow-2xl text-xs flex items-center gap-2 border border-emerald-400/40 animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Popout Modal */}
      <PopoutModal
        isOpen={popoutMode !== null}
        onClose={() => setPopoutMode(null)}
        initialMode={popoutMode || 'DEMAND'}
        meta={data.meta}
        demand={fDemand}
        rmpmParts={fRmpmParts}
        btsMode={btsMode}
        setBtsMode={setBtsMode}
        unitMode={unitMode}
        setUnitMode={setUnitMode}
        highlighterActive={highlighterActive}
        setHighlighterActive={setHighlighterActive}
        autoHighlightDeficits={autoHighlightDeficits}
        clearHighlights={clearHighlights}
      />

      {/* Full Critical FG Drilldown Modal */}
      <DrilldownModal
        isOpen={drillPart !== null}
        onClose={() => setDrillPart(null)}
        partCode={drillPart}
        meta={data.meta}
        demand={data.demand}
        rmpmParts={data.rmpm_parts}
        mb51={data.mb51}
        mb52={data.mb52}
        comments={data.comments}
        unitMode={unitMode}
        btsMode={btsMode}
        theme={theme}
        onSaveComment={handleSaveComment}
        onDeleteComment={handleDeleteComment}
      />

      {/* Data Import / Excel Upload Modal */}
      <DataImportModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onImportData={imported => {
          setData(imported);
          setIsDataModalOpen(false);
          showToast('Dataset updated successfully');
        }}
        onResetToDemo={() => {
          setData(initialDashboardData);
          localStorage.removeItem(STORAGE_KEY);
          setIsDataModalOpen(false);
          showToast('Demo dataset restored');
        }}
        currentData={data}
      />
    </div>
  );
};
