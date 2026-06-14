FROM composer:2 AS vendor
WORKDIR /app
COPY report-service/composer.json ./
COPY report-service/scripts ./scripts
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

FROM php:8.3-cli-alpine
RUN apk add --no-cache libzip-dev oniguruma-dev libpng-dev libjpeg-turbo-dev freetype-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd mbstring zip dom
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY report-service/composer.json ./
COPY report-service/public ./public
COPY report-service/src ./src
RUN php -r "require 'vendor/autoload.php'; echo class_exists('Paperdoc\\\\Support\\\\DocumentManager') ? 'Paperdoc ready' : exit(1);"
EXPOSE 8787
CMD ["php", "-S", "0.0.0.0:8787", "-t", "public", "public/router.php"]
