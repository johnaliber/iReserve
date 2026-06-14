<?php

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if ($path === '/health') {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ok', 'service' => 'ireserve-report-service']);
    return;
}

if ($path === '/export.php' || $path === '/api/reports/export') {
    require __DIR__ . '/export.php';
    return;
}

http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Not found.']);

