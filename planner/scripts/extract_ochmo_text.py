"""Write the text of OCHMO-STD-100.1A Rev A next to its PDF, one block per page, for the catalog test.

    pip install pypdf
    python planner/scripts/extract_ochmo_text.py

The tests read only the .txt, so they do not need pypdf. Each page starts with a line "=== page N ===",
where N is the PDF page index starting at 1 (it matches the page number printed on the page).
"""
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "docs" / "references" / "OCHMO-STD-100.1A_RevA_2024-09-09.pdf"


def main() -> None:
    reader = PdfReader(str(PDF))
    out = []
    for n, page in enumerate(reader.pages, start=1):
        out.append(f"=== page {n} ===\n{page.extract_text() or ''}\n")
    PDF.with_suffix(".txt").write_text("".join(out), encoding="utf-8")
    print(f"{len(reader.pages)} pages -> {PDF.with_suffix('.txt')}")


if __name__ == "__main__":
    main()
