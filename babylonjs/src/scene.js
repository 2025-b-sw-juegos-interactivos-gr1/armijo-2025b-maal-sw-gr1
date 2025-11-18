export function createScene(engine, canvas) {
  const scene = new BABYLON.Scene(engine);

  const camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -15), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.9;

  // Nota: coloca las texturas dentro de la carpeta `assets/` en la raíz del proyecto.
  // Textura de madera para la caja (archivo local: assets/wood.jpg)
  const woodMat = new BABYLON.StandardMaterial('woodMat', scene);
  woodMat.diffuseTexture = new BABYLON.Texture('assets/wood.jpg', scene);

  const box = BABYLON.MeshBuilder.CreateBox('box', { size: 2 }, scene);
  box.position = new BABYLON.Vector3(-4, 1, 0);
  box.material = woodMat;

  // Textura de mármol para la esfera (assets/marble.jpg)
  const marbleMat = new BABYLON.StandardMaterial('marbleMat', scene);
  marbleMat.diffuseTexture = new BABYLON.Texture('assets/marble.jpg', scene);

  const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);
  sphere.position = new BABYLON.Vector3(-1.5, 1, 0);
  sphere.material = marbleMat;

  // Textura metálica para el cilindro (assets/metal.jpg)
  const metalMat = new BABYLON.StandardMaterial('metalMat', scene);
  metalMat.diffuseTexture = new BABYLON.Texture('assets/metal.jpg', scene);

  const cylinder = BABYLON.MeshBuilder.CreateCylinder('cylinder', { height: 2, diameter: 1.5 }, scene);
  cylinder.position = new BABYLON.Vector3(1.5, 1, 0);
  cylinder.material = metalMat;

  // Textura de ladrillo para el torus (assets/brick.jpg)
  const brickMat = new BABYLON.StandardMaterial('brickMat', scene);
  brickMat.diffuseTexture = new BABYLON.Texture('assets/brick.jpg', scene);

  const torus = BABYLON.MeshBuilder.CreateTorus('torus', { diameter: 2, thickness: 0.5 }, scene);
  torus.position = new BABYLON.Vector3(4, 1, 0);
  torus.material = brickMat;

  // Textura de césped para el suelo (assets/grass.jpg)
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseTexture = new BABYLON.Texture('assets/grass.jpg', scene);

  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 12, height: 12 }, scene);
  ground.material = groundMat;

  return scene;
}
