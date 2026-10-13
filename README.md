# Patient Safety Incident Triage Agent

A deterministic rule-evaluation prototype with a Python CLI, optional FastAPI service, and a self-contained browser demonstration.

**Scope:** The implemented numeric cutoffs are demonstration values, not published or clinically validated patient-safety criteria. This software does **not** calculate a validated AHRQ Safety Assessment Code (SAC 1–4), diagnose incidents, perform root-cause analysis, or replace institutional reporting and escalation procedures. **Never use it for real clinical decisions or submit identifiable patient data.**

## Browser demonstration

The `web/` directory contains a static, responsive local evaluator using JavaScript. It does not need the Python backend or send requests over the network. It evaluates the same generic thresholds as `agents/workers.py`; it does **not** run Python in the browser. For local use:

```sh
python -m http.server 8080 --directory web
# Open http://localhost:8080/
```

Enter synthetic task and target IDs, two numeric measurements, a descriptor, and the critical flag. The generated result can be saved as JSON. It is an illustrative example, **not a cryptographically signed audit dossier**. GitHub Pages deployment is configured through `.github/workflows/pages.yml`; publication requires Pages to be enabled and a successful deployment.

## Rule behavior

| Input condition | Result |
| --- | --- |
| Primary metric > 25 | Elevated alert |
| Secondary metric > 12 | Elevated alert |
| Explicit critical flag | Critical alert (takes precedence) |
| Descriptor includes DISCORDANT, ANOMALY, MUTANT, VIOLATION, FAIL or REJECT | Elevated alert |
| None of these | Routine |

These numbers and keyword heuristics must not be interpreted as validated clinical thresholds. Separate legacy examples in `safety_incident.py` and `patient_safety_incident_triage_agent/` use different cutoffs; their historical outputs are not directly interchangeable.

## Python installation and CLI

Python 3.10+ is tested in CI.

```sh
python -m pip install -e ".[api,test]"
python cli.py audit --task-id SYN-001 --target SYN-TARGET --primary 28 --secondary 14 --critical
python cli.py chat Explain specifications
python cli.py verify-audit
python cli.py batch --input synthetic-input.csv --output results.csv
python -m pytest -q
```

CSV batch fields: `task_id,target_identifier,primary_metric,secondary_metric,status_descriptor,is_critical_flag`. Boolean flags accept `true/false`, `1/0` and `yes/no` (case-insensitive). The provided `sample.csv` uses a **legacy** format for `patient_safety_incident_triage_agent.cli`, not the root CLI.

## Local API

Set long random `API_ACCESS_KEY` and `AUDIT_SECRET_KEY` environment variables and launch:

```sh
python cli.py serve
```

Then call `POST /api/audit` with JSON matching `agents.models.SystemTaskPayload`, sending `X-API-Key: <your key>`. The health route is public; `/metrics`, `/api/audit`, `/api/chat`, and `/api/audit/logs` require the header. The API returns a 503 if its access key is not configured.

For Docker, supply both environment variables externally before running `docker compose up --build`. Compose binds to loopback by default; use a properly authenticated reverse proxy with TLS for any remote access.

## Security and data handling

The regex-based potential-identifier guard is **not** comprehensive PHI detection, HIPAA Safe Harbor de-identification, or a guarantee of compliance. Use synthetic data only. The API keeps dossiers and audit blocks in process memory; it does not provide durable, access-controlled audit storage. Each audit block has an HMAC-SHA256 signature chained to the previous block; signature verification now detects changed entries. When no audit key is supplied, a fresh ephemeral key is generated for that process, which cannot validate history across restarts. The browser demo keeps results in the current tab's memory and does not persist or transmit them.

## Technology and development

Python (Pydantic 2, optional FastAPI/Uvicorn), vanilla HTML/CSS/JavaScript, pytest, Node's built-in test runner, and GitHub Actions. The static browser demo works in current Chromium, Firefox and Safari browsers with ES module support. No third-party browser dependencies.

Licensed under [MIT](LICENSE).
