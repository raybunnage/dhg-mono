#\!/bin/bash

# Script to fetch direct metadata from Google Drive API
FILE_ID="1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM"

# Source env variables
source .env
source .env.local
source .env.development 2>/dev/null

# Use the Google Drive API directly with curl
curl -s -X GET \
  "https://www.googleapis.com/drive/v3/files/$FILE_ID?fields=*" \
  -H "Authorization: Bearer $GOOGLE_API_KEY" | jq

