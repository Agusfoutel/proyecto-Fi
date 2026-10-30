# fino — tu plata, clarita

App web (PWA) para saber en qué se te va la plata. Pensada primero para el celu, también anda bien en la compu.

- **Cargás un gasto en dos toques**: monto con teclado numérico, en qué, categoría, listo.
- **Categorías propias** como etiquetas, con color. Si escribís algo que ya cargaste antes ("Coto", "Uber"…), te sugiere la categoría sola.
- **Métricas**: en qué se te fue más, gasto por día, a qué ritmo vas, comparación con el mes pasado y últimos 6 meses.
- **Meses encadenados**: lo que te sobra de un mes pasa solo al siguiente (se puede apagar en Ajustes).
- **Aviso el último día de cada mes** para cargar el sueldo (notificación push).
- **Cada uno con su usuario** y la sesión queda abierta en el dispositivo (400 días, se renueva sola).
- **Tres estilos**: Bordó (el diseño original), Bosque (verde) y Océano (azul), cada uno en claro u oscuro.

## Cómo funciona el mes

1. El primer mes cargás **con cuánta plata arrancás** (ej. $ 450.000).
2. Vas cargando gastos (y si entra plata extra, un "Ingreso").
3. Al pasar al mes siguiente, lo que sobró **se suma solo**: si te quedaron $ 50.000 y cobrás $ 100.000, arrancás con $ 150.000. La app te muestra el desglose.
4. El último día del mes te llega un aviso para cargar el sueldo del mes que viene.

## Por qué no hay "base de datos" que mantener

Usa **SQLite**, que es un único archivo (`data/fino.db`). No hay un servidor de base de datos corriendo aparte, no hay que instalar nada más. Para hacer backup alcanza con copiar la carpeta `data/`.

## Correrlo en tu compu

Necesitás Node.js 22.13 o más nuevo (recomendado el LTS actual).

```bash
npm install
npm start
```

Abrí <http://localhost:3000>.

## Subirlo a tu servidor

1. Copiá el proyecto al servidor e instalá dependencias:

   ```bash
   npm ci --omit=dev
   cp .env.example .env
   ```

2. Editá `.env`. Muy recomendado: completar `INVITE_CODE` para que sólo puedan crear cuenta quienes tengan el código (vos y tu novio).

3. Dejalo corriendo siempre. Con **systemd** (`/etc/systemd/system/fino.service`):

   ```ini
   [Unit]
   Description=fino
   After=network.target

   [Service]
   WorkingDirectory=/opt/fino
   ExecStart=/usr/bin/node --env-file=.env server/index.js
   Restart=always
   User=www-data

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable --now fino
   ```

   (O con pm2: `pm2 start "npm start" --name fino && pm2 save`.)

4. **HTTPS es obligatorio** para instalar la app en el celu y para las notificaciones. Lo más fácil es **Caddy**, que saca el certificado solo. `Caddyfile`:

   ```
   fino.tudominio.com {
     reverse_proxy localhost:3000
   }
   ```

## Instalarla en el celu

- **Android (Chrome)**: abrí la página → menú ⋮ → *Instalar app*.
- **iPhone (Safari)**: Compartir → *Agregar a inicio*. Abrila desde ese ícono y activá los avisos en tu perfil (iOS 16.4 o más nuevo).

## Backup

Todo está en `data/` (base + claves de notificaciones). Copiá esa carpeta, idealmente con la app frenada o con:

```bash
sqlite3 data/fino.db ".backup data/backup-$(date +%F).db"
```

También podés descargar tus movimientos en CSV desde *Perfil → Descargar mis movimientos*.

## Estructura

```
server/   index.js (API + estáticos), db.js (SQLite), auth.js (login y sesiones), push.js (avisos de fin de mes)
public/   index.html, app.js (toda la app), styles.css, sw.js (offline + push), icons/
```
