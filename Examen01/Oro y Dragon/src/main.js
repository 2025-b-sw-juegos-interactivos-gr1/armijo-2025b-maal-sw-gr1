import "./style.css";
import "@babylonjs/loaders/glTF"; // habilita .glb

import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  ArcRotateCamera,
  FreeCamera,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  MeshBuilder,
  StandardMaterial,
  Ray,
  TransformNode,
  SceneLoader,
} from "@babylonjs/core";

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);
const statusEl = document.getElementById("status");

const createScene = async () => {

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.07, 0.1, 1);

    /* CAMARA: Configura una cámara ArcRotate para la vista en tercera persona.
      - Posición y ángulos iniciales.
      - Control del usuario mediante el canvas.
      - Límites de zoom (radio) para evitar acercarse/alejarse demasiado. */
  const camera = new ArcRotateCamera(
    "cam",
    Math.PI * 0.75,
    Math.PI * 0.37,
    28,
    new Vector3(0, 2, 0),
    scene
  ); 
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 45;

    /* LUCES: Añade iluminación básica de la escena.
      - HemisphericLight para luz ambiental general.
      - DirectionalLight para simular luz directa (sol/industrial). */
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;

  const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, -0.3), scene);
  dir.position = new Vector3(10, 20, 10);
  dir.intensity = 0.8;

    /* ZONAS: Crea zonas del juego visibles/colisionables:
      - `pickupZone`: área donde el jugador puede recoger objetos.
      - `deliveryZone`: área donde el jugador debe entregar objetos recogidos.
      Cada zona tiene su material y propiedades de visibilidad/pickable. */
  const pickupZone = MeshBuilder.CreateBox("pickupZone", { width: 6, height: 0.2, depth: 6 }, scene);
  pickupZone.position = new Vector3(-12, 0.1, -10);
  const pickupMat = new StandardMaterial("pickupMat", scene);
  pickupMat.diffuseColor = new Color3(0.1, 0.7, 0.2);
  pickupMat.alpha = 0.55;
  pickupZone.material = pickupMat;

  const deliveryZone = MeshBuilder.CreateBox("deliveryZone", { width: 7, height: 0.2, depth: 7 }, scene);
  // DELIVERY ZONE: crear el mesh de entrega y su material; se posiciona inicialmente
  // a una altura segura y luego se alinea exactamente con la superficie del modelo.
  deliveryZone.position = new Vector3(12, 0.15, 10);
  const deliveryMat = new StandardMaterial("deliveryMat", scene);
  deliveryMat.diffuseColor = new Color3(0.15, 0.4, 0.9);
  deliveryMat.alpha = 0.55;
  deliveryZone.material = deliveryMat;
  // Referencia al borde azul (se rellenará más abajo)
  let deliveryBorderMesh = null;
  pickupZone.isVisible = false;
  pickupZone.isPickable = false;
  deliveryZone.isVisible = true;
  deliveryZone.isPickable = false;

  // Nota: el borde azul (visual) se crea tras conocer la altura real de la superficie
 
    /* JUGADOR: Crea el transform node root que representa la posición del jugador
      y carga el modelo 3D `person.glb` como hijo. Ajusta escala, rotaciones y
      calcula offsets para posicionar correctamente los pies sobre la superficie. */
  statusEl.innerHTML = "Cargando personaje…";

  const playerRoot = new TransformNode("playerRoot", scene);
  playerRoot.position = new Vector3(0, 3, 0);

  const playerModelFix = new TransformNode("playerModelFix", scene);
  playerModelFix.parent = playerRoot;
  playerModelFix.rotation.y = 0;

  // Cargar el modelo del jugador (`person.glb`) y parentarlo a `playerModelFix`.
  const playerRes = await SceneLoader.ImportMeshAsync("", "assets/", "baby_dragon.glb", scene);
  const playerMesh = playerRes.meshes[0];
  playerMesh.parent = playerModelFix;
  playerMesh.position = Vector3.Zero();
  // Hacer el personaje un poco más pequeño
  playerMesh.scaling = new Vector3(20.8, 20.8, 20.8);
  playerMesh.rotationQuaternion = null;
  playerMesh.rotation = Vector3.Zero();

  // Mejorar visibilidad del personaje
  playerRes.meshes.forEach((m) => {
    try {
      m.isVisible = true;
      if (m.material) {
        // Remover el color grisáceo oscuro
        m.material.emissiveColor = new Color3(0, 0, 0);
        m.receiveShadows = true;
      }
    } catch (e) {}
  });

  // Calcular un offset vertical basado en la bounding box del personaje
  // esto nos permite posicionar al playerRoot para que los pies queden sobre la superficie
  let playerFeetOffset = 1.2; // valor por defecto (mismo que surfaceOffset)
  try {
    // actualizar matrices y leer bounding boxes mundiales
    playerRes.meshes.forEach(m => { try { m.computeWorldMatrix(true); } catch(e) {} });
    let minWorldY = Infinity;
    for (const m of playerRes.meshes) {
      try {
        const bi = m.getBoundingInfo && m.getBoundingInfo();
        if (bi && bi.boundingBox) minWorldY = Math.min(minWorldY, bi.boundingBox.minimumWorld.y);
      } catch(e) {}
    }
    if (minWorldY !== Infinity) {
      playerFeetOffset = playerRoot.position.y - minWorldY;
    }
  } catch(e) {}

  // Calcular altura aproximada de los ojos para la cámara en primera persona
  try {
    let pMin = Infinity, pMax = -Infinity;
    for (const m of playerRes.meshes) {
      try { m.computeWorldMatrix(true); const bi = m.getBoundingInfo && m.getBoundingInfo(); if (bi && bi.boundingBox) { pMin = Math.min(pMin, bi.boundingBox.minimumWorld.y); pMax = Math.max(pMax, bi.boundingBox.maximumWorld.y); } } catch(e) {}
    }
    if (pMin !== Infinity && pMax !== -Infinity) {
      const pHeight = pMax - pMin;
      const eyeAboveFeet = Math.max(0.6, Math.min(pHeight * 0.9, 1.6));
      // playerRoot.position.y + fpOffset.y should equal pMin + eyeAboveFeet
      fpOffset.y = eyeAboveFeet - playerFeetOffset;
    }
  } catch(e) {}

    /* ANCLAJE PARA OBJETOS A CARGAR: crea `carryAttach`, un TransformNode hijo
      del modelo del jugador que sirve como punto donde se parentan los objetos
      que el jugador recoge (ej. lingotes). */
  const carryAttach = new TransformNode("carryAttach", scene);
  carryAttach.parent = playerModelFix;
  // Colocar el anclaje cerca de la mano derecha (ajustable): delante y a mitad de altura
  // Ajustar ligeramente el anclaje por el nuevo tamaño del personaje
  carryAttach.position = new Vector3(0.35, 0.9, 0.45);

    /* ESCENARIO CENTRAL: Carga `model3d_bellus.glb` (escenario principal) y opcionalmente
      otros elementos (hipogeo). Se calcula bounding boxes y se posicionan modelos
      relativos entre sí para que queden alineados en el mundo. */
  statusEl.innerHTML = "Cargando escenario central…";
  const bellusRes = await SceneLoader.ImportMeshAsync("", "assets/", "model3d_bellus.glb", scene);
  const bellusMesh = bellusRes.meshes[0];
  bellusMesh.position = new Vector3(0, 0, 0);
  bellusMesh.scaling = new Vector3(1, 1, 1);
  bellusMesh.rotationQuaternion = null;
  bellusMesh.rotation = new Vector3(-Math.PI / 2, 0, 0);

  // Cargar adicionalmente el hipogeo y colocarlo junto al escenario principal
  let hipRes = null;
  try {
    statusEl.innerHTML = "Cargando hipogeo...";
    hipRes = await SceneLoader.ImportMeshAsync("", "assets/", "hipogeo_8.glb", scene);
    // Calcular bounds mundiales (min/max/center) para las mallas importadas
    // y reposicionar el hipogeo de forma adyacente al escenario principal.
    try {
      const computeBounds = (meshes) => {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const m of meshes) {
          try { m.computeWorldMatrix(true); } catch(e) {}
          try {
            const bi = m.getBoundingInfo && m.getBoundingInfo();
            if (bi && bi.boundingBox) {
              const mn = bi.boundingBox.minimumWorld;
              const mx = bi.boundingBox.maximumWorld;
              minX = Math.min(minX, mn.x); minY = Math.min(minY, mn.y); minZ = Math.min(minZ, mn.z);
              maxX = Math.max(maxX, mx.x); maxY = Math.max(maxY, mx.y); maxZ = Math.max(maxZ, mx.z);
            }
          } catch(e) {}
        }
        return {
          min: new Vector3(minX, minY, minZ),
          max: new Vector3(maxX, maxY, maxZ),
          center: new Vector3((minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2)
        };
      };

      const bellBounds = computeBounds(bellusRes.meshes);
      const hipBounds = computeBounds(hipRes.meshes);
      // Calcular traslación para que el hipogeo quede adyacente en +X y al mismo nivel (Y)
      const gap = 0.0; // separación mínima entre modelos
      const translateX = (bellBounds.max.x - hipBounds.min.x) + gap;
      const translateY = (bellBounds.min.y - hipBounds.min.y);
      const translateZ = (bellBounds.center.z - hipBounds.center.z);

      for (const m of hipRes.meshes) {
        try {
          m.position.addInPlace(new Vector3(translateX, translateY, translateZ));
          m.computeWorldMatrix(true);
        } catch(e) {}
      }
      console.log('hipogeo cargado y alineado, meshes=', hipRes.meshes.length, 'trans=', translateX.toFixed(2), translateY.toFixed(2), translateZ.toFixed(2));
    } catch(e) { console.warn('No se pudo reposicionar hipogeo:', e); }
  } catch(e) {
    console.warn('No se pudo cargar hipogeo_8.glb:', e);
  }

  // Preparar raycasting sobre las mallas del escenario
  // Filtrar las mallas importadas para ignorar cualquier malla que esté claramente por encima
  // del nivel de la escena (ej. estructuras flotantes). Usaremos solo mallas con topY < 15
  // Combinar mallas del escenario principal y del hipogeo (si existe)
  const bellusMeshesAll = bellusRes.meshes.slice().concat((hipRes && hipRes.meshes) ? hipRes.meshes : []);
  const bellusMeshes = bellusMeshesAll.filter(m => {
    try {
      m.computeWorldMatrix(true);
      const bi = m.getBoundingInfo();
      const topY = bi.boundingBox.maximumWorld.y;
      // si la malla está por encima de 8 unidades en Y, la ignoramos (elimina estructuras flotantes)
      if (topY > 8) {
        try { if (typeof m.setEnabled === 'function') m.setEnabled(false); else m.isVisible = false; } catch(e) {}
        return false;
      }
      return true;
    } catch(e) {
      return true;
    }
  });
  const surfaceOffset = 1.2; // separación sobre la superficie (ajustada para dragon.glb)

  const getSurfaceHeight = (x, z) => {
    const origin = new Vector3(x, 200, z);
    const dir = new Vector3(0, -1, 0);
    const ray = new Ray(origin, dir, 400);
    const pick = scene.pickWithRay(ray, (m) => bellusMeshes.indexOf(m) !== -1);
    if (pick && pick.hit && pick.pickedPoint) return pick.pickedPoint.y;
    return null;
  };

  // Cámara en primera persona 
  let isFirstPerson = false;
  let fpOffset = new Vector3(0, playerFeetOffset + 2.6, 0); // altura aproximada de la cámara sobre los pies
  const fpForward = 0.6; // mayor distancia hacia delante para evitar ver la parte superior de la cabeza
  const freeCam = new FreeCamera('freeCam', playerRoot.position.add(fpOffset), scene);
  freeCam.minZ = 0.1;
  // No queremos que la cámara reciba controles del usuario (la vista se guiará por el jugador)
  try { freeCam.detachControl(); } catch(e) {}

  function toggleView() {
    isFirstPerson = !isFirstPerson;
    if (isFirstPerson) {
      // cambiar a primera persona
      try { camera.detachControl(canvas); } catch(e) {}
      scene.activeCamera = freeCam;
      // posicionar y orientar inicialmente
      try {
        const forwardVec = new Vector3(Math.sin(playerRoot.rotation.y) * fpForward, 0, Math.cos(playerRoot.rotation.y) * fpForward);
        freeCam.position = playerRoot.position.add(fpOffset).add(forwardVec);
        // alinear la rotación inicial de la cámara con la orientación del jugador
        try { freeCam.rotation = new Vector3(0, playerRoot.rotation.y, 0); } catch(e) {}
      } catch(e) {}
      try {
        // permitir control del ratón en la freeCam (pointer look)
        freeCam.attachControl(canvas, true);
        // remover entrada de teclado para que no compita con nuestro sistema de movimiento
        try { if (freeCam.inputs && typeof freeCam.inputs.removeByType === 'function') freeCam.inputs.removeByType('FreeCameraKeyboardMoveInput'); } catch(e) {}
        // solicitar pointer lock para experiencia FPS (si el navegador lo permite)
        try { if (canvas.requestPointerLock) canvas.requestPointerLock(); } catch(e) {}
      } catch(e) {}
      // ocultar las mallas del jugador para que la cámara no vea el interior del modelo
      try {
        if (playerRes && playerRes.meshes) {
          playerRes.meshes.forEach((m) => { try { m.isVisible = false; } catch(e) {} });
        }
      } catch(e) {}
    } else {
      // volver a tercera persona
      // soltar control de la cámara libre
      try { freeCam.detachControl(); } catch(e) {}
      try { if (document.exitPointerLock) document.exitPointerLock(); } catch(e) {}
      // restaurar visibilidad de las mallas del jugador
      try {
        if (playerRes && playerRes.meshes) {
          playerRes.meshes.forEach((m) => { try { m.isVisible = true; } catch(e) {} });
        }
      } catch(e) {}
      scene.activeCamera = camera;
      try { camera.attachControl(canvas, true); } catch(e) {}
    }
  }

  // Ajusta `obj` (mesh o transform con hijos) para que su base toque `surfY`.
  const placeOnSurface = (obj, surfY) => {
    try {
      let meshes = [];
      if (typeof obj.getChildMeshes === 'function') meshes = obj.getChildMeshes(true);
      if ((!meshes || meshes.length === 0) && typeof obj.getTotalVertices === 'function') meshes = [obj];

      // actualizar matrices
      obj.computeWorldMatrix(true);
      for (const m of meshes) {
        try { m.computeWorldMatrix(true); } catch(e) {}
      }

      // calcular min Y mundial
      let minWorldY = Infinity;
      for (const m of meshes) {
        try {
          const bi = m.getBoundingInfo && m.getBoundingInfo();
          if (bi && bi.boundingBox) minWorldY = Math.min(minWorldY, bi.boundingBox.minimumWorld.y);
        } catch(e) {}
      }

      if (minWorldY !== Infinity) {
        const delta = surfY - minWorldY + 0.001; // pequeño offset anti-z-fighting
        obj.position.y += delta;
        obj.computeWorldMatrix(true);
        return true;
      }
    } catch (e) {}
    // fallback simple
    try { obj.position.y = surfY + 0.02; obj.computeWorldMatrix(true); } catch(e) {}
    return false;
  };

  let minY = -Infinity;
  let sceneCenter = new Vector3(0, 0, 0);

  // Ajustar la posición del personaje para que quede sobre el escenario
  try {
    bellusMesh.computeWorldMatrix(true);
    const bbox = bellusMesh.getBoundingInfo().boundingBox;
    const topY = bbox.maximumWorld.y;
    sceneCenter = bbox.centerWorld;
    playerRoot.position.x = sceneCenter.x;
    playerRoot.position.z = sceneCenter.z;
    // Mover la zona de entrega hacia un lateral del mapa (a la derecha del modelo `bellus`)
    
    try {
      // Calcular extensiones del bounding box
      const halfWidthX = bbox.maximumWorld.x - bbox.centerWorld.x;
      const halfDepthZ = bbox.maximumWorld.z - bbox.centerWorld.z;
      const sideOffset = 12; // separación adicional desde el borde del modelo
      // Colocar la zona DETRÁS del modelo (lado de la montaña): usar Z negativo
      deliveryZone.position.x = sceneCenter.x; // centrar en X
      deliveryZone.position.z = sceneCenter.z - (halfDepthZ + sideOffset);
    } catch (e) {}
    // Intentar posicionar al personaje justo sobre la superficie usando raycast
    const centerSurfY = getSurfaceHeight(sceneCenter.x, sceneCenter.z);
    if (centerSurfY !== null) {
      // usar playerFeetOffset calculado para colocar los pies exactamente sobre la superficie
      playerRoot.position.y = centerSurfY + playerFeetOffset;
    } else {
      // Si no hay información de superficie, caer de forma segura ligeramente por encima del techo
      playerRoot.position.y = topY + 1.0;
    }
    minY = playerRoot.position.y - 2.0; // límite mínimo razonable
  } catch (e) {
    console.warn('No se pudo calcular bounding box de bellus:', e);
  }

  // Alinear la zona de entrega con la superficie del modelo `bellus` (misma superficie que el personaje)
  try {
    const deliverySurfY = getSurfaceHeight(deliveryZone.position.x, deliveryZone.position.z);
    if (deliverySurfY !== null) {
      // Colocar la zona justo sobre la superficie
      deliveryZone.position.y = deliverySurfY + 0.02;
    }

    // Crear/colocar el borde azul alrededor de la zona de entrega a una altura relativa
    const borderY2 = deliveryZone.position.y + 0.05;
    const deliveryBorderPoints2 = [
      new Vector3(deliveryZone.position.x - 3.5, borderY2, deliveryZone.position.z - 3.5),
      new Vector3(deliveryZone.position.x + 3.5, borderY2, deliveryZone.position.z - 3.5),
      new Vector3(deliveryZone.position.x + 3.5, borderY2, deliveryZone.position.z + 3.5),
      new Vector3(deliveryZone.position.x - 3.5, borderY2, deliveryZone.position.z + 3.5),
      new Vector3(deliveryZone.position.x - 3.5, borderY2, deliveryZone.position.z - 3.5),
    ];
    try { if (deliveryBorderMesh) { try { deliveryBorderMesh.dispose(); } catch(e) {} } } catch(e) {}
    deliveryBorderMesh = MeshBuilder.CreateTube("deliveryBorder", { path: deliveryBorderPoints2, radius: 0.1 }, scene);
    const borderMat2 = new StandardMaterial("borderMat", scene);
    borderMat2.emissiveColor = new Color3(0.15, 0.6, 1.0);
    deliveryBorderMesh.material = borderMat2;
  } catch (e) { console.warn('No se pudo alinear zona de entrega:', e); }

  // Función para mover la zona de entrega a X,Z (proyectando sobre la superficie)
  function placeDeliveryAt(x, z) {
    try {
      const surfY = getSurfaceHeight(x, z);
      if (surfY === null) return false;
      deliveryZone.position.x = x;
      deliveryZone.position.z = z;
      deliveryZone.position.y = surfY + 0.02;

      // recrear borde
      try { if (deliveryBorderMesh) { deliveryBorderMesh.dispose(); } } catch(e) {}
      const by = deliveryZone.position.y + 0.05;
      const pts = [
        new Vector3(deliveryZone.position.x - 3.5, by, deliveryZone.position.z - 3.5),
        new Vector3(deliveryZone.position.x + 3.5, by, deliveryZone.position.z - 3.5),
        new Vector3(deliveryZone.position.x + 3.5, by, deliveryZone.position.z + 3.5),
        new Vector3(deliveryZone.position.x - 3.5, by, deliveryZone.position.z + 3.5),
        new Vector3(deliveryZone.position.x - 3.5, by, deliveryZone.position.z - 3.5),
      ];
      deliveryBorderMesh = MeshBuilder.CreateTube("deliveryBorder", { path: pts, radius: 0.1 }, scene);
      const mat = new StandardMaterial("borderMat", scene);
      mat.emissiveColor = new Color3(0.15, 0.6, 1.0);
      deliveryBorderMesh.material = mat;
      return true;
    } catch (e) { console.warn('placeDeliveryAt error', e); return false; }
  }

    /* ORO: Importa el GLB de las barras de oro y genera múltiples instancias
      distribuyéndolas alrededor del `sceneCenter`. Cada barra se escala,
      rota y se alinea con la superficie mediante raycast para evitar solapamientos. */
  statusEl.innerHTML = "Cargando barras de oro…";
  const palletRes = await SceneLoader.ImportMeshAsync("", "assets/", "fine_gold_bar.glb", scene);

  // Elegir la primera malla con geometría para usarla como prototipo
  let palletProto = palletRes.meshes.find(m => typeof m.getTotalVertices === 'function' && m.getTotalVertices() > 0);
  if (!palletProto) palletProto = palletRes.meshes[0];
  if (palletProto) palletProto.scaling = new Vector3(1, 1, 1);

  // Generar múltiples barras de oro distribuidas aleatoriamente alrededor del centro
  const goldBars = [];
  const goldCount = 4; // aumentar cantidad de barras
  // Generar el oro sobre el escenario central: usar un radio pequeño alrededor del sceneCenter
  const spawnRadius = 8; // radio desde el sceneCenter donde se pueden generar (más cerca del modelo)

  let created = 0;
  let attempts = 0;
  const maxAttempts = goldCount * 6;
  while (created < goldCount && attempts < maxAttempts) {
    attempts++;
    const rx = sceneCenter.x + (Math.random() * 2 - 1) * spawnRadius;
    const rz = sceneCenter.z + (Math.random() * 2 - 1) * spawnRadius;
    // (Generar directamente dentro del radio cercano al centro)
    const surfY = getSurfaceHeight(rx, rz);
    if (surfY === null) continue;

    if (!palletProto) continue;
    const protoClone = palletProto.clone(`gold_${created}`);
    if (!protoClone) continue;

    // aplicar escala y rotación aleatoria ligera
    try {
      protoClone.scaling = protoClone.scaling || new Vector3(1,1,1);
      // Hacer las barras más pequeñas para que puedan sujetarse en la mano
      protoClone.scaling = protoClone.scaling.multiplyByFloats(0.3 + Math.random()*0.3, 0.3 + Math.random()*0.3, 0.3 + Math.random()*0.3);
    } catch(e) {}
    protoClone.rotation = new Vector3(0, Math.random() * Math.PI * 2, 0);

    // placeOnSurface no funciona bien si el objeto está muy lejos.
    // Lo posicionamos cerca de la superficie de destino antes de llamar a la función.
    protoClone.position = new Vector3(rx, surfY + 5, rz);
    protoClone.computeWorldMatrix(true);

    // Alinear la base del clon con la superficie
    try {
      // placeOnSurface no es fiable; posicionar directamente sobre surfY
      // con un pequeño offset para asegurar visibilidad.
      protoClone.position.y = surfY + 0.1;
      protoClone.computeWorldMatrix(true);
    } catch (e) {
      protoClone.position.y = surfY + 0.02;
    }

    try {
      protoClone.isVisible = true;
      // Restaurar color dorado para las barras
      if (protoClone.material) protoClone.material.emissiveColor = new Color3(0.95, 0.8, 0.2);
    } catch (e) {}
    protoClone.isPickable = true;
    // Log para depuración: mostrar coordenadas y offsets calculados
    try {
      let minWorldYLog = null;
      try {
        const meshesLog = (typeof protoClone.getChildMeshes === 'function') ? protoClone.getChildMeshes(true) : [protoClone];
        let mm = Infinity;
        for (const m of meshesLog) {
          try { m.computeWorldMatrix(true); const bi = m.getBoundingInfo && m.getBoundingInfo(); if (bi && bi.boundingBox) mm = Math.min(mm, bi.boundingBox.minimumWorld.y); } catch(e) {}
        }
        if (mm !== Infinity) minWorldYLog = mm;
      } catch(e) {}
      console.log('[GOLD] created', protoClone.name, 'rx=', rx.toFixed(2), 'rz=', rz.toFixed(2), 'surfY=', surfY !== null ? surfY.toFixed(2) : null, 'minWorldY=', minWorldYLog !== null ? minWorldYLog.toFixed(2) : null, 'finalY=', protoClone.position.y.toFixed(2));
    } catch(e) {}
    goldBars.push(protoClone);
    created++;
  }

  // Si no se pudieron generar instancias desde el GLB, no crear marcadores visibles.
  if (goldBars.length === 0) {
    console.warn('No se generaron barras desde el GLB; no se crearán marcadores visibles.');
  }

  let goldCollected = 0;
  // Estado y animación para cuando el jugador recoge y "carga" una barra de oro
  let isCarryingGold = false;
  let carriedGold = null;
  let carryProgress = 0;
  const carryDurationFrames = 24; // frames que tarda en subirse al personaje
  let carryStartPos = null;
  let carriedGoldOriginalScaling = null;

  // Garantizar presencia de oro visible: si no hay suficientes instancias válidas,
  // crear esferas doradas adicionales alrededor del jugador y del centro.
  (function ensureVisibleGold() {
    // No crear esferas adicionales: confiar en las barras importadas desde el GLB.
    if (goldBars.length === 0) console.warn('ensureVisibleGold: no hay barras visibles y no se crearán esferas.');
  })();

  // Crear dos marcadores de prueba: uno justo bajo el jugador y otro en el centro del escenario
  // Marcadores de prueba (player/center) eliminados para no mostrar esferas.

    /* ESTADO: Variables que guardan el estado del juego (recogido, entregas,
      temporizadores, progreso de animaciones). */
  let hasPallet = false;
  let deliveredCount = 0;
  const deliveriesGoal = 3;
  let showWinTimer = 0;
  let totalOreDelivered = 0;
  let isDeliveringGold = false;
  let deliveryProgress = 0;
  const deliveryDurationFrames = 24;

  const inputMap = {};
  scene.onKeyboardObservable.add((kbInfo) => {
    const key = kbInfo.event.key.toLowerCase();
    if (kbInfo.type === 1) {
      inputMap[key] = true;
      if (key === "e") tryPickup();
      if (key === "q") tryDeliver();
      if (key === "v") toggleView();
      if (key === "m") {
        try {
          const moved = placeDeliveryAt(playerRoot.position.x, playerRoot.position.z);
          if (moved) statusEl.innerHTML = '✅ Zona de entrega movida a tu posición.';
          else statusEl.innerHTML = '❌ No se pudo mover la zona (sin superficie).';
        } catch (e) {}
      }
    } else {
      inputMap[key] = false;
    }
  });

    /* MOVIMIENTO: Lee las teclas de movimiento, aplica la traslación del jugador
      y mantiene la altura del personaje proyectando su posición sobre la geometría
      usando `getSurfaceHeight` para que los pies estén sobre la superficie. */
  const speed = 0.25;

  scene.onBeforeRenderObservable.add(() => {
    let moveX = 0, moveZ = 0;
    if (inputMap["w"] || inputMap["arrowup"]) moveZ += 1;
    if (inputMap["s"] || inputMap["arrowdown"]) moveZ -= 1;
    if (inputMap["a"] || inputMap["arrowleft"]) moveX -= 1;
    if (inputMap["d"] || inputMap["arrowright"]) moveX += 1;

    const dirVec = new Vector3(moveX, 0, moveZ);

    if (dirVec.length() > 0) {
      dirVec.normalize();
      playerRoot.position.addInPlace(dirVec.scale(speed));
      playerRoot.rotation.y = Math.atan2(dirVec.x, dirVec.z);
    }

    // Ajustar la altura del personaje proyectando sobre la geometría del escenario
    try {
      const surfY = getSurfaceHeight(playerRoot.position.x, playerRoot.position.z);
      if (surfY !== null) {
        // usar playerFeetOffset calculado para mantener los pies en la superficie
        playerRoot.position.y = surfY + playerFeetOffset;
      } else if (playerRoot.position.y < minY) {
        playerRoot.position.y = minY;
      }
    } catch (e) {
      if (playerRoot.position.y < minY) playerRoot.position.y = minY;
    }

    if (isFirstPerson) {
      try {
        const forwardVec = new Vector3(Math.sin(playerRoot.rotation.y) * fpForward, 0, Math.cos(playerRoot.rotation.y) * fpForward);
        freeCam.position = playerRoot.position.add(fpOffset).add(forwardVec);
      } catch (e) {}
    } else {
      camera.target = playerRoot.position.add(new Vector3(0, 1.5, 0));
    }
    updateHUD();
  });

    /* RECOGER: Lógica para detectar la barra de oro más cercana y animar su
      recogida (moverla hacia `carryAttach` y parentarla). Incluye también
      la lógica para soltar objetos en la escena. */
  function tryPickup() {
    // 1) Intentar recoger una barra de oro cercana
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < goldBars.length; i++) {
      const g = goldBars[i];
      if (!g) continue;
      if (typeof g.isEnabled === 'function' && !g.isEnabled()) continue;
      const dist = Vector3.Distance(playerRoot.position, g.getAbsolutePosition ? g.getAbsolutePosition() : g.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = g;
      }
    }

    if (nearest && nearestDist < 2.2 && !isCarryingGold) {
      // Iniciar animación de recogida: el oro se acerca al personaje y luego se "engancha"
      carriedGold = nearest;
      try { carriedGoldOriginalScaling = (carriedGold.scaling && carriedGold.scaling.clone) ? carriedGold.scaling.clone() : new Vector3(1,1,1); } catch(e) { carriedGoldOriginalScaling = new Vector3(1,1,1); }
      try { carriedGold.computeWorldMatrix(true); carryStartPos = carriedGold.getAbsolutePosition().clone(); } catch(e) { carryStartPos = carriedGold.position.clone(); }
      carryProgress = 0;
      isCarryingGold = true;
      // impedir que se vuelva a pickear mientras se anima
      try { carriedGold.isPickable = false; } catch(e) {}
      statusEl.innerHTML = `🪙 Recogiendo...`;
      return;
    }

    // Si ya llevas una barra (está parentada al attach), permitir soltarla donde estés
    try {
      if (carriedGold && carriedGold.parent === carryAttach && !isCarryingGold) {
        // Drop at player's current X,Z onto the scene surface
        const dropX = playerRoot.position.x;
        const dropZ = playerRoot.position.z;
        const dropSurfY = getSurfaceHeight(dropX, dropZ);
        // Unparent primero para colocar en mundo
        try { carriedGold.parent = null; } catch(e) {}
        try {
          if (dropSurfY !== null) {
            // Alinear la base del objeto con la superficie
            try {
              placeOnSurface(carriedGold, dropSurfY);
              carriedGold.position.x = dropX;
              carriedGold.position.z = dropZ;
            } catch(e) {
              carriedGold.position = new Vector3(dropX, dropSurfY + 0.02, dropZ);
            }
          } else {
            // fallback: soltar cerca del jugador
            carriedGold.position = new Vector3(playerRoot.position.x, playerRoot.position.y - 0.5, playerRoot.position.z);
          }
        } catch(e) {
          try { carriedGold.position = new Vector3(playerRoot.position.x, playerRoot.position.y - 0.5, playerRoot.position.z); } catch(e) {}
        }
        try { 
          // restaurar escala original al soltar
          if (carriedGoldOriginalScaling) carriedGold.scaling = carriedGoldOriginalScaling;
          carriedGold.isPickable = true; 
        } catch(e) {}
        // actualizar conteo de oro: lo soltaste, así que reducir el contador
        goldCollected = Math.max(0, goldCollected - 1);
        statusEl.innerHTML = `🪙 Oro recogido: <b>${goldCollected}</b>`;
        carriedGold = null;
        return;
      }
    } catch(e) {}

    // 2) Si existiera la lógica de palés (compatibilidad), intentar recoger palé
    try {
      if (typeof palletsStack !== 'undefined' && palletsStack.length > 0 && !hasPallet) {
        const topPallet = palletsStack[palletsStack.length - 1];
        const dist = Vector3.Distance(playerRoot.position, topPallet.getAbsolutePosition());
        if (dist < 2.2) {
          hasPallet = true;
          carriedPallet = palletsStack.pop();
          carriedPallet.parent = carryAttach;
          carriedPallet.position = Vector3.Zero();
          carriedPallet.rotation = Vector3.Zero();
        }
      }
    } catch (e) {}
  }
    /* ENTREGAR: Lógica para la entrega de objetos cuando el jugador está
      dentro de `deliveryZone`. Controla animación de entrega y actualización
      de contadores (oro entregado). */
  function tryDeliver() {
    // Si llevas oro y estás en la zona de entrega, iniciar animación de entrega
    if (carriedGold && carriedGold.parent === carryAttach && !isCarryingGold && !isDeliveringGold) {
      const distDelivery = Vector3.Distance(playerRoot.position, deliveryZone.position);
      
      if (distDelivery < 3.5) {
        isDeliveringGold = true;
        deliveryProgress = 0;
        showWinTimer = 120;
        console.log("Entregando oro...");
        return;
      } else {
        statusEl.innerHTML = `❌ Debes estar en la zona de entrega (azul) para entregar.`;
        console.log("No estás en la zona de entrega");
        return;
      }
    }

    if (!hasPallet || !carriedPallet) return;

    const dist = Vector3.Distance(playerRoot.position, deliveryZone.position);
    if (dist < 3.0) {
      hasPallet = false;
      carriedPallet.parent = null;
      carriedPallet.position = deliveryZone.position.add(new Vector3(0, 0.2, 0));
      carriedPallet = null;

      deliveredCount++;
      showWinTimer = 120;

      if (deliveredCount >= deliveriesGoal) {
        statusEl.innerHTML = `<b style="color:#ffd34f;font-size:16px">
          🎉 ¡MISIÓN COMPLETADA! Entregaste ${deliveredCount} palés.
        </b>`;
        scene.onBeforeRenderObservable.clear();
        return;
      }
    }
  }

    /* HUD: Construye y actualiza el panel de estado `statusEl` con información
      sobre oro recogido, oro en escena, instrucciones contextuales y mensajes. */
  function updateHUD() {
    // No actualizar HUD si estamos en animación de entrega
    if (isDeliveringGold) return;
    
    let msg = `<b style="font-size:14px">⛏️ ORO Y DRAGÓN</b><br><br>`;
    
    let nearestGoldDist = Infinity;
    let goldAvailable = 0;
    for (let i = 0; i < goldBars.length; i++) {
      const g = goldBars[i];
      if (!g) continue;
      if (g === carriedGold) continue;
      if (typeof g.isEnabled === 'function' && !g.isEnabled()) continue;
      goldAvailable++;
      const dist = Vector3.Distance(playerRoot.position, g.getAbsolutePosition ? g.getAbsolutePosition() : g.position);
      if (dist < nearestGoldDist) nearestGoldDist = dist;
    }
    
    msg += `<b>STATS:</b><br>`;
    msg += `Oro recogido: <b>${goldCollected}</b><br>`;
    msg += `Oro entregado: <b style="color:#5dff7a">${totalOreDelivered}</b><br>`;
    msg += `Oro en escena: <b>${goldAvailable}</b><br><br>`;
    
    // Lógica de instrucciones
    if (isCarryingGold) {
      msg += `<b style="color:#ffaa00">⏳ Recogiendo oro...</b>`;
    } else if (carriedGold && carriedGold.parent === carryAttach) {
      // Llevas oro
      msg += `<b style="color:#ffdd00">📥 Llevas 1 lingote de oro</b><br>`;
      const distDelivery = Vector3.Distance(playerRoot.position, deliveryZone.position);
      if (distDelivery < 3.5) {
        msg += `<br><b style="color:#5dff7a">👉 PRESIONA Q PARA ENTREGAR</b>`;
      } else {
        msg += `<br>Distancia a zona entrega: ${distDelivery.toFixed(1)} m`;
      }
    } else {
      // No llevas oro
      if (goldAvailable > 0 && nearestGoldDist < 2.2) {
        msg += `<b style="color:#ffaa00">👉 PRESIONA E PARA RECOGER</b>`;
      } else if (goldAvailable > 0) {
        msg += `Lingotes disponibles: ${goldAvailable}<br>Acércate a uno para recoger.`;
      } else {
        msg += `<b style="color:#ff5555">🚫 No hay más oro en escena</b>`;
      }
    }

    statusEl.innerHTML = msg;
  }

  statusEl.innerHTML = "✅ Listo. ¡Empieza a jugar!";
  // Mostrar el panel HUD para ver los mensajes
  try { statusEl.style.display = 'block'; } catch(e) {}
  // Animación: cuando se inicia la recogida, el oro se mueve hacia el punto de anclaje
  scene.onBeforeRenderObservable.add(() => {
    if (isCarryingGold && carriedGold) {
      carryProgress++;
      const t = Math.min(1, carryProgress / carryDurationFrames);
      try {
        const targetPos = carryAttach.getAbsolutePosition();
        const pos = Vector3.Lerp(carryStartPos, targetPos, t);
        carriedGold.setAbsolutePosition(pos);
      } catch(e) {}

      if (t >= 1) {
        try {
          carriedGold.parent = carryAttach;
          carriedGold.position = Vector3.Zero();
          carriedGold.rotation = Vector3.Zero();
          try {
            if (carriedGoldOriginalScaling) carriedGold.scaling = carriedGoldOriginalScaling.multiplyByFloats(0.35,0.35,0.35);
            else carriedGold.scaling = new Vector3(0.35,0.35,0.35);
          } catch(e) {}
          isCarryingGold = false;
          carryProgress = 0;
          carryStartPos = null;
          goldCollected++;
          statusEl.innerHTML = `🪙 Oro recogido: <b>${goldCollected}</b>`;
        } catch(e) {}
      }
    }

    if (isDeliveringGold && carriedGold) {
      deliveryProgress++;
      const t = Math.min(1, deliveryProgress / deliveryDurationFrames);
      
      try {
        if (carriedGold.material) {
          carriedGold.material.emissiveColor = new Color3(0.2, 0.9, 0.3);
        }
        
        const targetPos = deliveryZone.position.add(new Vector3(0, 1, 0));
        const currentPos = carriedGold.getAbsolutePosition();
        const newPos = Vector3.Lerp(currentPos, targetPos, t * 0.15);
        carriedGold.setAbsolutePosition(newPos);
      } catch(e) {}

      if (t >= 1) {
        try {
          carriedGold.parent = null;
          carriedGold.position = deliveryZone.position.add(new Vector3(
            (Math.random() - 0.5) * 2,
            0.1,
            (Math.random() - 0.5) * 2
          ));
          
          if (carriedGold.material) carriedGold.material.emissiveColor = new Color3(0.95, 0.8, 0.2);
          if (carriedGoldOriginalScaling) carriedGold.scaling = carriedGoldOriginalScaling;
          carriedGold.isPickable = true;
          
          goldCollected = Math.max(0, goldCollected - 1);
          totalOreDelivered++;
          isDeliveringGold = false;
          deliveryProgress = 0;
          carriedGold = null;
          
          statusEl.innerHTML = `✅ ¡Oro entregado! Total: <b style="color:#5dff7a">${totalOreDelivered}</b>`;
        } catch(e) {}
      }
    }
  });
  return scene;
};

/* ---------------- RUN ---------------- */
createScene().then((scene) => {
  engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());
canvas.focus();