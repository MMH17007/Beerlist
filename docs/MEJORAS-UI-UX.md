# Mejoras de UI y UX

Revisión de la versión hecha con Gemini (un único `index.html`). Primero lo que ya está aplicado en este repo, después lo que propongo, ordenado por impacto.

## Aplicado en esta versión

### Fallos que impedían usar la app
| Antes | Ahora |
| --- | --- |
| `authDomain: "www.beerlist.com"`: el login fallaba fuera de tu ordenador | Dominio real de Firebase, desde `.env` |
| Reglas de Firestore abiertas (`allow read, write: if true`) | Reglas por colección: solo miembros, cada uno toca lo suyo |
| Código de invitación dentro del HTML: cualquiera lo leía con "Ver código fuente" o se lo saltaba llamando a Firebase directamente | Registro abierto a todo el mundo, sin invitación (decisión de producto) |
| Al crear una mesa se descargaban **todas** las mesas de todos y se filtraban en el móvil | Cada uno solo recibe sus mesas; unirse es una lectura directa por código |
| Nombres y comentarios metidos con `innerHTML`: un comentario podía inyectar código | Todo se pinta como texto |
| "Pagar la cuenta", la cerveza junto al creador y copiar el código se perdieron en la última versión | Recuperados |
| Cualquiera podía modificar o borrar notas de otros | Cada uno solo su nota; solo el autor borra su publicación |

### Experiencia de uso
1. **Pantalla de carga** en vez de ver el login un segundo aunque ya tengas sesión.
2. **Registro libre con nombre**: cualquiera crea su cuenta; el nombre se pide una vez y ya no se vuelve a escribir al crear o unirse a una mesa.
3. **Recuperar contraseña** y botón para ver la contraseña al escribirla.
4. **Los comentarios del grupo se ven**: antes la nota decía "Público", pero nadie podía leerla.
5. **Tras publicar, se abre directamente la valoración**, que es lo siguiente que quiere hacer casi todo el mundo.
6. **Fotos comprimidas antes de subir** (de ~5 MB a ~300 KB): mucho más rápido con datos móviles.
7. **Aviso de duplicados** si ya existe una cerveza con ese nombre.
8. **Búsqueda y orden** en el muro, incluido "sin probar por mí".
9. **La bodega se ordena de mejor a peor** y dice cuántas llevas.
10. **Compartir la mesa** con el menú nativo del móvil (WhatsApp, etc.) y copiar con un toque.
11. **Códigos de mesa sin caracteres confusos** (sin 0/O ni 1/I/L) para dictarlos en el bar.
12. **Confirmaciones claras** antes de borrar, que dicen qué se pierde ("se borrará con 3 notas").
13. **Avisos discretos** (toasts) en lugar de `alert()`, y errores junto al campo que falla.
14. **Estados de carga** con esqueletos y botones que dicen qué están haciendo ("Subiendo foto…").
15. **Las pestañas usan la URL** (`#bodega`): el botón atrás del móvil funciona y al recargar sigues donde estabas.
16. **Funciona con mala cobertura**: caché local de Firestore.

### Interfaz y accesibilidad
- Navegación inferior con **texto bajo los iconos** (antes solo iconos: había que adivinar).
- Diálogos nativos: se cierran con Esc o tocando fuera y mantienen el foco dentro.
- **Contraste**: los botones mostaza llevan texto oscuro (blanco sobre `#EAB308` no se lee bien al sol).
- Zonas táctiles de al menos 44 px, etiquetas en todos los campos y botones de icono.
- Se respeta "reducir movimiento" del sistema y los bordes de los móviles con notch.

## Propuestas (siguiente paso)

### Hecho al abrir el registro
- ✅ **Textos legales**: aviso legal, condiciones de uso y política de privacidad; casillas de mayoría de edad y aceptación al registrarse; borrar la cuenta con todos sus datos.
- ✅ **Moderación**: botón "Denunciar" en publicaciones y comentarios; pestaña *Moderar* para administradores.
- ✅ **Verificación de correo** obligatoria para publicar, valorar y usar mesas.
- ✅ **Fotos sin clave expuesta**: Firebase Storage con reglas (solo tu carpeta, solo imágenes, máx. 2 MB). La foto se borra al borrar la publicación.

### Alta prioridad
1. **Límite de subidas por usuario** (p. ej. 20 al día) para que nadie agote la cuota de Storage.
2. **Instalable como app (PWA completa).** Ya hay manifiesto e icono; falta el *service worker* para que se instale en la pantalla de inicio y abra sin conexión.
3. **Feed dentro de cada mesa.** Ahora una mesa solo muestra quién está. Lo natural: ver qué cervezas ha valorado la gente de esa mesa, y un "ronda actual" para la quedada.

### Media prioridad
4. **Ficha más rica**: estilo (IPA, lager, stout…), graduación, país y lugar donde la tomaste. Permite filtros útiles ("mis mejores IPAs").
5. **Perfil**: cambiar nombre y foto de avatar; estadísticas personales (cervezas, media, estilo favorito).
6. **Notificaciones**: cuando alguien de tu mesa sube o valora una cerveza.
7. **Modo oscuro**, pensado para bares con poca luz.
8. **Recorte cuadrado al subir** para que todas las tarjetas se vean igual de bien.

### Detalles
9. Rankings del grupo: la mejor valorada del mes, quién ha probado más.
10. Retos (los que proponía Gemini para la inauguración) dentro de la app.
11. Dominio propio (unos 10-15 €/año) si queréis algo más fácil de recordar que `beerlist-f02c3.web.app`.
