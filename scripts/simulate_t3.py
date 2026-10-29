"""
Simulador de la Temporada 3: ¿hasta qué media de XI llega cada presupuesto?

Lee public/jugadores.json (precios ya generados por main.py) y aplica las reglas T3:
  - presupuesto = 380 − (POV − 5.5) × 10  (millones)
  - plantel de 21: XI (1 PT + 10 de campo) + banco (1 PT + 9 de campo)
  - piso de banco: los 9 mejores suplentes de campo promedian ≥ PISO (73 o 74, a confirmar)
  - franquicia y draftee gratis, dentro del XI

Usa precios medianos por OVR (arqueros y jugadores de campo por separado), igual que el
análisis de Nico, así que los resultados son aproximados: no contempla los 7 originarios
ni que otro mánager se lleve primero al jugador.

Uso:  python scripts/simulate_t3.py   →  imprime y escribe scripts/t3_simulation.md
"""
import json
import os
import statistics
from collections import Counter, defaultdict

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ARCHIVO_JUGADORES = os.path.join(RAIZ, 'public', 'jugadores.json')
ARCHIVO_SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 't3_simulation.md')

PRESUPUESTO_BASE, POV_MEDIO, PESO_POV = 380, 5.5, 10
EQUIPOS_POV = [  # (equipo, mánager, POV) — doc de Nico, 12/10/2026
    ('Aspra Calcio', 'Zane', 3), ('Santa Cabeza CF', 'Santi', 3.5), ('Lourinha FC', 'Rena', 4),
    ('Ryu Sendai', 'Fefo', 4.5), ('Argentinos de Tero Violado', 'Thomas', 6),
    ('Esportivo Lusitano do Recife', 'Lona', 6.5), ('Kaiser iz Varazdin', 'JC', 7),
    ('SK Konya', 'Alejo', 7), ('Falke Dusseldorf', 'Kique', 8.5), ('Dinamo Visegrad', 'Fefe', 9),
    ('Talleres de Balvanera', 'Nico', 9), ('Portland Rovers', 'Tino', 9),
]
PISOS_BANCO = (73, 74)
SUPLENTES_DE_CAMPO_MEDIDOS = 9
OVR_ARQUERO_SUPLENTE = 65
OVR_INICIAL = 66  # Todo puesto pago arranca acá y se mejora de a un punto.
ESCENARIOS_GRATIS = [  # (nombre, OVR de los jugadores gratis que van al XI)
    ('Sin gratis', ()),
    ('Franquicia 83', (83,)),
    ('Franquicia 89', (89,)),
    ('Franquicia 86 + draftee 84', (86, 84)),
]
FRANQUICIA_VARIANTES = [('≥30 años, OVR 81-88', 30, 81, 88), ('≥31 años, OVR 83-89', 31, 83, 89)]
DRAFT_EDAD_MAX, DRAFT_OVR_MAX = 21, 60


def presupuesto(pov: float) -> float:
    return PRESUPUESTO_BASE - (pov - POV_MEDIO) * PESO_POV


def cargar_jugadores() -> list[dict]:
    with open(ARCHIVO_JUGADORES, encoding='utf-8') as f:
        return json.load(f)


def precios_medianos(jugadores: list[dict]) -> dict[str, dict[int, float]]:
    """{'PT': {ovr: mediana}, 'campo': {ovr: mediana}}"""
    grupos: dict[str, dict[int, list[float]]] = {'PT': defaultdict(list), 'campo': defaultdict(list)}
    for j in jugadores:
        grupo = 'PT' if j['POS_NOMBRE'] == 'PT' else 'campo'
        grupos[grupo][int(j['OVR_CALCULADO'])].append(float(j['Precio']))
    return {g: {o: statistics.median(v) for o, v in por_ovr.items()} for g, por_ovr in grupos.items()}


def costo_banco(precios: dict[str, dict[int, float]], piso: int) -> float:
    return SUPLENTES_DE_CAMPO_MEDIDOS * precios['campo'][piso] + precios['PT'][OVR_ARQUERO_SUPLENTE]


def mejor_xi(precios: dict[str, dict[int, float]], dinero: float, gratis: tuple[int, ...]) -> float:
    """Media máxima del XI: sube de a un punto el puesto con la mejora más barata mientras alcance la plata."""
    puestos = [['PT', OVR_INICIAL]] + [['campo', OVR_INICIAL] for _ in range(10 - len(gratis))]
    dinero -= sum(precios[g][o] for g, o in puestos)
    while True:
        opciones = [
            (precios[g][o + 1] - precios[g][o], i)
            for i, (g, o) in enumerate(puestos) if o + 1 in precios[g]
        ]
        if not opciones:
            break
        costo, i = min(opciones)
        if costo > dinero:
            break
        dinero -= costo
        puestos[i][1] += 1
    ovrs = [o for _, o in puestos] + list(gratis)
    return sum(ovrs) / len(ovrs)


def contar_por_posicion(jugadores: list[dict]) -> str:
    conteo = Counter(j['POS_NOMBRE'] for j in jugadores)
    orden = ['PT', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MI', 'MD', 'MO', 'EI', 'ED', 'SD', 'DC']
    return ' · '.join(f"{p} {conteo[p]}" for p in orden if conteo[p])


def generar_reporte(jugadores: list[dict]) -> str:
    precios = precios_medianos(jugadores)
    lineas = ['# Simulación T3', '',
              'Generado por `scripts/simulate_t3.py` con los precios de `public/jugadores.json`.',
              'Precios medianos por OVR: resultados aproximados (no contempla originarios ni competencia por jugadores).', '']

    lineas += ['## Presupuesto por POV', '', '`presupuesto = 380 − (POV − 5.5) × 10`', '',
               '| Equipo | Mánager | POV | Presupuesto |', '|---|---|---|---|']
    lineas += [f"| {e} | {m} | {pov:g} | ${presupuesto(pov):.0f}M |" for e, m, pov in EQUIPOS_POV]

    presupuestos = sorted({presupuesto(pov) for _, _, pov in EQUIPOS_POV})
    for piso in PISOS_BANCO:
        banco = costo_banco(precios, piso)
        lineas += ['', f'## XI máximo con piso de banco {piso}',
                   f'Banco: 9 de campo de OVR {piso} + arquero suplente de {OVR_ARQUERO_SUPLENTE} ≈ **${banco:.1f}M**.', '',
                   '| Presupuesto | ' + ' | '.join(n for n, _ in ESCENARIOS_GRATIS) + ' |',
                   '|---|' + '---|' * len(ESCENARIOS_GRATIS)]
        for p in presupuestos:
            celdas = [f"{mejor_xi(precios, p - banco, gratis):.1f}" for _, gratis in ESCENARIOS_GRATIS]
            lineas.append(f"| ${p:.0f}M | " + ' | '.join(celdas) + ' |')

    lineas += ['', '## Pool de Jugador Franquicia', '']
    for nombre, edad, ovr_min, ovr_max in FRANQUICIA_VARIANTES:
        pool = [j for j in jugadores if int(j['Age']) >= edad and ovr_min <= int(j['OVR_CALCULADO']) <= ovr_max]
        lineas.append(f"- **{nombre}:** {len(pool)} jugadores — {contar_por_posicion(pool)}")

    draft = [j for j in jugadores if int(j['Age']) <= DRAFT_EDAD_MAX and int(j['OVR_CALCULADO']) <= DRAFT_OVR_MAX]
    lineas += ['', '## Pool del Draft de promesas', '',
               f"- **≤{DRAFT_EDAD_MAX} años, OVR base ≤{DRAFT_OVR_MAX}:** {len(draft)} jugadores — {contar_por_posicion(draft)}"]
    return '\n'.join(lineas) + '\n'


def main() -> None:
    reporte = generar_reporte(cargar_jugadores())
    print(reporte)
    with open(ARCHIVO_SALIDA, 'w', encoding='utf-8') as f:
        f.write(reporte)
    print(f"Reporte guardado en {ARCHIVO_SALIDA}")


if __name__ == '__main__':
    main()
