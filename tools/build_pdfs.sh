#!/bin/bash

# Build PDFs from HTML documents for Integratel Workshop Knowledge Assistant
# Usage: ./build_pdfs.sh
# Requires: Chrome/Chromium headless

set -e

# Paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/knowledge/src"
PDF_DIR="$REPO_ROOT/knowledge/pdfs"
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Verify Chrome exists
if [ ! -f "$CHROME_PATH" ]; then
    echo "Error: Chrome not found at $CHROME_PATH"
    exit 1
fi

# Verify source directory exists
if [ ! -d "$SRC_DIR" ]; then
    echo "Error: Source directory not found: $SRC_DIR"
    exit 1
fi

# Create PDF directory if it doesn't exist
mkdir -p "$PDF_DIR"

echo "Building PDFs from HTML documents..."
echo "Source: $SRC_DIR"
echo "Output: $PDF_DIR"
echo ""

# List of HTML files to convert
HTML_FILES=(
    "01_manual_troubleshooting_fibra_hfc_movil.html"
    "02_guia_reclamos_y_compensaciones.html"
    "03_politica_comercial_retencion_2026.html"
    "04_catalogo_planes_tarifas_2026.html"
    "05_procedimiento_portabilidad_numerica.html"
    "06_condiciones_contrato_y_faq.html"
    "07_comunicado_incidencia_inc_aqp_2026_0412.html"
)

# Convert each HTML to PDF
for html_file in "${HTML_FILES[@]}"; do
    html_path="$SRC_DIR/$html_file"
    pdf_path="$PDF_DIR/${html_file%.html}.pdf"

    if [ ! -f "$html_path" ]; then
        echo "⚠ Warning: HTML file not found: $html_path"
        continue
    fi

    echo "Converting: $html_file → ${html_file%.html}.pdf"

    # Use headless Chrome to convert HTML to PDF
    "$CHROME_PATH" \
        --headless=new \
        --disable-gpu \
        --no-pdf-header-footer \
        --print-to-pdf="$pdf_path" \
        "file://$html_path" 2>/dev/null

    # Check if PDF was created and has content
    if [ -f "$pdf_path" ]; then
        file_size=$(stat -f%z "$pdf_path" 2>/dev/null || stat -c%s "$pdf_path" 2>/dev/null)
        if [ "$file_size" -gt 10000 ]; then
            echo "  ✓ Created: $pdf_path ($file_size bytes)"
        else
            echo "  ✗ Error: PDF created but appears to be empty or too small ($file_size bytes)"
            exit 1
        fi
    else
        echo "  ✗ Error: Failed to create PDF"
        exit 1
    fi
done

echo ""
echo "Build complete! PDFs ready in: $PDF_DIR"
echo ""

# Verify all PDFs exist
PDF_COUNT=$(ls -1 "$PDF_DIR"/*.pdf 2>/dev/null | wc -l)
echo "Total PDFs generated: $PDF_COUNT / ${#HTML_FILES[@]}"

if [ "$PDF_COUNT" -eq "${#HTML_FILES[@]}" ]; then
    echo "✓ All PDFs successfully generated"
    exit 0
else
    echo "⚠ Warning: Not all PDFs were generated"
    exit 1
fi
