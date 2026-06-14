# iReserve Report Service

Standalone PHP 8.2+ service that renders authorized report models with
[`paperdoc-dev/paperdoc-lib`](https://paperdoc.dev/).

## Docker

From the iReserve repository root:

```bash
docker compose -f docker-compose.reports.yml up --build
```

Set the same strong `REPORT_SERVICE_SECRET` in the Next.js environment and the
service environment. Next.js defaults to `http://127.0.0.1:8787`; override it
with `REPORT_SERVICE_URL` when deployed separately.

For local development only, starting the PHP service with `APP_ENV=local`
enables the built-in localhost secret. Production still requires an explicit
`REPORT_SERVICE_SECRET`.

## Local PHP

```bash
cd report-service
composer install
php -S 127.0.0.1:8787 -t public public/router.php
```

The service intentionally has no database credentials. Next.js authenticates
the user, enforces permissions and village scope, fetches filtered rows, and
sends only the normalized report model to this internal service.
