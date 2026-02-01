#!/bin/bash

# Script to create Supabase storage bucket for statement files
# This script uses the Supabase Management API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Financial Concierge - Storage Bucket Setup${NC}"
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}Error: SUPABASE_URL environment variable is not set${NC}"
    echo "Set it to your Supabase project URL (e.g., https://xxxxx.supabase.co)"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set${NC}"
    echo "Get your service role key from: Supabase Dashboard → Settings → API"
    echo "⚠️  WARNING: Service role key has admin access. Keep it secret!"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}Error: Could not extract project ref from SUPABASE_URL${NC}"
    exit 1
fi

echo -e "${YELLOW}Project: $PROJECT_REF${NC}"
echo ""

# Create bucket
echo "Creating storage bucket 'statement-files'..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "statement-files",
    "public": false,
    "file_size_limit": 10485760,
    "allowed_mime_types": ["application/pdf", "text/csv"]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Bucket created successfully${NC}"
elif [ "$HTTP_CODE" -eq 409 ]; then
    echo -e "${YELLOW}⚠ Bucket already exists${NC}"
else
    echo -e "${RED}✗ Failed to create bucket${NC}"
    echo "HTTP Code: $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Apply storage policies from migration 021_create_statement_files_bucket.sql"
echo "2. Test file upload at /finance/concierge/upload"
echo "3. Verify files appear in Supabase Storage dashboard"










