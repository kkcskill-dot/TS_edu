#!/bin/bash

set -e

echo "🚀  Starting Deployment for TS_edu / tssurvey..."

echo "📥  Pulling latest changes from main branch..."
cd /var/www/html/TS_edu
sudo git pull origin main

echo "📂  Copying backend script to /opt/tssurvey/..."
sudo cp /var/www/html/TS_edu/tssurvey/server/tssurvey_api.py /opt/tssurvey/

echo "🔄  Restarting tssurvey-api service..."
sudo systemctl restart tssurvey-api

echo "🔄  Restarting nginx service..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅  Deployment completed successfully!"
