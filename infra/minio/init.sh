#!/usr/bin/env sh
# infra/minio/init.sh
#
# Runs once at startup to create the default MinIO bucket.
# Executed by the `minio-init` service in compose.yaml.

set -e

BUCKET="${MINIO_BUCKET:-guilda}"
ENDPOINT="http://minio:9000"

echo "Waiting for MinIO to be ready..."
until mc alias set local "$ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" > /dev/null 2>&1; do
  sleep 1
done

echo "MinIO is ready."

if mc ls "local/$BUCKET" > /dev/null 2>&1; then
  echo "Bucket '$BUCKET' already exists."
else
  mc mb "local/$BUCKET"
  echo "Bucket '$BUCKET' created."
fi

# Set download policy to private (no public access by default).
mc anonymous set none "local/$BUCKET"

echo "MinIO initialisation complete."
