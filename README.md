# beerlist.

Diario de cervezas abierto a todo el mundo. Subes la foto de lo que estás bebiendo, le pones nota, ves lo que opinan los demás y montas **mesas** privadas con tus amigos usando un código.

- **Explorar**: muro común con búsqueda y orden (recientes, mejor valoradas, más notas, sin probar).
- **Mi bodega**: tus cervezas valoradas, de mejor a peor, con tu comentario.
- **El bar**: mesas privadas con código de 6 caracteres. Quien la crea la puede cerrar; el resto "paga la cuenta" para salir.
- **Registro libre**: nombre, correo y contraseña. Sin invitaciones.

## Stack

| Pieza | Para qué |
| --- | --- |
| [Vite](https://vite.dev) + JavaScript modular | Desarrollo y build |
| [Tailwind CSS v4](https://tailwindcss.com) | Estilos, compilados (sin CDN) |
| Firebase Auth + Firestore | Cuentas y datos en tiempo real |
| Firebase Hosting | Publicación (`beerlist-f02c3.web.app`) |
| ImgBB | Alojamiento de fotos (se comprimen antes de subir) |

```
src/
  main.js      arranque, pestañas (#inicio, #bodega, #bar) y acciones globales
  auth.js      entrar, registrarse y completar el perfil
  beers.js     muro, bodega, valoraciones y publicaciones
  tables.js    mesas: crear, unirse, compartir, salir, cerrar
  upload.js    compresión de la foto y subida a ImgBB
  ui.js        utilidades: DOM seguro, diálogos, avisos, formato
firestore.rules  quién puede leer y escribir qué
```

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena los valores
npm run dev
```

### Reglas de seguridad

```bash
npm install -g firebase-tools
firebase login
npm run deploy:rules
```

### Publicar

```bash
npm run deploy
```

O automático: cada `push` a `main` publica con GitHub Actions (`.github/workflows/deploy.yml`). Necesita estos *secrets* en el repo (Settings → Secrets and variables → Actions):

- `FIREBASE_SERVICE_ACCOUNT`: lo genera `firebase init hosting:github`, o una cuenta de servicio con rol *Firebase Hosting Admin*.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_IMGBB_API_KEY`.

## Seguridad

- Hace falta cuenta para ver o publicar nada. Cada usuario solo puede editar o borrar lo suyo, y las mesas solo las ven quienes están dentro (ver `firestore.rules`).
- La configuración web de Firebase no es secreta por diseño; aun así va en `.env` y conviene limitar la API key por dominio en Google Cloud Console.
- La clave de ImgBB acaba dentro de la web publicada (no hay servidor). Con registro abierto conviene cambiar a un sistema sin clave (ver `docs/MEJORAS-UI-UX.md`).
- Todo el texto que escriben los usuarios se pinta como texto, nunca como HTML.

## Datos de la versión anterior

- **Cervezas y notas**: compatibles, se ven tal cual.
- **Cuentas creadas antes**: al entrar, la app pide el nombre una vez.
- **Mesas antiguas**: usaban otro formato y no aparecerán. Basta con volver a crearlas.
