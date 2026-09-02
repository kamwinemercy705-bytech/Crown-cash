FROM php:8.3-apache

# Install packages required for MongoDB
RUN apt-get update \
    && apt-get install -y libssl-dev pkg-config unzip git \
    && pecl install mongodb \
    && docker-php-ext-enable mongodb \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Apache application directory
WORKDIR /var/www/html

# Copy Composer configuration
COPY composer.json /var/www/html/composer.json

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Copy ALL application files
COPY . /var/www/html/

# Permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Render uses port 10000
RUN sed -i 's/Listen 80/Listen 10000/' /etc/apache2/ports.conf \
    && sed -i 's/:80>/:10000>/' /etc/apache2/sites-available/000-default.conf

EXPOSE 10000

CMD ["apache2-foreground"]