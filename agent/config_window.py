"""
Ventana de configuración para Vento LexOps Agent
Interfaz gráfica con Tkinter para configurar el agente.
"""

import os
import sys
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def open_config_window(config_manager, cert_manager):
    """Abre la ventana de configuración"""
    try:
        import tkinter as tk
        from tkinter import ttk, filedialog, messagebox
    except ImportError:
        logger.error("Tkinter no disponible")
        return
    
    root = tk.Tk()
    root.title("Vento LexOps - Configuración")
    root.geometry("600x500")
    root.resizable(True, True)
    
    try:
        root.iconbitmap('vento.ico')
    except:
        pass
    
    notebook = ttk.Notebook(root)
    notebook.pack(fill='both', expand=True, padx=10, pady=10)
    
    general_frame = ttk.Frame(notebook, padding=20)
    notebook.add(general_frame, text="General")
    
    ttk.Label(general_frame, text="Carpeta de descargas:").grid(row=0, column=0, sticky='w', pady=5)
    folder_var = tk.StringVar(value=config_manager.get_download_folder())
    folder_entry = ttk.Entry(general_frame, textvariable=folder_var, width=50)
    folder_entry.grid(row=0, column=1, padx=5, pady=5)
    
    def browse_folder():
        folder = filedialog.askdirectory(initialdir=folder_var.get())
        if folder:
            folder_var.set(folder)
    
    ttk.Button(general_frame, text="...", command=browse_folder, width=3).grid(row=0, column=2, pady=5)
    
    ttk.Label(general_frame, text="Intervalo de sincronización (minutos):").grid(row=1, column=0, sticky='w', pady=5)
    interval_var = tk.IntVar(value=config_manager.get_sync_interval())
    interval_spinbox = ttk.Spinbox(general_frame, from_=5, to=1440, textvariable=interval_var, width=10)
    interval_spinbox.grid(row=1, column=1, sticky='w', padx=5, pady=5)
    
    headless_var = tk.BooleanVar(value=config_manager.get('headless', True))
    ttk.Checkbutton(general_frame, text="Ejecutar navegador en segundo plano (headless)", 
                    variable=headless_var).grid(row=2, column=0, columnspan=2, sticky='w', pady=5)
    
    autostart_var = tk.BooleanVar(value=config_manager.get('auto_start', False))
    ttk.Checkbutton(general_frame, text="Iniciar automáticamente con Windows", 
                    variable=autostart_var).grid(row=3, column=0, columnspan=2, sticky='w', pady=5)
    
    accounts_frame = ttk.Frame(notebook, padding=20)
    notebook.add(accounts_frame, text="Cuentas/Certificados")
    
    ttk.Label(accounts_frame, text="Certificados configurados:").pack(anchor='w')
    
    list_frame = ttk.Frame(accounts_frame)
    list_frame.pack(fill='both', expand=True, pady=10)
    
    columns = ('nombre', 'certificado', 'tipo', 'estado')
    accounts_tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=8)
    accounts_tree.heading('nombre', text='Nombre')
    accounts_tree.heading('certificado', text='Certificado')
    accounts_tree.heading('tipo', text='Tipo')
    accounts_tree.heading('estado', text='Estado')
    
    accounts_tree.column('nombre', width=120)
    accounts_tree.column('certificado', width=180)
    accounts_tree.column('tipo', width=80)
    accounts_tree.column('estado', width=80)
    
    scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=accounts_tree.yview)
    accounts_tree.configure(yscrollcommand=scrollbar.set)
    
    accounts_tree.pack(side='left', fill='both', expand=True)
    scrollbar.pack(side='right', fill='y')
    
    def refresh_accounts_list():
        for item in accounts_tree.get_children():
            accounts_tree.delete(item)
        
        for account in config_manager.get_accounts():
            cert_file = account.get('certificate_file', '')
            if cert_file:
                cert_name = os.path.basename(cert_file)
                cert_type = 'Archivo'
            else:
                cert = cert_manager.get_certificate_by_thumbprint(account.get('certificate_thumbprint', ''))
                cert_name = cert.common_name if cert else 'No encontrado'
                cert_type = cert.issuer_type if cert else '-'
            
            status = 'Activo' if account.get('enabled', True) else 'Pausado'
            
            accounts_tree.insert('', 'end', values=(
                account.get('name', 'Sin nombre'),
                cert_name,
                cert_type,
                status
            ))
    
    refresh_accounts_list()
    
    buttons_frame = ttk.Frame(accounts_frame)
    buttons_frame.pack(fill='x', pady=10)
    
    def add_account():
        add_window = tk.Toplevel(root)
        add_window.title("Añadir cuenta")
        add_window.geometry("550x400")
        add_window.transient(root)
        add_window.grab_set()
        
        frame = ttk.Frame(add_window, padding=20)
        frame.pack(fill='both', expand=True)
        
        ttk.Label(frame, text="Nombre de la cuenta:").grid(row=0, column=0, sticky='w', pady=5)
        name_var = tk.StringVar()
        ttk.Entry(frame, textvariable=name_var, width=40).grid(row=0, column=1, columnspan=2, pady=5, sticky='w')
        
        ttk.Separator(frame, orient='horizontal').grid(row=1, column=0, columnspan=3, sticky='ew', pady=15)
        
        cert_source_var = tk.StringVar(value='file')
        
        ttk.Radiobutton(frame, text="Seleccionar archivo de certificado (.pfx, .p12):", 
                        variable=cert_source_var, value='file').grid(row=2, column=0, columnspan=3, sticky='w', pady=5)
        
        file_frame = ttk.Frame(frame)
        file_frame.grid(row=3, column=0, columnspan=3, sticky='ew', padx=20, pady=5)
        
        cert_file_var = tk.StringVar()
        cert_file_entry = ttk.Entry(file_frame, textvariable=cert_file_var, width=45)
        cert_file_entry.pack(side='left', padx=(0, 5))
        
        def browse_cert_file():
            filetypes = [
                ("Certificados", "*.pfx *.p12 *.PFX *.P12"),
                ("PKCS#12", "*.pfx *.p12"),
                ("Todos los archivos", "*.*")
            ]
            filepath = filedialog.askopenfilename(
                title="Seleccionar certificado digital",
                filetypes=filetypes,
                initialdir=os.path.expanduser("~")
            )
            if filepath:
                cert_file_var.set(filepath)
                cert_source_var.set('file')
        
        ttk.Button(file_frame, text="Examinar...", command=browse_cert_file).pack(side='left')
        
        ttk.Label(frame, text="Contraseña del certificado:").grid(row=4, column=0, sticky='w', padx=20, pady=5)
        password_var = tk.StringVar()
        password_entry = ttk.Entry(frame, textvariable=password_var, width=30, show='*')
        password_entry.grid(row=4, column=1, sticky='w', pady=5)
        
        show_pass_var = tk.BooleanVar(value=False)
        def toggle_password():
            password_entry.config(show='' if show_pass_var.get() else '*')
        ttk.Checkbutton(frame, text="Mostrar", variable=show_pass_var, 
                        command=toggle_password).grid(row=4, column=2, sticky='w', pady=5)
        
        ttk.Separator(frame, orient='horizontal').grid(row=5, column=0, columnspan=3, sticky='ew', pady=15)
        
        ttk.Radiobutton(frame, text="Usar certificado del almacén de Windows:", 
                        variable=cert_source_var, value='store').grid(row=6, column=0, columnspan=3, sticky='w', pady=5)
        
        store_frame = ttk.Frame(frame)
        store_frame.grid(row=7, column=0, columnspan=3, sticky='ew', padx=20, pady=5)
        
        certs = cert_manager.get_valid_certificates()
        cert_names = [f"{c.common_name} ({c.issuer_type})" for c in certs] if certs else ["(No se encontraron certificados)"]
        store_cert_var = tk.StringVar()
        store_cert_combo = ttk.Combobox(store_frame, textvariable=store_cert_var, values=cert_names, width=50, state='readonly')
        store_cert_combo.pack(anchor='w')
        
        def on_combo_click(event):
            cert_source_var.set('store')
        store_cert_combo.bind('<<ComboboxSelected>>', on_combo_click)
        
        enabled_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(frame, text="Cuenta activa", variable=enabled_var).grid(row=8, column=0, columnspan=3, sticky='w', pady=15)
        
        def save_account():
            name = name_var.get().strip()
            if not name:
                messagebox.showerror("Error", "Introduzca un nombre para la cuenta")
                return
            
            account = {
                'name': name,
                'enabled': enabled_var.get()
            }
            
            if cert_source_var.get() == 'file':
                cert_file = cert_file_var.get().strip()
                if not cert_file:
                    messagebox.showerror("Error", "Seleccione un archivo de certificado")
                    return
                if not os.path.exists(cert_file):
                    messagebox.showerror("Error", f"El archivo no existe:\n{cert_file}")
                    return
                
                account['certificate_file'] = cert_file
                account['certificate_password'] = password_var.get()
                
            else:
                cert_idx = store_cert_combo.current()
                if cert_idx < 0 or not certs:
                    messagebox.showerror("Error", "Seleccione un certificado del almacén")
                    return
                
                cert = certs[cert_idx]
                account['certificate_thumbprint'] = cert.thumbprint
            
            config_manager.add_account(account)
            refresh_accounts_list()
            add_window.destroy()
            messagebox.showinfo("Cuenta añadida", f"La cuenta '{name}' se ha añadido correctamente")
        
        buttons_bottom = ttk.Frame(frame)
        buttons_bottom.grid(row=9, column=0, columnspan=3, sticky='ew', pady=20)
        ttk.Button(buttons_bottom, text="Cancelar", command=add_window.destroy).pack(side='left')
        ttk.Button(buttons_bottom, text="Guardar", command=save_account).pack(side='right')
    
    def remove_account():
        selected = accounts_tree.selection()
        if not selected:
            messagebox.showwarning("Aviso", "Seleccione una cuenta para eliminar")
            return
        
        if messagebox.askyesno("Confirmar", "¿Está seguro de eliminar esta cuenta?"):
            idx = accounts_tree.index(selected[0])
            config_manager.remove_account(idx)
            refresh_accounts_list()
    
    ttk.Button(buttons_frame, text="Añadir cuenta", command=add_account).pack(side='left', padx=5)
    ttk.Button(buttons_frame, text="Eliminar cuenta", command=remove_account).pack(side='left', padx=5)
    ttk.Button(buttons_frame, text="Actualizar lista", command=refresh_accounts_list).pack(side='right', padx=5)
    
    bottom_frame = ttk.Frame(root)
    bottom_frame.pack(fill='x', padx=10, pady=10)
    
    def save_all():
        config_manager.set_download_folder(folder_var.get())
        config_manager.set_sync_interval(interval_var.get())
        config_manager.set('headless', headless_var.get())
        config_manager.set('auto_start', autostart_var.get())
        
        if autostart_var.get():
            add_to_startup()
        else:
            remove_from_startup()
        
        messagebox.showinfo("Guardado", "Configuración guardada correctamente")
        root.destroy()
    
    def add_to_startup():
        """Añade el agente al inicio de Windows"""
        if sys.platform != 'win32':
            return
        
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, winreg.KEY_SET_VALUE
            )
            exe_path = sys.executable if getattr(sys, 'frozen', False) else f'pythonw "{os.path.abspath(__file__)}"'
            winreg.SetValueEx(key, "VentoLexOps", 0, winreg.REG_SZ, exe_path)
            winreg.CloseKey(key)
        except Exception as e:
            logger.warning(f"No se pudo añadir al inicio: {e}")
    
    def remove_from_startup():
        """Elimina el agente del inicio de Windows"""
        if sys.platform != 'win32':
            return
        
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, winreg.KEY_SET_VALUE
            )
            winreg.DeleteValue(key, "VentoLexOps")
            winreg.CloseKey(key)
        except:
            pass
    
    ttk.Button(bottom_frame, text="Guardar", command=save_all).pack(side='right', padx=5)
    ttk.Button(bottom_frame, text="Cancelar", command=root.destroy).pack(side='right', padx=5)
    
    root.mainloop()


if __name__ == '__main__':
    from config_manager import ConfigManager
    from certificate_manager import CertificateManager
    
    config = ConfigManager()
    certs = CertificateManager()
    open_config_window(config, certs)
