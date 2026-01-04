"""
Programador de tareas para Vento LexOps Agent
Ejecuta sincronizaciones automáticas según intervalo configurado.
"""

import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class SyncScheduler:
    def __init__(self, interval_minutes: int, callback: Callable):
        self.interval_minutes = interval_minutes
        self.callback = callback
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._next_run: Optional[datetime] = None
        self._lock = threading.Lock()
    
    def start(self):
        """Inicia el programador"""
        if self._running:
            logger.warning("El programador ya está en ejecución")
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(f"Programador iniciado - Intervalo: {self.interval_minutes} minutos")
    
    def stop(self):
        """Detiene el programador"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Programador detenido")
    
    def _run_loop(self):
        """Bucle principal del programador"""
        while self._running:
            self._next_run = datetime.now() + timedelta(minutes=self.interval_minutes)
            
            while self._running and datetime.now() < self._next_run:
                time.sleep(1)
            
            if self._running:
                try:
                    logger.info("Ejecutando tarea programada...")
                    self.callback()
                except Exception as e:
                    logger.error(f"Error en tarea programada: {e}")
    
    def get_next_run(self) -> Optional[datetime]:
        """Devuelve la próxima ejecución programada"""
        return self._next_run
    
    def get_time_until_next_run(self) -> Optional[timedelta]:
        """Devuelve el tiempo restante hasta la próxima ejecución"""
        if self._next_run:
            return self._next_run - datetime.now()
        return None
    
    def set_interval(self, minutes: int):
        """Cambia el intervalo de sincronización"""
        with self._lock:
            self.interval_minutes = max(5, min(1440, minutes))
            logger.info(f"Intervalo actualizado a {self.interval_minutes} minutos")
    
    def trigger_now(self):
        """Ejecuta la tarea inmediatamente (fuera del ciclo normal)"""
        threading.Thread(target=self.callback, daemon=True).start()
    
    @property
    def is_running(self) -> bool:
        """Indica si el programador está activo"""
        return self._running


class ScheduleTime:
    """Representa una hora específica del día para programar tareas"""
    
    def __init__(self, hour: int, minute: int = 0):
        self.hour = hour
        self.minute = minute
    
    def next_occurrence(self) -> datetime:
        """Calcula la próxima ocurrencia de esta hora"""
        now = datetime.now()
        scheduled = now.replace(hour=self.hour, minute=self.minute, second=0, microsecond=0)
        
        if scheduled <= now:
            scheduled += timedelta(days=1)
        
        return scheduled
    
    def __str__(self):
        return f"{self.hour:02d}:{self.minute:02d}"


class DailyScheduler:
    """Programador que ejecuta a horas específicas del día"""
    
    def __init__(self, times: list, callback: Callable):
        self.times = [ScheduleTime(t['hour'], t.get('minute', 0)) for t in times]
        self.callback = callback
        self._running = False
        self._thread: Optional[threading.Thread] = None
    
    def start(self):
        """Inicia el programador diario"""
        if self._running:
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        
        times_str = ', '.join(str(t) for t in self.times)
        logger.info(f"Programador diario iniciado - Horas: {times_str}")
    
    def stop(self):
        """Detiene el programador"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
    
    def _run_loop(self):
        """Bucle principal del programador diario"""
        while self._running:
            next_times = [(t, t.next_occurrence()) for t in self.times]
            next_times.sort(key=lambda x: x[1])
            
            next_time = next_times[0][1]
            
            while self._running and datetime.now() < next_time:
                time.sleep(30)
            
            if self._running:
                try:
                    logger.info(f"Ejecutando tarea programada para {next_time.strftime('%H:%M')}")
                    self.callback()
                except Exception as e:
                    logger.error(f"Error en tarea programada: {e}")
                
                time.sleep(60)
