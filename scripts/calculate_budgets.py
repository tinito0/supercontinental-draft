import json
import pandas as pd
import os

# Configuración
ARCHIVO_JUGADORES = 'jugadores.json'
OUTPUT_FILE = 'team_budgets.md'

# Configuración de la Plantilla (21 Jugadores)
# Distribución para lograr el promedio T:
# - 3 Estrellas (T + 5)
# - 8 Titulares (T + 1)
# - 10 Suplentes (T - 2)
# Promedio aprox: (3*(T+5) + 8*(T+1) + 10*(T-2)) / 21 = (3T+15 + 8T+8 + 10T-20) / 21 = (21T + 3) / 21 = T + 0.14
ESTRUCTURA_PLANTILLA = [
    {'label': 'Estrellas', 'count': 3, 'offset': 5},
    {'label': 'Titulares', 'count': 8, 'offset': 1},
    {'label': 'Suplentes', 'count': 10, 'offset': -2}
]

def load_players():
    if not os.path.exists(ARCHIVO_JUGADORES):
        print(f"Error: No se encontró {ARCHIVO_JUGADORES}")
        return []
    with open(ARCHIVO_JUGADORES, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_avg_price_for_ovr(stats_df, ovr):
    """Devuelve el precio promedio para un OVR dado. Si no existe, busca el más cercano."""
    if ovr in stats_df.index:
        return stats_df.loc[ovr]['AvgPrice']
    
    # Si no hay jugadores de ese OVR exacto, buscar el más cercano
    # (Esto es importante para OVRs muy altos o bajos)
    idx = stats_df.index.get_indexer([ovr], method='nearest')[0]
    nearest_ovr = stats_df.index[idx]
    return stats_df.loc[nearest_ovr]['AvgPrice']

def calculate_budgets():
    players = load_players()
    if not players:
        return

    df = pd.DataFrame(players)
    
    # Asegurar tipos numéricos
    df['OVR_CALCULADO'] = pd.to_numeric(df['OVR_CALCULADO'], errors='coerce')
    df['Precio'] = pd.to_numeric(df['Precio'], errors='coerce')

    # Calcular precio promedio por OVR
    stats_by_ovr = df.groupby('OVR_CALCULADO')['Precio'].mean().reset_index()
    stats_by_ovr.columns = ['OVR', 'AvgPrice']
    stats_by_ovr.set_index('OVR', inplace=True)
    
    markdown_content = f"# Presupuestos Estimados (Modelo Realista)\n\n"
    markdown_content += f"**Base de cálculo:** Plantilla de 21 jugadores con distribución de roles.\n"
    markdown_content += "Este modelo asume que un equipo no tiene todos los jugadores iguales, sino una mezcla de Estrellas, Titulares y Suplentes.\n\n"
    markdown_content += "**Estructura asumida:**\n"
    for grupo in ESTRUCTURA_PLANTILLA:
        markdown_content += f"- **{grupo['count']} {grupo['label']}**: Media del Equipo {grupo['offset']:+}\n"
    
    markdown_content += "\n| Media Objetivo | Presupuesto Total (M$) | Desglose (Estrellas / Titulares / Suplentes) |\n"
    markdown_content += "|---|---|---|\n"

    # Rango de medias a calcular
    target_ovrs = range(90, 69, -1) # De 90 a 70

    for target_ovr in target_ovrs:
        total_budget = 0
        breakdown_text = []
        
        for grupo in ESTRUCTURA_PLANTILLA:
            target_player_ovr = target_ovr + grupo['offset']
            # Limitar OVR a rangos lógicos (ej. max 95, min 60) para evitar buscar datos inexistentes
            target_player_ovr = max(60, min(99, target_player_ovr))
            
            price_per_player = get_avg_price_for_ovr(stats_by_ovr, target_player_ovr)
            cost_for_group = price_per_player * grupo['count']
            
            total_budget += cost_for_group
            breakdown_text.append(f"{grupo['count']}x${price_per_player:.1f}M")

        markdown_content += f"| {target_ovr} | **${total_budget:,.2f}M** | <span style='font-size:0.8em'>{', '.join(breakdown_text)}</span> |\n"

    print(markdown_content)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    print(f"\nReporte guardado en {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_budgets()
