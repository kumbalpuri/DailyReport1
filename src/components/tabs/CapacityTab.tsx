import React, { useState, useEffect, useMemo } from 'react';
import { DemandRow, DashboardMeta, BtsMode, UnitMode } from '../../types';
import { calcPartMetrics, shortNumber } from '../../utils/calculations';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Factory,
  RotateCcw,
  Download,
  Search,
  Filter,
  Sliders,
  ChevronDown,
  ChevronUp,
  Zap,
  HelpCircle
} from 'lucide-react';

interface CapacityTabProps {
  meta: DashboardMeta;
  fDemand: DemandRow[];
  btsMode: BtsMode;
  unitMode: UnitMode;
  theme: 'dark' | 'light';
  selectedMf: string;
  setSelectedMf: (mf: string) => void;
  selectedLine: string;
  setSelectedLine: (line: string) => void;
}

const STORAGE_CAPACITY_KEY = 'kspg_product_capacities_v1';

// Default per-hour production capacity (pcs / hour)
const DEFAULT_CAPACITIES: Record<string, number> = {
  '51-PST-1011': 65,  // Piston Assy 1.2L K-Series (Maruti) - Line 1
  '51-PST-1033': 55,  // Piston Assembly 1.0L B-Series (Maruti) - Line 1
  '51-PST-1024': 60,  // Piston Machined 1.5L Turbo Diesel (Tata) - Line 2
  '51-PST-2045': 45,  // Heavy Duty Piston 2.2L (Mahindra) - Line 2
  '51-PST-3008': 120, // Two Wheeler Piston 125cc (Bajaj) - Line 3
  '51-PST-8015': 110, // Single Cyl Piston 150cc (Bajaj) - Line 3
  '51-PST-4090': 40,  // Commercial Truck Piston (Volvo Eicher) - Line 4
  '51-PST-6110': 42,  // Heavy Commercial Piston (Ashok Leyland) - Line 4
  '51-RNG-5012': 150, // Piston Ring Set 3-Piece (Hyundai) - Line 5
  '51-ASM-7020': 50   // Piston & Pin Sub-Assembly (Hyundai) - Line 5
};

export const CapacityTab: React.FC<CapacityTabProps> = ({
  meta,
  fDemand,
  btsMode,
  theme,
  selectedMf,
  setSelectedMf,
  selectedLine,
  setSelectedLine
}) => {
  // Configurable Shift parameters (Default strictly 3 shifts of 7.25 hours)
  const [shiftsPerDay, setShiftsPerDay] = useState<number>(3.0);
  const [hoursPerShift, setHoursPerShift] = useState<number>(7.25);
  const [calcBasis, setCalcBasis] = useState<'ASKING_RATE' | 'DAILY_PLAN' | 'TOTAL_PENDING'>('ASKING_RATE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [capacityFilter, setCapacityFilter] = useState<'ALL' | 'OVER_CAPACITY' | 'AVAILABLE'>('ALL');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Capacities map: part -> capacity_per_hour
  const [capacities, setCapacities] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CAPACITY_KEY);
      if (saved) {
        return { ...DEFAULT_CAPACITIES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load saved capacities', e);
    }
    return DEFAULT_CAPACITIES;
  });

  // Save to localStorage when capacities change
  const handleUpdateCapacity = (part: string, val: number) => {
    const num = Math.max(1, isNaN(val) ? 1 : Math.round(val));
    setCapacities(prev => {
      const next = { ...prev, [part]: num };
      try {
        localStorage.setItem(STORAGE_CAPACITY_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save capacity', e);
      }
      return next;
    });
  };

  const handleResetCapacities = () => {
    setCapacities(DEFAULT_CAPACITIES);
    try {
      localStorage.removeItem(STORAGE_CAPACITY_KEY);
    } catch {}
  };

  // Total daily available operating hours per line = shiftsPerDay * hoursPerShift
  const dailyAvailableHoursPerLine = shiftsPerDay * hoursPerShift; // 3 * 7.25 = 21.75 hours

  // Compute product-level capacity and shift requirements
  const productMetrics = useMemo(() => {
    return fDemand.map(r => {
      const m = calcPartMetrics(r, btsMode, meta);
      const capPerHour = capacities[r.part] || DEFAULT_CAPACITIES[r.part] || 50;

      // Determine volume based on calculation basis
      let volumeForCalc = m.askRateQ;
      if (calcBasis === 'DAILY_PLAN') {
        volumeForCalc = m.planQ / Math.max(1, meta.total_working_days);
      } else if (calcBasis === 'TOTAL_PENDING') {
        volumeForCalc = m.pendQ;
      }

      // Daily hours required = Daily Volume / Capacity Per Hour
      const dailyHoursReq = volumeForCalc / capPerHour;

      // Daily shifts required = Daily Hours / Hours Per Shift
      const dailyShiftsReq = dailyHoursReq / hoursPerShift;

      // Total shifts for remaining month
      const totalHoursReq = m.pendQ / capPerHour;
      const totalShiftsReq = totalHoursReq / hoursPerShift;
      const daysRequiredAt3Shifts = totalShiftsReq / shiftsPerDay;

      return {
        part: r.part,
        desc: r.desc,
        customer: r.customer,
        minifactory: r.minifactory || 'MF-1',
        line: r.line || 'Line 1',
        planQ: m.planQ,
        prodQ: m.prodQ,
        pendQ: m.pendQ,
        askRateQ: m.askRateQ,
        volumeForCalc,
        capacityPerHour: capPerHour,
        isCustomized: capacities[r.part] !== undefined && capacities[r.part] !== DEFAULT_CAPACITIES[r.part],
        dailyHoursReq,
        dailyShiftsReq,
        totalHoursReq,
        totalShiftsReq,
        daysRequiredAt3Shifts,
        exceeds3Shifts: dailyShiftsReq > shiftsPerDay
      };
    });
  }, [fDemand, btsMode, meta, capacities, calcBasis, hoursPerShift, shiftsPerDay]);

  // Aggregate by Line
  const lineAggregations = useMemo(() => {
    const map: Record<
      string,
      {
        line: string;
        minifactory: string;
        products: typeof productMetrics;
        totalDailyVolume: number;
        totalDailyHours: number;
        totalDailyShifts: number;
        totalPendingVolume: number;
        totalPendingHours: number;
        totalPendingShifts: number;
      }
    > = {};

    productMetrics.forEach(p => {
      const lineKey = p.line;
      if (!map[lineKey]) {
        map[lineKey] = {
          line: p.line,
          minifactory: p.minifactory,
          products: [],
          totalDailyVolume: 0,
          totalDailyHours: 0,
          totalDailyShifts: 0,
          totalPendingVolume: 0,
          totalPendingHours: 0,
          totalPendingShifts: 0
        };
      }

      map[lineKey].products.push(p);
      map[lineKey].totalDailyVolume += p.volumeForCalc;
      map[lineKey].totalDailyHours += p.dailyHoursReq;
      map[lineKey].totalDailyShifts += p.dailyShiftsReq;
      map[lineKey].totalPendingVolume += p.pendQ;
      map[lineKey].totalPendingHours += p.totalHoursReq;
      map[lineKey].totalPendingShifts += p.totalShiftsReq;
    });

    return Object.values(map).map(lineData => {
      const totalDailyShifts = lineData.totalDailyShifts;
      const isOverCapacity = totalDailyShifts > shiftsPerDay;
      const utilizationPct = (totalDailyShifts / shiftsPerDay) * 100;
      const bufferShifts = shiftsPerDay - totalDailyShifts;
      const bufferHours = dailyAvailableHoursPerLine - lineData.totalDailyHours;

      return {
        ...lineData,
        isOverCapacity,
        utilizationPct,
        bufferShifts,
        bufferHours,
        productCount: lineData.products.length
      };
    });
  }, [productMetrics, shiftsPerDay, dailyAvailableHoursPerLine]);

  // Filtered Lines
  const displayLines = useMemo(() => {
    return lineAggregations.filter(l => {
      if (selectedMf !== 'ALL' && l.minifactory !== selectedMf) return false;
      if (selectedLine !== 'ALL' && l.line !== selectedLine) return false;
      if (capacityFilter === 'OVER_CAPACITY' && !l.isOverCapacity) return false;
      if (capacityFilter === 'AVAILABLE' && l.isOverCapacity) return false;
      return true;
    });
  }, [lineAggregations, selectedMf, selectedLine, capacityFilter]);

  // Filtered Products for the table
  const displayProducts = useMemo(() => {
    return productMetrics.filter(p => {
      if (selectedMf !== 'ALL' && p.minifactory !== selectedMf) return false;
      if (selectedLine !== 'ALL' && p.line !== selectedLine) return false;
      if (capacityFilter === 'OVER_CAPACITY') {
        const line = lineAggregations.find(l => l.line === p.line);
        if (line && !line.isOverCapacity) return false;
      }
      if (capacityFilter === 'AVAILABLE') {
        const line = lineAggregations.find(l => l.line === p.line);
        if (line && line.isOverCapacity) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPart = p.part.toLowerCase().includes(q);
        const matchesDesc = p.desc.toLowerCase().includes(q);
        const matchesCust = p.customer.toLowerCase().includes(q);
        const matchesLine = p.line.toLowerCase().includes(q);
        if (!matchesPart && !matchesDesc && !matchesCust && !matchesLine) return false;
      }
      return true;
    });
  }, [productMetrics, selectedMf, selectedLine, capacityFilter, searchQuery, lineAggregations]);

  // Overall Plant Summary
  const plantSummary = useMemo(() => {
    const totalLines = lineAggregations.length;
    const overCapacityLines = lineAggregations.filter(l => l.isOverCapacity);
    const tightLines = lineAggregations.filter(l => !l.isOverCapacity && l.totalDailyShifts >= 2.5);
    const healthyLines = lineAggregations.filter(l => l.totalDailyShifts < 2.5);

    const totalAvailableShifts = totalLines * shiftsPerDay;
    const totalRequiredShifts = lineAggregations.reduce((acc, l) => acc + l.totalDailyShifts, 0);
    const totalAvailableHours = totalLines * dailyAvailableHoursPerLine;
    const totalRequiredHours = lineAggregations.reduce((acc, l) => acc + l.totalDailyHours, 0);
    const overallUtilization = totalAvailableShifts > 0 ? (totalRequiredShifts / totalAvailableShifts) * 100 : 0;

    // Line 1 specific data for quick reference
    const line1Data = lineAggregations.find(l => l.line.toLowerCase().includes('line 1'));

    return {
      totalLines,
      overCapacityCount: overCapacityLines.length,
      tightCount: tightLines.length,
      healthyCount: healthyLines.length,
      totalAvailableShifts,
      totalRequiredShifts,
      totalAvailableHours,
      totalRequiredHours,
      overallUtilization,
      line1Data
    };
  }, [lineAggregations, shiftsPerDay, dailyAvailableHoursPerLine]);

  // Export Capacity Report to CSV
  const handleExportCSV = () => {
    const headers = [
      'Line',
      'Minifactory',
      'Part Number',
      'Description',
      'Customer',
      'Monthly Plan',
      'Produced Till Date',
      'Pending Qty',
      'Daily Volume (Asking Rate)',
      'Capacity Per Hour (Pcs/Hr)',
      'Daily Hours Required',
      'Daily Shifts Required (7.25 hr/shift)',
      'Line Total Shifts Required',
      'Line Available Shifts (3.0)',
      'Line Capacity Status'
    ];

    const rows: string[][] = [];

    lineAggregations.forEach(line => {
      line.products.forEach(p => {
        rows.push([
          `"${line.line}"`,
          `"${line.minifactory}"`,
          `"${p.part}"`,
          `"${p.desc.replace(/"/g, '""')}"`,
          `"${p.customer}"`,
          p.planQ.toString(),
          p.prodQ.toString(),
          p.pendQ.toString(),
          Math.round(p.volumeForCalc).toString(),
          p.capacityPerHour.toString(),
          p.dailyHoursReq.toFixed(2),
          p.dailyShiftsReq.toFixed(2),
          line.totalDailyShifts.toFixed(2),
          shiftsPerDay.toFixed(1),
          line.isOverCapacity ? 'OVER CAPACITY (> 3 SHIFTS)' : 'NORMAL'
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KSPG_Capacity_Shift_Requirement_${meta.cutoff_date.replace(/-/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLight = theme === 'light';

  return (
    <div className="flex flex-col w-full h-full min-h-0 gap-1.5 overflow-hidden select-none">
      {/* 1. Header Toolbar & Slicers */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-md px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 shadow-xs">
        {/* Left: Title & Line 1 Quick Selector */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Factory className="w-4 h-4 text-emerald-400" />
            <span className="text-[12.5px] font-extrabold text-[var(--text-main)] tracking-wide">
              Capacity &amp; Shift Requirement Planning
            </span>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold">
              3 Shifts @ 7.25 Hrs / Day
            </span>
          </div>

          {/* Quick Line 1 Shortcut button */}
          <button
            onClick={() => {
              const l1 = meta.lines.find(l => l.toLowerCase().includes('line 1')) || 'Line 1 (Passenger Cars)';
              setSelectedLine(selectedLine === l1 ? 'ALL' : l1);
            }}
            className={`px-2 py-0.5 rounded text-[10.5px] font-bold border transition-all cursor-pointer ${
              selectedLine.toLowerCase().includes('line 1')
                ? 'bg-blue-600 text-white border-blue-400 shadow-xs ring-1 ring-blue-300'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/40 hover:bg-blue-500/20'
            }`}
          >
            {selectedLine.toLowerCase().includes('line 1') ? '✓ Line 1 Selected' : 'Focus Line 1'}
          </button>

          {/* Over-Capacity filter badge button */}
          {plantSummary.overCapacityCount > 0 && (
            <button
              onClick={() => setCapacityFilter(prev => (prev === 'OVER_CAPACITY' ? 'ALL' : 'OVER_CAPACITY'))}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold border transition-all cursor-pointer ${
                capacityFilter === 'OVER_CAPACITY'
                  ? 'bg-red-600 text-white border-red-400 shadow-md animate-pulse'
                  : 'bg-red-500/15 text-red-400 border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>{plantSummary.overCapacityCount} Line(s) Over Capacity (&gt;3 Shifts)</span>
            </button>
          )}
        </div>

        {/* Right: Slicers & Calculation Basis */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Minifactory Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-bold">MF:</span>
            <select
              value={selectedMf}
              onChange={e => {
                setSelectedMf(e.target.value);
                setSelectedLine('ALL');
              }}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Minifactories</option>
              {meta.minifactories.map(mf => (
                <option key={mf} value={mf}>
                  {mf}
                </option>
              ))}
            </select>
          </div>

          {/* Line Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-bold">Line:</span>
            <select
              value={selectedLine}
              onChange={e => setSelectedLine(e.target.value)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10.5px] font-semibold focus:outline-none focus:border-blue-500 cursor-pointer max-w-[160px]"
            >
              <option value="ALL">All Lines</option>
              {meta.lines.map(line => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

          {/* Calculation Basis selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-bold">Basis:</span>
            <select
              value={calcBasis}
              onChange={e => setCalcBasis(e.target.value as any)}
              className="bg-[var(--bg-card)] text-[var(--text-main)] border border-emerald-500/50 rounded px-1.5 py-0.5 text-[10.5px] font-bold focus:outline-none focus:border-emerald-400 cursor-pointer text-emerald-400"
            >
              <option value="ASKING_RATE">Daily Asking Rate (Catch-up)</option>
              <option value="DAILY_PLAN">Daily Planned Rate (Plan / Days)</option>
              <option value="TOTAL_PENDING">Full Month Pending Volume</option>
            </select>
          </div>

          {/* Formula Info Button */}
          <button
            onClick={() => setShowFormulaModal(true)}
            title="View Shift Calculation Formula & Logic"
            className="p-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-slate-300 hover:text-white hover:border-blue-400 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Reset Capacities */}
          <button
            onClick={handleResetCapacities}
            title="Reset all product capacities to factory standards"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Caps</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            title="Download full capacity report as CSV"
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-[10.5px] font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 flex-shrink-0">
        {/* KPI 1: Over-Capacity Alert / Status */}
        <div
          className={`p-2 rounded-md border flex flex-col justify-between shadow-xs transition-colors ${
            plantSummary.overCapacityCount > 0
              ? 'bg-red-500/15 border-red-500/70 text-red-200'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <span>Capacity Status</span>
            {plantSummary.overCapacityCount > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-[19px] font-black ${
                plantSummary.overCapacityCount > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {plantSummary.overCapacityCount > 0
                ? `${plantSummary.overCapacityCount} Bottleneck`
                : 'All Lines OK'}
            </span>
          </div>
          <div className="text-[9px] mt-0.5 font-medium opacity-85">
            {plantSummary.overCapacityCount > 0
              ? 'Lines exceeding 3.0 Shifts/day (Red)'
              : 'All lines operating ≤ 3.0 Shifts/day'}
          </div>
        </div>

        {/* KPI 2: Line 1 Direct Focus Card */}
        {plantSummary.line1Data ? (
          <div
            className={`p-2 rounded-md border flex flex-col justify-between shadow-xs ${
              plantSummary.line1Data.isOverCapacity
                ? 'bg-red-500/20 border-red-500 text-red-200'
                : plantSummary.line1Data.totalDailyShifts >= 2.5
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="truncate">Line 1 Focus</span>
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                  plantSummary.line1Data.isOverCapacity
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                {plantSummary.line1Data.isOverCapacity ? 'OVER CAP' : 'NORMAL'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-[19px] font-black ${
                  plantSummary.line1Data.isOverCapacity
                    ? 'text-red-400'
                    : plantSummary.line1Data.totalDailyShifts >= 2.5
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {plantSummary.line1Data.totalDailyShifts.toFixed(2)}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                / 3.0 Shifts
              </span>
            </div>
            <div className="text-[9px] mt-0.5 font-semibold">
              {plantSummary.line1Data.isOverCapacity ? (
                <span className="text-red-400 font-bold">
                  Deficit: +{Math.abs(plantSummary.line1Data.bufferShifts).toFixed(2)} Shifts (+{Math.abs(plantSummary.line1Data.bufferHours).toFixed(1)}h OT)
                </span>
              ) : (
                <span className="text-emerald-400">
                  Buffer: +{plantSummary.line1Data.bufferShifts.toFixed(2)} Shifts ({plantSummary.line1Data.bufferHours.toFixed(1)}h Free)
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Line 1 Status</span>
            <span className="text-sm font-bold text-slate-400">N/A</span>
          </div>
        )}

        {/* KPI 3: Total Daily Operating Hours */}
        <div className="p-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
            <span>Plant Shift Load</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[19px] font-black text-blue-400">
              {plantSummary.totalRequiredShifts.toFixed(1)}
            </span>
            <span className="text-[10px] font-semibold text-[var(--text-muted)]">
              / {plantSummary.totalAvailableShifts.toFixed(0)} Avail Shifts
            </span>
          </div>
          <div className="text-[9px] mt-0.5 text-[var(--text-muted)]">
            Total {plantSummary.totalRequiredHours.toFixed(1)} hrs needed / {plantSummary.totalAvailableHours.toFixed(1)} hrs capacity
          </div>
        </div>

        {/* KPI 4: Overall Capacity Utilization */}
        <div className="p-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
            <span>Capacity Utilization</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-[19px] font-black ${
                plantSummary.overallUtilization > 100
                  ? 'text-red-400'
                  : plantSummary.overallUtilization > 85
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {plantSummary.overallUtilization.toFixed(1)}%
            </span>
            <span className="text-[10px] font-semibold text-[var(--text-muted)]">Plant Avg</span>
          </div>
          <div className="text-[9px] mt-0.5 text-[var(--text-muted)]">
            {plantSummary.tightCount} tight lines (85-100%) | {plantSummary.healthyCount} normal (&lt;85%)
          </div>
        </div>

        {/* KPI 5: Standard Operating Base */}
        <div className="p-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
            <span>Standard Setup</span>
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[19px] font-black text-purple-400">
              {shiftsPerDay} × {hoursPerShift}h
            </span>
            <span className="text-[10px] font-semibold text-[var(--text-muted)]">
              = 21.75h / day
            </span>
          </div>
          <div className="text-[9px] mt-0.5 text-[var(--text-muted)]">
            Remaining Days: <strong className="text-emerald-400">{meta.remaining_working_days}</strong> of {meta.total_working_days}
          </div>
        </div>
      </div>

      {/* 3. Main Split View: Top Line-Wise Overview & Bottom Product-Wise Detail */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5 overflow-hidden">
        {/* Left Column (5 Cols): Line-Wise Capacity Summary & Visual Gauge */}
        <div className="lg:col-span-5 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
          <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-[var(--text-main)]">
                Line-Wise Capacity &amp; Shift Loading Matrix
              </span>
            </div>
            <div className="flex items-center gap-1 text-[9.5px]">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-red-400 font-bold">&gt;3.0 Shifts (Red)</span>
              <span className="mx-1 text-slate-500">|</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-emerald-400 font-bold">≤3.0 Shifts (OK)</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {displayLines.map(line => {
              const isL1 = line.line.toLowerCase().includes('line 1');
              const isSelected = selectedLine === line.line;
              const maxGaugeShifts = 4.0; // scale for visualization
              const fillPct = Math.min(100, (line.totalDailyShifts / maxGaugeShifts) * 100);
              const thresholdPct = (shiftsPerDay / maxGaugeShifts) * 100; // 3.0 / 4.0 = 75%

              return (
                <div
                  key={line.line}
                  onClick={() => setSelectedLine(isSelected ? 'ALL' : line.line)}
                  className={`p-2.5 rounded-md border transition-all cursor-pointer ${
                    line.isOverCapacity
                      ? 'bg-red-500/10 border-red-500/80 shadow-xs hover:border-red-400 ring-1 ring-red-500/30'
                      : line.totalDailyShifts >= 2.5
                      ? 'bg-amber-500/5 border-amber-500/40 hover:border-amber-400'
                      : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-blue-400'
                  } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {/* Line Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] font-extrabold ${line.isOverCapacity ? 'text-red-400' : 'text-[var(--text-main)]'}`}>
                        {line.line}
                      </span>
                      {isL1 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">
                          Primary Line
                        </span>
                      )}
                      <span className="text-[9px] text-[var(--text-muted)]">
                        ({line.productCount} {line.productCount === 1 ? 'part' : 'parts'})
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[9.5px] font-black px-2 py-0.5 rounded border ${
                        line.isOverCapacity
                          ? 'bg-red-600 text-white border-red-500 shadow-xs'
                          : line.totalDailyShifts >= 2.5
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      }`}
                    >
                      {line.isOverCapacity
                        ? `🚨 OVER CAPACITY (${line.totalDailyShifts.toFixed(2)} Shifts)`
                        : `✓ HEALTHY (${line.totalDailyShifts.toFixed(2)} Shifts)`}
                    </span>
                  </div>

                  {/* Subtitle MF */}
                  <div className="text-[9.5px] text-[var(--text-muted)] mb-2 flex items-center justify-between">
                    <span>{line.minifactory}</span>
                    <span className="font-mono">
                      Daily Req: <strong className="text-white">{Math.round(line.totalDailyVolume).toLocaleString('en-IN')}</strong> units |{' '}
                      <strong className={line.isOverCapacity ? 'text-red-400' : 'text-blue-400'}>
                        {line.totalDailyHours.toFixed(1)} hrs/day
                      </strong>
                    </span>
                  </div>

                  {/* Visual Shift Capacity Gauge */}
                  <div className="relative w-full h-4 bg-slate-800/80 rounded overflow-hidden border border-slate-700">
                    {/* Fill Bar */}
                    <div
                      className={`h-full transition-all duration-300 ${
                        line.isOverCapacity
                          ? 'bg-gradient-to-r from-amber-500 to-red-600'
                          : line.totalDailyShifts >= 2.5
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${fillPct}%` }}
                    />

                    {/* Dotted threshold line at 3.0 Shifts */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm z-10"
                      style={{ left: `${thresholdPct}%` }}
                      title="Available Capacity Limit: 3.0 Shifts (21.75 Hrs)"
                    />

                    {/* Label inside gauge */}
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px] font-bold text-white drop-shadow-sm pointer-events-none">
                      <span>{line.totalDailyShifts.toFixed(2)} Shifts Required</span>
                      <span className="opacity-90">3.0 Max Limit</span>
                    </div>
                  </div>

                  {/* Operational Variance & Buffer Guidance */}
                  <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono">
                    <span className="text-[var(--text-muted)]">
                      Utilization: <strong className={line.utilizationPct > 100 ? 'text-red-400' : 'text-slate-200'}>{line.utilizationPct.toFixed(1)}%</strong>
                    </span>
                    {line.isOverCapacity ? (
                      <span className="text-red-400 font-bold">
                        ⚠️ Deficit: Exceeds by +{Math.abs(line.bufferShifts).toFixed(2)} shifts (+{Math.abs(line.bufferHours).toFixed(1)} hrs overtime)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">
                        ✓ Available Buffer: +{line.bufferShifts.toFixed(2)} shifts (+{line.bufferHours.toFixed(1)} hrs headroom)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Guidance Box */}
          <div className="p-2 border-t border-[var(--border)] bg-[var(--bg-hdr)]/50 text-[9px] text-[var(--text-muted)] flex items-center justify-between flex-shrink-0">
            <span>Click any Line to isolate its products in the table</span>
            {selectedLine !== 'ALL' && (
              <button
                onClick={() => setSelectedLine('ALL')}
                className="text-blue-400 font-bold hover:underline"
              >
                Clear Line Filter (Show All)
              </button>
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): Product-Wise Detail Table with Editable Capacities */}
        <div className="lg:col-span-7 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md flex flex-col min-h-0 overflow-hidden shadow-xs">
          {/* Table Header & Search */}
          <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-hdr)] flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--text-main)] truncate">
                Product-Level Capacity &amp; Shift Breakdown
              </span>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 font-mono">
                {displayProducts.length} {displayProducts.length === 1 ? 'part' : 'parts'}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search part, desc, line..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-6 pr-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[10.5px] text-[var(--text-main)] placeholder-slate-500 focus:outline-none focus:border-blue-400 w-44"
              />
            </div>
          </div>

          {/* Scrollable Table */}
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead className="sticky top-0 z-10 bg-[var(--tbl-th-bg)] border-b border-[var(--border)]">
                <tr className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-extrabold">
                  <th className="py-1.5 px-2">Part &amp; Description</th>
                  <th className="py-1.5 px-2">Line / MF</th>
                  <th className="py-1.5 px-2 text-right">Plan</th>
                  <th className="py-1.5 px-2 text-right">Pending</th>
                  <th className="py-1.5 px-2 text-right text-blue-400">Daily Req</th>
                  <th className="py-1.5 px-2 text-center text-emerald-400">
                    Cap / Hr <span className="text-[8px] text-slate-400">(Pcs)</span>
                  </th>
                  <th className="py-1.5 px-2 text-right text-purple-400">Daily Hrs</th>
                  <th className="py-1.5 px-2 text-right">
                    Daily Shifts <span className="text-[8px] text-slate-400">(@7.25h)</span>
                  </th>
                  <th className="py-1.5 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-mono">
                {displayProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-slate-400 text-xs font-sans">
                      No products match the selected filters.
                    </td>
                  </tr>
                ) : (
                  displayProducts.map(p => {
                    const line = lineAggregations.find(l => l.line === p.line);
                    const isLineOver = line ? line.isOverCapacity : false;

                    return (
                      <tr
                        key={p.part}
                        className={`hover:bg-[var(--bg-hover)] transition-colors ${
                          isLineOver ? 'bg-red-500/5' : ''
                        }`}
                      >
                        {/* Part Code & Description */}
                        <td className="py-1.5 px-2 font-sans">
                          <div className="font-mono font-bold text-[var(--text-main)] text-[10.5px]">
                            {p.part}
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)] truncate max-w-[170px]" title={p.desc}>
                            {p.desc}
                          </div>
                          <div className="text-[8.5px] text-blue-400 font-semibold">{p.customer}</div>
                        </td>

                        {/* Line & MF */}
                        <td className="py-1.5 px-2 font-sans text-[9px] text-[var(--text-muted)]">
                          <div className="font-bold text-slate-300 truncate max-w-[130px]">{p.line}</div>
                          <div className="text-[8.5px] truncate max-w-[130px]">{p.minifactory}</div>
                        </td>

                        {/* Plan */}
                        <td className="py-1.5 px-2 text-right font-medium">
                          {p.planQ.toLocaleString('en-IN')}
                        </td>

                        {/* Pending */}
                        <td className="py-1.5 px-2 text-right font-bold text-amber-400">
                          {p.pendQ.toLocaleString('en-IN')}
                        </td>

                        {/* Daily Volume (Asking Rate) */}
                        <td className="py-1.5 px-2 text-right font-bold text-blue-400">
                          {Math.round(p.volumeForCalc).toLocaleString('en-IN')}
                        </td>

                        {/* Editable Capacity per Hour */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              step="5"
                              value={p.capacityPerHour}
                              onChange={e => handleUpdateCapacity(p.part, parseInt(e.target.value) || 1)}
                              className={`w-14 px-1.5 py-0.5 rounded text-center font-mono font-bold text-[10.5px] border focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                                p.isCustomized
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                  : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-main)]'
                              }`}
                              title={`Editable Capacity: ${p.capacityPerHour} pcs/hour. Click to change.`}
                            />
                            {p.isCustomized && (
                              <button
                                onClick={() => handleUpdateCapacity(p.part, DEFAULT_CAPACITIES[p.part] || 50)}
                                title="Reset to standard capacity"
                                className="text-[8px] text-slate-400 hover:text-white"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Daily Hours Required */}
                        <td className="py-1.5 px-2 text-right font-bold text-purple-400">
                          {p.dailyHoursReq.toFixed(1)}h
                        </td>

                        {/* Daily Shifts Required (@7.25h) */}
                        <td className="py-1.5 px-2 text-right font-black text-[10.5px]">
                          <span
                            className={
                              p.dailyShiftsReq > 2.0
                                ? 'text-red-400'
                                : p.dailyShiftsReq > 1.2
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {p.dailyShiftsReq.toFixed(2)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-2 text-center font-sans">
                          {isLineOver ? (
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold inline-block whitespace-nowrap shadow-xs">
                              Over Cap Line
                            </span>
                          ) : (
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold inline-block whitespace-nowrap">
                              Available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Footer: Instructions & Totals */}
          <div className="px-3 py-1.5 border-t border-[var(--border)] bg-[var(--bg-hdr)] flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-[var(--text-muted)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">💡 Tip:</span>
              <span>Edit any product's capacity (pcs/hr) in the input boxes to immediately simulate shift impact.</span>
            </div>
            <div className="font-mono text-slate-300">
              Filtered Total:{' '}
              <strong className="text-white">
                {displayProducts.reduce((acc, p) => acc + p.dailyShiftsReq, 0).toFixed(2)} Shifts
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Shift Calculation Formula Explanation Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-2xl max-w-lg w-full p-4 text-[11px] text-[var(--text-main)] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">Capacity &amp; Shift Requirement Formula</span>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 font-sans leading-relaxed">
              <div className="p-2.5 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="font-bold text-blue-400 mb-1">1. Operating Shift Baseline:</div>
                <div className="font-mono text-[10px] space-y-0.5">
                  <div>• Available Shifts / Day = <strong>3 Shifts</strong></div>
                  <div>• Hours per Shift = <strong>7.25 Hours</strong></div>
                  <div>• Total Operating Capacity = 3 × 7.25 = <strong>21.75 Hours / Day</strong> per Line</div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="font-bold text-emerald-400 mb-1">2. Shift Calculation Steps:</div>
                <div className="font-mono text-[10px] space-y-1">
                  <div>
                    <span className="text-slate-400">Step A:</span> <strong>Daily Hours Needed (Part)</strong> = Daily Asking Rate (Units) ÷ Capacity per Hour (Pcs/Hr)
                  </div>
                  <div>
                    <span className="text-slate-400">Step B:</span> <strong>Daily Shifts Needed (Part)</strong> = Daily Hours Needed ÷ 7.25 Hours/Shift
                  </div>
                  <div>
                    <span className="text-slate-400">Step C:</span> <strong>Total Line Shifts</strong> = Sum of Shifts for all products running on that Line
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/50">
                <div className="font-bold text-red-400 mb-1">3. The Red Bottleneck Rule:</div>
                <div className="text-[10px] text-slate-300">
                  Whenever a Line's combined shift requirement <strong>exceeds 3.0 Shifts</strong> (i.e. &gt; 21.75 hours), the line is flagged in <strong>VIBRANT RED</strong> to signal that the daily target cannot be completed in standard 3 shifts without overtime, weekend shifts, or product re-balancing.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                Close &amp; Return to Planner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
