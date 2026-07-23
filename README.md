<p align="center">
  <img src="public/logo.webp" alt="SCL Draft Logo" width="120" />
</p>

<h1 align="center">⚽ Supercontinental Draft</h1>

<p align="center">
  <b>Plataforma de gestión de fichajes, tácticas y torneos en tiempo real para la Supercontinental League.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/Firebase-12-ffca28?logo=firebase&logoColor=black" alt="Firebase 12" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-06b6d4?logo=tailwindcss&logoColor=white" alt="TailwindCSS 3" />
  <img src="https://img.shields.io/badge/PWA-ready-5a0fc8?logo=pwa&logoColor=white" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/license-Private-red" alt="License" />
</p>

---

## 📖 Descripción

**Supercontinental Draft** (SCL Draft) es una webapp multijugador en tiempo real donde cada participante actúa como director deportivo de un equipo ficticio. Con un presupuesto asignado, los managers compiten por fichar a los mejores jugadores (con estadísticas estilo PES/eFootball) antes que sus rivales, armar formaciones tácticas y participar en torneos organizados dentro de la liga.

El proyecto funciona como una **Progressive Web App (PWA)** instalable en celulares y escritorio.

---

## ✨ Funcionalidades principales

### 🏪 Marketplace
- Base de datos de **+1000 jugadores** con stats detalladas (25+ atributos por jugador).
- Búsqueda por nombre, posición, OVR, precio, país, región, habilidades y más.
- Filtros avanzados con rangos de estadísticas individuales.
- Vista de grilla y lista con virtualización para rendimiento.
- Carrito de fichajes con sistema de bloqueo en tiempo real.

### 📊 Fichas de jugador
- Modal detallado con radar chart, stats agrupadas por categoría.
- Colores dinámicos según posición y nivel de OVR.
- Foto de jugador, bandera de nacionalidad, playing style y habilidades especiales.
- Sistema de recomendaciones: alternativas similares sugeridas automáticamente.

### 🔄 Comparador 1v1
- Seleccioná dos jugadores y comparalos stat por stat.
- Visualización con barras de comparación y highlights del ganador por categoría.

### ⚙️ Formaciones tácticas
- **+15 formaciones** disponibles: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 4-1-2-1-2 (Rombo), 4-2-2-2 (Cubo), y más.
- Pitch visual interactivo para armar tu 11 ideal.
- Exportación de imagen de tu formación.
- Vista pública compartible por URL.

### 💰 Sistema de fichajes
- Mercado compartido en tiempo real entre todos los managers (Firebase Firestore).
- **Bloqueo instantáneo** de jugadores al fichar (un jugador solo puede pertenecer a un equipo).
- Venta de jugadores con recupero del 100% del valor.
- Propuestas de traspaso entre managers con ofertas y contraofertas.
- Feed de actividad con historial de transferencias.

### 🏆 Torneos
- Sistema de torneos con fase de grupos y brackets.
- Vista de tabla de posiciones y llaves del torneo.
- Modo OBS para transmisión en vivo (`?mode=obs`).
- Vista pública de brackets y tablas (`?mode=table`, `?mode=bracket`).
- Overlay de broadcast configurable.

### 🔍 Scouting
- Panel de asignaciones de scouts.
- Listas de deseos (wishlist) por jugador.
- Sistema de sugerencias de fichajes.

### 💬 Chat de managers
- Chat en tiempo real entre todos los managers de la liga.
- Detección automática de intención de traspaso en mensajes.
- Notificaciones de mensajes nuevos.

### 🔔 Notificaciones
- Panel de notificaciones con alertas de fichajes, ofertas entrantes y cambios de mercado.
- Notificaciones de nuevos fichajes de otros equipos en tiempo real.

### 🛡️ Panel de administración
- Control de apertura/cierre del mercado.
- Gestión de equipos y whitelists.
- Migración de cuentas.
- Configuración de torneos y overlays de broadcast.

### 📱 PWA & Instalable
- Service Worker para funcionamiento offline.
- Popup automático de instalación en dispositivos compatibles.
- Manifesto configurado con iconos y theme color.

---

## 🏗️ Arquitectura del proyecto

```
supercontinental-draft/
├── app.jsx                    # Componente principal de la aplicación
├── main.jsx                   # Entry point (React + Chart.js + Router)
├── index.html                 # HTML raíz con Service Worker
├── index.css                  # Estilos principales
├── landing.css                # Estilos de la landing page
├── playercard.css             # Estilos de las tarjetas de jugador
│
├── components/                # 27 componentes React
│   ├── AdminModal.jsx         # Panel de administración
│   ├── BroadcastOverlay.jsx   # Overlay para transmisiones
│   ├── CartModal.jsx          # Carrito de fichajes
│   ├── ComparisonModal.jsx    # Comparador 1v1
│   ├── FiltrosModal.jsx       # Filtros avanzados
│   ├── FormationModal.jsx     # Editor de formación táctica
│   ├── ManagerChat.jsx        # Chat entre managers
│   ├── PlayerCard.jsx         # Tarjeta de jugador (grilla)
│   ├── PlayerModal.jsx        # Ficha detallada de jugador
│   ├── ScoutAssignmentsPanel.jsx  # Panel de scouting
│   ├── TournamentModal.jsx    # Gestión de torneos
│   ├── TransferFeed.jsx       # Feed de transferencias
│   ├── TransferProposalModal.jsx  # Propuestas de traspaso
│   └── ...                    # Y más
│
├── screens/                   # Pantallas/rutas principales
│   ├── LandingPage.jsx        # Landing page pública
│   ├── LoginScreen.jsx        # Pantalla de login
│   ├── LinkGoogleScreen.jsx   # Migración/vinculación de cuenta Google
│   ├── TeamScreen.jsx         # Vista pública de equipo
│   ├── FormationViewScreen.jsx # Vista pública de formación
│   └── MaintenanceScreen.jsx  # Pantalla de mantenimiento
│
├── utils/                     # Utilidades y constantes
│   ├── constants.js           # Posiciones, stats, formaciones, skills, regiones
│   ├── helpers.js             # Funciones auxiliares (formato precio, normalización, etc.)
│   ├── managerChatUtils.js    # Utilidades del chat (detección de intención)
│   └── tournamentViews.js     # Normalización de vistas de torneo
│
├── config/
│   └── firebase.js            # Configuración de Firebase (Auth, Firestore, Storage)
│
├── public/                    # Assets estáticos
│   ├── fotos_jugadores/       # ~3000+ fotos de jugadores (.webp)
│   ├── Logos_equipos/         # Logos de equipos ficticios
│   ├── scouts/                # Fotos de scouts
│   ├── jugadores.json         # Base de datos de jugadores (~57 MB)
│   ├── paises.json            # Mapeo ID → nombre de país
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── ...                    # Favicons, iconos
│
├── scripts/                   # Scripts de datos/utilidades (Python)
│   ├── main.py                # Script principal de procesamiento
│   ├── generador.py           # Generador de datos
│   ├── calculate_budgets.py   # Cálculo de presupuestos
│   ├── leyendas.py            # Generador de leyendas
│   └── ...                    # Archivos auxiliares
│
├── firebase.json              # Config de Firebase Hosting + Firestore
├── firestore.rules            # Reglas de seguridad de Firestore
├── package.json               # Dependencias del proyecto
├── vite.config.js             # Configuración de Vite
├── tailwind.config.js         # Configuración de TailwindCSS
└── postcss.config.js          # Configuración de PostCSS
```

---

## 🛠️ Tech Stack

| Categoría        | Tecnología                                                     |
| ---------------- | -------------------------------------------------------------- |
| **Frontend**     | React 18, React Router 7, Lucide React (iconos)               |
| **Build Tool**   | Vite 7 con `@vitejs/plugin-react`                              |
| **Styling**      | TailwindCSS 3, CSS personalizado (landing, player cards)       |
| **Backend**      | Firebase (Auth, Firestore, Storage, Hosting)                   |
| **Charts**       | Chart.js + react-chartjs-2 (radar charts, barras)              |
| **PDF/Export**    | jsPDF + jspdf-autotable, html2canvas                           |
| **Virtualización** | react-window + react-virtualized-auto-sizer                  |
| **Notificaciones** | react-toastify                                                |
| **Efectos**      | react-snowfall (efectos de temporada)                          |
| **PWA**          | Service Worker nativo + Web App Manifest                       |
| **Scripts**      | Python 3 (procesamiento de datos, generación de jugadores)     |

---

## 🚀 Instalación y desarrollo

### Prerequisitos
- [Node.js](https://nodejs.org/) v18+ 
- [npm](https://www.npmjs.com/) v9+
- Cuenta de Firebase (opcional, para backend propio)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tinito0/supercontinental-draft.git
cd supercontinental-draft
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crear un archivo `.env.local` en la raíz con las credenciales de Firebase:

```env
# Las credenciales de Firebase se configuran en config/firebase.js
# Si querés usar tu propio proyecto, editá las constantes allí.
```

### 4. Iniciar servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### 5. Build para producción

```bash
npm run build
```

Los archivos de producción se generan en la carpeta `dist/`.

### 6. Deploy a Firebase

```bash
npm run build
firebase deploy
```

---

## 📱 Rutas de la aplicación

| Ruta                    | Descripción                               | Acceso          |
| ----------------------- | ----------------------------------------- | --------------- |
| `/`                     | Landing page                              | Público         |
| `/login`                | Pantalla de inicio de sesión              | Público         |
| `/marketplace`          | Mercado de jugadores                      | Autenticado     |
| `/my-team`              | Mi equipo (plantilla y presupuesto)       | Autenticado     |
| `/scouting`             | Panel de scouting                         | Autenticado     |
| `/other-teams`          | Ver otros equipos                         | Autenticado     |
| `/financials`           | Finanzas y presupuesto                    | Autenticado     |
| `/torneo`               | Torneo de la liga                         | Autenticado     |
| `/admin`                | Panel de administración                   | Solo Admin      |
| `/team/:id`             | Vista pública de un equipo                | Público         |
| `/tactics/view/:id`     | Vista pública de formación                | Público         |
| `?mode=obs`             | Modo OBS (overlay para streams)           | Público         |
| `?mode=table`           | Vista pública de tabla de posiciones      | Público         |
| `?mode=bracket`         | Vista pública de brackets                 | Público         |

---

## 🔐 Autenticación

El sistema soporta:
- **Email/Password**: Registro e inicio de sesión clásico.
- **Google Sign-In**: Inicio de sesión con cuenta de Google.
- **Migración de cuentas**: Flujo para vincular cuentas legacy a Google.

---

## 📦 Scripts de datos (Python)

En la carpeta `scripts/` se encuentran utilidades Python para procesar y generar la base de datos de jugadores:

| Script                  | Descripción                                      |
| ----------------------- | ------------------------------------------------ |
| `main.py`               | Script principal de procesamiento de jugadores   |
| `generador.py`          | Generación de datos de jugadores                 |
| `calculate_budgets.py`  | Cálculo de presupuestos de equipos               |
| `leyendas.py`           | Generador de jugadores leyenda                   |

---

## 🎮 Posiciones

| Abreviatura | Posición              | Color    |
| ----------- | --------------------- | -------- |
| PT          | Portero               | 🟡 Amarillo |
| DFC         | Defensa Central       | 🔵 Azul    |
| LI / LD     | Lateral Izq / Der     | 🔵 Azul    |
| MCD         | Mediocampista Defensivo | 🟢 Verde |
| MC          | Mediocampista Central | 🟢 Verde   |
| MI / MD     | Mediocampista Izq / Der | 🟢 Verde |
| MO          | Mediocampista Ofensivo | 🟢 Verde  |
| EI / ED     | Extremo Izq / Der     | 🔴 Rojo   |
| SD          | Segundo Delantero     | 🔴 Rojo    |
| DC          | Delantero Centro      | 🔴 Rojo    |

---

## 🌍 Regiones cubiertas

- 🌎 Sudamérica
- 🌍 Europa  
- 🌎 Norte y Centroamérica
- 🌍 África
- 🌏 Asia
- 🌏 Oceanía

---

## 📄 Reglas del Draft

1. Cada manager comienza con un **presupuesto asignado** por la administración.
2. Los fichajes son en **tiempo real**: si fichás a un jugador, se bloquea para todos.
3. Podés vender un jugador en cualquier momento y recuperar el **100% de su valor**.
4. Existe la opción de proponer **traspasos** a otros managers con ofertas y contraofertas.
5. El **Jugador Franquicia** es una ficha especial que se puede usar una vez por temporada.
6. El mercado **abre y cierra** según lo defina la administración.

---

## 🤝 Contribuir

Este es un proyecto privado para uso entre amigos. Si sos parte de la liga y querés contribuir:

1. Creá un fork del repositorio.
2. Creá una rama con tu feature: `git checkout -b feature/mi-feature`.
3. Hacé commit de tus cambios: `git commit -m "Agrega mi feature"`.
4. Pusheá a tu rama: `git push origin feature/mi-feature`.
5. Abrí un Pull Request.

---

## 📝 Licencia

Proyecto privado. Todos los derechos reservados.  
Hecho con ⚽ para amigos que aman el fútbol.

---

<p align="center">
  <b>© 2025 – 2027 Supercontinental Draft</b>
</p>
