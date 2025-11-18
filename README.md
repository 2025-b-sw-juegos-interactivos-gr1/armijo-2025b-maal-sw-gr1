# Proyecto BabylonJS local

Estructura de carpetas:

```
assets/
	js/
		app.js
	models/
		.gitkeep
	textures/
		.gitkeep   # coloca aquí tus imágenes (ej.: madera.jpg, marmol.jpg, metal.jpg, ladrillo.jpg, cesped.jpg)
index.html
package.json
README.md
```

## Cómo usar

1) Coloca tus texturas en `assets/textures/` con los nombres que usa el ejemplo o ajusta las rutas en `assets/js/app.js`.

2) Inicia el servidor local (requiere Node.js):

```powershell
npm run start
```

Esto levanta `http-server` en `http://localhost:8080` con caché desactivada.

3) Abre `http://localhost:8080` en tu navegador. Deberías ver la escena de BabylonJS.

## Notas
- El archivo `index.html` carga BabylonJS y `assets/js/app.js`.
- Puedes agregar modelos a `assets/models/` (GLB/GLTF). Se incluyó `babylonjs.loaders` en `index.html` por si deseas cargar modelos.
- Si necesitas cambiar los nombres de las texturas, edita las rutas en `assets/js/app.js`.
