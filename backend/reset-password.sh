#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./reset-password.sh <new_password> [optional: --remote]"
  echo "Example: ./reset-password.sh mynewpassword"
  echo "Example (Remote): ./reset-password.sh mynewpassword --remote"
  exit 1
fi

PASSWORD="$1"
REMOTE_FLAG="$2"

if [ "$REMOTE_FLAG" == "--remote" ]; then
    echo "Updating REMOTE database..."
    npx wrangler d1 execute housbilling-db --remote --command "UPDATE admin SET password = '$PASSWORD' WHERE id = 1"
else
    echo "Updating LOCAL database..."
    npx wrangler d1 execute housbilling-db --local --command "UPDATE admin SET password = '$PASSWORD' WHERE id = 1"
fi

echo "✅ Admin password updated successfully."
