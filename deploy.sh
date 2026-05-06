#!/bin/bash

# Configuration
PROJECT_NAME="Rush-CRM"
DOMAIN="rms.rushcorporation.com"
PORT=4000 # Update this to your backend port
REPO_URL="https://github.com/Jawa090/Rush-CRM.git"

# Define Paths
BASE_DIR="/home/$DOMAIN"
REPO_DIR="$BASE_DIR/public_html" # We keep the repo in public_html for this setup
PUBLIC_HTML="$BASE_DIR/public_html"

echo "======== DEPLOYMENT STARTED: $DOMAIN ========"
date

# # 1. Update Repository
# if [ ! -d "$REPO_DIR/.git" ]; then
#     echo "Cloning repository for the first time..."
#     # If directory exists but isn't a repo, we clear it first
#     rm -rf $REPO_DIR/*
#     git clone $REPO_URL $REPO_DIR
# fi

cd $REPO_DIR
echo "Resetting local changes and pulling fresh from main..."
git fetch --all
git reset --hard origin/main

# 2. Backend Setup (Done before Frontend Build)
echo "--- Step 1: Backend Setup ---"
cd $REPO_DIR/backend

# Copy example env if missing
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Creating backend .env from .env.example..."
    cp .env.example .env
fi

echo "Installing backend dependencies..."
npm install
# 3. Manage Backend Process with PM2
echo "--- Step 2: PM2 Backend Process Management ---"
PM2_NAME="rush-rms-backend"

pm2 describe $PM2_NAME > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Restarting existing PM2 process: $PM2_NAME"
    pm2 restart $PM2_NAME --update-env
else
    echo "Starting new PM2 process: $PM2_NAME"
    # Ensure this points to src/server.js as per your repo structure
    PORT=$PORT pm2 start src/server.js --name $PM2_NAME --env production
fi
pm2 save

# Force-replace .env with .env.production
[ -f ".env.production" ] && cp -f .env.production .env && echo "Applied .env.production successfully." || echo ".env.production not found!"
# 4. Frontend Build

echo "--- Step 3: Frontend Build ---"
cd $REPO_DIR/frontend
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Creating frontend .env..."
    cp .env.example .env
fi

echo "Installing frontend dependencies..."
npm install

echo "Running build..."
npm run build

# 5. Deploy Static Files to Public Root
echo "--- Step 4: Deploying static files to public_html ---"
if [ -d "dist" ]; then
    echo "Syncing build files to root..."
    # We use rsync to avoid deleting the 'backend' folder we just set up
    rsync -avz --exclude 'backend' --exclude 'frontend' --exclude '.git' dist/ $PUBLIC_HTML/
    echo "Frontend deployed to $PUBLIC_HTML"
else
    echo "ERROR: Frontend build failed. 'dist' folder not found."
    exit 1
fi

# 6. Finalize permissions
echo "--- Step 5: Finalizing permissions ---"
# Get the CyberPanel website user
DIR_OWNER=$(stat -c '%U:%G' $PUBLIC_HTML)
chown -R $DIR_OWNER $PUBLIC_HTML

# 7. Restart LiteSpeed
echo "Restarting LiteSpeed..."
/usr/local/lsws/bin/lswsctrl restart

echo "======== DEPLOYMENT COMPLETE: $DOMAIN ========"



