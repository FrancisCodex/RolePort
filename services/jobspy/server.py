"""
A tiny HTTP wrapper around JobSpy (https://github.com/speedyapply/JobSpy, MIT) for HireMe.

HireMe calls it once per job board so each board reports its own result or error.
Standard library only, apart from JobSpy itself. Meant for a self-hosted HireMe on the
user's own network: don't expose it to the internet.

    GET /health
    GET /search?site=linkedin&term=nurse&location=Manila, Philippines&country_indeed=philippines
               &hours_old=72&is_remote=false&results=20
"""

from __future__ import annotations

import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from jobspy import scrape_jobs

SITES = {"linkedin", "indeed", "google", "glassdoor", "zip_recruiter", "bayt", "naukri", "bdjobs", "hellowork"}
MAX_RESULTS = 25
# Boards whose search results have no description; JobSpy then opens each posting.
FETCH_DESCRIPTION = {"linkedin", "bayt", "hellowork"}

log = logging.getLogger("jobspy-service")


def search(query: dict[str, str]) -> dict[str, object]:
    site = query.get("site", "")
    if site not in SITES:
        raise ValueError(f"unknown site: {site!r}")
    term = query.get("term", "").strip()
    if not term:
        raise ValueError("term is required")

    hours_old = int(query["hours_old"]) if query.get("hours_old") else None
    results = min(int(query.get("results") or 20), MAX_RESULTS)
    df = scrape_jobs(
        site_name=[site],
        search_term=term,
        location=query.get("location") or None,
        is_remote=query.get("is_remote") == "true",
        country_indeed=query.get("country_indeed") or "usa",
        hours_old=hours_old,
        results_wanted=results,
        description_format="html",
        fetch_description=site in FETCH_DESCRIPTION,
        verbose=0,
    )
    errors = df.attrs.get("errors") or {}
    return {
        "jobs": json.loads(df.to_json(orient="records", date_format="iso")),
        "error": errors.get(site),
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict[str, object]) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path == "/health":
            self._send(200, {"ok": True})
            return
        if url.path != "/search":
            self._send(404, {"error": "not found"})
            return
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            self._send(200, search(query))
        except ValueError as e:
            self._send(400, {"error": str(e)})
        except Exception as e:  # a board failing must not take the service down
            log.exception("search failed")
            self._send(502, {"error": f"{type(e).__name__}: {e}"})

    def log_message(self, format: str, *args: object) -> None:
        log.info("%s %s", self.address_string(), format % args)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    log.info("JobSpy service on http://%s:%d", host, port)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
