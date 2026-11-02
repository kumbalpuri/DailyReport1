export type UnitMode = 'QTY' | 'INR' | 'LAKH' | `FX_${number}`;
export type BtsMode = 'WITH_BTS' | 'WITHOUT_BTS';
export type TabType = 'yesterday' | 'demand' | 'dispatch' | 'rmpm' | 'overview' | 'stock' | 'critical' | 'actions' | 'capacity';
export type YesterdaySubView = 'PROD' | 'DISPATCH' | 'RMPM' | 'SNAPSHOT' | 'MISSES' | 'ALL' | 'FG';
export type PopoutReportMode = 'DEMAND' | 'DISPATCH' | 'YESTERDAY';

export interface CalendarRow {
  date: string;
  weekday: string;
  is_working: number;
}

export interface FxRate {
  from: string;
  to: string;
  rate: number;
}

export interface Mb51DateSummary {
  iso: string;
  display: string;
  disp_qty: number;
  prod_qty: number;
  rm_qty: number;
}

export interface DashboardMeta {
  cutoff_date: string;
  latest_date_iso: string;
  mb51_dates: Mb51DateSummary[];
  total_working_days: number;
  elapsed_working_days: number;
  remaining_working_days: number;
  prorata_pct: number;
  fx_list: FxRate[];
  minifactories: string[];
  lines: string[];
  customers: string[];
}

export interface DemandRow {
  sr_no: string;
  part: string;
  desc: string;
  products: string;
  customer: string;
  line: string;
  minifactory: string;
  type: string;
  price: number;
  plan_with_bts_qty: number;
  plan_with_bts_val: number;
  plan_without_bts_qty: number;
  plan_without_bts_val: number;
  bts_qty: number;
  bts_val: number;
  prod_td_qty: number;
  prod_td_val: number;
  stock_total_qty: number;
  stock_total_val: number;
  stock_unrest_qty: number;
  stock_qual_qty: number;
  yest_prod_qty: number;
  yest_prod_val: number;
  yest_disp_601_qty: number;
  yest_disp_601_val: number;
  yest_disp_641_qty: number;
  yest_disp_641_val: number;
  yest_disp_qty: number;
  yest_disp_val: number;
  disp_601_qty: number;
  disp_601_val: number;
  disp_641_qty: number;
  disp_641_val: number;
  total_disp_qty: number;
  total_disp_val: number;
  sheet_remarks: string;
}

export interface RmpmPartRow {
  part: string;
  desc: string;
  line: string;
  minifactory: string;
  type: string;
  unit_val: number;
  sched_yest_qty: number;
  sched_yest_val: number;
  yest_grn_qty: number;
  yest_grn_val: number;
  yest_gap_qty: number;
  yest_gap_val: number;
  sched_total_qty: number;
  sched_total_val: number;
  grn_qty: number;
  grn_val: number;
  gap_total_qty: number;
  gap_total_val: number;
  unrest_qty: number;
  unrest_val: number;
  qual_qty: number;
  qual_val: number;
  total_stock_qty: number;
  total_stock_val: number;
  supplier: string;
}

export interface VendorScheduleRow {
  part: string;
  desc: string;
  date: string;
  line: string;
  minifactory: string;
  type: string;
  unit_val: number;
  sched_qty: number;
  sched_val: number;
  grn_qty: number;
  grn_val: number;
}

export interface Mb51Row {
  date: string;
  part: string;
  desc: string;
  mvt: number;
  line: string;
  minifactory: string;
  type: string;
  qty: number;
  val: number;
  price_val: number;
  supplier: string;
  customer: string;
  po: string;
  doc: string;
}

export interface Mb52Row {
  part: string;
  desc: string;
  line: string;
  minifactory: string;
  type: string;
  price: number;
  unrest_qty: number;
  unrest_val: number;
  qual_qty: number;
  qual_val: number;
  total_qty: number;
  total_val: number;
  block_qty: number;
  block_val: number;
  trans_qty: number;
  trans_val: number;
}

export interface CommentRecord {
  id: string;
  created: string;
  updated: string;
  part: string;
  desc: string;
  customer: string;
  minifactory: string;
  line: string;
  stakeholder: string;
  category: string;
  discussion: string;
  action: string;
  owner: string;
  target_date: string;
  status: 'Open' | 'In Progress' | 'Closed' | string;
  criticality: 'Critical' | 'Normal' | string;
  needs_escalation: 'Yes' | 'No' | string;
  escalation_details: string;
  plan_val: number;
  pending_val: number;
}

export interface CalculatedPartMetrics {
  planQ: number;
  planV: number;
  ttdQ: number;
  ttdV: number;
  prodQ: number;
  prodV: number;
  pendQ: number;
  pendV: number;
  runRateQ: number;
  runRateV: number;
  askRateQ: number;
  askRateV: number;
  yestPlanQ: number;
  yestPlanV: number;
  pctAchTd: number;
  pctAchMon: number;
  pctYestProd: number;
  pctYestDisp: number;
  remStr: string;
}

export interface CalculatedDispatchMetrics {
  planQ: number;
  planV: number;
  ttdQ: number;
  ttdV: number;
  dispQ: number;
  dispV: number;
  disp601Q: number;
  disp601V: number;
  disp641Q: number;
  disp641V: number;
  pendDispQ: number;
  pendDispV: number;
  runRateQ: number;
  runRateV: number;
  askRateQ: number;
  askRateV: number;
  yestPlanQ: number;
  yestPlanV: number;
  pctAchTd: number;
  pctAchMon: number;
  pctYestDisp: number;
  stockCoverDays: number;
  remStr: string;
}

export interface FullDashboardPayload {
  meta: DashboardMeta;
  calendar: CalendarRow[];
  demand: DemandRow[];
  rmpm_parts: RmpmPartRow[];
  vendor_schedule: VendorScheduleRow[];
  mb51: Mb51Row[];
  mb52: Mb52Row[];
  comments: CommentRecord[];
}

export interface ProductCapacityConfig {
  part: string;
  capacity_per_hour: number;
}

export interface ProductCapacityMetrics {
  part: string;
  desc: string;
  customer: string;
  minifactory: string;
  line: string;
  planQ: number;
  prodQ: number;
  pendingQ: number;
  askRateQ: number;
  capacityPerHour: number;
  dailyHoursRequired: number;
  dailyShiftsRequired: number;
  totalShiftsRequired: number;
  daysRequiredAt3Shifts: number;
  exceeds3Shifts: boolean;
}

export interface LineCapacityMetrics {
  line: string;
  minifactory: string;
  productCount: number;
  products: ProductCapacityMetrics[];
  totalDailyVolume: number;
  totalDailyHoursRequired: number;
  totalDailyShiftsRequired: number;
  availableDailyShifts: number; // 3.0
  availableDailyHours: number; // 21.75
  utilizationPct: number;
  bufferShifts: number; // available - required
  bufferHours: number;
  isOverCapacity: boolean; // totalDailyShiftsRequired > 3.0
}
