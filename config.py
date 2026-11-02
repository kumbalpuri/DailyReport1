import os

# ==============================================================================
# 1. FOLDER-INDEPENDENT PATH RESOLUTION & CONFIGURATION
# ==============================================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

EXACT_FILES = {
    "calendar": "Calendar.xlsx",
    "demand": "Demand.xlsx",
    "exchange": "Exchange Rate.xlsx",
    "master": "Master.xlsx",
    "mb51": "Mb51.xlsx",
    "mb52": "MB52.xlsx",
    "price": "Price.xlsx",
    "vendor": "Vendor.xlsx",
}


def _has_excel_inputs(directory):
    """Return True if at least one of the required Excel input files exists in directory."""
    if not directory or not os.path.isdir(directory):
        return False
    target_bases = {os.path.splitext(v)[0].strip().lower() for v in EXACT_FILES.values()}
    try:
        for fname in os.listdir(directory):
            if fname.startswith("~$"):
                continue
            base, ext = os.path.splitext(fname)
            if ext.lower() in (".xlsx", ".xls", ".xlsm") and base.strip().lower() in target_bases:
                return True
    except OSError:
        return False
    return False


def detect_input_dir():
    """
    Automatically detect the Input folder regardless of where the zip is extracted:
    1. Environment variable KSPG_INPUT_DIR (if set)
    2. SCRIPT_DIR (when unzipped directly inside the Input folder)
    3. Parent of SCRIPT_DIR (if Windows 'Extract All' created a subfolder inside Input)
    4. SCRIPT_DIR/Input (if unzipped in the parent folder above Input)
    5. Current working directory (fallback)
    """
    env_dir = os.environ.get("KSPG_INPUT_DIR", "").strip()
    candidates = [
        env_dir,
        SCRIPT_DIR,
        os.path.dirname(SCRIPT_DIR),
        os.path.join(SCRIPT_DIR, "Input"),
        os.getcwd(),
        os.path.join(os.getcwd(), "Input"),
    ]
    for cand in candidates:
        if cand and _has_excel_inputs(cand):
            return os.path.abspath(cand)
    return SCRIPT_DIR


INPUT_DIR = detect_input_dir()
PARENT_DIR = os.path.dirname(INPUT_DIR) if os.path.dirname(INPUT_DIR) else INPUT_DIR

# Save HTML in both parent folder (original behavior) and current/input folder for convenience
OUTPUT_HTML = os.path.join(PARENT_DIR, "Production_Command_Center.html")
OUTPUT_HTML_LOCAL = os.path.join(INPUT_DIR, "Production_Command_Center.html")

COMMENTS_XLSX_INPUT = os.path.join(INPUT_DIR, "Critical_FG_Comments_Log.xlsx")
COMMENTS_XLSX_PARENT = os.path.join(PARENT_DIR, "Critical_FG_Comments_Log.xlsx")

COMMENT_COLS = [
    ("id", "ID"),
    ("created", "Created"),
    ("updated", "Last Updated"),
    ("part", "Part Number"),
    ("desc", "Description"),
    ("customer", "Customer"),
    ("minifactory", "Minifactory"),
    ("line", "Line"),
    ("stakeholder", "Stakeholder"),
    ("category", "Issue Category"),
    ("discussion", "Stakeholder Input / Discussion"),
    ("action", "Action Being Taken"),
    ("owner", "Owner"),
    ("target_date", "Target Date"),
    ("status", "Status"),
    ("criticality", "Control Status"),
    ("needs_escalation", "Needs Escalation"),
    ("escalation_details", "Escalation Details"),
    ("plan_val", "Plan Value (INR) at entry"),
    ("pending_val", "Pending Value (INR) at entry"),
]

COMMENT_WIDTHS = [8, 19, 19, 14, 30, 16, 14, 12, 18, 18, 48, 48, 16, 13, 12, 15, 16, 36, 18, 18]
