import pandas as pd
import os
import math
import json
import base64
import re
import unicodedata # Para normalizar tildes

# --- CONFIGURACIÓN ---
NOMBRE_ARCHIVO_JUGADORES = 'jugadores_exportados.csv'
NOMBRE_ARCHIVO_PAISES = 'id_pais_limpio.txt' 
NOMBRE_ARCHIVO_LISTA_EXCLUSION = 'lista_jugadores.txt' # Lista de jugadores a excluir

# --- ARCHIVOS DE SALIDA ---
SALIDA_JUGADORES_JSON = 'jugadores.json'
SALIDA_PAISES_JSON = 'paises.json'

# --- LISTA DE EXCLUSIÓN MANUAL ---
# Nombres en minúsculas y sin tildes
LISTA_EXCLUSION_NOMBRES = {
    'pele',
    'd. maradona',
    'tite',
    'gallardo',
    'm. gallardo',
    'aimar',
    'p. aimar'
}

# Mapeo del ID numérico de la columna 'POS' a un nombre legible.
MAPEO_POS_ID = {
    0: 'PT', 1: 'DFC', 2: 'LI', 3: 'LD', 4: 'MCD', 5: 'MC',
    6: 'MI', 7: 'MD', 8: 'MO', 9: 'EI', 10: 'ED', 11: 'SD', 12: 'DC'
}

# Mapeo de Posición a Grupo General
MAPEO_GRUPOS = {
    'PT': 'Arqueros',
    'DFC': 'Defensores', 'LI': 'Defensores', 'LD': 'Defensores',
    'MCD': 'Mediocampistas', 'MC': 'Mediocampistas', 'MI': 'Mediocampistas', 'MD': 'Mediocampistas', 'MO': 'Mediocampistas',
    'DC': 'Delanteros', 'SD': 'Delanteros', 'EI': 'Delanteros', 'ED': 'Delanteros'
}

# Columnas de aptitud de posición (para el heatmap)
MAPEO_APTITUD_CSV_A_JSON = {
    'GK': 'PT',
    'CB': 'DFC',
    'LB': 'LI',
    'RB': 'LD',
    'DMF': 'MCD',
    'CMF': 'MC',
    'LMF': 'MI',
    'RMF': 'MD',
    'AMF': 'MO',
    'LWF': 'EI',
    'RWF': 'ED',
    'SS': 'SD',
    'CF': 'DC'
}
# Definición de Macro-Estadísticas para el Gráfico de Radar
RADAR_STATS_MAP = {
    'STAT_Ataque': ['OffensiveAwareness', 'Finishing'],
    'STAT_Tecnica': ['BallControl', 'Dribbling', 'TightPossession'],
    'STAT_Pase': ['LowPass', 'LoftedPass', 'Curl'],
    'STAT_Fisico': ['PhysicalContact', 'Stamina', 'Jump', 'Balance'],
    'STAT_Velocidad': ['Speed', 'Acceleration', 'KickingPower'],
    'STAT_Defensa': ['DefensiveAwareness', 'BallWinning', 'Aggression', 'Heading']
}

# Columnas de estadísticas del jugador (para el modal)
STATS_JUGADOR_CAMPO = {
    'Ataque': ['OffensiveAwareness', 'BallControl', 'Dribbling', 'TightPossession'],
    'Disparo': ['Finishing', 'Heading', 'PlaceKicking', 'Curl', 'KickingPower'],
    'Pase': ['LowPass', 'LoftedPass'],
    'Físico': ['Speed', 'Acceleration', 'Jump', 'PhysicalContact', 'Balance', 'Stamina'],
    'Defensa': ['DefensiveAwareness', 'BallWinning', 'Aggression']
}

# Columnas de estadísticas de portero
STATS_PORTERO = {
    'Portería': ['GKAwareness', 'GKCatching', 'GKClearing', 'GKReflexes', 'GKReach'],
    'Físico': ['Speed', 'Acceleration', 'Jump', 'PhysicalContact', 'Balance', 'Stamina'],
}

# Habilidades de Jugador (Player Skills)
PLAYER_SKILLS_MAP = {
    'Trickster': 'Elástico',
    'MazingRun': 'Regate Veloz',
    'SpeedingBullet': 'Carrera Veloz',
    'IncisiveRun': 'Desmarque',
    'LongBallExpert': 'Experto P. Largos',
    'EarlyCross': 'Centro Temprano',
    'LongRanger': 'Tiro Larga Dist.',
    'ScissorsFeint': 'Bicicleta',
    'DoubleTouch': 'Doble Toque',
    'FlipFlap': 'Elástica Inversa',
    'MarseilleTurn': 'Ruleta',
    'Sombrero': 'Sombrero',
    'CrossOverTurn': 'Croqueta',
    'CutBehindAndTurn': 'Corte y Giro',
    'ScotchMove': 'Amago Escocés',
    'StepOnSkillcontrol': 'Control c/ Suela',
    'HeadingSpecial': 'Cabeceador',
    'LongRangeDrive': 'Disparo Potente',
    'Chipshotcontrol': 'Vaselina',
    'LongRangeShot': 'Remate Lejano',
    'KnuckleShot': 'Tiro s/ Vira',
    'DippingShots': 'Tiro con Rosca',
    'RisingShots': 'Tiro Ascendente',
    'AcrobaticFinishing': 'Remate Acrobático',
    'HeelTrick': 'Taco',
    'FirstTimeShot': 'Tiro al Primer Toque',
    'OneTouchPass': 'Pase al Primer Toque',
    'ThroughPassing': 'Pase en Profundidad',
    'WeightedPass': 'Pase Medido',
    'PinpointCrossing': 'Centro Preciso',
    'OutsideCurler': 'Tiro c/ Exterior',
    'Rabona': 'Rabona',
    'NoLookPass': 'Pase sin Mirar',
    'LowLoftedPass': 'Pase Bombeado Tenso',
    'GKLowPunt': 'Saque de Puerta Bajo',
    'GKHighPunt': 'Saque de Puerta Alto',
    'LongThrow': 'Saque Largo',
    'GKLongThrow': 'Saque de Meta Largo',
    'PenaltySpecialist': 'Especialista Penales',
    'GKPenaltySaver': 'Para-Penales',
    'Gamesmanship': 'Pillería',
    'ManMarking': 'Marcaje',
    'TrackBack': 'Persecución',
    'Interception': 'Interceptador',
    'AcrobaticClear': 'Despeje Acrobático',
    'Captaincy': 'Capitanía',
    'SuperSub': 'Súper Suplente',
    'FightingSpirit': 'Espíritu de Lucha'
}
PLAYER_SKILLS_COLUMNS = list(PLAYER_SKILLS_MAP.keys())


def cargar_mapeo_paises(filename):
    """Lee el txt de países y lo convierte en un diccionario."""
    print(f"-> Cargando mapeo de países desde '{filename}'...")
    if not os.path.exists(filename):
        print(f"Advertencia: No se encontró el archivo '{filename}'. El filtro de país estará vacío.")
        return {0: 'N/A'} 
        
    mapeo = {0: 'N/A'} 
    pattern = re.compile(r"ID_Pais:\s*(\d+),\s*Pais:\s*(.+)")
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                match = pattern.search(line)
                if match:
                    pais_id = int(match.group(1))
                    pais_nombre = match.group(2).strip()
                    mapeo[pais_id] = pais_nombre
        print(f"-> Se cargaron {len(mapeo)} países.")
        return mapeo
    except Exception as e:
        print(f"Error al leer el archivo de países '{filename}': {e}")
        return {0: 'N/A'}

def normalizar_nombre(texto):
    """Función para normalizar nombres para comparación (quitar tildes, minúsculas, strip)."""
    if not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize('NFD', texto)
    texto = re.sub(r"[\u0300-\u036f]", "", texto)
    return texto.lower().strip()

def cargar_lista_exclusion(filename):
    """Lee un TXT con un nombre por línea y devuelve un set de nombres normalizados."""
    print(f"-> Cargando lista de EXCLUSIÓN desde '{filename}'...")
    if not os.path.exists(filename):
        print(f"-> (Info: No se encontró el archivo '{filename}'. No se excluirán jugadores de esta lista.)")
        return set() 
        
    nombres = set()
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                nombre_limpio = line.strip()
                if nombre_limpio:
                    nombres.add(normalizar_nombre(nombre_limpio))
        print(f"-> Se cargaron {len(nombres)} nombres para la EXCLUSIÓN.")
        return nombres
    except Exception as e:
        print(f"Error al leer la lista de exclusión '{filename}': {e}")
        return set()


# --- LÓGICA PES 2021 (SIN PROGRESIÓN) ---

def calcular_valor_base(rating):
    # Subimos el factor a 280 porque ya no hay multiplicadores gigantes de edad
    if rating < 65: return 2000000
    valor = (rating - 40)**3 * 300
    return int(valor)

def calcular_modificador_edad(edad):
    e = int(edad)
    # LÓGICA: RENDIMIENTO INMEDIATO (PES 2021)
    
    # JÓVENES (16-22): 
    # En PES suelen ser rápidos, pero en esta liga no van a mejorar.
    # Ya no valen 1.50x. Valen lo normal.
    if e < 23: return 1.20 
    
    # PRIME FÍSICO (23-29): 
    # La mejor edad en PES. Tienen el físico desarrollado y aguantan 90 min.
    # Estos deben ser los MÁS CAROS ahora.
    if 23 <= e < 30: return 1.25 
    
    # VETERANOS (30-33): 
    # Siguen siendo buenísimos, solo vigilar la resistencia.
    # Mantienen buen valor.
    if 30 <= e < 34: return 1.10 
    
    # OCASO (34+): 
    # Aquí PES suele matarles la Stamina/Velocidad. Descuento.
    return 0.85 

def calcular_modificador_posicion(posicion):
    # Mantenemos igual, el gol se paga.
    atacantes = ['DC', 'EI', 'ED', 'SD']
    creativos = ['MO', 'MI', 'MD'] 
    medios = ['MC', 'MCD']
    defensa = ['DFC', 'LI', 'LD']
    portero = ['PT']
    
    if posicion in atacantes: return 1.20 
    if posicion in creativos: return 1.15 
    if posicion in medios: return 1.10
    if posicion in defensa: return 1.00
    if posicion in portero: return 0.95 
    return 1.0

def calcular_modificador_reputacion(reputacion):
    # Mantenemos el bonus leve de "fama" (camisetas vendidas, etc.)
    try:
        rep = int(reputacion)
        return 1.0 + (rep * 0.08) 
    except:
        return 1.0

def calcular_precio_final(jugador):
    try:
        rating = int(jugador['OVR_CALCULADO'])
        edad = int(jugador['Age'])
        posicion = jugador['POS_NOMBRE']
        reputacion = int(jugador['Reputation'])
        
        base = calcular_valor_base(rating)
        mod_edad = calcular_modificador_edad(edad)
        mod_pos = calcular_modificador_posicion(posicion)
        mod_rep = calcular_modificador_reputacion(reputacion)
        
        precio = base * mod_edad * mod_pos * mod_rep
        return round(precio / 1000000, 2)
    except Exception:
        return 0
# --- Procesamiento de Datos ---
def procesar_datos_para_json(lista_exclusion_txt):
    """
    Lee el CSV, excluye leyendas/face edit/lista Txt,
    calcula el OVR, la posición y el precio, y prepara los datos para el JSON.
    """
    print(f"-> Cargando base de datos: '{NOMBRE_ARCHIVO_JUGADORES}'...")
    try:
        df = pd.read_csv(NOMBRE_ARCHIVO_JUGADORES, delimiter=';', low_memory=False).rename(columns={'Country': 'Country1'})
    except FileNotFoundError:
        print(f"¡Error Crítico! No se encontró el archivo '{NOMBRE_ARCHIVO_JUGADORES}'.")
        return None
    except Exception as e:
        print(f"Ocurrió un error inesperado al leer el CSV: {e}")
        return None

    print(f"-> Datos cargados. Total: {len(df)} jugadores.")

    # --- INICIO BLOQUE DE FILTROS DE LIMPIEZA (EJECUTADO PRIMERO) ---
    
    if 'Name' in df.columns:
        df['Name_lower'] = df['Name'].astype(str).apply(normalizar_nombre)
    else:
        print("-> (Advertencia: No se encontró la columna 'Name'. Los filtros de nombre no funcionarán.)")
        df['Name_lower'] = "" 

    mascara_face_edit = df['Name_lower'].str.contains('face edit', case=False, na=False)
    num_face_edit = mascara_face_edit.sum()
    df = df[~mascara_face_edit] 
    print(f"-> Se han excluido {num_face_edit} jugadores 'FACE EDIT'.")

    COLUMNA_ES_LEYENDA = 'Legend'
    
    if COLUMNA_ES_LEYENDA in df.columns:
        def es_leyenda(val):
            if isinstance(val, bool): return val
            if isinstance(val, (int, float)): return val == 1
            if isinstance(val, str):
                val_str = val.lower().strip()
                return val_str == 'true' or val_str == '1' or val_str == '1.0'
            return False
        es_leyenda_mask = df[COLUMNA_ES_LEYENDA].apply(es_leyenda)
        print(f"-> Se encontraron {es_leyenda_mask.sum()} jugadores marcados como 'Legend=True'.")
    else:
        print(f"-> (Advertencia: No se encontró la columna '{COLUMNA_ES_LEYENDA}'.)")
        es_leyenda_mask = pd.Series([False] * len(df), index=df.index) 

    en_lista_exclusion_mask = df['Name_lower'].isin(LISTA_EXCLUSION_NOMBRES)
    print(f"-> Se encontraron {en_lista_exclusion_mask.sum()} jugadores en la lista de exclusión manual.")

    en_lista_txt_mask = df['Name_lower'].isin(lista_exclusion_txt)
    print(f"-> Se encontraron {en_lista_txt_mask.sum()} jugadores en la lista de exclusión TXT.")

    mascara_total_excluir = es_leyenda_mask | en_lista_exclusion_mask | en_lista_txt_mask
    num_excluidos = mascara_total_excluir.sum()
    df = df[~mascara_total_excluir] 
    print(f"-> Se han excluido un total de {num_excluidos} jugadores (Leyendas, Lista Manual, Lista TXT).")
        
    print(f"-> Quedan {len(df)} jugadores para procesar.")
    # --- FIN BLOQUE DE FILTROS DE LIMPIEZA ---


    # --- 1. Limpieza y Mapeos Básicos ---
    df['OVR_CALCULADO'] = pd.to_numeric(df['OverallStats'], errors='coerce').fillna(0).astype(int)
    df['POS_NOMBRE'] = df['POS'].map(MAPEO_POS_ID).fillna('Desconocido')
    df['Grupo'] = df['POS_NOMBRE'].map(MAPEO_GRUPOS).fillna('Otro')
    df['Foot'] = df['Foot'].apply(lambda x: 'Izquierdo' if x else 'Derecho')
    df['WeakFootUsage'] = pd.to_numeric(df['WeakFootUsage'], errors='coerce').fillna(1).astype(int)
    df['WeakFootAcc'] = pd.to_numeric(df['WeakFootAcc'], errors='coerce').fillna(1).astype(int)
    df['Reputation'] = pd.to_numeric(df['Reputation'], errors='coerce').fillna(1).astype(int)
    
    if 'Country1' not in df.columns: df['Country1'] = 0
    if 'Country2' not in df.columns: df['Country2'] = 0
    df['Country1'] = pd.to_numeric(df['Country1'], errors='coerce').fillna(0).astype(int)
    df['Country2'] = pd.to_numeric(df['Country2'], errors='coerce').fillna(0).astype(int)


    # --- INICIO DE CORRECCIÓN HEATMAP ---
    print("-> Procesando aptitud de heatmap...")
    for csv_col, json_key in MAPEO_APTITUD_CSV_A_JSON.items():
        aptitud_col_nombre = f'Aptitude{json_key}'
        if csv_col in df.columns:
            # Convierte la columna del CSV (ej. 'CB') a numérico y la renombra a (ej. 'AptitudeDFC')
            df[aptitud_col_nombre] = pd.to_numeric(df[csv_col], errors='coerce').fillna(0).astype(int)
        else:
            # Si la columna 'CB' no existe, crea 'AptitudeDFC' con 0s
            df[aptitud_col_nombre] = 0
    # --- FIN DE CORRECCIÓN HEATMAP ---


    # --- 2. Pre-cálculo de Macro-Estadísticas (Radar) ---
    print("-> Pre-calculando macro-estadísticas (gráfico radar)...")
    stats_individuales_flat = [item for sublist in RADAR_STATS_MAP.values() for item in sublist]
    for col in stats_individuales_flat:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(40) 
        else:
            df[col] = 40
    for stat_radar, componentes in RADAR_STATS_MAP.items():
        componentes_validos = [c for c in componentes if c in df.columns]
        if componentes_validos:
            df[stat_radar] = df[componentes_validos].mean(axis=1).round().astype(int)
        else:
            df[stat_radar] = 40

    # --- 3. Cálculo de Precio ---
    print("-> Calculando valor de mercado de jugadores...")
    df['Precio'] = df.apply(calcular_precio_final, axis=1)

    # --- 4. Limpieza de Habilidades de Jugador ---
    print("-> Procesando habilidades de jugador...")
    for col in PLAYER_SKILLS_COLUMNS:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).lower() == 'true')
        else:
            df[col] = False 
            
    # --- 5. Preparación del JSON ---
    columnas_stats_nombres_flat = [item for sublist in STATS_JUGADOR_CAMPO.values() for item in sublist] + \
                                  [item for sublist in STATS_PORTERO.values() for item in sublist]
    for col in columnas_stats_nombres_flat:
        if col not in df.columns:
            df[col] = 0 

    columnas_principales = [
        'Id', 'Name', 'Age', 'Height', 'Weight', 'Foot', 'PlayingStyle',
        'OVR_CALCULADO', 'POS_NOMBRE', 'Precio', 'Reputation',
        'Grupo', 'Country1', 'Country2', 
        'Name_lower','WeakFootUsage','WeakFootAcc' # Para la búsqueda rápida
    ]
    
    # CORREGIDO: Esta variable no estaba definida y se usan las claves del mapeo
    columnas_heatmap = [f'Aptitude{json_key}' for json_key in MAPEO_APTITUD_CSV_A_JSON.values()]
    columnas_radar = list(RADAR_STATS_MAP.keys()) 
    columnas_skills = PLAYER_SKILLS_COLUMNS 
    
    columnas_a_incluir = list(set(
        columnas_principales + 
        columnas_heatmap + 
        columnas_stats_nombres_flat + 
        columnas_radar +
        columnas_skills 
    ))
    
    columnas_existentes = [col for col in columnas_a_incluir if col in df.columns]
    
    df_seleccionado = df[columnas_existentes].fillna('')
    datos_para_json = df_seleccionado.to_dict('records')
    
    print("-> Procesamiento completado.")
    return datos_para_json

# --- ELIMINADO: generar_html_interactivo ---
# --- ELIMINADO: codificar_imagen_a_data_url ---

# --- Flujo Principal de la Aplicación (Script) ---
def main():
    """Función principal que ejecuta el procesamiento y la generación del HTML."""
    os.system('cls' if os.name == 'nt' else 'clear') 
    print("===============================================")
    print("   Constructor del Buscador Web Supercontinental ")
    print("===============================================")
    
    # 1. Cargar Mapeo de Países
    mapeo_paises = cargar_mapeo_paises(NOMBRE_ARCHIVO_PAISES)
    if not mapeo_paises:
        print("No se pudo cargar el mapeo de países. El filtro no funcionará.")
        mapeo_paises = {0: 'N/A'}

    # 2. Cargar Lista de Exclusión TXT
    lista_exclusion_txt = cargar_lista_exclusion(NOMBRE_ARCHIVO_LISTA_EXCLUSION) 

    # 3. ELIMINADO: Carga de Imágenes

    # 4. Procesar datos de jugadores (pasando la lista de exclusión)
    datos_jugadores = procesar_datos_para_json(lista_exclusion_txt)
    
    if datos_jugadores is not None:
        # 5. Guardar JSON de Jugadores
        try:
            with open(SALIDA_JUGADORES_JSON, 'w', encoding='utf-8') as f:
                json.dump(datos_jugadores, f, ensure_ascii=False)
            print(f"\n¡Éxito! Se ha generado '{SALIDA_JUGADORES_JSON}' con {len(datos_jugadores)} jugadores.")
        except Exception as e:
            print(f"\nOcurrió un error al guardar '{SALIDA_JUGADORES_JSON}': {e}")
            
        # 6. Guardar JSON de Países
        try:
            with open(SALIDA_PAISES_JSON, 'w', encoding='utf-8') as f:
                json.dump(mapeo_paises, f, ensure_ascii=False)
            print(f"¡Éxito! Se ha generado '{SALIDA_PAISES_JSON}'.")
        except Exception as e:
            print(f"\nOcurrió un error al guardar '{SALIDA_PAISES_JSON}': {e}")
            
        print("\nProceso completado. Ahora puedes usar estos archivos JSON en tu aplicación de React.")
        
    else:
        print("El programa no pudo continuar.")

if __name__ == "__main__":
    main()