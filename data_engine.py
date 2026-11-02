import os
import datetime
import pandas as pd
import numpy as np

import config
from utils import resolve_exact_file, find_col, clean_part, to_num, clean_str
from comments_engine import get_comments_lock, load_comments

# Support pandas itertuples accessing DataFrame columns with leading underscores (e.g. _clean_part)
_orig_itertuples = pd.DataFrame.itertuples


def _patched_itertuples(self, index=True, name="Pandas"):
    it = _orig_itertuples(self, index=index, name=name)
    if name is not None:
        first = next(it, None)
        if first is not None:
            cls = type(first)
            cols = list(self.columns)
            if index:
                cols = ["Index"] + cols
            for idx, col in enumerate(cols):
                if str(col).startswith("_") and not hasattr(cls, col):
                    setattr(cls, col, property(lambda self, i=idx: self[i]))
            yield first
            yield from it
    else:
        yield from it


pd.DataFrame.itertuples = _patched_itertuples


def build_strict_data(input_dir=None):
    active_input_dir = input_dir or config.INPUT_DIR
    print("=" * 78)
    print(" READING EXACT INPUT FILES FROM:", active_input_dir)
    print("=" * 78)

    paths = {k: resolve_exact_file(active_input_dir, v) for k, v in config.EXACT_FILES.items()}
    for k, p in paths.items():
        print(f" [LOADED] {k.upper():<10} -> {os.path.basename(p)}")

    df_cal = pd.read_excel(paths["calendar"])
    df_demand = pd.read_excel(paths["demand"])
    df_fx = pd.read_excel(paths["exchange"])
    df_master = pd.read_excel(paths["master"])
    df_mb51 = pd.read_excel(paths["mb51"])
    df_mb52 = pd.read_excel(paths["mb52"])
    df_price = pd.read_excel(paths["price"])
    df_vendor = pd.read_excel(paths["vendor"])

    # 1. MASTER.XLSX
    c_m_part = find_col(df_master, ["Part Number", "Part #", "Material Number", "Material"], required=True, file_label="Master.xlsx")
    c_m_desc = find_col(df_master, ["Description", "Material Description"], file_label="Master.xlsx")
    c_m_line = find_col(df_master, ["Line"], file_label="Master.xlsx")
    c_m_mf = find_col(df_master, ["Minifactory", "Mini Factory", "Mini-Factory"], file_label="Master.xlsx")
    c_m_type = find_col(df_master, ["Type"], required=True, file_label="Master.xlsx")

    master = pd.DataFrame({
        "Part": clean_part(df_master[c_m_part]),
        "Description": clean_str(df_master[c_m_desc]) if c_m_desc else "",
        "Line": clean_str(df_master[c_m_line]) if c_m_line else "",
        "Minifactory": clean_str(df_master[c_m_mf]) if c_m_mf else "",
        "Type": clean_str(df_master[c_m_type]).str.upper(),
    })
    master = master[master["Part"] != ""].drop_duplicates(subset=["Part"], keep="first").copy()

    # 2. PRICE.XLSX
    c_p_part = find_col(df_price, ["Part #", "Part Number", "Material Number", "Material"], required=True, file_label="Price.xlsx")
    c_p_val = find_col(df_price, ["Sales price / Unit", "Sales price", "Price"], required=True, file_label="Price.xlsx")
    c_p_name = find_col(df_price, ["Product name", "Description", "Products"], file_label="Price.xlsx")

    price = pd.DataFrame({
        "Part": clean_part(df_price[c_p_part]),
        "Unit_Price": to_num(df_price[c_p_val]),
        "Product_Name": clean_str(df_price[c_p_name]) if c_p_name else "",
    })
    price = price[price["Part"] != ""].drop_duplicates(subset=["Part"], keep="first").copy()

    master = pd.merge(master, price[["Part", "Unit_Price", "Product_Name"]], on="Part", how="left")
    master["Unit_Price"] = master["Unit_Price"].fillna(0.0)
    master["Product_Name"] = clean_str(master["Product_Name"])
    master["Description"] = np.where(master["Description"] != "", master["Description"], master["Product_Name"])

    price_map = dict(zip(price["Part"], price["Unit_Price"]))
    price_desc_map = dict(zip(price["Part"], price["Product_Name"]))
    master_map = master.set_index("Part").to_dict(orient="index")

    # 3. EXCHANGE RATE.XLSX
    c_fx_from = find_col(df_fx, ["From"], required=True, file_label="Exchange Rate.xlsx")
    c_fx_to = find_col(df_fx, ["To"], file_label="Exchange Rate.xlsx")
    c_fx_rate = find_col(df_fx, ["Exchange Rate", "Rate"], required=True, file_label="Exchange Rate.xlsx")

    fx_list = []
    for _, r in df_fx.iterrows():
        f_curr = str(r[c_fx_from]).strip() if pd.notna(r[c_fx_from]) else ""
        t_curr = str(r[c_fx_to]).strip() if (c_fx_to and pd.notna(r[c_fx_to])) else ""
        rate_val = float(to_num(pd.Series([r[c_fx_rate]])).iloc[0])
        if f_curr and rate_val > 0:
            fx_list.append({"from": f_curr, "to": t_curr, "rate": rate_val})

    # 4. CALENDAR.XLSX
    c_cal_date = find_col(df_cal, ["Date"], required=True, file_label="Calendar.xlsx")
    c_cal_wday = find_col(df_cal, ["Weekday"], file_label="Calendar.xlsx")
    c_cal_work = find_col(df_cal, ["Is_Working", "Is Working"], required=True, file_label="Calendar.xlsx")

    df_cal["Date_Obj"] = pd.to_datetime(df_cal[c_cal_date], errors="coerce")
    df_cal = df_cal.dropna(subset=["Date_Obj"]).sort_values("Date_Obj").copy()
    df_cal["Date_Str"] = df_cal["Date_Obj"].dt.strftime("%Y-%m-%d")
    df_cal["Weekday_Str"] = clean_str(df_cal[c_cal_wday]) if c_cal_wday else df_cal["Date_Obj"].dt.strftime("%a")
    df_cal["Is_Working_Int"] = to_num(df_cal[c_cal_work]).astype(int)

    calendar_rows = [
        {"date": r["Date_Str"], "weekday": r["Weekday_Str"], "is_working": int(r["Is_Working_Int"])}
        for _, r in df_cal.iterrows()
    ]
    total_working_days = int((df_cal["Is_Working_Int"] == 1).sum())

    # 5. MB51.XLSX
    c_t_part = c_mb_part = find_col(df_mb51, ["Material", "Material Number", "Part #", "Part Number"], required=True, file_label="Mb51.xlsx")
    c_t_mvt = c_mb_mvt = find_col(df_mb51, ["MvT", "Movement Type"], required=True, file_label="Mb51.xlsx")
    c_t_qty = c_mb_qty = find_col(df_mb51, ["Quantity in UnE", "Quantity", "Qty"], required=True, file_label="Mb51.xlsx")
    c_t_amt = c_mb_val = find_col(df_mb51, ["Amt.in loc.cur.", "Amount in LC", "Amount"], file_label="Mb51.xlsx")
    c_t_pdate = c_mb_date = find_col(df_mb51, ["Pstng Date", "Posting Date", "Doc. Date"], required=True, file_label="Mb51.xlsx")
    c_t_supp = find_col(df_mb51, ["Supplier", "Vendor"], file_label="Mb51.xlsx")
    c_t_cust = find_col(df_mb51, ["Customer"], file_label="Mb51.xlsx")
    c_t_po = find_col(df_mb51, ["PO"], file_label="Mb51.xlsx")
    c_t_doc = find_col(df_mb51, ["Mat. Doc.", "Mat Doc"], file_label="Mb51.xlsx")
    if not c_mb_val:
        df_mb51["_sap_val_fallback"] = 0.0
        c_mb_val = "_sap_val_fallback"

    mb51 = pd.DataFrame()
    mb51["Part"] = clean_part(df_mb51[c_t_part])
    mb51["MvT"] = to_num(df_mb51[c_t_mvt]).astype(int)
    raw_q = to_num(df_mb51[c_t_qty])
    raw_a = to_num(df_mb51[c_t_amt]) if c_t_amt else pd.Series(0.0, index=df_mb51.index)

    mb51["Qty"] = np.where(
        mb51["MvT"].isin([102, 602]), -np.abs(raw_q),
        np.where(mb51["MvT"].isin([101, 601, 641]), np.abs(raw_q), raw_q)
    )
    mb51["SAP_Amt"] = np.where(
        mb51["MvT"].isin([102, 602]), -np.abs(raw_a),
        np.where(mb51["MvT"].isin([101, 601, 641]), np.abs(raw_a), raw_a)
    )
    mb51["Date_Obj"] = pd.to_datetime(df_mb51[c_t_pdate], errors="coerce")
    mb51["Date"] = mb51["Date_Obj"].dt.strftime("%Y-%m-%d").fillna("")
    mb51["Supplier"] = clean_str(df_mb51[c_t_supp]) if c_t_supp else ""
    mb51["Customer"] = clean_str(df_mb51[c_t_cust]) if c_t_cust else ""
    mb51["PO"] = clean_str(df_mb51[c_t_po]) if c_t_po else ""
    mb51["Mat_Doc"] = clean_str(df_mb51[c_t_doc]) if c_t_doc else ""

    mb51 = mb51[mb51["MvT"].isin([101, 102, 601, 602, 641]) & (mb51["Part"] != "")].copy()
    mb51 = pd.merge(
        mb51,
        master[["Part", "Description", "Line", "Minifactory", "Type", "Unit_Price"]],
        on="Part",
        how="left"
    )
    mb51["Description"] = clean_str(mb51["Description"])
    mb51["Line"] = clean_str(mb51["Line"])
    mb51["Minifactory"] = clean_str(mb51["Minifactory"])
    mb51["Type"] = clean_str(mb51["Type"])
    mb51["Unit_Price"] = mb51["Part"].map(price_map).fillna(mb51["Unit_Price"]).fillna(0.0)
    mb51["Price_Master_Val"] = mb51["Qty"] * mb51["Unit_Price"]
    mb51["Value"] = np.where(mb51["Unit_Price"] > 0, mb51["Price_Master_Val"], mb51["SAP_Amt"])

    # Summarize transaction dates in one pass; the latest posting date remains
    # the report date even when that day has no dispatch transactions.
    date_summary_source = mb51.assign(
        Dispatch_Qty=np.where(mb51["MvT"].isin([601, 602, 641]), mb51["Qty"], 0.0),
        FG_Prod_Qty=np.where(
            mb51["MvT"].isin([101, 102]) & (mb51["Type"] != "RMPM"),
            mb51["Qty"],
            0.0,
        ),
        RMPM_Receipt_Qty=np.where(
            mb51["MvT"].isin([101, 102]) & (mb51["Type"] == "RMPM"),
            mb51["Qty"],
            0.0,
        ),
    )
    dates_grouped = date_summary_source[date_summary_source["Date"] != ""].groupby("Date").agg(
        disp_qty=("Dispatch_Qty", "sum"),
        prod_qty=("FG_Prod_Qty", "sum"),
        rm_qty=("RMPM_Receipt_Qty", "sum"),
    )
    mb51_dates_summary = [
        {
            "iso": d_iso,
            "display": datetime.datetime.strptime(d_iso, "%Y-%m-%d").strftime("%d-%m-%Y"),
            "disp_qty": round(float(row["disp_qty"]), 2),
            "prod_qty": round(float(row["prod_qty"]), 2),
            "rm_qty": round(float(row["rm_qty"]), 2),
        }
        for d_iso, row in dates_grouped.sort_index().iterrows()
    ]

    unique_dates = dates_grouped.index.tolist()
    selected_yest_iso = unique_dates[-1] if unique_dates else ""

    latest_mb51_date = pd.to_datetime(selected_yest_iso) if selected_yest_iso else None
    if latest_mb51_date is not None and not df_cal.empty:
        elapsed_working_days = int(df_cal[df_cal["Date_Obj"] <= latest_mb51_date]["Is_Working_Int"].eq(1).sum())
        cutoff_str = latest_mb51_date.strftime("%d-%m-%Y")
    else:
        elapsed_working_days = total_working_days
        cutoff_str = df_cal["Date_Obj"].max().strftime("%d-%m-%Y") if not df_cal.empty else ""

    remaining_working_days = max(0, total_working_days - elapsed_working_days)
    prorata_ratio = (elapsed_working_days / total_working_days) if total_working_days > 0 else 1.0

    # 6. MB52.XLSX
    c_s_part = find_col(df_mb52, ["Material Number", "Material", "Part Number", "Part #"], required=True, file_label="MB52.xlsx")
    c_s_desc = find_col(df_mb52, ["Material Description", "Description"], file_label="MB52.xlsx")
    c_s_sloc = find_col(df_mb52, ["SLoc"], file_label="MB52.xlsx")
    c_s_unr_q = find_col(df_mb52, ["Unrestricted"], required=True, file_label="MB52.xlsx")
    c_s_unr_v = find_col(df_mb52, ["Value Unrestricted"], file_label="MB52.xlsx")
    c_s_qa_q = find_col(df_mb52, ["In Quality Insp.", "In Quality Insp"], required=True, file_label="MB52.xlsx")
    c_s_qa_v = find_col(df_mb52, ["Value in QualInsp.", "Value in QualInsp"], file_label="MB52.xlsx")
    c_s_blk_q = find_col(df_mb52, ["Blocked"], file_label="MB52.xlsx")
    c_s_blk_v = find_col(df_mb52, ["Value BlockedStock"], file_label="MB52.xlsx")
    c_s_trn_q = find_col(df_mb52, ["Transit/Transf.", "Stock in Transit"], file_label="MB52.xlsx")
    c_s_trn_v = find_col(df_mb52, ["Val. in Trans./Tfr", "Value in Transit"], file_label="MB52.xlsx")

    mb52 = pd.DataFrame({
        "Part": clean_part(df_mb52[c_s_part]),
        "MB52_Desc": clean_str(df_mb52[c_s_desc]) if c_s_desc else "",
        "SLoc": clean_str(df_mb52[c_s_sloc]) if c_s_sloc else "",
        "Unrestricted_Qty": to_num(df_mb52[c_s_unr_q]),
        "Unrestricted_SAP_Val": to_num(df_mb52[c_s_unr_v]) if c_s_unr_v else 0.0,
        "Quality_Qty": to_num(df_mb52[c_s_qa_q]),
        "Quality_SAP_Val": to_num(df_mb52[c_s_qa_v]) if c_s_qa_v else 0.0,
        "Blocked_Qty": to_num(df_mb52[c_s_blk_q]) if c_s_blk_q else 0.0,
        "Blocked_SAP_Val": to_num(df_mb52[c_s_blk_v]) if c_s_blk_v else 0.0,
        "Transit_Qty": to_num(df_mb52[c_s_trn_q]) if c_s_trn_q else 0.0,
        "Transit_SAP_Val": to_num(df_mb52[c_s_trn_v]) if c_s_trn_v else 0.0,
    })
    mb52["Total_Stock_Qty"] = mb52["Unrestricted_Qty"] + mb52["Quality_Qty"]
    mb52["Total_Stock_SAP_Val"] = mb52["Unrestricted_SAP_Val"] + mb52["Quality_SAP_Val"]
    mb52 = mb52[mb52["Part"] != ""].copy()

    mb52 = pd.merge(mb52, master[["Part", "Description", "Line", "Minifactory", "Type", "Unit_Price"]], on="Part", how="left")
    mb52["Description"] = clean_str(mb52["Description"])
    mb52["Description"] = np.where(mb52["Description"] != "", mb52["Description"], mb52["MB52_Desc"])
    mb52["Line"] = clean_str(mb52["Line"])
    mb52["Minifactory"] = clean_str(mb52["Minifactory"])
    mb52["Type"] = clean_str(mb52["Type"])
    mb52["Unit_Price"] = mb52["Part"].map(price_map).fillna(mb52["Unit_Price"]).fillna(0.0)

    mb52["Unrestricted_Val"] = np.where(mb52["Unit_Price"] > 0, mb52["Unrestricted_Qty"] * mb52["Unit_Price"], mb52["Unrestricted_SAP_Val"])
    mb52["Quality_Val"] = np.where(mb52["Unit_Price"] > 0, mb52["Quality_Qty"] * mb52["Unit_Price"], mb52["Quality_SAP_Val"])
    mb52["Blocked_Val"] = np.where(mb52["Unit_Price"] > 0, mb52["Blocked_Qty"] * mb52["Unit_Price"], mb52["Blocked_SAP_Val"])
    mb52["Transit_Val"] = np.where(mb52["Unit_Price"] > 0, mb52["Transit_Qty"] * mb52["Unit_Price"], mb52["Transit_SAP_Val"])
    mb52["Total_Stock_Val"] = mb52["Unrestricted_Val"] + mb52["Quality_Val"]

    mb52_by_part = mb52.groupby("Part", as_index=False).agg({
        "Description": "first", "Line": "first", "Minifactory": "first", "Type": "first", "Unit_Price": "first",
        "Unrestricted_Qty": "sum", "Unrestricted_Val": "sum", "Quality_Qty": "sum", "Quality_Val": "sum",
        "Blocked_Qty": "sum", "Blocked_Val": "sum", "Transit_Qty": "sum", "Transit_Val": "sum",
        "Total_Stock_Qty": "sum", "Total_Stock_Val": "sum",
    })
    stock_lookup = mb52_by_part.set_index("Part").to_dict(orient="index")

    # 7. DEMAND.XLSX
    c_d_sr = find_col(df_demand, ["Sr No", "Sr. No", "S.No"], file_label="Demand.xlsx")
    c_d_prod = find_col(df_demand, ["Products", "Product", "Description"], file_label="Demand.xlsx")
    c_d_cust = find_col(df_demand, ["Customer"], file_label="Demand.xlsx")
    c_d_part = find_col(df_demand, ["Part #", "Part Number", "Material"], required=True, file_label="Demand.xlsx")
    c_d_plan = find_col(df_demand, ["Production plan", "Production Plan", "Sep Production plan", "Monthly Plan", "Oct Production plan", "Plan"], file_label="Demand.xlsx")
    c_d_bts = find_col(df_demand, ["BTS Min", "BTS", "Build to Stock"], file_label="Demand.xlsx")
    c_d_tgt = find_col(df_demand, ["Target 100%", "Target"], file_label="Demand.xlsx")
    c_d_rem = find_col(df_demand, ["Remarks", "Remark"], file_label="Demand.xlsx")

    mb51_prod_df = mb51[mb51["MvT"].isin([101, 102])]
    mb51_prod_map = mb51_prod_df.groupby("Part")["Qty"].sum().to_dict()
    mb51_val_map = mb51_prod_df.groupby("Part")["Value"].sum().to_dict()

    mb51_601_df = mb51[mb51["MvT"].isin([601, 602])]
    mb51_601_map = mb51_601_df.groupby("Part")["Qty"].sum().to_dict()

    mb51_641_df = mb51[mb51["MvT"] == 641]
    mb51_641_map = mb51_641_df.groupby("Part")["Qty"].sum().to_dict()

    # --- OPTIMIZED YESTERDAY MB51 AGGREGATION (SINGLE PASS + SMART DATE FALLBACK) ---
    # Standardize posting dates once
    mb51_dates = pd.to_datetime(df_mb51[c_mb_date], errors="coerce").dt.date
    target_yest_date = (pd.Timestamp.today() - pd.Timedelta(days=1)).date()

    # If target yesterday has no 101/102/601/641 movements (e.g., Sunday/Holiday),
    # automatically fall back to the latest active posting date in MB51
    valid_dates = mb51_dates.dropna()
    if valid_dates.empty:
        active_yest_date = target_yest_date
    elif (mb51_dates == target_yest_date).any():
        active_yest_date = target_yest_date
    else:
        active_yest_date = valid_dates.max()

    yest_date_label = active_yest_date.strftime("%d-%b-%Y")
    df_yest = df_mb51[mb51_dates == active_yest_date].copy()

    # Single groupby for 101/102 (Production), 601 (Customer Dispatch), 641 (STO Dispatch)
    yest_prod_q_map, yest_prod_v_map = {}, {}
    yest_601_q_map, yest_601_v_map = {}, {}
    yest_641_q_map, yest_641_v_map = {}, {}

    if not df_yest.empty:
        # Ensure 102 reversals subtract if not already negative in MB51
        mvt_series = df_yest[c_mb_mvt].astype(str).str.strip()
        qty_series = pd.to_numeric(df_yest[c_mb_qty], errors="coerce").fillna(0.0)
        val_series = pd.to_numeric(df_yest[c_mb_val], errors="coerce").fillna(0.0)

        # Normalize 102 sign if positive in raw export
        is_102_pos = (mvt_series == "102") & (qty_series > 0)
        qty_series = np.where(is_102_pos, -qty_series, qty_series)
        val_series = np.where(is_102_pos, -val_series, val_series)

        df_yest["_clean_part"] = clean_str(df_yest[c_mb_part])
        df_yest["_mvt_group"] = mvt_series.map({
            "101": "PROD", "102": "PROD",
            "601": "601", "602": "601",
            "641": "641", "642": "641"
        })
        df_yest["_qty"] = qty_series
        df_yest["_val"] = val_series

        y_grp = (
            df_yest.dropna(subset=["_mvt_group"])
            .groupby(["_clean_part", "_mvt_group"], as_index=False)[["_qty", "_val"]]
            .sum()
        )

        for r_y in y_grp.itertuples(index=False):
            p_code, m_grp, q_val, v_val = r_y._clean_part, r_y._mvt_group, float(r_y._qty), float(r_y._val)
            if m_grp == "PROD":
                yest_prod_q_map[p_code] = q_val
                yest_prod_v_map[p_code] = v_val
            elif m_grp == "601":
                yest_601_q_map[p_code] = abs(q_val)
                yest_601_v_map[p_code] = abs(v_val)
            elif m_grp == "641":
                yest_641_q_map[p_code] = abs(q_val)
                yest_641_v_map[p_code] = abs(v_val)

    demand_rows = []
    for idx, r in df_demand.iterrows():
        part_no = clean_part(pd.Series([r[c_d_part]])).iloc[0]
        if not part_no:
            continue

        m_info = master_map.get(part_no, {})
        s_info = stock_lookup.get(part_no, {})
        u_price = float(price_map.get(part_no, m_info.get("Unit_Price", 0.0)))

        raw_plan = float(to_num(pd.Series([r[c_d_plan]])).iloc[0]) if c_d_plan else 0.0
        raw_bts = float(to_num(pd.Series([r[c_d_bts]])).iloc[0]) if c_d_bts else 0.0
        raw_tgt = float(to_num(pd.Series([r[c_d_tgt]])).iloc[0]) if c_d_tgt else 0.0

        plan_with_bts_q = raw_plan if raw_plan > 0 else raw_tgt
        plan_without_bts_q = max(0.0, plan_with_bts_q - raw_bts)

        prod_td_q = float(mb51_prod_map.get(part_no, 0.0))
        prod_td_v = prod_td_q * u_price if u_price > 0 else float(mb51_val_map.get(part_no, 0.0))

        curr_stock_q = float(s_info.get("Total_Stock_Qty", 0.0))
        curr_stock_v = curr_stock_q * u_price if u_price > 0 else float(s_info.get("Total_Stock_Val", 0.0))

        yest_prod_q = float(yest_prod_q_map.get(part_no, 0.0))
        yest_601_q = float(yest_601_q_map.get(part_no, 0.0))
        yest_641_q = float(yest_641_q_map.get(part_no, 0.0))
        yest_disp_q = yest_601_q + yest_641_q

        disp_601_q = float(mb51_601_map.get(part_no, 0.0))
        disp_641_q = float(mb51_641_map.get(part_no, 0.0))

        demand_prod_str = clean_str(pd.Series([r[c_d_prod]])).iloc[0] if c_d_prod else ""
        master_desc_str = m_info.get("Description", "") or s_info.get("Description", "") or price_desc_map.get(part_no, "")
        material_desc = master_desc_str if master_desc_str else (demand_prod_str if demand_prod_str else part_no)
        display_desc = demand_prod_str if demand_prod_str else material_desc

        demand_rows.append({
            "sr_no": clean_str(pd.Series([r[c_d_sr]])).iloc[0] if c_d_sr else str(idx + 1),
            "part": part_no,
            "desc": material_desc,
            "products": display_desc,
            "customer": clean_str(pd.Series([r[c_d_cust]])).iloc[0] if c_d_cust else "",
            "line": m_info.get("Line", ""),
            "minifactory": m_info.get("Minifactory", ""),
            "type": m_info.get("Type", "FG"),
            "price": round(u_price, 4),
            "plan_with_bts_qty": round(plan_with_bts_q, 2),
            "plan_with_bts_val": round(plan_with_bts_q * u_price, 2),
            "plan_without_bts_qty": round(plan_without_bts_q, 2),
            "plan_without_bts_val": round(plan_without_bts_q * u_price, 2),
            "bts_qty": round(raw_bts, 2),
            "bts_val": round(raw_bts * u_price, 2),
            "prod_td_qty": round(prod_td_q, 2),
            "prod_td_val": round(prod_td_v, 2),
            "stock_total_qty": round(curr_stock_q, 2),
            "stock_total_val": round(curr_stock_v, 2),
            "stock_unrest_qty": round(float(s_info.get("Unrestricted_Qty", 0.0)), 2),
            "stock_qual_qty": round(float(s_info.get("Quality_Qty", 0.0)), 2),
            "yest_prod_qty": round(yest_prod_q, 2),
            "yest_prod_val": round(yest_prod_q * u_price, 2),
            "yest_disp_601_qty": round(yest_601_q, 2),
            "yest_disp_601_val": round(yest_601_q * u_price, 2),
            "yest_disp_641_qty": round(yest_641_q, 2),
            "yest_disp_641_val": round(yest_641_q * u_price, 2),
            "yest_disp_qty": round(yest_disp_q, 2),
            "yest_disp_val": round(yest_disp_q * u_price, 2),
            "disp_601_qty": round(disp_601_q, 2),
            "disp_601_val": round(disp_601_q * u_price, 2),
            "disp_641_qty": round(disp_641_q, 2),
            "disp_641_val": round(disp_641_q * u_price, 2),
            "total_disp_qty": round(disp_601_q + disp_641_q, 2),
            "total_disp_val": round((disp_601_q + disp_641_q) * u_price, 2),
            "sheet_remarks": clean_str(pd.Series([r[c_d_rem]])).iloc[0] if c_d_rem else "",
        })

    # 8. VENDOR.XLSX
    c_v_part = find_col(df_vendor, ["Product", "Part Number", "Part #", "Material"], required=True, file_label="Vendor.xlsx")
    c_v_desc = find_col(df_vendor, ["Descrioption", "Description"], file_label="Vendor.xlsx")
    c_v_date = find_col(df_vendor, ["Date"], required=True, file_label="Vendor.xlsx")
    c_v_qty = find_col(df_vendor, ["Qty", "Quantity"], required=True, file_label="Vendor.xlsx")

    vendor = pd.DataFrame({
        "Part": clean_part(df_vendor[c_v_part]),
        "Vendor_Desc": clean_str(df_vendor[c_v_desc]) if c_v_desc else "",
        "Date_Obj": pd.to_datetime(df_vendor[c_v_date], errors="coerce"),
        "Sched_Qty": to_num(df_vendor[c_v_qty]),
    })
    vendor["Date"] = vendor["Date_Obj"].dt.strftime("%Y-%m-%d").fillna("")
    vendor = vendor[vendor["Part"] != ""].copy()

    vendor = pd.merge(vendor, master[["Part", "Description", "Line", "Minifactory", "Type", "Unit_Price"]], on="Part", how="left")
    vendor["Description"] = clean_str(vendor["Description"])
    vendor["Description"] = np.where(vendor["Description"] != "", vendor["Description"], vendor["Vendor_Desc"])
    vendor["Line"] = clean_str(vendor["Line"])
    vendor["Minifactory"] = clean_str(vendor["Minifactory"])
    vendor["Type"] = clean_str(vendor["Type"])

    vendor_rmpm = vendor[vendor["Type"] == "RMPM"].copy()
    if vendor_rmpm.empty:
        vendor_rmpm = vendor.copy()

    mb52_unit_val = {
        p_code: s_row["Total_Stock_Val"] / s_row["Total_Stock_Qty"]
        for p_code, s_row in stock_lookup.items()
        if s_row["Total_Stock_Qty"] > 0 and s_row["Total_Stock_Val"] > 0
    }
    mb51_unit_val = {}
    for p_code, grp in mb51[np.abs(mb51["Qty"]) > 0].groupby("Part"):
        q_sum, a_sum = np.abs(grp["Qty"]).sum(), np.abs(grp["SAP_Amt"]).sum()
        if q_sum > 0 and a_sum > 0:
            mb51_unit_val[p_code] = a_sum / q_sum

    def get_strict_unit_val(part_code):
        if price_map.get(part_code, 0.0) > 0:
            return float(price_map[part_code])
        if mb52_unit_val.get(part_code, 0.0) > 0:
            return float(mb52_unit_val[part_code])
        if mb51_unit_val.get(part_code, 0.0) > 0:
            return float(mb51_unit_val[part_code])
        return 0.0

    rmpm_daily_grn = mb51[mb51["MvT"].isin([101, 102])].groupby(["Part", "Date"], as_index=False).agg(GRN_Qty=("Qty", "sum"), GRN_Val=("Value", "sum"))
    grn_part_date_map = {(r["Part"], r["Date"]): (float(r["GRN_Qty"]), float(r["GRN_Val"])) for _, r in rmpm_daily_grn.iterrows()}

    vendor_schedule_rows = []
    for _, r in vendor_rmpm.iterrows():
        p_code, d_str = r["Part"], r["Date"]
        u_val = get_strict_unit_val(p_code)
        s_qty = float(r["Sched_Qty"])
        g_qty, g_val = grn_part_date_map.get((p_code, d_str), (0.0, 0.0))
        if g_val == 0.0 and g_qty != 0.0:
            g_val = g_qty * u_val
        vendor_schedule_rows.append({
            "part": p_code, "desc": r["Description"], "date": d_str, "line": r["Line"],
            "minifactory": r["Minifactory"], "type": r["Type"], "unit_val": round(u_val, 4),
            "sched_qty": round(s_qty, 2), "sched_val": round(s_qty * u_val, 2),
            "grn_qty": round(g_qty, 2), "grn_val": round(g_val, 2),
        })

    rmpm_master_df = master[master["Type"] == "RMPM"][["Part", "Description", "Line", "Minifactory", "Type"]].copy()
    vendor_unique_df = vendor_rmpm[["Part", "Description", "Line", "Minifactory", "Type"]].drop_duplicates("Part").copy()
    rmpm_combined_df = pd.concat([rmpm_master_df, vendor_unique_df], ignore_index=True).drop_duplicates("Part", keep="first")

    vendor_tot_by_part = vendor_rmpm.groupby("Part", as_index=False).agg(Sched_Total_Qty=("Sched_Qty", "sum"), Vendor_Desc=("Description", "first"))
    vendor_yest_by_part = vendor_rmpm[vendor_rmpm["Date"] == selected_yest_iso].groupby("Part")["Sched_Qty"].sum().to_dict() if selected_yest_iso else {}
    rmpm_grn_by_part = mb51[mb51["MvT"].isin([101, 102])].groupby("Part", as_index=False).agg(
        GRN_Qty=("Qty", "sum"), GRN_Val=("Value", "sum"), Supplier=("Supplier", lambda s: next((x for x in reversed(list(s)) if x), ""))
    )
    grn_part_lookup = rmpm_grn_by_part.set_index("Part").to_dict(orient="index")
    sched_part_lookup = vendor_tot_by_part.set_index("Part").to_dict(orient="index")

    rmpm_part_rows = []
    for _, r in rmpm_combined_df.iterrows():
        p_code = r["Part"]
        u_val = get_strict_unit_val(p_code)
        v_info = sched_part_lookup.get(p_code, {})
        g_info = grn_part_lookup.get(p_code, {})
        s_info = stock_lookup.get(p_code, {})

        sched_tot_q = float(v_info.get("Sched_Total_Qty", 0.0))
        sched_exact_yest_q = float(vendor_yest_by_part.get(p_code, 0.0))
        sched_yest_plan_q = sched_exact_yest_q if sched_exact_yest_q > 0 else (sched_tot_q / total_working_days if total_working_days > 0 else sched_tot_q)

        grn_q = float(g_info.get("GRN_Qty", 0.0))
        grn_v = float(g_info.get("GRN_Val", 0.0)) or (grn_q * u_val)
        yest_grn_q, yest_grn_v = grn_part_date_map.get((p_code, selected_yest_iso), (0.0, 0.0))
        if yest_grn_v == 0.0 and yest_grn_q != 0.0:
            yest_grn_v = yest_grn_q * u_val

        gap_tot_q = max(0.0, sched_tot_q - grn_q)
        gap_yest_q = max(0.0, sched_yest_plan_q - yest_grn_q)
        unr_q = float(s_info.get("Unrestricted_Qty", 0.0))
        qa_q = float(s_info.get("Quality_Qty", 0.0))
        tot_stk_q = float(s_info.get("Total_Stock_Qty", 0.0))
        tot_stk_v = float(s_info.get("Total_Stock_Val", tot_stk_q * u_val))

        rmpm_part_rows.append({
            "part": p_code,
            "desc": r["Description"] if r["Description"] else v_info.get("Vendor_Desc", p_code),
            "line": r["Line"],
            "minifactory": r["Minifactory"],
            "type": r["Type"] if r["Type"] else "RMPM",
            "unit_val": round(u_val, 4),
            "sched_yest_qty": round(sched_yest_plan_q, 2),
            "sched_yest_val": round(sched_yest_plan_q * u_val, 2),
            "yest_grn_qty": round(yest_grn_q, 2),
            "yest_grn_val": round(yest_grn_v, 2),
            "yest_gap_qty": round(gap_yest_q, 2),
            "yest_gap_val": round(gap_yest_q * u_val, 2),
            "sched_total_qty": round(sched_tot_q, 2),
            "sched_total_val": round(sched_tot_q * u_val, 2),
            "grn_qty": round(grn_q, 2),
            "grn_val": round(grn_v, 2),
            "gap_total_qty": round(gap_tot_q, 2),
            "gap_total_val": round(gap_tot_q * u_val, 2),
            "unrest_qty": round(unr_q, 2),
            "unrest_val": round(float(s_info.get("Unrestricted_Val", unr_q * u_val)), 2),
            "qual_qty": round(qa_q, 2),
            "qual_val": round(float(s_info.get("Quality_Val", qa_q * u_val)), 2),
            "total_stock_qty": round(tot_stk_q, 2),
            "total_stock_val": round(tot_stk_v, 2),
            "supplier": g_info.get("Supplier", ""),
        })

    mb51_rows = [
        {
            "date": r["Date"], "part": r["Part"], "desc": r["Description"], "mvt": int(r["MvT"]),
            "line": r["Line"], "minifactory": r["Minifactory"], "type": r["Type"],
            "qty": round(float(r["Qty"]), 2), "val": round(float(r["Value"]), 2),
            "price_val": round(float(r["Price_Master_Val"]), 2),
            "supplier": r["Supplier"], "customer": r["Customer"], "po": r["PO"], "doc": r["Mat_Doc"]
        }
        for _, r in mb51.iterrows()
    ]

    mb52_rows = [
        {
            "part": r["Part"], "desc": r["Description"], "line": r["Line"], "minifactory": r["Minifactory"], "type": r["Type"],
            "price": round(float(r["Unit_Price"]), 4), "unrest_qty": round(float(r["Unrestricted_Qty"]), 2), "unrest_val": round(float(r["Unrestricted_Val"]), 2),
            "qual_qty": round(float(r["Quality_Qty"]), 2), "qual_val": round(float(r["Quality_Val"]), 2),
            "total_qty": round(float(r["Total_Stock_Qty"]), 2), "total_val": round(float(r["Total_Stock_Val"]), 2),
            "block_qty": round(float(r["Blocked_Qty"]), 2), "block_val": round(float(r["Blocked_Val"]), 2),
            "trans_qty": round(float(r["Transit_Qty"]), 2), "trans_val": round(float(r["Transit_Val"]), 2),
        }
        for _, r in mb52_by_part.iterrows()
    ]

    minifactories = sorted({x["minifactory"] for x in demand_rows + rmpm_part_rows + mb52_rows if x["minifactory"]})
    lines = sorted({x["line"] for x in demand_rows + rmpm_part_rows + mb52_rows if x["line"]})
    customers = sorted({x["customer"] for x in demand_rows if x["customer"]})

    with get_comments_lock():
        initial_comments = load_comments()

    print(f" [VERIFIED] Default Yesterday Date: {cutoff_str} (Selected from {len(mb51_dates_summary)} MB51 dates)")
    return {
        "meta": {
            "cutoff_date": cutoff_str,
            "latest_date_iso": selected_yest_iso,
            "mb51_dates": mb51_dates_summary,
            "total_working_days": total_working_days,
            "elapsed_working_days": elapsed_working_days,
            "remaining_working_days": remaining_working_days,
            "prorata_pct": round(prorata_ratio * 100.0, 1),
            "fx_list": fx_list,
            "minifactories": minifactories,
            "lines": lines,
            "customers": customers,
        },
        "calendar": calendar_rows,
        "demand": demand_rows,
        "rmpm_parts": rmpm_part_rows,
        "vendor_schedule": vendor_schedule_rows,
        "mb51": mb51_rows,
        "mb52": mb52_rows,
        "comments": initial_comments,
    }
