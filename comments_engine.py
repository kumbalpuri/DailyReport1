import os
import re
import threading
import datetime
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment

import config

_comments_lock = threading.Lock()


def get_comments_lock():
    return _comments_lock


def _read_excel_comments(path):
    if not os.path.exists(path):
        return []
    wb = load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return []
    hdr = [str(h).strip() if h is not None else "" for h in rows[0]]
    label_to_key = {lbl.lower(): key for key, lbl in config.COMMENT_COLS}
    label_to_key["boss help needed"] = "needs_escalation"
    label_to_key["help details"] = "escalation_details"

    out = []
    for row in rows[1:]:
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        rec = {k: "" for k, _ in config.COMMENT_COLS}
        for h, v in zip(hdr, row):
            k = label_to_key.get(h.lower())
            if not k:
                continue
            if v is None:
                rec[k] = ""
            elif hasattr(v, "strftime"):
                has_time = bool(getattr(v, "hour", 0) or getattr(v, "minute", 0) or getattr(v, "second", 0))
                rec[k] = v.strftime("%Y-%m-%d %H:%M:%S" if has_time else "%Y-%m-%d")
            else:
                rec[k] = str(v).strip()
        rec["part"] = re.sub(r"\.0$", "", rec["part"]).strip()
        rec["criticality"] = rec.get("criticality") or "Critical"
        rec["status"] = rec.get("status") or "Open"
        rec["needs_escalation"] = rec.get("needs_escalation") or "No"
        if rec["part"]:
            out.append(rec)
    return out


def load_comments():
    recs_in = _read_excel_comments(config.COMMENTS_XLSX_INPUT)
    recs_par = _read_excel_comments(config.COMMENTS_XLSX_PARENT)
    by_id = {}
    for r in recs_par + recs_in:
        cid = r.get("id") or f"{r.get('part')}_{r.get('created')}"
        by_id[cid] = r
    return list(by_id.values())


def _write_excel_comments(path, records):
    wb = Workbook()
    ws = wb.active
    ws.title = "Comments"
    ws.append([lbl for _, lbl in config.COMMENT_COLS])
    hdr_fill = PatternFill("solid", fgColor="1F3864")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = hdr_fill
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for rec in records:
        ws.append([rec.get(k, "") for k, _ in config.COMMENT_COLS])
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
            if isinstance(c.value, str) and c.value[:1] in ("=", "+", "-", "@"):
                c.data_type = "s"
    for i, w in enumerate(config.COMMENT_WIDTHS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    tmp_path = path + ".tmp"
    wb.save(tmp_path)
    os.replace(tmp_path, path)


def save_comments(records):
    _write_excel_comments(config.COMMENTS_XLSX_INPUT, records)
    try:
        if os.path.abspath(config.COMMENTS_XLSX_PARENT) != os.path.abspath(config.COMMENTS_XLSX_INPUT):
            _write_excel_comments(config.COMMENTS_XLSX_PARENT, records)
    except Exception:
        pass


def upsert_comment(payload):
    with _comments_lock:
        records = load_comments()
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        clean = {
            k: str(payload.get(k, "") or "").strip()
            for k, _ in config.COMMENT_COLS
            if k not in ("id", "created", "updated")
        }
        clean["criticality"] = clean.get("criticality") or "Critical"
        clean["status"] = clean.get("status") or "Open"
        clean["needs_escalation"] = clean.get("needs_escalation") or "No"

        cid = str(payload.get("id", "") or "").strip()
        existing = next((r for r in records if r["id"] == cid), None) if cid else None
        if existing:
            existing.update(clean)
            existing["updated"] = now
        else:
            nums = [int(re.sub(r"\D", "", r.get("id", "")) or 0) for r in records]
            new_id = "C%04d" % ((max(nums) if nums else 0) + 1)
            rec = {k: "" for k, _ in config.COMMENT_COLS}
            rec.update(clean)
            rec["id"], rec["created"], rec["updated"] = new_id, now, now
            records.append(rec)
        save_comments(records)
        return records


def delete_comment(cid):
    with _comments_lock:
        records = [r for r in load_comments() if r["id"] != str(cid)]
        save_comments(records)
        return records
