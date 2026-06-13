# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This project is in early setup. Currently `main.py` only contains PyCharm's
default starter script — there is no real application code, dependencies,
build/test tooling, or git repository yet.

## Environment

- A Python virtual environment exists at `venv/` (Python 3.8.10, via
  `/usr/local/bin/python3.8`).
- No dependencies are declared yet (no `requirements.txt` / `pyproject.toml`).

## Next steps for future Claude instances

When real application code, dependencies, build/lint/test commands, or
architecture are added to this repo, update this file to describe:
- How to install dependencies and run the project
- How to run lint/format/test commands (including running a single test)
- The high-level architecture once multiple modules/components exist
