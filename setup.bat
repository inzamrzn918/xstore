@echo off
echo ================================
echo SecurePrintShare - Quick Setup
echo Using UV + Bun
echo ================================
echo.

REM Check UV installation
echo Checking UV installation...
where uv >nul 2>nul
if errorlevel 1 (
    echo UV is not installed. Installing UV...
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    echo Please restart your terminal and run this script again.
    pause
    exit /b 1
) else (
    echo UV is installed!
    uv --version
)

echo.

REM Check Bun installation
echo Checking Bun installation...
where bun >nul 2>nul
if errorlevel 1 (
    echo Bun is not installed. Installing Bun...
    powershell -c "irm bun.sh/install.ps1|iex"
    echo Please restart your terminal and run this script again.
    pause
    exit /b 1
) else (
    echo Bun is installed!
    bun --version
)

echo.
echo ================================
echo Setting up Backend (UV + Python 3.12)
echo ================================
cd backend

echo Creating virtual environment with Python 3.12...
uv venv --python 3.12

echo Installing dependencies...
call .venv\Scripts\activate
uv pip install -e .

if not exist .env (
    echo Creating .env file...
    copy .env.example .env
)

echo.
echo Backend setup complete!
echo.

cd ..

echo.
echo ================================
echo Setting up Mobile App (Bun)
echo ================================
cd mobile-app

echo Installing dependencies with Bun...
bun install

echo.
echo Mobile app setup complete!
echo.

cd ..

echo.
echo ================================
echo Setting up Desktop Client (Bun)
echo ================================
cd desktop-client

echo Installing dependencies with Bun...
bun install

echo.
echo Desktop client setup complete!
echo.

cd ..

echo.
echo ================================
echo Your local IP addresses:
echo ================================
ipconfig | findstr /i "IPv4"
echo.
echo IMPORTANT: Update mobile-app/App.js with your IP address!
echo.

echo ================================
echo Setup Complete!
echo ================================
echo.
echo Next steps:
echo 1. Update mobile-app/App.js with your IP address
echo 2. Start backend: cd backend ^&^& .venv\Scripts\activate ^&^& python main.py
echo 3. Start mobile: cd mobile-app ^&^& bun run start
echo 4. Start desktop: cd desktop-client ^&^& bun run start
echo.

pause
