// BabylonJS - escena básica con texturas locales en assets/textures
(function () {
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true);

  const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -15), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.9;

    // Materiales con texturas locales (colócalas en assets/textures)
    const woodMat = new BABYLON.StandardMaterial('woodMat', scene);
    woodMat.diffuseTexture = new BABYLON.Texture('assets/textures/madera.jpg', scene);

    const box = BABYLON.MeshBuilder.CreateBox('box', { size: 2 }, scene);
    box.position = new BABYLON.Vector3(-4, 1, 0);
    box.material = woodMat;

    const marbleMat = new BABYLON.StandardMaterial('marbleMat', scene);
    marbleMat.diffuseTexture = new BABYLON.Texture('assets/textures/marmol.jpg', scene);

    const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);
    sphere.position = new BABYLON.Vector3(-1.5, 1, 0);
    sphere.material = marbleMat;

    const metalMat = new BABYLON.StandardMaterial('metalMat', scene);
    metalMat.diffuseTexture = new BABYLON.Texture('assets/textures/metal.jpg', scene);

    const cylinder = BABYLON.MeshBuilder.CreateCylinder('cylinder', { height: 2, diameter: 1.5 }, scene);
    cylinder.position = new BABYLON.Vector3(1.5, 1, 0);
    cylinder.material = metalMat;

    const brickMat = new BABYLON.StandardMaterial('brickMat', scene);
    brickMat.diffuseTexture = new BABYLON.Texture('assets/textures/ladrillo.jpg', scene);

    const torus = BABYLON.MeshBuilder.CreateTorus('torus', { diameter: 2, thickness: 0.5 }, scene);
    torus.position = new BABYLON.Vector3(4, 1, 0);
    torus.material = brickMat;

    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.diffuseTexture = new BABYLON.Texture('assets/textures/cesped.jpg', scene);

    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 12, height: 12 }, scene);
    ground.material = groundMat;

    // Log de plugin activado (útil para verificar que glTF loader está activo)
    BABYLON.SceneLoader.OnPluginActivatedObservable.add((plugin) => {
      console.log('Plugin de carga activado:', plugin.name || plugin);
    });

    // Cargar el Yeti (GLTF) desde assets/models
    BABYLON.SceneLoader.ImportMeshAsync(null, "./assets/models/", "Yeti.gltf", scene)
      .then((result) => {
        const root = result.meshes && result.meshes[0];
        if (root) {
          // Escala y posición para asegurar visibilidad sobre el suelo
          root.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
          root.position = new BABYLON.Vector3(0, 1, 0);

          // Si hay bounding info, ajustar para que repose sobre el suelo
          if (root.getBoundingInfo) {
            const bi = root.getBoundingInfo();
            if (bi) {
              const min = bi.boundingBox.minimumWorld;
              const offsetY = -min.y;
              if (isFinite(offsetY)) {
                root.position.y += offsetY;
              }
            }
          }
        }
        console.log('Yeti cargado: ./assets/models/Yeti.gltf');
      })
      .catch((err) => {
        console.error('Error cargando el Yeti (./assets/models/Yeti.gltf):', err);
      });

    return scene;
  };

  const scene = createScene();
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
})();
