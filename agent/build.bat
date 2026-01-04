@echo off
REM Vento LexOps Agent - Script de compilacion para Windows
REM Genera un ejecutable .exe standalone

echo ============================================
echo  Vento LexOps Agent - Generador de Ejecutable
echo ============================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no encontrado. Instale Python 3.10 o superior.
    pause
    exit /b 1
)

REM Instalar dependencias
echo Instalando dependencias...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
)

REM Generar ejecutable
echo.
echo Generando ejecutable...
pyinstaller --onefile --windowed --name=VentoLexOps ^
    --add-data "config_manager.py;." ^
    --add-data "certificate_manager.py;." ^
    --add-data "lexnet_automator.py;." ^
    --add-data "scheduler.py;." ^
    --add-data "config_window.py;." ^
    --hidden-import=pystray ^
    --hidden-import=PIL ^
    --hidden-import=win32crypt ^
    --hidden-import=win32security ^
    vento_agent.py

if errorlevel 1 (
    echo ERROR: Fallo al generar el ejecutable.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  EXITO! Ejecutable generado en: dist\VentoLexOps.exe
echo ============================================
echo.

pause
