#!/usr/bin/env python3
"""DocParse Benchmark Runner.

Usage:
    python benchmarks/run_benchmarks.py --suite office     # Structural (no API, instant)
    python benchmarks/run_benchmarks.py --suite pdf         # PDF extraction (needs AI)
    python benchmarks/run_benchmarks.py --suite all         # Everything
    python benchmarks/run_benchmarks.py --competitors       # Compare to competitors
    python benchmarks/run_benchmarks.py --json              # JSON output
"""

import argparse
import subprocess
import sys
from pathlib import Path

REPO_DIR = Path(__file__).parent.parent


def run_office(json_output: bool = False):
    """Run Office structural benchmark."""
    cmd = [sys.executable, str(REPO_DIR / "benchmarks" / "office" / "eval_office.py")]
    if json_output:
        cmd.append("--json")
    subprocess.run(cmd, cwd=str(REPO_DIR))


def run_pdf(ai_backend: str = "gemini", json_output: bool = False):
    """Run PDF benchmark (requires AI backend)."""
    eval_script = REPO_DIR / "benchmarks" / "pdf" / "eval_pdf.py"
    if not eval_script.exists():
        print("PDF benchmark not yet implemented. Run --suite office first.")
        return
    cmd = [sys.executable, str(eval_script), "--ai", ai_backend]
    if json_output:
        cmd.append("--json")
    subprocess.run(cmd, cwd=str(REPO_DIR))


def run_competitors(json_output: bool = False):
    """Run competitor comparison."""
    print("Competitor comparison not yet implemented.")
    print("Available adapters:")
    for p in sorted((REPO_DIR / "benchmarks" / "competitors").glob("*.py")):
        print(f"  - {p.name}")


def main():
    parser = argparse.ArgumentParser(description="DocParse Benchmark Runner")
    parser.add_argument("--suite", choices=["office", "pdf", "all"], default="office",
                        help="Benchmark suite to run (default: office)")
    parser.add_argument("--ai", default="gemini",
                        help="AI backend for PDF benchmark (default: gemini)")
    parser.add_argument("--competitors", action="store_true",
                        help="Run competitor comparison")
    parser.add_argument("--json", action="store_true",
                        help="JSON output")
    args = parser.parse_args()

    if args.competitors:
        run_competitors(args.json)
        return

    if args.suite in ("office", "all"):
        run_office(args.json)

    if args.suite in ("pdf", "all"):
        run_pdf(args.ai, args.json)


if __name__ == "__main__":
    main()
