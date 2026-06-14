<?php

declare(strict_types=1);

use IReserve\Reports\ReportGenerator;

require dirname(__DIR__) . '/vendor/autoload.php';

header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondJson(405, ['error' => 'Method not allowed.']);
}

$expectedSecret = getenv('REPORT_SERVICE_SECRET')
    ?: ((getenv('APP_ENV') ?: 'production') === 'local' ? 'ireserve-local-report-service' : '');
$providedSecret = $_SERVER['HTTP_X_REPORT_SERVICE_SECRET'] ?? '';
if ($expectedSecret === '' || ! hash_equals($expectedSecret, $providedSecret)) {
    respondJson(401, ['error' => 'Unauthorized report service request.']);
}

try {
    $payload = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    $generator = new ReportGenerator();
    $result = $generator->generate($payload);

    header('Content-Type: ' . $result['contentType']);
    header('Content-Disposition: attachment; filename="' . $result['filename'] . '"');
    header('Content-Length: ' . strlen($result['content']));
    echo $result['content'];
} catch (InvalidArgumentException $exception) {
    respondJson(422, ['error' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('Paperdoc report generation failed: ' . $exception->getMessage());
    respondJson(500, ['error' => 'Failed to generate report. Please try again.']);
}

function respondJson(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
