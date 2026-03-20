"""DocParse — Python client for the DocParse document parsing API.

Usage::

    from docparse import DocParse

    client = DocParse(api_key="dp_a1b2c3d4...")
    result = client.parse("report.docx")
    print(result.blocks)

Unstructured migration::

    from docparse import UnstructuredClient
    client = UnstructuredClient(
        server_url="https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app"
    )
    elements = client.general.partition(file="report.docx")
"""
from .client import DocParse
from .compat import UnstructuredClient
from .types import (
    Block, Cell, ParseResult, DocMetadata, Summary,
    HealthResult, FormatsResult,
    KeyInfo, Quota, Usage, UsageInfo,
    Element, ElementMetadata,
    DocParseError, AuthError, QuotaError,
)

__version__ = "0.1.0"
__all__ = [
    "DocParse",
    "UnstructuredClient",
    "Block", "Cell", "ParseResult", "DocMetadata", "Summary",
    "HealthResult", "FormatsResult",
    "KeyInfo", "Quota", "Usage", "UsageInfo",
    "Element", "ElementMetadata",
    "DocParseError", "AuthError", "QuotaError",
]
