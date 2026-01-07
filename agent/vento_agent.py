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
from typing import List, Optional

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
from lexnet_automator import LexNetAutomator, NotificationInfo
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
        self.pending_notifications: List[NotificationInfo] = []
        self.icon = None
        self._pending_window_queue: List[List[NotificationInfo]] = []
        
    def create_tray_icon(self):
        """Crea el icono de la bandeja del sistema"""
        image = Image.new('RGB', (64, 64), color='#1E40AF')
        draw = ImageDraw.Draw(image)
        draw.rectangle([16, 16, 48, 48], fill='#3B82F6')
        draw.text((24, 22), "V", fill='white')
        return image
    
    def build_menu(self):
        """Construye el menú del icono de la bandeja con valores dinámicos"""
        def get_status_text(item):
            return f"Estado: {'Activo' if self.running else 'Pausado'}"
        
        def get_last_sync_text(item):
            return f"Última revisión: {self.last_sync.strftime('%H:%M') if self.last_sync else 'Nunca'}"
        
        def get_pending_text(item):
            return f"Pendientes: {len(self.pending_notifications)}"
        
        def get_pending_button_text(item):
            count = len(self.pending_notifications)
            return f"Ver pendientes ({count})..."
        
        def has_pending(item):
            return len(self.pending_notifications) > 0
        
        def get_pause_text(item):
            return 'Pausar' if self.running else 'Reanudar'
        
        return pystray.Menu(
            item(get_status_text, None, enabled=False),
            item(get_last_sync_text, None, enabled=False),
            item(get_pending_text, None, enabled=False),
            pystray.Menu.SEPARATOR,
            item('Revisar notificaciones', self.on_check_notifications),
            item(get_pending_button_text, self.on_show_pending, enabled=has_pending),
            item('Configuración...', self.on_open_config),
            item('Ver carpeta', self.on_open_folder),
            pystray.Menu.SEPARATOR,
            item(get_pause_text, self.on_toggle_pause),
            item('Salir', self.on_quit)
        )
    
    def on_check_notifications(self, icon, item):
        """Revisa si hay notificaciones nuevas sin descargarlas"""
        logger.info("Revisando notificaciones...")
        self.show_notification("Vento LexOps", "Revisando notificaciones en LexNET...")
        threading.Thread(target=self.check_all_accounts, daemon=True).start()
    
    def on_show_pending(self, icon, item):
        """Muestra la ventana con notificaciones pendientes"""
        if self.pending_notifications:
            self.show_pending_window(self.pending_notifications.copy())
    
    def on_open_config(self, icon, item):
        """Abre la ventana de configuración"""
        from config_window import open_config_window
        threading.Thread(target=lambda: open_config_window(self.config, self.cert_manager), daemon=True).start()
    
    def on_open_folder(self, icon, item):
        """Abre la carpeta de descargas en el explorador de Windows"""
        folder = self.config.get_download_folder()
        try:
            os.makedirs(folder, exist_ok=True)
            if sys.platform == 'win32':
                os.startfile(folder)
            else:
                import subprocess
                subprocess.run(['xdg-open', folder], check=False)
            logger.info(f"Abriendo carpeta: {folder}")
        except Exception as e:
            logger.error(f"Error abriendo carpeta {folder}: {e}")
    
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
    
    def check_all_accounts(self):
        """Revisa todas las cuentas buscando notificaciones pendientes SIN descargar"""
        accounts = self.config.get('accounts', [])
        if not accounts:
            logger.warning("No hay cuentas configuradas")
            self.show_notification("Vento LexOps", "No hay cuentas configuradas")
            return
        
        download_folder = self.config.get_download_folder()
        os.makedirs(download_folder, exist_ok=True)
        
        all_pending = []
        
        for account in accounts:
            if not account.get('enabled', True):
                continue
            
            cert_thumbprint = account.get('certificate_thumbprint', '')
            cert_file = account.get('certificate_file', '')
            cert_password = account.get('certificate_password', '')
            account_name = account.get('name', 'Sin nombre')
            
            logger.info(f"Revisando cuenta: {account_name}")
            
            try:
                automator = LexNetAutomator(
                    certificate_thumbprint=cert_thumbprint,
                    download_folder=download_folder,
                    headless=self.config.get('headless', True)
                )
                
                notifications = automator.check_notifications()
                
                for notif in notifications:
                    notif.account_name = account_name
                    notif.certificate_thumbprint = cert_thumbprint
                    notif.certificate_file = cert_file
                    notif.certificate_password = cert_password
                
                all_pending.extend(notifications)
                
                logger.info(f"Cuenta {account_name}: {len(notifications)} notificaciones pendientes")
                
            except Exception as e:
                logger.error(f"Error revisando {account_name}: {e}")
        
        self.last_sync = datetime.now()
        self.pending_notifications = all_pending
        
        if self.icon:
            self.icon.update_menu()
        
        if all_pending:
            urgent_count = sum(1 for n in all_pending if n.is_urgent)
            msg = f"Hay {len(all_pending)} notificaciones pendientes"
            if urgent_count > 0:
                msg += f" ({urgent_count} urgentes)"
            msg += ". Haz clic en 'Ver pendientes' para gestionar."
            
            self.show_notification("Vento LexOps", msg)
        else:
            self.show_notification("Vento LexOps", "No hay notificaciones nuevas")
    
    def show_pending_window(self, notifications: List[NotificationInfo]):
        """Muestra ventana con las notificaciones pendientes para decidir si descargar"""
        try:
            import tkinter as tk
            from tkinter import ttk, messagebox
        except ImportError:
            logger.error("Tkinter no disponible")
            return
        
        root = tk.Tk()
        root.title("Vento LexOps - Notificaciones Pendientes")
        root.geometry("700x450")
        root.resizable(True, True)
        
        frame = ttk.Frame(root, padding=15)
        frame.pack(fill='both', expand=True)
        
        header_frame = ttk.Frame(frame)
        header_frame.pack(fill='x', pady=(0, 10))
        
        ttk.Label(header_frame, text=f"Se encontraron {len(notifications)} notificaciones pendientes", 
                  font=('Segoe UI', 11, 'bold')).pack(side='left')
        
        urgent_count = sum(1 for n in notifications if n.is_urgent)
        if urgent_count > 0:
            ttk.Label(header_frame, text=f"  ({urgent_count} urgentes)", 
                      foreground='red', font=('Segoe UI', 11)).pack(side='left')
        
        list_frame = ttk.Frame(frame)
        list_frame.pack(fill='both', expand=True, pady=10)
        
        columns = ('seleccionar', 'juzgado', 'procedimiento', 'tipo', 'urgente')
        tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=12)
        
        tree.heading('seleccionar', text='')
        tree.heading('juzgado', text='Juzgado')
        tree.heading('procedimiento', text='Procedimiento')
        tree.heading('tipo', text='Tipo')
        tree.heading('urgente', text='Urgente')
        
        tree.column('seleccionar', width=30, anchor='center')
        tree.column('juzgado', width=280)
        tree.column('procedimiento', width=120)
        tree.column('tipo', width=120)
        tree.column('urgente', width=60, anchor='center')
        
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        selected_items = {}
        
        for idx, notif in enumerate(notifications):
            selected_items[idx] = tk.BooleanVar(value=True)
            urgent_text = "⚠️ SÍ" if notif.is_urgent else "No"
            tree.insert('', 'end', iid=str(idx), values=(
                '☑',
                notif.court[:40] + '...' if len(notif.court) > 40 else notif.court,
                notif.procedure_number,
                notif.notification_type,
                urgent_text
            ))
        
        def toggle_selection(event):
            item_id = tree.focus()
            if item_id:
                idx = int(item_id)
                selected_items[idx].set(not selected_items[idx].get())
                current = tree.item(item_id, 'values')
                new_check = '☑' if selected_items[idx].get() else '☐'
                tree.item(item_id, values=(new_check, current[1], current[2], current[3], current[4]))
        
        tree.bind('<Double-1>', toggle_selection)
        tree.bind('<space>', toggle_selection)
        
        info_label = ttk.Label(frame, text="Doble clic o Espacio para seleccionar/deseleccionar. Las no descargadas seguirán en LexNET.",
                               foreground='gray')
        info_label.pack(pady=5)
        
        buttons_frame = ttk.Frame(frame)
        buttons_frame.pack(fill='x', pady=15)
        
        def select_all():
            for idx in selected_items:
                selected_items[idx].set(True)
                current = tree.item(str(idx), 'values')
                tree.item(str(idx), values=('☑', current[1], current[2], current[3], current[4]))
        
        def select_none():
            for idx in selected_items:
                selected_items[idx].set(False)
                current = tree.item(str(idx), 'values')
                tree.item(str(idx), values=('☐', current[1], current[2], current[3], current[4]))
        
        ttk.Button(buttons_frame, text="Seleccionar todas", command=select_all).pack(side='left', padx=5)
        ttk.Button(buttons_frame, text="Deseleccionar todas", command=select_none).pack(side='left', padx=5)
        
        def download_selected():
            to_download = [notifications[idx] for idx, var in selected_items.items() if var.get()]
            
            if not to_download:
                messagebox.showinfo("Aviso", "No hay notificaciones seleccionadas para descargar")
                return
            
            root.destroy()
            
            count = len(to_download)
            self.show_notification("Vento LexOps", f"Descargando {count} notificaciones...")
            
            threading.Thread(
                target=lambda: self.download_selected_notifications(to_download),
                daemon=True
            ).start()
        
        def postpone():
            root.destroy()
            self.show_notification("Vento LexOps", 
                                   f"{len(notifications)} notificaciones pospuestas. Seguirán en LexNET.")
            logger.info(f"Usuario pospuso {len(notifications)} notificaciones")
        
        ttk.Button(buttons_frame, text="Posponer (No descargar)", command=postpone).pack(side='right', padx=5)
        ttk.Button(buttons_frame, text="Descargar seleccionadas", command=download_selected).pack(side='right', padx=5)
        
        root.mainloop()
    
    def download_selected_notifications(self, notifications: List[NotificationInfo]):
        """Descarga las notificaciones seleccionadas por el usuario"""
        download_folder = self.config.get_download_folder()
        
        by_account = {}
        for notif in notifications:
            key = (notif.certificate_thumbprint, notif.certificate_file, notif.certificate_password)
            if key not in by_account:
                by_account[key] = []
            by_account[key].append(notif)
        
        total_downloaded = 0
        
        for (cert_thumb, cert_file, cert_pass), account_notifs in by_account.items():
            try:
                automator = LexNetAutomator(
                    certificate_thumbprint=cert_thumb,
                    download_folder=download_folder,
                    headless=self.config.get('headless', True)
                )
                
                downloaded = automator.download_notifications(account_notifs)
                total_downloaded += downloaded
                
            except Exception as e:
                logger.error(f"Error descargando notificaciones: {e}")
        
        self.new_notifications_count = total_downloaded
        
        for notif in notifications:
            if notif in self.pending_notifications:
                self.pending_notifications.remove(notif)
        
        if self.icon:
            self.icon.update_menu()
        
        self.show_notification("Vento LexOps", f"Se descargaron {total_downloaded} notificaciones")
    
    def scheduled_check(self):
        """Callback para revisión programada"""
        if self.running:
            logger.info("Ejecutando revisión programada")
            self.check_all_accounts()
    
    def run_with_tray(self):
        """Ejecuta el agente con icono en la bandeja"""
        self.running = True
        
        interval = self.config.get('sync_interval_minutes', 30)
        self.scheduler = SyncScheduler(interval, self.scheduled_check)
        self.scheduler.start()
        
        logger.info(f"Vento Agent iniciado - Intervalo: {interval} min")
        
        self.icon = pystray.Icon(
            "vento_agent",
            self.create_tray_icon(),
            "Vento LexOps Agent",
            menu=self.build_menu()
        )
        
        threading.Thread(target=self.check_all_accounts, daemon=True).start()
        
        self.icon.run()
    
    def run_console(self):
        """Ejecuta el agente en modo consola (sin bandeja)"""
        self.running = True
        
        interval = self.config.get('sync_interval_minutes', 30)
        logger.info(f"Vento Agent iniciado en modo consola - Intervalo: {interval} min")
        
        while self.running:
            self.check_all_accounts()
            
            if self.pending_notifications:
                print(f"\n¿Descargar {len(self.pending_notifications)} notificaciones? (s/n): ", end='')
                response = input().strip().lower()
                if response == 's':
                    self.download_selected_notifications(self.pending_notifications)
            
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
