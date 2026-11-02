import os
import re
import pandas as pd


def resolve_exact_file(directory, target_filename):
    if not os.path.exists(directory):
        raise FileNotFoundError(f"Input directory not found: {directory}")
    target_base = os.path.splitext(target_filename)[0].strip().lower()
    for fname in os.listdir(directory):
        if fname.startswith("~$"):
            continue
        base, ext = os.path.splitext(fname)
        if ext.lower() in (".xlsx", ".xls", ".xlsm") and base.strip().lower() == target_base:
            return os.path.join(directory, fname)
    raise FileNotFoundError(f"Required input file '{target_filename}' not found in {directory}")


def find_col(df, candidates, required=False, file_label=""):
    norm_map = {re.sub(r"\s+", " ", str(c)).strip().lower(): c for c in df.columns}
    for cand in candidates:
        key = re.sub(r"\s+", " ", cand).strip().lower()
        if key in norm_map:
            return norm_map[key]
    for cand in candidates:
        key = re.sub(r"\s+", " ", cand).strip().lower()
        for norm_col, orig_col in norm_map.items():
            if key in norm_col:
                return orig_col
    if required:
        raise KeyError(f"Missing column {candidates} in {file_label}. Actual: {list(df.columns)}")
    return None


def clean_part(series):
    return series.fillna("").astype(str).str.strip().str.replace(r"\.0$", "", regex=True)


def to_num(series):
    if series is None:
        return pd.Series(dtype=float)
    if pd.api.types.is_numeric_dtype(series):
        return series.fillna(0.0).astype(float)
    cleaned = series.astype(str).str.replace(",", "", regex=False).str.replace("%", "", regex=False).str.strip()
    return pd.to_numeric(cleaned, errors="coerce").fillna(0.0).astype(float)


def clean_str(series):
    if series is None:
        return pd.Series(dtype=str)
    return series.fillna("").astype(str).str.strip().replace({"nan": "", "None": ""})
