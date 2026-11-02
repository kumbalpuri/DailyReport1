import { CalculatedPartMetrics, CalculatedDispatchMetrics, DemandRow, BtsMode, DashboardMeta, UnitMode, FxRate, CommentRecord } from '../types';
import * as XLSX from 'xlsx';

export function calcPartMetrics(
  r: DemandRow,
  btsMode: BtsMode,
  meta: DashboardMeta
): CalculatedPartMetrics {
  const planQ = btsMode === 'WITH_BTS' ? r.plan_with_bts_qty : r.plan_without_bts_qty;
  const planV = btsMode === 'WITH_BTS' ? r.plan_with_bts_val : r.plan_without_bts_val;
  
  const totW = Math.max(1, meta.total_working_days);
  const elapW = Math.max(1, meta.elapsed_working_days);
  const remW = Math.max(0, meta.remaining_working_days);
  const proRatio = elapW / totW;

  const ttdQ = planQ * proRatio;
  const ttdV = planV * proRatio;

  const prodQ = r.prod_td_qty;
  const prodV = r.prod_td_val;

  const pendQ = Math.max(0, planQ - prodQ);
  const pendV = Math.max(0, planV - prodV);

  const runRateQ = prodQ / elapW;
  const runRateV = prodV / elapW;

  const askRateQ = remW > 0 ? pendQ / remW : pendQ;
  const askRateV = remW > 0 ? pendV / remW : pendV;

  const yestPlanQ = planQ / totW;
  const yestPlanV = planV / totW;

  const pctAchTd = ttdQ > 0 ? (prodQ / ttdQ) * 100.0 : 0.0;
  const pctAchMon = planQ > 0 ? (prodQ / planQ) * 100.0 : 0.0;
  const pctYestProd = yestPlanQ > 0 ? (r.yest_prod_qty / yestPlanQ) * 100.0 : 0.0;
  const pctYestDisp = yestPlanQ > 0 ? (r.yest_disp_qty / yestPlanQ) * 100.0 : 0.0;

  let remStr = r.sheet_remarks;
  if (!remStr) {
    if (planQ > 0 && prodQ >= planQ) {
      remStr = 'Monthly Plan Achieved';
    } else if (ttdQ > 0 && prodQ >= ttdQ) {
      remStr = 'Ahead / On Track vs TTD';
    } else if (prodQ === 0 && planQ > 0) {
      remStr = 'No Production Logged (MB51)';
    } else {
      const deficit = Math.round(Math.max(0, ttdQ - prodQ));
      remStr = `Behind TTD (-${deficit.toLocaleString('en-IN')})`;
    }
  }

  return {
    planQ,
    planV,
    ttdQ,
    ttdV,
    prodQ,
    prodV,
    pendQ,
    pendV,
    runRateQ,
    runRateV,
    askRateQ,
    askRateV,
    yestPlanQ,
    yestPlanV,
    pctAchTd,
    pctAchMon,
    pctYestProd,
    pctYestDisp,
    remStr
  };
}

export function calcDispatchMetrics(
  r: DemandRow,
  btsMode: BtsMode,
  meta: DashboardMeta
): CalculatedDispatchMetrics {
  const planQ = btsMode === 'WITH_BTS' ? r.plan_with_bts_qty : r.plan_without_bts_qty;
  const planV = btsMode === 'WITH_BTS' ? r.plan_with_bts_val : r.plan_without_bts_val;

  const totW = Math.max(1, meta.total_working_days);
  const elapW = Math.max(1, meta.elapsed_working_days);
  const remW = Math.max(0, meta.remaining_working_days);
  const proRatio = elapW / totW;

  const ttdQ = planQ * proRatio;
  const ttdV = planV * proRatio;

  const disp601Q = Number(r.disp_601_qty || 0);
  const disp601V = Number(r.disp_601_val || disp601Q * r.price);
  const disp641Q = Number(r.disp_641_qty || 0);
  const disp641V = Number(r.disp_641_val || disp641Q * r.price);
  const dispQ = Number(r.total_disp_qty || disp601Q + disp641Q);
  const dispV = Number(r.total_disp_val || dispQ * r.price);

  const pendDispQ = Math.max(0, planQ - dispQ);
  const pendDispV = Math.max(0, planV - dispV);

  const runRateQ = dispQ / elapW;
  const runRateV = dispV / elapW;

  const askRateQ = remW > 0 ? pendDispQ / remW : pendDispQ;
  const askRateV = remW > 0 ? pendDispV / remW : pendDispV;

  const yestPlanQ = planQ / totW;
  const yestPlanV = planV / totW;

  const pctAchTd = ttdQ > 0 ? (dispQ / ttdQ) * 100.0 : dispQ > 0 ? 100.0 : 0.0;
  const pctAchMon = planQ > 0 ? (dispQ / planQ) * 100.0 : dispQ > 0 ? 100.0 : 0.0;
  const pctYestDisp = yestPlanQ > 0 ? (r.yest_disp_qty / yestPlanQ) * 100.0 : r.yest_disp_qty > 0 ? 100.0 : 0.0;

  const dailyReq = yestPlanQ > 0 ? yestPlanQ : 1;
  const stockCoverDays = r.stock_total_qty / dailyReq;

  let remStr = '';
  if (planQ > 0 && dispQ >= planQ) {
    remStr = 'Monthly Dispatch Met';
  } else if (ttdQ > 0 && dispQ >= ttdQ) {
    remStr = `On Track (${stockCoverDays.toFixed(1)}d Stock Cover)`;
  } else if (dispQ === 0 && planQ > 0) {
    remStr = r.stock_total_qty > 0 ? `Zero Disp | ${r.stock_total_qty.toLocaleString('en-IN')} in Stock` : 'Zero Dispatch & Zero Stock';
  } else {
    const gap = Math.round(Math.max(0, ttdQ - dispQ));
    if (r.stock_total_qty >= gap) {
      remStr = `Ready to Ship (${r.stock_total_qty.toLocaleString('en-IN')} in Stock vs -${gap.toLocaleString('en-IN')} TTD)`;
    } else {
      remStr = `Disp Lag -${gap.toLocaleString('en-IN')} (Stock: ${r.stock_total_qty.toLocaleString('en-IN')})`;
    }
  }

  return {
    planQ,
    planV,
    ttdQ,
    ttdV,
    dispQ,
    dispV,
    disp601Q,
    disp601V,
    disp641Q,
    disp641V,
    pendDispQ,
    pendDispV,
    runRateQ,
    runRateV,
    askRateQ,
    askRateV,
    yestPlanQ,
    yestPlanV,
    pctAchTd,
    pctAchMon,
    pctYestDisp,
    stockCoverDays,
    remStr
  };
}

export function pickUnit(
  qty: number,
  valInr: number,
  mode: UnitMode,
  fxList: FxRate[] = []
): number {
  if (mode === 'QTY') return Number(qty || 0);
  const inr = Number(valInr || 0);
  if (mode === 'LAKH') return inr / 100000.0;
  if (mode.startsWith('FX_')) {
    const idx = parseInt(mode.split('_')[1], 10);
    const fxObj = fxList[idx];
    return inr / (fxObj && fxObj.rate > 0 ? fxObj.rate : 1.0);
  }
  return inr;
}

export function formatUnit(
  val: number,
  mode: UnitMode,
  fxList: FxRate[] = [],
  options: { decimals?: number } = {}
): string {
  const n = Number(val || 0);
  if (mode === 'QTY') {
    return n.toLocaleString('en-IN', {
      maximumFractionDigits: options.decimals ?? 0
    });
  }
  if (mode === 'LAKH') {
    return (
      '₹' +
      n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) +
      ' L'
    );
  }
  if (mode.startsWith('FX_')) {
    const idx = parseInt(mode.split('_')[1], 10);
    const fxObj = fxList[idx];
    return (
      (fxObj ? fxObj.from + ' ' : '') +
      n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  );
}

export function shortNumber(n: number): string {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 10000000) return (v / 10000000).toFixed(1) + 'Cr';
  if (abs >= 100000) return (v / 100000).toFixed(1) + 'L';
  if (abs >= 1000) return (v / 1000).toFixed(1) + 'k';
  return Math.round(v).toString();
}

export function exportToCSV(
  rows: Record<string, any>[],
  headers: { key: string; label: string }[],
  filename: string
) {
  const headerLine = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(row => {
    return headers
      .map(h => {
        const val = row[h.key] ?? '';
        return `"${String(val).replace(/\r?\n|\r/g, ' ').replace(/"/g, '""').trim()}"`;
      })
      .join(',');
  });

  const csvContent = [headerLine, ...rowLines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCommentsToExcel(comments: CommentRecord[], filename = 'Critical_FG_Comments_Log.xlsx') {
  const headers = [
    { key: 'id', label: 'ID' },
    { key: 'created', label: 'Created' },
    { key: 'updated', label: 'Last Updated' },
    { key: 'part', label: 'Part Number' },
    { key: 'desc', label: 'Description' },
    { key: 'customer', label: 'Customer' },
    { key: 'minifactory', label: 'Minifactory' },
    { key: 'line', label: 'Line' },
    { key: 'stakeholder', label: 'Stakeholder' },
    { key: 'category', label: 'Issue Category' },
    { key: 'discussion', label: 'Stakeholder Input / Discussion' },
    { key: 'action', label: 'Action Being Taken' },
    { key: 'owner', label: 'Owner' },
    { key: 'target_date', label: 'Target Date' },
    { key: 'status', label: 'Status' },
    { key: 'criticality', label: 'Control Status' },
    { key: 'needs_escalation', label: 'Needs Escalation' },
    { key: 'escalation_details', label: 'Escalation Details' },
    { key: 'plan_val', label: 'Plan Value (INR) at entry' },
    { key: 'pending_val', label: 'Pending Value (INR) at entry' }
  ];

  const excelRows = comments.map(c => {
    const rowObj: Record<string, any> = {};
    headers.forEach(h => {
      rowObj[h.label] = (c as any)[h.key] ?? '';
    });
    return rowObj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Comments');
  XLSX.writeFile(wb, filename);
}
