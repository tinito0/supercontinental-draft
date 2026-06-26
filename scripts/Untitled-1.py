
import os
import xml.etree.ElementTree as ET
from tinytag import TinyTag

# --- Configuración ---
# 1. La carpeta donde tienes tus NUEVOS archivos .wav
#    (Asegúrate de que estén en orden, ej: 01.wav, 02.wav, 03.wav...)
#    OJO: ¡Usa barras / o barras dobles \\ en la ruta!
SONGS_FOLDER = r"D:\download\PES"

# 2. La ruta a tu archivo Playlist.xml original
XML_FILE = r"C:\Users\open\Downloads\Playlist.xml"

# 3. Dónde guardar el archivo nuevo
NEW_XML_FILE = r"C:\Users\open\Downloads\Playlist_nueva.xml"
# --- Fin de la Configuración ---

def update_playlist():
    print("Iniciando el script...")
    
    # --- Paso 1: Leer los archivos de música ---
    try:
        # Obtener todos los archivos .wav y ordenarlos
        song_files = sorted([f for f in os.listdir(SONGS_FOLDER) if f.endswith('.wav')])
        if not song_files:
            print(f"Error: No se encontraron archivos .wav en {SONGS_FOLDER}")
            return
            
        print(f"Se encontraron {len(song_files)} canciones .wav.")
        
        # Extraer metadatos (Título y Artista) de cada archivo
        new_songs_metadata = []
        for song_file in song_files:
            file_path = os.path.join(SONGS_FOLDER, song_file)
            tag = TinyTag.get(file_path)
            
            # Si no hay metadatos, usar el nombre del archivo
            title = tag.title if tag.title else os.path.splitext(song_file)[0]
            artist = tag.artist if tag.artist else "Artista Desconocido"
            
            new_songs_metadata.append({'title': title, 'artist': artist})
            
    except FileNotFoundError:
        print(f"Error: La carpeta de canciones no existe: {SONGS_FOLDER}")
        return
    except Exception as e:
        print(f"Error al leer los archivos de música: {e}")
        return

    # --- Paso 2: Modificar el archivo XML ---
    try:
        # Cargar el árbol XML
        tree = ET.parse(XML_FILE)
        root = tree.getroot()

        # Encontrar TODAS las etiquetas <Label> dentro de <CueList>
        cue_labels = root.findall('.//CueList/Label')
        
        print(f"Se encontraron {len(cue_labels)} etiquetas <Label> en el XML.")
        
        # Iterar al mismo tiempo sobre las canciones y las etiquetas
        # (usamos 'zip' para emparejar la canción 1 con la etiqueta 1, etc.)
        num_to_update = min(len(new_songs_metadata), len(cue_labels))
        
        for i in range(num_to_update):
            label = cue_labels[i]
            song = new_songs_metadata[i]
            
            # Guardar los valores originales (¡esto es clave!)
            original_offset = label.get('Offset')
            original_remain = label.get('RemainTimeForFadeoutStart')
            original_fadeout = label.get('FadeoutTime')
            original_wait = label.get('FadeoutWaitTime')
            
            # Actualizar solo el Título y Artista
            label.set('Title', song['title'])
            label.set('Artist', song['artist'])
            
            # (Opcional) Si quieres poner todo en 0 como en tu penúltimo intento:
            # label.set('Offset', '0')
            # label.set('RemainTimeForFadeoutStart', '0')
            # ...etc.
            # Pero lo dejaremos para que mantenga los valores originales.

        # --- Paso 3: Guardar el nuevo XML ---
        tree.write(NEW_XML_FILE, encoding="utf-8", xml_declaration=True)
        print(f"\n¡Éxito! Tu nueva playlist se ha guardado en:")
        print(NEW_XML_FILE)

    except FileNotFoundError:
        print(f"Error: El archivo XML no existe: {XML_FILE}")
    except ET.ParseError:
        print(f"Error: No se pudo 'parsear' (leer) el archivo XML. ¿Está dañado?")
    except Exception as e:
        print(f"Un error inesperado ocurrió al modificar el XML: {e}")

# Ejecutar la función
update_playlist()