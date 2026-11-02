@echo off
title KSPG Production Command Center
echo ==============================================================================
echo   STARTING KSPG SALES ^& PRODUCTION COMMAND CENTER...
echo ==============================================================================
python "%~dp0Production_Command_Center.py"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python script exited with an error.
    pause
)
