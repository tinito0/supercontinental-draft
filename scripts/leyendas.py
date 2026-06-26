import os
import json

# --- Configuración ---
# Asegúrate de que estas rutas sean correctas desde donde ejecutes el script
JSON_FILE = os.path.join('public', 'jugadores.json')
FOTOS_DIR = os.path.join('public', 'fotos_jugadores_copia')
# ---------------------

def limpiar_fotos_huerfanas():
    print(f"Iniciando script de limpieza...")
    print(f"Cargando base de datos: {JSON_FILE}")

    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            jugadores = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: No se pudo encontrar el archivo '{JSON_FILE}'.")
        print("Asegúrate de ejecutar este script desde la carpeta raíz de tu proyecto (PROGRAMA SUPER2).")
        return
    except json.JSONDecodeError:
        print(f"ERROR: El archivo '{JSON_FILE}' está corrupto o no es un JSON válido.")
        return
    except Exception as e:
        print(f"Ha ocurrido un error inesperado al leer el JSON: {e}")
        return

    if not os.path.exists(FOTOS_DIR):
        print(f"ERROR: No se pudo encontrar el directorio de fotos: '{FOTOS_DIR}'.")
        print("Asegúrate de que la carpeta 'public/fotos_jugadores' exista.")
        return

    print(f"Se encontraron {len(jugadores)} jugadores en la base de datos.")
    

    # --- TAREA 1: Buscando fotos de Leyendas (DESACTIVADA) ---
    print("\n--- TAREA 1: Omitiendo borrado de Leyendas (según solicitud) ---")
    
    # borrados_count = 0
    # leyendas_encontradas = 0
    # print("\n--- TAREA 1: Buscando fotos de Leyendas para borrar ---")
    # for jugador in jugadores:
    #     es_leyenda = (jugador.get('Grupo') == 'Leyendas')
    #     if es_leyenda:
    #         leyendas_encontradas += 1
    #         try:
    #             player_id = jugador['Id']
    #             file_name = f"{player_id}.png"
    #             file_path = os.path.join(FOTOS_DIR, file_name)
    #             if os.path.isfile(file_path):
    #                 os.remove(file_path)
    #                 print(f"  [BORRADO] {file_name} (ID: {player_id}, Nombre: {jugador.get('Name', 'N/A')})")
    #                 borrados_count += 1
    #         except KeyError:
    #             print(f"  [ERROR] Un jugador leyenda no tiene 'Id' en el JSON. Datos: {jugador}")
    #         except Exception as e:
    #             print(f"  [ERROR] No se pudo borrar el archivo para el ID {jugador.get('Id', 'N/A')}: {e}")
    # print("\n--- Limpieza de Leyendas Finalizada ---")
    # print(f"Jugadores leyenda encontrados en el JSON: {leyendas_encontradas}")
    # print(f"Archivos PNG de leyendas eliminados: {borrados_count}")


    # --- TAREA 2: Encontrar y BORRAR Huérfanos (PNGs sin jugador en JSON) ---
    print("\n--- TAREA 2: Buscando y borrando fotos huérfanas (PNGs sin jugador en JSON) ---")

    # Paso 1: Crear un set con todos los IDs del JSON (como strings)
    try:
        json_ids = set(str(j['Id']) for j in jugadores)
        print(f"Se compararán las fotos contra {len(json_ids)} IDs únicos del JSON.")
    except KeyError:
        print("  [ERROR] Un jugador en el JSON no tiene 'Id'. Omitiendo esa entrada.")
        json_ids = set()
        for j in jugadores:
            if 'Id' in j:
                json_ids.add(str(j['Id']))
    
    if not json_ids:
        print("No se pudieron cargar IDs del JSON. Abortando búsqueda de huérfanos.")
        return # Salimos de la función principal

    # Paso 2: Recorrer la carpeta de fotos
    huerfanos_count = 0
    borrados_huerfanos_count = 0
    for file_name in os.listdir(FOTOS_DIR):
        if file_name.endswith('.png'):
            # Obtenemos el ID de la imagen (ej: "7511.png" -> "7511")
            image_id = os.path.splitext(file_name)[0]
            
            # Paso 3: Comparar
            if image_id not in json_ids:
                print(f"  [HUÉRFANO] {file_name} no corresponde a ningún jugador en el JSON.")
                huerfanos_count += 1
                
                # --- ¡CORRECCIÓN! Este bloque AHORA ESTÁ DENTRO del 'if' ---
                try:
                    file_path = os.path.join(FOTOS_DIR, file_name)
                    os.remove(file_path)
                    print(f"    -> [BORRADO] {file_name}")
                    borrados_huerfanos_count += 1
                except Exception as e:
                    print(f"    -> [ERROR AL BORRAR] {e}")
                # ---------------------------------------------------------

    if huerfanos_count == 0:
        print("¡Excelente! No se encontraron fotos huérfanas.")
    else:
        print(f"\nSe encontraron {huerfanos_count} fotos huérfanas.")
        print(f"Se eliminaron {borrados_huerfanos_count} fotos huérfanas.")
    
    print("\n--- Proceso completado ---")


if __name__ == "__main__":
    limpiar_fotos_huerfanas()