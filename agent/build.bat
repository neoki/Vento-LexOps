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
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
)

REM Generar ejecutable
echo.
echo Generando ejecutable...
python -m PyInstaller --onefile --noconsole --name=VentoLexOps ^
    --hidden-import=pystray ^
    --hidden-import=PIL ^
    --hidden-import=cryptography ^
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
