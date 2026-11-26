#!/usr/bin/env python3
"""Checks the store-field character limits in LISTING.md. Usage: python3 docs/store/check-lengths.py"""
import re, sys, pathlib
text = pathlib.Path(__file__).with_name("LISTING.md").read_text(encoding="utf-8")
bad = 0
for m in re.finditer(r"### ([^\n]*?\(max (\d+)[,)][^\n]*)\n+(.*?)(?=\n### |\n---|\Z)", text, re.S):
    title, limit, body = m.group(1), int(m.group(2)), m.group(3).strip()
    n = len(body)
    ok = n <= limit
    bad += not ok
    print(f"{'OK ' if ok else 'BAD'} {n:5d}/{limit:<5d} {title}")
sys.exit(1 if bad else 0)
