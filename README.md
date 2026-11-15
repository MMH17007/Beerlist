# beerlist.

Diario privado de cervezas para un grupo de amigos. Subes la foto de lo que estás bebiendo, le pones nota, ves lo que opina el resto y montas **mesas** privadas con un código.

- **Explorar**: muro común con búsqueda y orden (recientes, mejor valoradas, más notas, sin probar).
- **Mi bodega**: tus cervezas valoradas, de mejor a peor, con tu comentario.
- **El bar**: mesas con código de 6 caracteres. Quien la crea la puede cerrar; el resto "paga la cuenta" para salir.
- **Acceso por invitación**: solo entra quien tiene el código del grupo, y el código no aparece en el código fuente.

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
  auth.js      entrar, registrarse con código, activar cuentas antiguas
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

### 1. Código de invitación (una sola vez)

El código vive en Firestore y **solo lo leen las reglas de seguridad**, nunca la web.

1. Firebase Console → Firestore Database → *Iniciar colección* `config`.
2. Documento con ID `invite` y un campo `code` (texto) con el código que quieras.
3. Para cambiar el código basta con editar ese campo. Las cuentas ya activadas siguen funcionando.

### 2. Reglas de seguridad

```bash
npm install -g firebase-tools
firebase login
npm run deploy:rules
```

### 3. Publicar

```bash
npm run deploy
```

O automático: cada `push` a `main` publica con GitHub Actions (`.github/workflows/deploy.yml`). Necesita estos *secrets* en el repo (Settings → Secrets and variables → Actions):

- `FIREBASE_SERVICE_ACCOUNT`: lo genera `firebase init hosting:github`, o una cuenta de servicio con rol *Firebase Hosting Admin*.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_IMGBB_API_KEY`.

## Seguridad

- La configuración web de Firebase no es secreta por diseño; lo que protege los datos son las reglas de `firestore.rules`. Aun así va en `.env` y conviene limitar la API key por dominio en Google Cloud Console.
- La clave de ImgBB acaba dentro de la web publicada (no hay servidor). Por eso hay que poder rotarla, y el plan es cambiar a un sistema sin clave (ver `docs/MEJORAS-UI-UX.md`).
- Todo el texto que escriben los usuarios se pinta como texto, nunca como HTML.

## Datos de la versión anterior

- **Cervezas y notas**: compatibles, se ven tal cual.
- **Cuentas creadas antes**: al entrar, la app pide nombre y código una vez para activarlas.
- **Mesas antiguas**: usaban otro formato y no aparecerán. Basta con volver a crearlas.
