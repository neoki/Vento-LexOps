#!/usr/bin/env python3
"""
Vento LexOps Agent - Agente de escritorio para descarga automática de notificaciones LexNET
Ejecuta en segundo plano como icono en la bandeja del sistema de Windows.
"""

import os
import sys
import json
import time
import threading
import logging
from datetime import datetime
from pathlib import Path

try:
    import pystray
    from pystray import MenuItem as item
    from PIL import Image, ImageDraw
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False
    print("pystray/PIL no disponible - modo consola")

from config_manager import ConfigManager
from certificate_manager import CertificateManager
from lexnet_automator import LexNetAutomator
from scheduler import SyncScheduler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vento_agent.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VentoAgent:
    def __init__(self):
        self.config = ConfigManager()
        self.cert_manager = CertificateManager()
        self.scheduler = None
        self.automator = None
        self.running = False
        self.last_sync = None
        self.new_notifications_count = 0
        self.icon = None
        
    def create_tray_icon(self):
        """Crea el icono de la bandeja del sistema"""
        image = Image.new('RGB', (64, 64), color='#1E40AF')
        draw = ImageDraw.Draw(image)
        draw.rectangle([16, 16, 48, 48], fill='#3B82F6')
        draw.text((24, 22), "V", fill='white')
        return image
    
    def build_menu(self):
        """Construye el menú del icono de la bandeja"""
        status = "Activo" if self.running else "Pausado"
        last_sync_text = self.last_sync.strftime("%H:%M") if self.last_sync else "Nunca"
        
        return pystray.Menu(
            item(f'Estado: {status}', None, enabled=False),
            item(f'Última sync: {last_sync_text}', None, enabled=False),
            item(f'Nuevas: {self.new_notifications_count}', None, enabled=False),
            pystray.Menu.SEPARATOR,
            item('Sincronizar ahora', self.on_sync_now),
            item('Configuración...', self.on_open_config),
            item('Ver carpeta', self.on_open_folder),
            pystray.Menu.SEPARATOR,
            item('Pausar' if self.running else 'Reanudar', self.on_toggle_pause),
            item('Salir', self.on_quit)
        )
    
    def on_sync_now(self, icon, item):
        """Ejecuta sincronización manual"""
        logger.info("Sincronización manual iniciada")
        threading.Thread(target=self.sync_all_accounts, daemon=True).start()
    
    def on_open_config(self, icon, item):
        """Abre la ventana de configuración"""
        from config_window import open_config_window
        threading.Thread(target=lambda: open_config_window(self.config, self.cert_manager), daemon=True).start()
    
    def on_open_folder(self, icon, item):
        """Abre la carpeta de descargas"""
        folder = self.config.get('download_folder', os.path.expanduser('~/VentoLexNet'))
        if os.path.exists(folder):
            os.startfile(folder)
        else:
            os.makedirs(folder, exist_ok=True)
            os.startfile(folder)
    
    def on_toggle_pause(self, icon, item):
        """Pausa o reanuda la sincronización automática"""
        self.running = not self.running
        status = "reanudada" if self.running else "pausada"
        logger.info(f"Sincronización {status}")
        self.show_notification("Vento LexOps", f"Sincronización {status}")
        icon.update_menu()
    
    def on_quit(self, icon, item):
        """Cierra la aplicación"""
        logger.info("Cerrando Vento Agent...")
        self.running = False
        if self.scheduler:
            self.scheduler.stop()
        icon.stop()
    
    def show_notification(self, title, message):
        """Muestra notificación en Windows"""
        try:
            if self.icon:
                self.icon.notify(message, title)
        except Exception as e:
            logger.warning(f"No se pudo mostrar notificación: {e}")
    
    def sync_all_accounts(self):
        """Sincroniza todas las cuentas configuradas"""
        accounts = self.config.get('accounts', [])
        if not accounts:
            logger.warning("No hay cuentas configuradas")
            return
        
        download_folder = self.config.get('download_folder', os.path.expanduser('~/VentoLexNet'))
        os.makedirs(download_folder, exist_ok=True)
        
        total_new = 0
        
        for account in accounts:
            if not account.get('enabled', True):
                continue
                
            cert_thumbprint = account.get('certificate_thumbprint')
            account_name = account.get('name', 'Sin nombre')
            
            logger.info(f"Sincronizando cuenta: {account_name}")
            
            try:
                automator = LexNetAutomator(
                    certificate_thumbprint=cert_thumbprint,
                    download_folder=download_folder,
                    headless=self.config.get('headless', True)
                )
                
                new_count = automator.sync_notifications()
                total_new += new_count
                
                logger.info(f"Cuenta {account_name}: {new_count} nuevas notificaciones")
                
            except Exception as e:
                logger.error(f"Error sincronizando {account_name}: {e}")
        
        self.last_sync = datetime.now()
        self.new_notifications_count = total_new
        
        if total_new > 0:
            self.show_notification(
                "Vento LexOps",
                f"Se han descargado {total_new} nuevas notificaciones"
            )
        
        if self.icon:
            self.icon.update_menu()
    
    def scheduled_sync(self):
        """Callback para sincronización programada"""
        if self.running:
            logger.info("Ejecutando sincronización programada")
            self.sync_all_accounts()
    
    def run_with_tray(self):
        """Ejecuta el agente con icono en la bandeja"""
        self.running = True
        
        interval = self.config.get('sync_interval_minutes', 30)
        self.scheduler = SyncScheduler(interval, self.scheduled_sync)
        self.scheduler.start()
        
        logger.info(f"Vento Agent iniciado - Intervalo: {interval} min")
        
        self.icon = pystray.Icon(
            "vento_agent",
            self.create_tray_icon(),
            "Vento LexOps Agent",
            menu=self.build_menu()
        )
        
        threading.Thread(target=self.sync_all_accounts, daemon=True).start()
        
        self.icon.run()
    
    def run_console(self):
        """Ejecuta el agente en modo consola (sin bandeja)"""
        self.running = True
        
        interval = self.config.get('sync_interval_minutes', 30)
        logger.info(f"Vento Agent iniciado en modo consola - Intervalo: {interval} min")
        
        while self.running:
            self.sync_all_accounts()
            logger.info(f"Esperando {interval} minutos...")
            time.sleep(interval * 60)


def main():
    agent = VentoAgent()
    
    if HAS_TRAY and sys.platform == 'win32':
        agent.run_with_tray()
    else:
        agent.run_console()


if __name__ == '__main__':
    main()
