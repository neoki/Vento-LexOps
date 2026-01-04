"""
Gestor de configuración del agente Vento LexOps
"""

import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_CONFIG = {
    'download_folder': '',
    'sync_interval_minutes': 30,
    'headless': True,
    'auto_start': False,
    'accounts': []
}

class ConfigManager:
    def __init__(self, config_path: Optional[str] = None):
        if config_path:
            self.config_path = Path(config_path)
        else:
            app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
            self.config_path = Path(app_data) / 'VentoLexOps' / 'config.json'
        
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self._config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Carga la configuración desde el archivo"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    for key, value in DEFAULT_CONFIG.items():
                        if key not in config:
                            config[key] = value
                    return config
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error cargando configuración: {e}")
        
        return DEFAULT_CONFIG.copy()
    
    def _save_config(self):
        """Guarda la configuración en el archivo"""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"Error guardando configuración: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Obtiene un valor de configuración"""
        return self._config.get(key, default)
    
    def set(self, key: str, value: Any):
        """Establece un valor de configuración"""
        self._config[key] = value
        self._save_config()
    
    def get_accounts(self) -> List[Dict[str, Any]]:
        """Obtiene la lista de cuentas configuradas"""
        return self._config.get('accounts', [])
    
    def add_account(self, account: Dict[str, Any]):
        """Añade una cuenta"""
        accounts = self.get_accounts()
        accounts.append(account)
        self.set('accounts', accounts)
    
    def update_account(self, index: int, account: Dict[str, Any]):
        """Actualiza una cuenta existente"""
        accounts = self.get_accounts()
        if 0 <= index < len(accounts):
            accounts[index] = account
            self.set('accounts', accounts)
    
    def remove_account(self, index: int):
        """Elimina una cuenta"""
        accounts = self.get_accounts()
        if 0 <= index < len(accounts):
            accounts.pop(index)
            self.set('accounts', accounts)
    
    def get_download_folder(self) -> str:
        """Obtiene la carpeta de descargas"""
        folder = self._config.get('download_folder', '')
        if not folder:
            folder = os.path.join(os.path.expanduser('~'), 'VentoLexNet')
        return folder
    
    def set_download_folder(self, folder: str):
        """Establece la carpeta de descargas"""
        self.set('download_folder', folder)
    
    def get_sync_interval(self) -> int:
        """Obtiene el intervalo de sincronización en minutos"""
        return self._config.get('sync_interval_minutes', 30)
    
    def set_sync_interval(self, minutes: int):
        """Establece el intervalo de sincronización"""
        self.set('sync_interval_minutes', max(5, min(1440, minutes)))
    
    def to_dict(self) -> Dict[str, Any]:
        """Devuelve toda la configuración como diccionario"""
        return self._config.copy()
