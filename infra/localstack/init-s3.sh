#!/usr/bin/env bash
# infra/localstack/init-s3.sh
#
# Runs automatically when LocalStack's S3 service is ready.
# Creates the default bucket used by Guilda for file uploads.
# Mounted at: /etc/localstack/init/ready.d/init-s3.sh

set -euo pipefail

BUCKET="${S3_BUCKET:-guilda}"
REGION="${DEFAULT_REGION:-us-east-1}"
ENDPOINT="http://localhost:4566"

echo "Creating S3 bucket: $BUCKET"

awslocal s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  $([ "$REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$REGION" || echo "")

echo "Bucket '$BUCKET' ready."
