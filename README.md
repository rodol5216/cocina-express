# Cocina Express — guía para publicarla gratis

Esta carpeta tiene tu tienda lista para vivir en internet, fuera de Claude,
sin pagar hosting. Necesitas hacer 3 cosas, en este orden. Tómate tu tiempo,
no hay que apurarse.

---

## Antes de empezar

Vas a crear **2 cuentas gratis**, si no las tienes ya:
- Una cuenta de **Google** (para Firebase) — probablemente ya tienes una.
- Una cuenta de **GitHub** — gratis, en github.com.
- Una cuenta de **Vercel** — gratis, en vercel.com (puedes entrar directo con tu cuenta de GitHub).

Ninguna pide tarjeta de crédito para lo que vamos a hacer.

---

## Paso 1 — Crear la base de datos (Firebase)

1. Ve a **console.firebase.google.com** y entra con tu cuenta de Google.
2. Toca **"Crear un proyecto"**, ponle de nombre "Cocina Express", sigue los pasos (puedes desactivar Google Analytics, no lo necesitas).
3. Dentro del proyecto, en el menú izquierdo, ve a **"Firestore Database"** → **"Crear base de datos"**.
4. Elige **"Iniciar en modo de prueba"** (más adelante puedes ajustar las reglas — te dejé un archivo `firestore.rules` en esta carpeta si quieres copiar y pegar esas reglas en la pestaña "Reglas").
5. Elige la ubicación del servidor más cercana (por ejemplo, una de EE.UU. o la que te sugiera por defecto) y confirma.
6. Ahora ve a la rueda de ⚙️ (Configuración del proyecto) → pestaña **"General"** → baja hasta "Tus apps" → toca el ícono **`</>`** (Web) para agregar una app web.
7. Ponle un apodo (ej. "cocina-express-web") y toca "Registrar app". Te va a mostrar un bloque de código con algo así:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "cocina-express-xxxx.firebaseapp.com",
  projectId: "cocina-express-xxxx",
  storageBucket: "cocina-express-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**Guarda esos 6 valores** — los vas a necesitar en el Paso 3.

---

## Paso 2 — Subir el código a GitHub

1. Ve a **github.com**, crea una cuenta si no tienes, e inicia sesión.
2. Toca el botón **"+"** arriba a la derecha → **"New repository"**.
3. Ponle de nombre `cocina-express`, déjalo en **"Public"** o **"Private"** (cualquiera funciona), y toca **"Create repository"**.
4. En la página del repositorio recién creado, busca el enlace **"uploading an existing file"**.
5. Descomprime el archivo .zip que te compartí, y **arrastra todos los archivos y carpetas** (menos `node_modules` si aparece) dentro de esa página.
6. Baja y toca **"Commit changes"**.

---

## Paso 3 — Publicar la tienda (Vercel)

1. Ve a **vercel.com** → **"Sign Up"** → elige **"Continue with GitHub"**.
2. En tu panel de Vercel, toca **"Add New..." → "Project"**.
3. Busca y selecciona el repositorio `cocina-express` que acabas de subir → **"Import"**.
4. Antes de tocar "Deploy", abre la sección **"Environment Variables"** y agrega los 6 valores que guardaste del Paso 1, uno por uno:

   | Nombre | Valor |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | (tu apiKey) |
   | `VITE_FIREBASE_AUTH_DOMAIN` | (tu authDomain) |
   | `VITE_FIREBASE_PROJECT_ID` | (tu projectId) |
   | `VITE_FIREBASE_STORAGE_BUCKET` | (tu storageBucket) |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | (tu messagingSenderId) |
   | `VITE_FIREBASE_APP_ID` | (tu appId) |

5. Toca **"Deploy"** y espera 1-2 minutos.
6. ¡Listo! Vercel te da un enlace como `cocina-express-tuusuario.vercel.app` — esa es tu tienda, ya en internet, gratis.

### El link del administrador
Igual que en Claude, el botón "Admin" del menú de abajo está oculto por seguridad.
Solo aparece si agregas `#rvladmin` al final del link. Ejemplo:

- Link para tus clientes: `https://cocina-express-tuusuario.vercel.app`
- Tu link de administrador: `https://cocina-express-tuusuario.vercel.app/#rvladmin`

Guarda el segundo solo para ti. El PIN por defecto sigue siendo `1234` — cámbialo en Ajustes apenas entres.

---

## Paso 4 (opcional) — Activar "Generar descripción con IA"

Este paso es opcional y no es gratis (cuesta centavos por descripción). Si quieres usarlo:

1. Crea una clave en **console.anthropic.com** → API Keys.
2. En Vercel, ve a tu proyecto → **Settings → Environment Variables** → agrega `ANTHROPIC_API_KEY` con esa clave.
3. Vuelve a desplegar (Vercel → Deployments → "..." → Redeploy).

Si no haces este paso, el botón de IA solo mostrará un mensaje pidiéndote escribir la descripción a mano — el resto de la tienda funciona exactamente igual.

---

## Cómo actualizar tu tienda en el futuro

Cada vez que quieras cambiar algo en el código (no en los productos — eso se hace desde el panel admin, no aquí):
1. Sube los archivos nuevos a tu repositorio de GitHub (mismo método del Paso 2).
2. Vercel detecta el cambio solo y vuelve a publicar en 1-2 minutos. No hay que hacer nada más.

---

## Cosas importantes que debes saber

- **No hay contraseña real de administrador a nivel de servidor.** El PIN es solo una puerta dentro de la app; alguien muy técnico podría, en teoría, escribir datos directo a la base de datos sin pasar por tu app. Para un negocio pequeño el riesgo es bajo, pero si más adelante creces, vale la pena agregar un sistema de usuarios real (Firebase Authentication).
- **Los datos ahora sí son 100% tuyos** — viven en tu propia cuenta de Firebase, no en Claude. Puedes hacer respaldo o borrar todo cuando quieras desde el panel de Firebase.
- Si en algún momento quieres probar cambios en tu computadora antes de subirlos: copia `.env.example` como `.env`, llena los valores de Firebase, y corre `npm install` y luego `npm run dev`.
