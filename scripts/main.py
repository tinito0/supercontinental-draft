import pandas as pd
import numpy as np
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

# Mapeo del ID numérico de la columna 'PlayingStyle' a un nombre legible.
MAPEO_PLAYING_STYLE = {
    0: 'Ninguno',
    1: 'Cazagoles',
    2: 'Señuelo',
    3: 'Hombre de Área',
    4: 'Extremo Prolífico',
    5: 'El Diez Clásico',
    6: 'Jugador de Huecos',
    7: 'Omnipresente',
    8: 'El Protector',
    9: 'El Destructor',
    10: 'Atacante Extra',
    11: 'Lateral Ofensivo',
    12: 'Lateral Defensivo',
    13: 'Referente',
    14: 'Creador de Jugadas',
    15: 'Creación',
    16: 'Portero Ofensivo',
    17: 'Portero Defensivo',
    18: 'Extremo Móvil',
    19: 'Especialista en Centros',
    20: 'Organizador',
    21: 'Lateral Finalizador',
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
# LÓGICA DE VALORACIÓN DE JUGADORES — TEMPORADA 3
#
#   precio = ancla(OVR) × edad × posición × meta_posición
#
# - ancla(OVR): se calibra para que la mediana de cada OVR quede igual a la de
#   la fórmula T2 (acuerdo de la reunión: misma escala de precios). Lo que cambia
#   es el reparto entre jugadores del mismo OVR, no el nivel general.
# - Sin reputación: la fama no juega en PES.
# - Edad casi plana: la T3 dura una temporada y la edad no cambia stats.
# - meta_posición: el OVR se calcula con pesos distintos por posición (ver
#   r/WEPES, "How PES 2021 calculates Overall Rating"). El modificador compara a
#   cada jugador contra los de su misma posición y OVR en tres cosas:
#     A. Núcleo: las stats que más pesan en el OVR de su puesto.
#     B. Puntos ciegos: stats que ese OVR casi no pesa y en cancha importan.
#        Nunca repiten el núcleo (al extremo no se le cobra el ritmo: su OVR
#        ya lo paga).
#     C. Habilidades clave de su puesto.
# - Debajo de OVR 66 rige un piso escalonado fijo.
# =============================================================================

# --- Fórmula T2 (se conserva como referencia de escala y para el control) ---
FACTOR_BASE_T2 = 0.003986


def calcular_valor_base_t2(ovr: int) -> float:
    """Valor base T2 en millones: 0.003986 × (ovr − 60)^2.8, con piso en OVR 65."""
    ovr_efectivo = max(int(ovr), 65)
    return FACTOR_BASE_T2 * ((ovr_efectivo - 60) ** 2.8)


def calcular_modificador_edad_t2(edad: int) -> float:
    e = int(edad)
    if e <= 20: return 0.90
    if e <= 24: return 1.00
    if e <= 29: return 1.08
    if e <= 32: return 1.00
    if e <= 35: return 0.92
    return 0.85


def calcular_modificador_reputacion_t2(reputacion: int) -> float:
    try:
        rep = max(1, min(8, int(reputacion)))
        return 1.0 + (rep - 1) * 0.04
    except (ValueError, TypeError):
        return 1.0


def calcular_modificador_posicion(posicion: str) -> float:
    """El gol se paga: igual que en T2."""
    if posicion in ['DC', 'EI', 'ED', 'SD']: return 1.15
    if posicion in ['MO', 'MI', 'MD']:        return 1.10
    if posicion in ['MC', 'MCD']:             return 1.05
    if posicion in ['DFC', 'LI', 'LD']:       return 1.00
    if posicion in ['PT']:                    return 0.97
    return 1.0


def calcular_precio_t2(jugador) -> float:
    """Precio con la fórmula T2 (base × edad × posición × reputación)."""
    try:
        return round(
            calcular_valor_base_t2(int(jugador['OVR_CALCULADO']))
            * calcular_modificador_edad_t2(int(jugador['Age']))
            * calcular_modificador_posicion(jugador['POS_NOMBRE'])
            * calcular_modificador_reputacion_t2(int(jugador['Reputation'])),
            2,
        )
    except (KeyError, ValueError, TypeError):
        return 0


# --- Fórmula T3 ---

OVR_MINIMO_CURVA = 66
# Escalonado y siempre por debajo del más barato de OVR 66 (~$0,6M).
PISO_PRECIO_BAJO = {60: 0.30, 61: 0.34, 62: 0.38, 63: 0.42, 64: 0.47, 65: 0.52}
PISO_PRECIO_MINIMO = 0.30  # OVR < 60


def calcular_modificador_edad(edad: int) -> float:
    """Edad casi plana (0,97-1,02): en una temporada la edad no cambia los stats."""
    e = int(edad)
    if e <= 20: return 0.97
    if e <= 29: return 1.02
    if e <= 32: return 1.00
    return 0.97


# A. Núcleo: stats que más pesan en el OVR de cada puesto, con su peso (% del
#    total) según la reconstrucción del post (pesdb, ~14.700 jugadores). Para
#    EI/ED y MI/MD se usan los pesos enteros de la fórmula real que publicó el
#    autor en los comentarios.
NUCLEO_POR_POSICION: dict[str, dict[str, int]] = {
    'PT':  {'GKReach': 21, 'GKAwareness': 21, 'GKReflexes': 14, 'GKCatching': 13, 'GKClearing': 13},
    'DFC': {'DefensiveAwareness': 12, 'PhysicalContact': 10, 'Jump': 10, 'Heading': 10, 'BallWinning': 9},
    'LI':  {'DefensiveAwareness': 8, 'Stamina': 8, 'Speed': 7, 'Acceleration': 7, 'LoftedPass': 7},
    'LD':  {'Speed': 8, 'Stamina': 8, 'DefensiveAwareness': 8, 'LoftedPass': 7, 'BallControl': 7},
    'MCD': {'BallControl': 10, 'LoftedPass': 9, 'LowPass': 8, 'Stamina': 8, 'Curl': 7},
    'MC':  {'BallControl': 11, 'LowPass': 11, 'LoftedPass': 10, 'Stamina': 9, 'Dribbling': 7},
    'MI':  {'Speed': 24, 'Acceleration': 21, 'Dribbling': 17, 'BallControl': 15, 'Stamina': 13},
    'MD':  {'Speed': 24, 'Acceleration': 21, 'Dribbling': 17, 'BallControl': 15, 'Stamina': 13},
    'MO':  {'BallControl': 11, 'LowPass': 10, 'Finishing': 8, 'Dribbling': 8, 'LoftedPass': 8},
    'EI':  {'BallControl': 19, 'OffensiveAwareness': 17, 'Dribbling': 15, 'Speed': 15, 'Acceleration': 15},
    'ED':  {'BallControl': 19, 'OffensiveAwareness': 17, 'Dribbling': 15, 'Speed': 15, 'Acceleration': 15},
    'SD':  {'Acceleration': 9, 'LowPass': 8, 'BallControl': 8, 'Finishing': 7, 'Dribbling': 7},
    'DC':  {'Finishing': 14, 'OffensiveAwareness': 14, 'BallControl': 10, 'PhysicalContact': 6, 'TightPossession': 5},
}

# B. Puntos ciegos: lo que el OVR de ese puesto casi no pesa y en cancha importa.
PUNTOS_CIEGOS_POR_POSICION: dict[str, tuple[str, ...]] = {
    'PT':  ('Height',),
    'DFC': ('Speed', 'Acceleration', 'Height'),
    'LI':  ('BallWinning', 'LowPass'),
    'LD':  ('BallWinning', 'LowPass'),
    'MCD': ('DefensiveAwareness', 'BallWinning', 'PhysicalContact'),
    'MC':  ('BallWinning', 'PhysicalContact', 'Acceleration'),
    'MI':  ('LowPass', 'LoftedPass'),
    'MD':  ('LowPass', 'LoftedPass'),
    'MO':  ('Acceleration', 'Balance', 'TightPossession'),
    'EI':  ('Finishing', 'Balance'),
    'ED':  ('Finishing', 'Balance'),
    'SD':  ('OffensiveAwareness', 'Balance'),
    'DC':  ('Speed', 'Acceleration', 'Heading'),
}

# C. Habilidades clave por puesto (columnas de PLAYER_SKILLS_MAP).
HABILIDADES_POR_POSICION: dict[str, tuple[str, ...]] = {
    'PT':  ('GKPenaltySaver', 'GKLongThrow'),
    'DFC': ('Interception', 'ManMarking', 'HeadingSpecial', 'AcrobaticClear'),
    'LI':  ('PinpointCrossing', 'EarlyCross', 'Interception', 'TrackBack'),
    'LD':  ('PinpointCrossing', 'EarlyCross', 'Interception', 'TrackBack'),
    'MCD': ('Interception', 'ManMarking', 'TrackBack', 'WeightedPass'),
    'MC':  ('ThroughPassing', 'WeightedPass', 'OneTouchPass', 'LongBallExpert'),
    'MI':  ('PinpointCrossing', 'EarlyCross', 'DoubleTouch', 'TrackBack'),
    'MD':  ('PinpointCrossing', 'EarlyCross', 'DoubleTouch', 'TrackBack'),
    'MO':  ('ThroughPassing', 'OneTouchPass', 'LongRanger', 'DoubleTouch'),
    'EI':  ('DoubleTouch', 'CutBehindAndTurn', 'FirstTimeShot', 'PinpointCrossing'),
    'ED':  ('DoubleTouch', 'CutBehindAndTurn', 'FirstTimeShot', 'PinpointCrossing'),
    'SD':  ('FirstTimeShot', 'OneTouchPass', 'DoubleTouch', 'AcrobaticFinishing'),
    'DC':  ('FirstTimeShot', 'AcrobaticFinishing', 'HeadingSpecial', 'OneTouchPass'),
}

# Cuánto mueve cada parte el precio (fracción) y sus topes.
NUCLEO_POR_DESVIO, NUCLEO_MIN, NUCLEO_MAX = 0.03, -0.05, 0.06
CIEGOS_POR_DESVIO, CIEGOS_MIN, CIEGOS_MAX = 0.03, -0.04, 0.06
HABILIDAD_BONUS, HABILIDADES_MAX = 0.02, 0.06
META_MIN, META_MAX = 0.92, 1.14
# Pares = misma posición y misma franja de 2 puntos de OVR (82-83, 84-85, …).
ANCHO_FRANJA_OVR = 2


def _columnas_numericas(df: pd.DataFrame, columnas: set[str]) -> pd.DataFrame:
    """Copia numérica de las columnas pedidas; las que falten valen 0."""
    return pd.DataFrame(
        {c: pd.to_numeric(df[c], errors='coerce') if c in df.columns else 0.0 for c in columnas},
        index=df.index,
    ).fillna(0.0)


def _puntaje_por_posicion(df: pd.DataFrame, stats: pd.DataFrame,
                          tabla: dict[str, dict[str, float]]) -> pd.Series:
    """Promedio ponderado de las stats de la tabla, según la posición de cada jugador."""
    puntaje = pd.Series(np.nan, index=df.index)
    for posicion, pesos in tabla.items():
        mascara = df['POS_NOMBRE'] == posicion
        if not mascara.any():
            continue
        w = np.array(list(pesos.values()), dtype=float)
        puntaje[mascara] = stats.loc[mascara, list(pesos)].to_numpy(dtype=float) @ w / w.sum()
    return puntaje


def _desvios_contra_pares(puntaje: pd.Series, df: pd.DataFrame) -> pd.Series:
    """Cuántos desvíos está cada jugador por encima o debajo de sus pares (0 si no hay con quién comparar)."""
    grupos = puntaje.groupby([df['POS_NOMBRE'], df['OVR_CALCULADO'] // ANCHO_FRANJA_OVR])
    media = grupos.transform('mean')
    desvio = grupos.transform(lambda s: s.std(ddof=0)).replace(0, np.nan)
    return ((puntaje - media) / desvio).fillna(0.0)


def calcular_modificadores_meta(df: pd.DataFrame) -> pd.Series:
    """Multiplicador meta por posición (A núcleo + B puntos ciegos + C habilidades), acotado a META_MIN-META_MAX."""
    columnas = {s for pesos in NUCLEO_POR_POSICION.values() for s in pesos}
    columnas |= {s for lista in PUNTOS_CIEGOS_POR_POSICION.values() for s in lista}
    stats = _columnas_numericas(df, columnas)

    nucleo = _puntaje_por_posicion(df, stats, NUCLEO_POR_POSICION)
    ciegos = _puntaje_por_posicion(
        df, stats, {pos: dict.fromkeys(lista, 1.0) for pos, lista in PUNTOS_CIEGOS_POR_POSICION.items()}
    )
    ajuste_nucleo = (_desvios_contra_pares(nucleo, df) * NUCLEO_POR_DESVIO).clip(NUCLEO_MIN, NUCLEO_MAX)
    ajuste_ciegos = (_desvios_contra_pares(ciegos, df) * CIEGOS_POR_DESVIO).clip(CIEGOS_MIN, CIEGOS_MAX)

    cantidad_habilidades = pd.Series(0, index=df.index)
    for posicion, habilidades in HABILIDADES_POR_POSICION.items():
        mascara = df['POS_NOMBRE'] == posicion
        presentes = [h for h in habilidades if h in df.columns]
        if mascara.any() and presentes:
            cantidad_habilidades[mascara] = df.loc[mascara, presentes].astype(bool).sum(axis=1)
    ajuste_habilidades = (cantidad_habilidades * HABILIDAD_BONUS).clip(upper=HABILIDADES_MAX)

    meta = (1.0 + ajuste_nucleo + ajuste_ciegos + ajuste_habilidades).clip(META_MIN, META_MAX)
    # Posiciones sin tabla (p. ej. 'Desconocido') quedan neutras.
    return meta.where(df['POS_NOMBRE'].isin(NUCLEO_POR_POSICION), 1.0)


def calcular_precios(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
    """
    Devuelve (precio_t3, precio_t2, meta) en millones, redondeados a 2 decimales.
    El ancla de cada OVR iguala la mediana T3 a la mediana T2 de ese OVR.
    """
    ovr = df['OVR_CALCULADO'].astype(int)
    precio_t2 = df.apply(calcular_precio_t2, axis=1)
    meta = calcular_modificadores_meta(df)
    modificadores = (
        pd.to_numeric(df['Age'], errors='coerce').fillna(25).astype(int).map(calcular_modificador_edad)
        * df['POS_NOMBRE'].map(calcular_modificador_posicion)
        * meta
    )

    en_curva = ovr >= OVR_MINIMO_CURVA
    # Un precio T2 de 0 (dato inválido) no debe correr la mediana de su OVR.
    referencia = en_curva & (precio_t2 > 0)
    ancla = (
        precio_t2[referencia].groupby(ovr[referencia]).median()
        / modificadores[referencia].groupby(ovr[referencia]).median()
    )
    piso = ovr.map(lambda o: PISO_PRECIO_BAJO.get(o, PISO_PRECIO_MINIMO))
    precio_t3 = (ovr.map(ancla) * modificadores).where(en_curva, piso).fillna(piso)
    return precio_t3.round(2), precio_t2, meta.round(3)


def imprimir_control_precios(df: pd.DataFrame, precio_t3: pd.Series,
                             precio_t2: pd.Series, meta: pd.Series) -> None:
    """Tabla de control antes→después por OVR y los cambios más grandes."""
    ovr = df['OVR_CALCULADO'].astype(int)
    print("\n-> Control de precios T2 → T3 (millones)")
    print(f"   {'OVR':>3} {'jug':>5} | {'mediana':>15} | {'mínimo':>15} | {'máximo':>15}")
    for valor in sorted(o for o in ovr.unique() if o >= 60):
        a, b = precio_t2[ovr == valor], precio_t3[ovr == valor]
        print(f"   {valor:>3} {len(a):>5} | {a.median():6.1f} → {b.median():6.1f} | "
              f"{a.min():6.1f} → {b.min():6.1f} | {a.max():6.1f} → {b.max():6.1f}")
    print(f"   Multiplicador meta: mín ×{meta.min():.3f} · mediana ×{meta.median():.3f} · máx ×{meta.max():.3f}")

    relevantes = ovr >= 78
    cambio = (precio_t3 - precio_t2)[relevantes]
    mayores = cambio.abs().sort_values(ascending=False).index[:20]
    print("\n-> Los 20 cambios más grandes (OVR ≥ 78)")
    for i in mayores:
        print(f"   {str(df.at[i, 'Name'])[:22]:22} {df.at[i, 'POS_NOMBRE']:>3} {ovr[i]:>3} "
              f"meta ×{meta[i]:.2f} | {precio_t2[i]:6.1f} → {precio_t3[i]:6.1f}")



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
    df['PlayingStyle']  = pd.to_numeric(df['PlayingStyle'], errors='coerce').fillna(0).astype(int).map(MAPEO_PLAYING_STYLE).fillna('Ninguno')
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
    # 4. HABILIDADES DE JUGADOR (antes del precio: el modificador meta las usa)
    # -------------------------------------------------------------------------
    print("-> Procesando habilidades de jugador...")
    for col in PLAYER_SKILLS_COLUMNS:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).lower() == 'true')
        else:
            df[col] = False

    # -------------------------------------------------------------------------
    # 5. CÁLCULO DE PRECIO (FÓRMULA T3)
    # -------------------------------------------------------------------------
    print("-> Calculando valor de mercado de jugadores...")
    precio_t3, precio_t2, meta = calcular_precios(df)
    df['Precio'] = precio_t3
    imprimir_control_precios(df, precio_t3, precio_t2, meta)

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

            # Copiar o guardar también directamente en public/
            ruta_public = os.path.join(os.path.dirname(__file__), '..', 'public', SALIDA_JUGADORES_JSON)
            if os.path.exists(os.path.dirname(ruta_public)):
                with open(ruta_public, 'w', encoding='utf-8') as f_pub:
                    json.dump(datos_jugadores, f_pub, ensure_ascii=False)
                print(f"¡Éxito! Guardado en '{ruta_public}'.")
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
