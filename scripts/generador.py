import secrets
import string
import os

# --- Configuración ---

# ¡IMPORTANTE!
# Edita esta lista para poner los emails de tus 12 usuarios.
# Firebase Authentication funciona mejor con emails como "username".
NOMBRES_DE_USUARIO = [
    "talleresdeblv@scl.com",
    "portlandrv@scl.com",
    "dinamovise@scl.com",
    "redbllus@scl.com",
    "konyask@scl.com",
    "estudiantestv@scl.com",
    "Stego@scl.com",
    "LusitanoRecife@scl.com",
    "falkedusseldorf@scl.com",
    "kaiserizv@scl.com",
    "usuario11@scl.com",
    "usuario12@scl.com",
]

LONGITUD_CONTRASENA = 14
ARCHIVO_SALIDA = "credenciales.txt"
# --- Fin Configuración ---

def generar_contrasena_segura(longitud):
    """
    Genera una contraseña segura con al menos una mayúscula, 
    minúscula, dígito y símbolo.
    """
    
    # 1. Definir el alfabeto completo
    alfabeto = string.ascii_letters + string.digits + string.punctuation

    while True:
        # 2. Generar una contraseña aleatoria usando 'secrets' para seguridad
        contrasena = ''.join(secrets.choice(alfabeto) for i in range(longitud))
        
        # 3. Validar que cumple los requisitos de complejidad
        if (any(c in string.ascii_lowercase for c in contrasena)
            and any(c in string.ascii_uppercase for c in contrasena)
            and any(c in string.digits for c in contrasena)
            and any(c in string.punctuation for c in contrasena)):
            return contrasena
        # Si no cumple (muy improbable con longitud 14), el bucle se repite.

def main():
    """Función principal para generar y guardar las credenciales."""
    
    print("Generando credenciales para el Draft Supercontinental...")
    print("=========================================================")
    
    credenciales = []

    for username in NOMBRES_DE_USUARIO:
        password = generar_contrasena_segura(LONGITUD_CONTRASENA)
        credenciales.append((username, password))
        # Imprimir en la consola
        print(f"  Usuario (email): {username:<25} Contraseña: {password}")

    # Guardar en un archivo de texto
    try:
        ruta_script = os.path.dirname(os.path.abspath(__file__))
        ruta_salida = os.path.join(ruta_script, ARCHIVO_SALIDA)
        
        with open(ruta_salida, "w", encoding="utf-8") as f:
            f.write("Credenciales Generadas - Draft Supercontinental\n")
            f.write("==============================================\n\n")
            for username, password in credenciales:
                f.write(f"Usuario (email): {username}\n")
                f.write(f"Contraseña:    {password}\n")
                f.write("----------------------------------------------\n")
        
        print(f"\n¡Éxito! Las credenciales se han guardado en:")
        print(f"{ruta_salida}")
        print("\nAhora puedes usar esta lista para crear los usuarios en:")
        print("Consola de Firebase -> Authentication -> Add user")

    except IOError as e:
        print(f"\nError: No se pudo escribir en el archivo '{ARCHIVO_SALIDA}': {e}")
    except Exception as e:
        print(f"\nOcurrió un error inesperado: {e}")

if __name__ == "__main__":
    main()