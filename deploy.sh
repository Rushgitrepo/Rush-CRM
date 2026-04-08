#!/bin/bash

# Configuration
REPO_URL="https://github.com/Jawa090/Rush-CRM.git"
TARGET_DIR="/home/crm.rushcorporation.com/public_html"
PM2_NAME="rush-crm-backend"
BRANCH="main"

echo "🚀 Starting Deployment for Rush-CRM..."

# 1. Navigate to directory or clone if it doesn't exist
if [ ! -d "$TARGET_DIR/.git" ]; then
    echo "Initial clone of repository..."
    git clone $REPO_URL $TARGET_DIR
    cd $TARGET_DIR
else
    cd $TARGET_DIR
    echo "Fetching latest changes..."
    git reset --hard HEAD
    git pull origin $BRANCH
fi

# 2. Install Root Dependencies (since it's a monorepo)
echo "Installing root dependencies..."
npm install

# 3. Setup Backend
echo "Configuring Backend..."
cd backend
npm install
# Optional: Run migrations or build steps here
# npm run build 

# 4. Manage PM2 Process
echo "Restarting PM2 process..."
# Check if process is already running
pm2 describe $PM2_NAME > /dev/null
RUNNING=$?

if [ $RUNNING -eq 0 ]; then
    echo "Process found. Restarting..."
    pm2 restart $PM2_NAME
else
    echo "Process not found. Starting new instance..."
    # Replace 'index.js' or 'server.js' with your actual entry point
    pm2 start index.js --name $PM2_NAME
fi

# 5. Setup Frontend (Vite/React)
echo "Configuring Frontend..."
cd ../frontend
npm install
npm run build

# 6. Finalize permissions for CyberPanel
echo "Setting permissions..."
chown -R $(stat -c '%U' $TARGET_DIR):$(stat -c '%G' $TARGET_DIR) $TARGET_DIR

echo "✅ Deployment Complete!"
pm2 save