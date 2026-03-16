#!/usr/bin/env python3
"""
Extract images/figures from PDF files using PyMuPDF.

Usage: python extract-images.py <pdf-path> <output-dir>
"""

import sys
import os
import fitz  # PyMuPDF
from pathlib import Path


def extract_images(pdf_path, output_dir):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    extracted = []
    print(f"Processing PDF: {pdf_path}")
    print(f"Total pages: {len(doc)}")

    bitmap_count = 0
    page_images = {}

    for page_num, page in enumerate(doc, start=1):
        image_list = page.get_images(full=True)
        valid = []
        for img in image_list:
            xref = img[0]
            base_image = doc.extract_image(xref)
            if base_image and base_image.get('width', 0) >= 80 and base_image.get('height', 0) >= 80:
                valid.append(base_image)

        if valid:
            page_images[page_num] = len(valid)
            print(f"Page {page_num}: Found {len(valid)} image(s)")

        for base_image in valid:
            filename = f"page_{page_num}_img_{bitmap_count + 1}.{base_image['ext']}"
            filepath = output_path / filename
            with open(filepath, "wb") as f:
                f.write(base_image["image"])
            extracted.append(str(filepath))
            bitmap_count += 1

    doc.close()
    print(f"\nSummary:")
    print(f"  Total images extracted: {len(extracted)}")
    print(f"  Images by page: {page_images}")
    return extracted


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract-images.py <pdf-path> <output-dir>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        extracted = extract_images(pdf_path, output_dir)
        import json
        print(json.dumps(extracted))
    except Exception as e:
        print(f"Error extracting images: {e}", file=sys.stderr)
        sys.exit(1)
