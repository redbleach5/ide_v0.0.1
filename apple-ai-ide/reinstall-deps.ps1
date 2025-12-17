# Script for forced reinstallation of all dependencies

Write-Host "=== Forced reinstallation of dependencies ===" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "Current directory: $projectPath" -ForegroundColor Gray
Write-Host ""

# Step 1: Clear npm cache
Write-Host "Step 1: Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Cache cleared" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Warning during cache cleanup" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Remove node_modules
Write-Host "Step 2: Removing node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    Write-Host "[OK] node_modules removed" -ForegroundColor Green
} else {
    Write-Host "[INFO] node_modules not found" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Remove package-lock.json
Write-Host "Step 3: Removing package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
    Write-Host "[OK] package-lock.json removed" -ForegroundColor Green
} else {
    Write-Host "[INFO] package-lock.json not found" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Install dependencies
Write-Host "Step 4: Installing dependencies..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Gray
Write-Host ""

# Set environment variables for node-gyp
$env:GYP_MSVS_VERSION = "2022"

npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] All dependencies installed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Check node-pty
    if (Test-Path "node_modules\node-pty") {
        Write-Host "[OK] node-pty installed successfully" -ForegroundColor Green
        
        # Step 5: Rebuild native modules for Electron
        Write-Host ""
        Write-Host "Step 5: Rebuilding native modules for Electron..." -ForegroundColor Yellow
        Write-Host "This may take a few minutes..." -ForegroundColor Gray
        Write-Host ""
        
        npx electron-rebuild -f -w node-pty
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Native modules rebuilt successfully!" -ForegroundColor Green
            Write-Host "Terminal will now work in IDE!" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Failed to rebuild native modules" -ForegroundColor Yellow
            Write-Host "Try running manually: npm run rebuild-native" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARNING] node-pty not installed" -ForegroundColor Yellow
        Write-Host "Try installing it separately:" -ForegroundColor Yellow
        Write-Host "  npm install node-pty" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "[ERROR] Error installing dependencies" -ForegroundColor Red
    Write-Host ""
    Write-Host "If problem with node-pty, try:" -ForegroundColor Yellow
    Write-Host "1. Use Developer Command Prompt for VS 2022" -ForegroundColor Yellow
    Write-Host "2. Make sure 'MSVC v143 - VS 2022 C++ x64/x86 build tools' is installed" -ForegroundColor Yellow
    Write-Host "3. Restart computer after installing Visual Studio components" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
