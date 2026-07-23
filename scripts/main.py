import pandas as pd
import os
import math
import json
import re
import unicodedata  # Para normalizar tildes

# --- CONFIGURACIÓN ---
NOMBRE_ARCHIVO_JUGADORES = 'jugadores_exportados.csv'
NOMBRE_ARCHIVO_PAISES = 'id_pais_limpio.txt'
NOMBRE_ARCHIVO_LISTA_EXCLUSION = 'lista_jugadores.txt'  # Lista de jugadores a excluir

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
    'MCD': 'Mediocampistas', 'MC': 'Mediocampistas', 'MI': 'Mediocampistas',
    'MD': 'Mediocampistas', 'MO': 'Mediocampistas',
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
# Alineado con las 6 categorías oficiales del PES 2021:
# SHO (Disparo), PAS (Pase), STR (Fuerza), DEF (Defensa) / GK (Arquero), SPD (Velocidad), DRI (Regate)
# Orden horario del hexágono: SHO, PAS, STR, DEF/GK, SPD, DRI
RADAR_STATS_MAP = {
    'STAT_SHO': ['Finishing', 'PlaceKicking', 'Curl', 'KickingPower', 'Heading'],
    'STAT_PAS': ['LowPass', 'LoftedPass', 'TightPossession'],
    'STAT_STR': ['PhysicalContact', 'Jump', 'Stamina'],
    'STAT_DEF': ['DefensiveAwareness', 'BallWinning', 'Aggression'],
    'STAT_SPD': ['Speed', 'Acceleration'],
    'STAT_DRI': ['BallControl', 'Dribbling', 'OffensiveAwareness', 'Balance'],
    # STAT_GK reemplaza a STAT_DEF en el radar cuando el jugador es arquero
    'STAT_GK':  ['GKAwareness', 'GKCatching', 'GKClearing', 'GKReflexes', 'GKReach'],
}

# Columnas de estadísticas del jugador (para el modal)
# Organizado en las 6 categorías PES: SHO, PAS, DRI, SPD, DEF, STR
STATS_JUGADOR_CAMPO = {
    'SHO': ['Finishing', 'PlaceKicking', 'Curl', 'KickingPower', 'Heading'],
    'PAS': ['LowPass', 'LoftedPass', 'TightPossession'],
    'DRI': ['BallControl', 'Dribbling', 'OffensiveAwareness', 'Balance'],
    'SPD': ['Speed', 'Acceleration'],
    'DEF': ['DefensiveAwareness', 'BallWinning', 'Aggression'],
    'STR': ['PhysicalContact', 'Jump', 'Stamina'],
}

# Columnas de estadísticas de portero
STATS_PORTERO = {
    'Portería': ['GKAwareness', 'GKCatching', 'GKClearing', 'GKReflexes', 'GKReach'],
    'Físico':   ['Speed', 'Acceleration', 'Jump', 'PhysicalContact', 'Balance', 'Stamina'],
}

# Habilidades de Jugador (Player Skills)
PLAYER_SKILLS_MAP = {
    'Trickster':         'Elástico',
    'MazingRun':         'Regate Veloz',
    'SpeedingBullet':    'Carrera Veloz',
    'IncisiveRun':       'Desmarque',
    'LongBallExpert':    'Experto P. Largos',
    'EarlyCross':        'Centro Temprano',
    'LongRanger':        'Tiro Larga Dist.',
    'ScissorsFeint':     'Bicicleta',
    'DoubleTouch':       'Doble Toque',
    'FlipFlap':          'Elástica Inversa',
    'MarseilleTurn':     'Ruleta',
    'Sombrero':          'Sombrero',
    'CrossOverTurn':     'Croqueta',
    'CutBehindAndTurn':  'Corte y Giro',
    'ScotchMove':        'Amago Escocés',
    'StepOnSkillcontrol':'Control c/ Suela',
    'HeadingSpecial':    'Cabeceador',
    'LongRangeDrive':    'Disparo Potente',
    'Chipshotcontrol':   'Vaselina',
    'LongRangeShot':     'Remate Lejano',
    'KnuckleShot':       'Tiro s/ Vira',
    'DippingShots':      'Tiro con Rosca',
    'RisingShots':       'Tiro Ascendente',
    'AcrobaticFinishing':'Remate Acrobático',
    'HeelTrick':         'Taco',
    'FirstTimeShot':     'Tiro al Primer Toque',
    'OneTouchPass':      'Pase al Primer Toque',
    'ThroughPassing':    'Pase en Profundidad',
    'WeightedPass':      'Pase Medido',
    'PinpointCrossing':  'Centro Preciso',
    'OutsideCurler':     'Tiro c/ Exterior',
    'Rabona':            'Rabona',
    'NoLookPass':        'Pase sin Mirar',
    'LowLoftedPass':     'Pase Bombeado Tenso',
    'GKLowPunt':         'Saque de Puerta Bajo',
    'GKHighPunt':        'Saque de Puerta Alto',
    'LongThrow':         'Saque Largo',
    'GKLongThrow':       'Saque de Meta Largo',
    'PenaltySpecialist': 'Especialista Penales',
    'GKPenaltySaver':    'Para-Penales',
    'Gamesmanship':      'Pillería',
    'ManMarking':        'Marcaje',
    'TrackBack':         'Persecución',
    'Interception':      'Interceptador',
    'AcrobaticClear':    'Despeje Acrobático',
    'Captaincy':         'Capitanía',
    'SuperSub':          'Súper Suplente',
    'FightingSpirit':    'Espíritu de Lucha'
}
PLAYER_SKILLS_COLUMNS = list(PLAYER_SKILLS_MAP.keys())


# =============================================================================
# LÓGICA DE VALORACIÓN DE JUGADORES
# Calibrada para Supercontinental PES 2021:
#   - Mbappé (OVR 91) ≈ 95M
#   - Plantel competitivo de 21 jugadores (OVR prom ~79) ≈ 440M
#   - Jugador OVR 70 común ≈ 3-9M según edad/pos/rep
#   - Jugador OVR 65 mediocre ≈ 1-3M
# =============================================================================

# Factor base calibrado: 0.003986 × (ovr − 60)^2.8
# El exponente 2.8 (en vez del antiguo cubo sobre ovr-40) suaviza la curva
# media y mantiene la diferenciación correcta en los OVR altos.
FACTOR_BASE = 0.003986


def calcular_valor_base(ovr):
    """
    Retorna el valor base en millones para un OVR dado.
    Usa una potencia de 2.8 sobre (ovr - 60) para una curva
    más gradual que el antiguo (ovr - 40)^3.
    El piso es OVR 65 — todo lo que esté debajo usa la base de OVR 65.
    """
    ovr_efectivo = max(int(ovr), 65)
    return FACTOR_BASE * ((ovr_efectivo - 60) ** 2.8)


def calcular_modificador_edad(edad):
    """
    Modificador de edad con rangos suaves (diferencia máxima: 23%).
    Prime (25-29) vale un poco más; ocaso (34+) un poco menos.
    No penaliza brutalmente a veteranos como el sistema anterior.

    Rangos:
      ≤ 20  → 0.90  (muy joven, todavía crudo)
      21-24 → 1.00  (desarrollándose)
      25-29 → 1.08  (prime físico)
      30-32 → 1.00  (veterano capaz)
      33-35 → 0.92  (bajando)
      36+   → 0.85  (ocaso)
    """
    e = int(edad)
    if e <= 20: return 0.90
    if e <= 24: return 1.00
    if e <= 29: return 1.08
    if e <= 32: return 1.00
    if e <= 35: return 0.92
    return 0.85


def calcular_modificador_posicion(posicion):
    """
    El gol se paga, pero con spread más ajustado que antes (1.15 vs 0.97).
    Spread reducido respecto al sistema anterior (1.20 vs 0.95) para que
    la posición no distorsione demasiado frente al OVR.
    """
    if posicion in ['DC', 'EI', 'ED', 'SD']: return 1.15
    if posicion in ['MO', 'MI', 'MD']:        return 1.10
    if posicion in ['MC', 'MCD']:             return 1.05
    if posicion in ['DFC', 'LI', 'LD']:       return 1.00
    if posicion in ['PT']:                    return 0.97
    return 1.0


def calcular_modificador_reputacion(reputacion):
    """
    Rep 1 = 1.00× (base limpia, sin inflación artificial).
    Rep 8 = 1.28× (28% de premium por fama — Mbappé sigue siendo Mbappé).
    Fórmula: 1.0 + (rep - 1) * 0.04
    Corrección del bug anterior donde rep=1 daba 1.08× en vez de 1.00×.
    """
    try:
        rep = max(1, min(8, int(reputacion)))
        return 1.0 + (rep - 1) * 0.04
    except (ValueError, TypeError):
        return 1.0


def calcular_precio_final(jugador):
    """
    Precio final en millones (M), redondeado a 2 decimales.
    precio = base(ovr) × mod_edad × mod_posicion × mod_reputacion
    """
    try:
        ovr       = int(jugador['OVR_CALCULADO'])
        edad      = int(jugador['Age'])
        posicion  = jugador['POS_NOMBRE']
        reputacion = int(jugador['Reputation'])

        precio = (
            calcular_valor_base(ovr)
            * calcular_modificador_edad(edad)
            * calcular_modificador_posicion(posicion)
            * calcular_modificador_reputacion(reputacion)
        )
        return round(precio, 2)
    except Exception:
        return 0


# =============================================================================
# FUNCIONES DE CARGA Y UTILIDADES
# =============================================================================

def cargar_mapeo_paises(filename):
    """Lee el txt de países y lo convierte en un diccionario."""
    print(f"-> Cargando mapeo de países desde '{filename}'...")
    if not os.path.exists(filename):
        print(f"   Advertencia: No se encontró '{filename}'. El filtro de país estará vacío.")
        return {0: 'N/A'}

    mapeo = {0: 'N/A'}
    pattern = re.compile(r"ID_Pais:\s*(\d+),\s*Pais:\s*(.+)")
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                match = pattern.search(line)
                if match:
                    mapeo[int(match.group(1))] = match.group(2).strip()
        print(f"-> Se cargaron {len(mapeo)} países.")
        return mapeo
    except Exception as e:
        print(f"   Error al leer '{filename}': {e}")
        return {0: 'N/A'}


def normalizar_nombre(texto):
    """Normaliza nombres para comparación: quita tildes, pasa a minúsculas."""
    if not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize('NFD', texto)
    texto = re.sub(r"[\u0300-\u036f]", "", texto)
    return texto.lower().strip()


def cargar_lista_exclusion(filename):
    """Lee un TXT con un nombre por línea y devuelve un set de nombres normalizados."""
    print(f"-> Cargando lista de exclusión desde '{filename}'...")
    if not os.path.exists(filename):
        print(f"   (Info: No se encontró '{filename}'. No se excluirán jugadores de esta lista.)")
        return set()

    nombres = set()
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                nombre_limpio = line.strip()
                if nombre_limpio:
                    nombres.add(normalizar_nombre(nombre_limpio))
        print(f"-> Se cargaron {len(nombres)} nombres para la exclusión.")
        return nombres
    except Exception as e:
        print(f"   Error al leer '{filename}': {e}")
        return set()


# =============================================================================
# PROCESAMIENTO PRINCIPAL
# =============================================================================

def procesar_datos_para_json(lista_exclusion_txt):
    """
    Lee el CSV, aplica filtros de limpieza, calcula OVR/posición/precio
    y devuelve los datos listos para exportar como JSON.
    """
    print(f"-> Cargando base de datos: '{NOMBRE_ARCHIVO_JUGADORES}'...")
    try:
        df = pd.read_csv(
            NOMBRE_ARCHIVO_JUGADORES,
            delimiter=';',
            low_memory=False
        ).rename(columns={'Country': 'Country1'})
    except FileNotFoundError:
        print(f"   ¡Error Crítico! No se encontró '{NOMBRE_ARCHIVO_JUGADORES}'.")
        return None
    except Exception as e:
        print(f"   Error inesperado al leer el CSV: {e}")
        return None

    print(f"-> Datos cargados. Total: {len(df)} jugadores.")

    # -------------------------------------------------------------------------
    # BLOQUE DE FILTROS DE LIMPIEZA
    # -------------------------------------------------------------------------

    if 'Name' in df.columns:
        df['Name_lower'] = df['Name'].astype(str).apply(normalizar_nombre)
    else:
        print("   Advertencia: No se encontró la columna 'Name'.")
        df['Name_lower'] = ""

    # Excluir "Face Edit"
    mascara_face_edit = df['Name_lower'].str.contains('face edit', case=False, na=False)
    df = df[~mascara_face_edit]
    print(f"-> Excluidos {mascara_face_edit.sum()} jugadores 'FACE EDIT'.")

    # Excluir Leyendas
    COLUMNA_ES_LEYENDA = 'Legend'
    if COLUMNA_ES_LEYENDA in df.columns:
        def es_leyenda(val):
            if isinstance(val, bool): return val
            if isinstance(val, (int, float)): return val == 1
            if isinstance(val, str):
                v = val.lower().strip()
                return v in ('true', '1', '1.0')
            return False
        es_leyenda_mask = df[COLUMNA_ES_LEYENDA].apply(es_leyenda)
        print(f"-> Encontrados {es_leyenda_mask.sum()} jugadores marcados como 'Legend=True'.")
    else:
        print(f"   Advertencia: No se encontró la columna '{COLUMNA_ES_LEYENDA}'.")
        es_leyenda_mask = pd.Series([False] * len(df), index=df.index)

    # Excluir lista manual y lista TXT
    en_lista_exclusion_mask = df['Name_lower'].isin(LISTA_EXCLUSION_NOMBRES)
    en_lista_txt_mask = df['Name_lower'].isin(lista_exclusion_txt)
    print(f"-> Encontrados {en_lista_exclusion_mask.sum()} en lista manual, "
          f"{en_lista_txt_mask.sum()} en lista TXT.")

    mascara_total = es_leyenda_mask | en_lista_exclusion_mask | en_lista_txt_mask
    df = df[~mascara_total]
    print(f"-> Excluidos {mascara_total.sum()} jugadores en total. Quedan {len(df)}.")

    # -------------------------------------------------------------------------
    # 1. LIMPIEZA Y MAPEOS BÁSICOS
    # -------------------------------------------------------------------------
    df['OVR_CALCULADO'] = pd.to_numeric(df['OverallStats'], errors='coerce').fillna(0).astype(int)
    df['POS_NOMBRE']    = df['POS'].map(MAPEO_POS_ID).fillna('Desconocido')
    df['Grupo']         = df['POS_NOMBRE'].map(MAPEO_GRUPOS).fillna('Otro')
    df['Foot']          = df['Foot'].apply(lambda x: 'Izquierdo' if x else 'Derecho')
    df['WeakFootUsage'] = pd.to_numeric(df['WeakFootUsage'], errors='coerce').fillna(1).astype(int)
    df['WeakFootAcc']   = pd.to_numeric(df['WeakFootAcc'],   errors='coerce').fillna(1).astype(int)
    df['Reputation']    = pd.to_numeric(df['Reputation'],    errors='coerce').fillna(1).astype(int)

    if 'Country1' not in df.columns: df['Country1'] = 0
    if 'Country2' not in df.columns: df['Country2'] = 0
    df['Country1'] = pd.to_numeric(df['Country1'], errors='coerce').fillna(0).astype(int)
    df['Country2'] = pd.to_numeric(df['Country2'], errors='coerce').fillna(0).astype(int)

    # -------------------------------------------------------------------------
    # 2. HEATMAP DE APTITUD DE POSICIÓN
    # -------------------------------------------------------------------------
    print("-> Procesando aptitud de heatmap...")
    for csv_col, json_key in MAPEO_APTITUD_CSV_A_JSON.items():
        col_nombre = f'Aptitude{json_key}'
        if csv_col in df.columns:
            df[col_nombre] = pd.to_numeric(df[csv_col], errors='coerce').fillna(0).astype(int)
        else:
            df[col_nombre] = 0

    # -------------------------------------------------------------------------
    # 3. MACRO-ESTADÍSTICAS (RADAR)
    # -------------------------------------------------------------------------
    print("-> Pre-calculando macro-estadísticas (gráfico radar)...")
    stats_flat = [s for sublist in RADAR_STATS_MAP.values() for s in sublist]
    for col in stats_flat:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(40)
        else:
            df[col] = 40

    for stat_radar, componentes in RADAR_STATS_MAP.items():
        validos = [c for c in componentes if c in df.columns]
        if validos:
            df[stat_radar] = df[validos].mean(axis=1).round().astype(int)
        else:
            df[stat_radar] = 40

    # -------------------------------------------------------------------------
    # 4. CÁLCULO DE PRECIO (NUEVA FÓRMULA)
    # -------------------------------------------------------------------------
    print("-> Calculando valor de mercado de jugadores...")
    df['Precio'] = df.apply(calcular_precio_final, axis=1)

    # -------------------------------------------------------------------------
    # 5. HABILIDADES DE JUGADOR
    # -------------------------------------------------------------------------
    print("-> Procesando habilidades de jugador...")
    for col in PLAYER_SKILLS_COLUMNS:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).lower() == 'true')
        else:
            df[col] = False

    # -------------------------------------------------------------------------
    # 6. PREPARACIÓN DEL JSON
    # -------------------------------------------------------------------------
    columnas_stats_flat = (
        [s for sublist in STATS_JUGADOR_CAMPO.values() for s in sublist] +
        [s for sublist in STATS_PORTERO.values() for s in sublist]
    )
    for col in columnas_stats_flat:
        if col not in df.columns:
            df[col] = 0

    columnas_principales = [
        'Id', 'Name', 'Age', 'Height', 'Weight', 'Foot', 'PlayingStyle',
        'OVR_CALCULADO', 'POS_NOMBRE', 'Precio', 'Reputation',
        'Grupo', 'Country1', 'Country2',
        'Name_lower', 'WeakFootUsage', 'WeakFootAcc'
    ]
    columnas_heatmap = [f'Aptitude{v}' for v in MAPEO_APTITUD_CSV_A_JSON.values()]
    columnas_radar   = list(RADAR_STATS_MAP.keys())
    columnas_skills  = PLAYER_SKILLS_COLUMNS

    columnas_a_incluir = list(set(
        columnas_principales +
        columnas_heatmap +
        columnas_stats_flat +
        columnas_radar +
        columnas_skills
    ))

    columnas_existentes = [c for c in columnas_a_incluir if c in df.columns]
    df_seleccionado = df[columnas_existentes].fillna('')
    datos_para_json = df_seleccionado.to_dict('records')

    print("-> Procesamiento completado.")
    return datos_para_json


# =============================================================================
# FLUJO PRINCIPAL
# =============================================================================

def main():
    os.system('cls' if os.name == 'nt' else 'clear')
    print("===============================================")
    print("   Constructor del Buscador Web Supercontinental")
    print("===============================================")

    # 1. Cargar mapeo de países
    mapeo_paises = cargar_mapeo_paises(NOMBRE_ARCHIVO_PAISES)
    if not mapeo_paises:
        print("No se pudo cargar el mapeo de países. El filtro no funcionará.")
        mapeo_paises = {0: 'N/A'}

    # 2. Cargar lista de exclusión TXT
    lista_exclusion_txt = cargar_lista_exclusion(NOMBRE_ARCHIVO_LISTA_EXCLUSION)

    # 3. Procesar datos de jugadores
    datos_jugadores = procesar_datos_para_json(lista_exclusion_txt)

    if datos_jugadores is not None:
        # 4. Guardar JSON de jugadores
        try:
            with open(SALIDA_JUGADORES_JSON, 'w', encoding='utf-8') as f:
                json.dump(datos_jugadores, f, ensure_ascii=False)
            print(f"\n¡Éxito! '{SALIDA_JUGADORES_JSON}' generado con {len(datos_jugadores)} jugadores.")
        except Exception as e:
            print(f"\nError al guardar '{SALIDA_JUGADORES_JSON}': {e}")

        # 5. Guardar JSON de países
        try:
            with open(SALIDA_PAISES_JSON, 'w', encoding='utf-8') as f:
                json.dump(mapeo_paises, f, ensure_ascii=False)
            print(f"¡Éxito! '{SALIDA_PAISES_JSON}' generado.")
        except Exception as e:
            print(f"\nError al guardar '{SALIDA_PAISES_JSON}': {e}")

        print("\nProceso completado. Podés usar estos JSON en tu aplicación de React.")
    else:
        print("El programa no pudo continuar.")


if __name__ == "__main__":
    main()
