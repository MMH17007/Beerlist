# beerlist.

**Pruébala:** [beerlist-f02c3.web.app](https://beerlist-f02c3.web.app/)

Diario de cervezas abierto a todo el mundo. Subes la foto de lo que estás bebiendo, le pones nota, ves lo que opinan los demás y montas **mesas** privadas con tus amigos usando un código.

- **Explorar**: muro común con búsqueda y orden (recientes, mejor valoradas, más notas, sin probar).
- **Mi bodega**: tus cervezas valoradas, de mejor a peor, con tu comentario.
- **El bar**: mesas privadas con código de 6 caracteres. Quien la crea la puede cerrar; el resto "paga la cuenta" para salir.
- **Registro libre** para mayores de 18 años. Para publicar hay que confirmar el correo.
- **Denuncias y moderación**: cualquiera denuncia fotos o comentarios; los administradores los revisan en *Moderar*.
- **Mi cuenta**: cerrar sesión, textos legales y borrar la cuenta con todos sus datos.

## Stack

| Pieza | Para qué |
| --- | --- |
| [Vite](https://vite.dev) + JavaScript modular | Desarrollo y build |
| [Tailwind CSS v4](https://tailwindcss.com) | Estilos, compilados (sin CDN) |
| Firebase Auth + Firestore | Cuentas y datos en tiempo real |
| Firebase Hosting | Publicación (`beerlist-f02c3.web.app`) |
| Firebase Storage | Fotos (se comprimen antes de subir, máx. 2 MB) |

```
src/
  main.js        arranque, pestañas (#inicio, #bodega, #bar, #moderar) y acciones globales
  auth.js        entrar, registrarse, consentimiento y verificación de correo
  beers.js       muro, bodega, valoraciones y publicaciones
  tables.js      mesas: crear, unirse, compartir, salir, cerrar
  reports.js     denunciar publicaciones y comentarios
  moderation.js  panel de denuncias para administradores
  account.js     mi cuenta y borrado de la cuenta
  upload.js      compresión y subida de fotos a Storage
  ui.js          utilidades: DOM seguro, diálogos, avisos, formato
public/          aviso-legal.html y privacidad.html
firestore.rules  quién puede leer y escribir qué en la base de datos
storage.rules    quién puede subir y borrar fotos
```

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena los valores
npm run dev
```

### Configuración en la consola de Firebase (una vez)

1. **Storage**: activa el plan Blaze (pide tarjeta; hasta 5 GB es gratis) y crea una alerta de presupuesto de 1 €. Luego *Storage → Comenzar*.
2. **Administrador**: en Firestore crea la colección `admins` con un documento cuyo ID sea tu UID (lo ves en *Authentication → Users*). Sin campos. Con eso aparece la pestaña *Moderar*.
3. **Textos legales**: rellena los datos marcados en amarillo en `public/aviso-legal.html` y `public/privacidad.html`.

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
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

## Seguridad

- Hace falta cuenta para ver nada y correo confirmado para publicar. Cada usuario solo edita o borra lo suyo; las mesas solo las ven quienes están dentro.
- No hay ninguna clave secreta en la web: las fotos van a Storage y las protegen `storage.rules` (solo tu carpeta, solo imágenes, máx. 2 MB).
- Los administradores pueden retirar publicaciones y comentarios, pero no escribir en nombre de nadie.
- La configuración web de Firebase no es secreta por diseño; aun así va en `.env` y conviene limitar la API key por dominio en Google Cloud Console.
- Todo el texto que escriben los usuarios se pinta como texto, nunca como HTML.

## Datos de la versión anterior

- **Cervezas y notas**: compatibles, se ven tal cual (las fotos antiguas siguen en ImgBB).
- **Cuentas creadas antes**: al entrar, la app pide nombre y aceptar las condiciones una vez, y hay que confirmar el correo para publicar.
- **Mesas antiguas**: usaban otro formato y no aparecerán. Basta con volver a crearlas.
