const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const backendPath = path.join(context.appOutDir, 'resources', 'backend');
  
  console.log('Installing backend dependencies...');
  console.log('Backend path:', backendPath);
  
  if (fs.existsSync(backendPath)) {
    try {
      // Install production dependencies only
      execSync('npm install --production --no-optional', {
        cwd: backendPath,
        stdio: 'inherit'
      });
      console.log('Backend dependencies installed successfully!');
    } catch (error) {
      console.error('Failed to install backend dependencies:', error);
      throw error;
    }
  } else {
    console.warn('Backend path not found:', backendPath);
  }
};
