#!/usr/bin/env sh
set -eu

CERT_DIR=${CERT_DIR:-certs}
CERT_FILE="$CERT_DIR/localhost.crt"
KEY_FILE="$CERT_DIR/localhost.key"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    printf '%s\n' "HTTPS development certificate already exists in $CERT_DIR/"
    exit 0
fi

command -v openssl >/dev/null 2>&1 || {
    printf '%s\n' 'openssl is required to generate the HTTPS development certificate.' >&2
    exit 1
}

mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj '/CN=localhost' \
    -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
chmod 600 "$KEY_FILE"
printf '%s\n' "Generated a local HTTPS certificate in $CERT_DIR/"
