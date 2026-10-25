"""
A tiny HTTP wrapper around JobSpy (https://github.com/speedyapply/JobSpy, MIT) for HireMe.

HireMe calls it once per job board so each board reports its own result or error.
Standard library only, apart from JobSpy itself. Meant for the user's own machine:
don't expose it to the internet.

    GET /health
    GET /search?site=linkedin&term=nurse&location=Manila, Philippines&country_indeed=philippines
               &hours_old=72&is_remote=false&results=20

Self-hosted HireMe calls it from its server. HireMe Lite calls it from the browser, so the
site's origin must be listed in JOBSPY_ALLOWED_ORIGINS (comma-separated, default none):

    JOBSPY_ALLOWED_ORIGINS=https://hireme.example python server.py
"""

from __future__ import annotations

import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from jobspy import scrape_jobs
from jobspy.glassdoor.constant import domains as glassdoor_domains
from jobspy.model import Country

SITES = {"linkedin", "indeed", "google", "glassdoor", "zip_recruiter", "bayt", "naukri", "bdjobs", "hellowork"}
MAX_RESULTS = 25
# Boards whose search results have no description; JobSpy then opens each posting.
FETCH_DESCRIPTION = {"linkedin", "bayt", "hellowork"}

# Countries without their own Glassdoor site whose jobs glassdoor.com finds by location
# (JobSpy does the same for Malaysia and Vietnam). Checked by searching each one.
for _country in (Country.PHILIPPINES,):
    glassdoor_domains.setdefault(_country, "www.glassdoor.com")

log = logging.getLogger("jobspy-service")

# Web pages allowed to call the service from a browser (HireMe Lite). Empty: browsers can't.
ALLOWED_ORIGINS = {o.strip().rstrip("/") for o in os.environ.get("JOBSPY_ALLOWED_ORIGINS", "").split(",") if o.strip()}


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
    def _cors(self) -> None:
        """CORS headers for an allowed browser origin; nothing for any other caller."""
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _send(self, status: int, body: dict[str, object]) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        """Preflight, including Chrome's check before a public site calls a local address."""
        allowed = self.headers.get("Origin", "") in ALLOWED_ORIGINS
        self.send_response(204 if allowed else 403)
        if allowed:
            self._cors()
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", self.headers.get("Access-Control-Request-Headers", ""))
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _from_other_site(self) -> bool:
        """A browser request from a page that isn't allowed. Servers send neither header."""
        origin = self.headers.get("Origin")
        if origin is not None:
            return origin not in ALLOWED_ORIGINS
        return self.headers.get("Sec-Fetch-Site") in ("cross-site", "same-site")

    def do_GET(self) -> None:
        # Refuse before searching: a page on another site could otherwise make this computer
        # query the boards (it couldn't read the answer, but the request would still go out).
        if self._from_other_site():
            self._send(403, {"error": "origin not allowed; add it to JOBSPY_ALLOWED_ORIGINS"})
            return
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
    if ALLOWED_ORIGINS:
        log.info("Browsers allowed from: %s", ", ".join(sorted(ALLOWED_ORIGINS)))
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
