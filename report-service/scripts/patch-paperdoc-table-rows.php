<?php

declare(strict_types=1);

$rendererPath = dirname(__DIR__) . '/vendor/paperdoc-dev/paperdoc-lib/src/Renderers/PdfRenderer.php';
if (! is_file($rendererPath)) {
    fwrite(STDERR, "Paperdoc PdfRenderer was not found.\n");
    exit(1);
}

$source = (string) file_get_contents($rendererPath);
$startMarker = '    private function writeTable(Table $table, DocumentInterface $document): void';
$endMarker = "    /**\n     * Flatten a cell's elements into a single line of text suitable for";
$start = strpos($source, $startMarker);
$end = strpos($source, $endMarker, $start === false ? 0 : $start);

if ($start === false || $end === false) {
    fwrite(STDERR, "Paperdoc table renderer markers were not found.\n");
    exit(1);
}

$replacement = <<<'PHP'
    private function writeTable(Table $table, DocumentInterface $document): void
    {
        $tableStyle   = $table->getStyle();
        $contentWidth = $this->engine->getContentWidth();
        $colCount     = $table->getColumnCount();

        if ($colCount === 0) {
            return;
        }

        $this->engine->moveCursorY(-8.0);

        $colWidths = $table->getColumnWidths();
        if (empty($colWidths)) {
            $equalWidth = $contentWidth / $colCount;
            $colWidths = array_fill(0, $colCount, $equalWidth);
        } else {
            $total = array_sum($colWidths);
            $colWidths = array_map(fn (float $w) => ($w / $total) * $contentWidth, $colWidths);
        }

        $cellPadding = $tableStyle?->getCellPadding() ?? 4.0;
        $borderWidth = $tableStyle?->getBorderWidth() ?? 0.5;
        $borderColor = $tableStyle?->getBorderColor() ?? '#000000';
        $headerBg    = $tableStyle?->getHeaderBg() ?? '#f3f4f6';
        $stripedBg   = $tableStyle?->getStripedBg();
        $defaultStyle = $document->getDefaultTextStyle();
        $fontSize = $defaultStyle->getFontSize();
        $startX = $this->engine->getLeftMargin();
        $bodyRowIndex = 0;

        foreach ($table->getRows() as $row) {
            $preparedCells = [];
            $rowHeight = $fontSize * 1.15 + ($cellPadding * 2);

            foreach ($row->getCells() as $index => $cell) {
                $columnWidth = $colWidths[$index] ?? $colWidths[0];
                $cellStyle = $this->cellStyleForPdf($cell, $defaultStyle);
                $cellSize = $cellStyle->getFontSize() > 0 ? $cellStyle->getFontSize() : $fontSize;
                $fontName = $cellStyle->getPdfFontName();

                if ($row->isHeader() && ! str_contains($fontName, 'Bold')) {
                    $fontName = str_replace(
                        ['Helvetica', 'Times-Roman', 'Courier'],
                        ['Helvetica-Bold', 'Times-Bold', 'Courier-Bold'],
                        $fontName,
                    );
                }

                $lines = $this->engine->wrapText(
                    $this->cellTextForPdf($cell),
                    $fontName,
                    $cellSize,
                    max(1.0, $columnWidth - ($cellPadding * 2)),
                );
                if ($lines === []) {
                    $lines = [''];
                }

                $lineHeight = $cellSize * 1.15;
                $rowHeight = max($rowHeight, (count($lines) * $lineHeight) + ($cellPadding * 2));
                $preparedCells[] = [
                    'width' => $columnWidth,
                    'size' => $cellSize,
                    'font' => $fontName,
                    'lines' => $lines,
                    'color' => $cellStyle->getColorRgb(),
                ];
            }

            if ($this->engine->needsNewPage($rowHeight)) {
                $this->engine->newPage();
            }

            $startY = $this->engine->getCursorY();
            $fillBg = $row->isHeader()
                ? $headerBg
                : ($stripedBg !== null && $bodyRowIndex % 2 === 1 ? $stripedBg : null);

            $x = $startX;
            foreach ($colWidths as $columnWidth) {
                $this->engine->drawRect(
                    $x,
                    $startY - $rowHeight,
                    $columnWidth,
                    $rowHeight,
                    $fillBg,
                    $borderColor,
                    $borderWidth,
                );
                $x += $columnWidth;
            }

            $x = $startX;
            foreach ($preparedCells as $cell) {
                [$red, $green, $blue] = $cell['color'];
                $textX = $x + $cellPadding;
                $textY = $startY - $cellPadding - $cell['size'];

                foreach ($cell['lines'] as $lineIndex => $line) {
                    $this->engine->writeTextAt(
                        $line,
                        $cell['font'],
                        $cell['size'],
                        $textX,
                        $textY - ($lineIndex * $cell['size'] * 1.15),
                        $red,
                        $green,
                        $blue,
                    );
                }
                $x += $cell['width'];
            }

            if (! $row->isHeader()) {
                $bodyRowIndex++;
            }
            $this->engine->moveCursorY(-$rowHeight);
        }

        $this->engine->moveCursorY(-12);
    }

PHP;

$patched = substr($source, 0, $start) . $replacement . substr($source, $end);
if (file_put_contents($rendererPath, $patched) === false) {
    fwrite(STDERR, "Paperdoc PdfRenderer could not be patched.\n");
    exit(1);
}

echo "Paperdoc table row-height patch applied.\n";

$enginePath = dirname(__DIR__) . '/vendor/paperdoc-dev/paperdoc-lib/src/Support/Pdf/PdfEngine.php';
if (! is_file($enginePath)) {
    fwrite(STDERR, "Paperdoc PdfEngine was not found.\n");
    exit(1);
}

$engineSource = (string) file_get_contents($enginePath);
$wrapStartMarker = '    public function wrapText(';
$wrapEndMarker = "    /* -------------------------------------------------------------\n     | Output";
$wrapStart = strpos($engineSource, $wrapStartMarker);
$wrapEnd = strpos($engineSource, $wrapEndMarker, $wrapStart === false ? 0 : $wrapStart);

if ($wrapStart === false || $wrapEnd === false) {
    fwrite(STDERR, "Paperdoc text wrapper markers were not found.\n");
    exit(1);
}

$wrapReplacement = <<<'PHP'
    public function wrapText(
        string $text,
        string $fontName,
        float $fontSize,
        float $maxWidth,
        float $letterSpacing = 0.0,
        ?float $firstLineMaxWidth = null,
    ): array {
        $words = explode(' ', $text);
        $lines = [];
        $currentLine = '';

        foreach ($words as $word) {
            $budget = (count($lines) === 0 && $firstLineMaxWidth !== null)
                ? $firstLineMaxWidth
                : $maxWidth;
            $segments = $this->splitOversizedWord($word, $fontName, $fontSize, $budget, $letterSpacing);

            foreach ($segments as $segmentIndex => $segment) {
                $testLine = $currentLine === '' ? $segment : $currentLine . ' ' . $segment;
                $testWidth = $this->measureTextWidth($testLine, $fontName, $fontSize, $letterSpacing);

                if ($testWidth > $budget && $currentLine !== '') {
                    $lines[] = $currentLine;
                    $currentLine = $segment;
                    $budget = $maxWidth;
                } else {
                    $currentLine = $testLine;
                }

                if ($segmentIndex < count($segments) - 1) {
                    $lines[] = $currentLine;
                    $currentLine = '';
                    $budget = $maxWidth;
                }
            }
        }

        if ($currentLine !== '') {
            $lines[] = $currentLine;
        }

        return $lines ?: [''];
    }

    /**
     * Split an unbroken token such as an email or reference number so it
     * cannot overflow its table cell.
     *
     * @return string[]
     */
    private function splitOversizedWord(
        string $word,
        string $fontName,
        float $fontSize,
        float $maxWidth,
        float $letterSpacing,
    ): array {
        if ($word === '' || $this->measureTextWidth($word, $fontName, $fontSize, $letterSpacing) <= $maxWidth) {
            return [$word];
        }

        $characters = preg_split('//u', $word, -1, PREG_SPLIT_NO_EMPTY) ?: str_split($word);
        $segments = [];
        $current = '';

        foreach ($characters as $character) {
            $candidate = $current . $character;
            if (
                $current !== ''
                && $this->measureTextWidth($candidate, $fontName, $fontSize, $letterSpacing) > $maxWidth
            ) {
                $segments[] = $current;
                $current = $character;
            } else {
                $current = $candidate;
            }
        }

        if ($current !== '') {
            $segments[] = $current;
        }

        return $segments ?: [$word];
    }

PHP;

$patchedEngine = substr($engineSource, 0, $wrapStart) . $wrapReplacement . substr($engineSource, $wrapEnd);
if (file_put_contents($enginePath, $patchedEngine) === false) {
    fwrite(STDERR, "Paperdoc PdfEngine could not be patched.\n");
    exit(1);
}

echo "Paperdoc long-token wrapping patch applied.\n";
