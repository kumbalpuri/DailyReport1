import os
import sys
import threading
import webbrowser

# Ensure local modular imports work regardless of current working directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import config
from comments_engine import get_comments_lock, save_comments
from data_engine import build_strict_data
from server import create_local_server
from template import render_dashboard_html


def main():
    with get_comments_lock():
        if not os.path.exists(config.COMMENTS_XLSX_INPUT):
            save_comments([])

    html_holder = [b""]
    server = create_local_server(lambda: html_holder[0])

    actual_port = server.server_address[1]
    url = f"http://127.0.0.1:{actual_port}"

    payload = build_strict_data(config.INPUT_DIR)
    html_content = render_dashboard_html(payload, url)
    html_holder[0] = html_content.encode("utf-8")

    # Save HTML in parent directory (or fallback to INPUT_DIR if parent is not writable)
    saved_html_path = config.OUTPUT_HTML
    try:
        with open(config.OUTPUT_HTML, "w", encoding="utf-8") as f:
            f.write(html_content)
    except Exception:
        saved_html_path = config.OUTPUT_HTML_LOCAL

    # Also save a local copy inside INPUT_DIR for convenient access
    try:
        if os.path.abspath(config.OUTPUT_HTML_LOCAL) != os.path.abspath(saved_html_path):
            with open(config.OUTPUT_HTML_LOCAL, "w", encoding="utf-8") as f:
                f.write(html_content)
    except Exception:
        pass

    print("\n" + "=" * 78)
    print(f" [FOLDER ] Active Input Directory : {config.INPUT_DIR}")
    print(f" [SUCCESS] Dashboard HTML saved to : {saved_html_path}")
    print(f" [SERVER ] Live Dashboard URL      : {url}/")
    print(f" [EXCEL  ] Comments auto-save to   : {config.COMMENTS_XLSX_INPUT}")
    print(" IMPORTANT: Keep this command prompt window open while saving comments.")
    print("=" * 78 + "\n")

    threading.Timer(0.6, lambda: webbrowser.open(f"{url}/")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n Server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
