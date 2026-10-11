# TikTok Repost Cleaner - Extensión de Navegador

Esta extensión te permite gestionar y eliminar de forma selectiva los videos compartidos (reposts) de tu perfil de TikTok.

---

## 🚀 ¿Cómo instalarla en tu navegador (Chrome / Edge / Brave)?

1. **Abre la gestión de extensiones:**
   * En **Google Chrome**: Entra a `chrome://extensions/`
   * En **Microsoft Edge**: Entra a `edge://extensions/`
2. **Activa el "Modo desarrollador" (Developer mode):**
   * Verás un interruptor en la esquina superior derecha. Actívalo.
3. **Cargar la extensión descomprimida:**
   * Haz clic en el botón que dice **"Cargar descomprimida"** (o *Load unpacked*).
   * Selecciona esta carpeta: `c:\Users\Javier Tulcán\Desktop\TikTok`.
4. ¡Listo! La extensión aparecerá en tu barra de herramientas. Te recomendamos fijarla (anclarla) para tenerla siempre a la mano.

---

## 🛠️ ¿Cómo usarla?

1. Ve a [TikTok](https://www.tiktok.com/) en tu navegador e inicia sesión con tu cuenta.
2. Dirígete a tu **Perfil** y entra en la pestaña de **Compartidos** / **Republicaciones**.
3. Abre la extensión haciendo clic en su ícono.
4. Presiona **🔍 Escanear Compartidos**. La extensión detectará los videos visibles en esa sección.
5. Marca las casillas de los videos que quieres eliminar (o usa el botón para seleccionar todos).
6. Presiona **🗑️ Eliminar Seleccionados**. La extensión irá abriendo y desmarcando el compartido uno a uno con pausas para no saturar la red ni activar bloqueos de TikTok.

---

## ⚠️ Consejos y advertencias
- **Selectores de TikTok:** TikTok cambia frecuentemente sus clases y estructura web. Si en algún momento no detecta los botones, avísame para actualizar los selectores en `content.js`.
- **Desplázate hacia abajo:** Si tienes muchos compartidos, haz scroll en tu perfil de TikTok para que carguen más videos en pantalla antes de presionar "Escanear Compartidos".
