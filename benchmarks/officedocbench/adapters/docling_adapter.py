"""IBM Docling adapter for OfficeDocBench.

Requires: uv pip install docling
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .base_adapter import OfficeDocBenchAdapter


class DoclingAdapter(OfficeDocBenchAdapter):

    def name(self) -> str:
        return "Docling"

    def version(self) -> str:
        try:
            import docling
            return getattr(docling, "__version__", "unknown")
        except ImportError:
            return "not installed"

    def parse(self, filepath: Path) -> dict[str, Any]:
        try:
            from docling.document_converter import DocumentConverter
        except ImportError:
            raise RuntimeError("docling not installed: uv pip install docling")

        converter = DocumentConverter()
        result = converter.convert(str(filepath))

        text_elements = []
        headings = []
        tables = []
        images = []
        lists_out = []

        try:
            doc_dict = result.document.export_to_dict()
            body = doc_dict.get("main-text", doc_dict.get("body", []))

            for item in body:
                item_type = item.get("type", "")
                text = item.get("text", "")

                if item_type in ("title", "section-header"):
                    headings.append({"text": text, "level": item.get("level", 1)})
                elif item_type == "table":
                    cell_text = text or item.get("data", "")
                    tables.append({
                        "row_count": 0,
                        "has_merged_cells": False,
                        "cell_text": cell_text,
                    })
                elif item_type == "list-item":
                    lists_out.append({"items": [text], "ordered": False})
                elif item_type == "picture":
                    images.append({"description": text})
                else:
                    text_elements.append({"text": text, "style": item_type})

        except Exception:
            # Fallback to markdown export
            md = result.document.export_to_markdown()
            for line in md.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                if line.startswith("#"):
                    level = len(line) - len(line.lstrip("#"))
                    headings.append({"text": line.lstrip("# ").strip(), "level": level})
                else:
                    text_elements.append({"text": line, "style": "markdown"})

        return {
            "text_elements": text_elements,
            "headings": headings,
            "tables": tables,
            "track_changes": [],
            "comments": [],
            "headers_footers": [],
            "footnotes": [],
            "speaker_notes": [],
            "text_boxes": [],
            "images": images,
            "lists": lists_out,
            "metadata": {},
        }

    def supported_formats(self) -> set[str]:
        return {"docx", "pptx", "xlsx"}
