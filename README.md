# KSPG Sales & Production Command Center

Enterprise daily review command center for automotive manufacturing sales, production planning, SAP MB51 material transactions, MB52 inventory stock, vendor schedules, critical finished goods (FG) control, and stakeholder action tracking.

## Core Features Ported & Re-architected in React

1. **Executive KPI Ribbon & Slicers**:
   - Production Plan with dynamic BTS modes (With BTS / Without BTS).
   - Production Till Date (MvT 101/102 Net) with % achievement vs Target Till Date (TTD) and Month-to-Date.
   - Asking Rate / Day calculation based on remaining working days in the calendar.
   - Dispatch tracking (Customer Dispatch MvT 601/602 + STO Transfer Dispatch MvT 641).
   - MB52 Inventory Stock (Unrestricted vs Quality Inspection vs Blocked vs Transit).
   - Monitored Raw Material (RMPM) & Vendor Schedule Adherence with shortfall gap tracking.
   - Interactive Yesterday Date picker with automatic dynamic recalculation of elapsed working days, pro-rata percentage, and day metrics.
   - Currency and Unit Switcher (Quantity in Units, INR ₹, Lakhs ₹ L, and Foreign Exchange rates USD/EUR).

2. **The 7 Command Center Tabs**:
   - **1. Yesterday Performance**: 3 left metric pillars (Dispatch value in Million INR, Net production with gross receipts vs reversals, and key RMPM receipts) paired with the interactive Yesterday Performance Workbench (All 4 Pillars, Prod & Dispatch, RM & Vendor).
   - **2. Monthly Demand & Asking Rate**: Material-wise plan vs TTD vs Prod combo chart, Line-wise run rate vs asking rate combo chart, and full Automated Production & Demand Review Report table.
   - **3. RMPM Supplier & Stock**: Daily supplier schedule vs MB51 GRN combo chart, monitored RMPM schedule vs received vs stock chart, and switchable Part Summary and Date-Wise Schedule tables.
   - **4. Minifactory & S&OP Overview**: 4 interactive SVG combo charts for Minifactories (clickable filter), MB51 daily trends, Customers (clickable filter), and RMPM performance.
   - **5. MB52 Stock & MB51 Ledger**: Stock breakdown charts and switchable MB52 All, MB52 RMPM, MB52 FG, and MB51 movement ledger.
   - **6. Critical FG Review**: Ranked by pending production value with coverage analysis, top-N filter, control status toggle pill (Focus vs Normal), inline expandable logs, and drilldown triggers.
   - **7. Action Tracker & Follow-up**: Sorted by target date with automated urgency flags (Overdue, Due Today, In X Days, Closed), quick status changer, and drilldown integration.

3. **Interactive Modals & Workflow Tools**:
   - **Popout Report Modal**: Fullscreen multi-filter report with multi-select checkboxes for Minifactory, Line, Customer, and Performance Status.
   - **Critical FG Drilldown Modal**: 6 part KPIs, daily MB51 trend chart with Value/Quantity toggle, stock and RM gaps table, stakeholder discussion form with auto-save to browser storage, and discussion history table with edit and delete.
   - **Deficit Highlighter**: Visual crosshair row highlighting, ⚡ Auto-highlight deficits button, and Clear.
   - **Data & Excel Management**: Drag-and-drop Excel (`.xlsx`) or JSON import, Excel comments log exporter, and reset to demo data.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Excel Engine**: SheetJS (XLSX)
- **Dev Server**: Vite (port 3000, 0.0.0.0)
