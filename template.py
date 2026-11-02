import os
import json
import config

TEMPLATE_FILE = os.path.join(config.SCRIPT_DIR, "dashboard_template.html")


def load_html_template():
    if os.path.exists(TEMPLATE_FILE):
        with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
            return f.read()
    raise FileNotFoundError(f"Dashboard HTML template not found at: {TEMPLATE_FILE}")


def render_dashboard_html(payload, server_url):
    html_template = load_html_template()
    json_payload = json.dumps(payload, ensure_ascii=False)
    return (
        html_template
        .replace("__DATA_PAYLOAD__", json_payload)
        .replace("__SERVER_URL__", server_url)
    )
