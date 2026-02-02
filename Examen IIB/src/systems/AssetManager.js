import {
  SceneLoader,
  AssetsManager,
  Mesh,
  StandardMaterial,
  Color3,
  Texture,
  Sound,
  TransformNode,
} from "@babylonjs/core";

export class AssetManager {
  constructor(scene) {
    this.scene = scene;
    this.loadedAssets = new Map();
    this.assetsManager = new AssetsManager(scene);
  }

  async loadModel(name, path) {
    if (this.loadedAssets.has(name)) {
      return this.loadedAssets.get(name);
    }

    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "/assets/models/",
        path,
        this.scene
      );
      this.loadedAssets.set(name, result);

      console.log(
        `Model ${name} loaded successfully with ${result.meshes.length} meshes`
      );

      // Setup collisions and materials for imported meshes
      result.meshes.forEach((mesh, index) => {
        if (mesh.name && mesh.geometry) {
          mesh.checkCollisions = true;

          if (mesh.name.toLowerCase().includes("collision")) {
            mesh.isVisible = false;
            mesh.checkCollisions = true;
          } else if (
            mesh.name.toLowerCase().includes("wall") ||
            mesh.name.toLowerCase().includes("floor") ||
            mesh.name.toLowerCase().includes("ceiling")
          ) {
            mesh.checkCollisions = true;
            if (!mesh.material) {
              mesh.material = this.createHorrorMaterial(`${name}_${index}`);
            }
          } else {
            mesh.checkCollisions = true;
            if (!mesh.material) {
              mesh.material = this.createPlaceholderMaterial();
            }
          }
        }
      });

      return result;
    } catch (error) {
      console.warn(`Failed to load model ${name}:`, error);
      return null;
    }
  }

  // ✅ FIX: instancia TODO el modelo, no solo 1 mesh
 async createModelInstance(modelName, position, rotation = null, scale = null) {
  const modelData = this.loadedAssets.get(modelName);
  console.log(
    `Creating instance for model: ${modelName}`,
    modelData ? "Model found" : "Model not found"
  );

  if (!modelData) {
    console.warn(`Model ${modelName} not loaded`);
    return null;
  }

  const container = new TransformNode(
    `${modelName}_container_${Date.now()}`,
    this.scene
  );

  container.position.copyFrom(position);
  if (rotation) container.rotation.copyFrom(rotation);
  if (scale) container.scaling.copyFrom(scale);

  const sourceMeshes = modelData.meshes.filter(
    (m) => m && m.geometry && m.name !== "__root__"
  );

  console.log("[AssetManager] sourceMeshes:", sourceMeshes.length);

  if (sourceMeshes.length === 0) {
    console.warn("[AssetManager] No meshes with geometry found to clone");
    container.dispose();
    return null;
  }

  let created = 0;

  sourceMeshes.forEach((src) => {
    // ✅ CLONE REAL (NO instance)
    const clone = src.clone(`${src.name}_clone_${Date.now()}`);

    if (!clone) return;

    clone.parent = container;

    // Copia transform local del mesh original
    clone.position.copyFrom(src.position);
    clone.scaling.copyFrom(src.scaling);

    if (src.rotationQuaternion) {
      clone.rotationQuaternion = src.rotationQuaternion.clone();
    } else {
      clone.rotation.copyFrom(src.rotation);
    }

    // Material / render settings
    clone.material = src.material;
    clone.checkCollisions = false;
    clone.isPickable = false;
    clone.isVisible = true;
    clone.visibility = 1;

    created++;
  });

  console.log(`[AssetManager] Model CLONED with ${created} meshes`);
  return container;
}

  async loadTexture(name, path) {
    if (this.loadedAssets.has(name)) return this.loadedAssets.get(name);
    const texture = new Texture(`assets/textures/${path}`, this.scene);
    this.loadedAssets.set(name, texture);
    return texture;
  }

  async loadSound(name, path) {
    if (this.loadedAssets.has(name)) return this.loadedAssets.get(name);
    const sound = new Sound(name, `assets/audio/${path}`, this.scene, null, { loop: false, autoplay: false });
    this.loadedAssets.set(name, sound);
    return sound;
  }

  createPlaceholderMesh(name, size = 1) {
    const mesh = Mesh.CreateBox(name, size, this.scene);
    mesh.material = this.scene.getMaterialByName('placeholder') || this.createPlaceholderMaterial();
    mesh.checkCollisions = true;
    return mesh;
  }

  async loadTableModel() {
    return await this.loadModel('table', 'industrial_coffee_table_4k.gltf');
  }

  async loadCorridorModel() {
    try {
      const result = await this.loadModel('horror_corridor1', 'horror_corridor_1.glb');
      if (result && result.meshes) {
        result.meshes.forEach(mesh => {
          if (mesh.name && mesh.geometry) {
            mesh.checkCollisions = true;
            if (
              mesh.name.toLowerCase().includes('wall') ||
              mesh.name.toLowerCase().includes('floor') ||
              mesh.name.toLowerCase().includes('ceiling')
            ) {
              mesh.isPickable = false;
            }
          }
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to load horror corridor model:', error);
      return null;
    }
  }

  createPlaceholderMaterial() {
    const material = new StandardMaterial('placeholder', this.scene);
    material.diffuseColor = new Color3(0.5, 0.5, 0.5);
    material.emissiveColor = new Color3(0.1, 0.1, 0.1);
    return material;
  }

  createHorrorMaterial(name) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = new Color3(0.3, 0.35, 0.3);
    material.specularColor = new Color3(0.05, 0.05, 0.05);
    material.roughness = 0.8;
    return material;
  }

  getLoadedModel(name) {
    return this.loadedAssets.get(name);
  }

  dispose() {
    this.loadedAssets.clear();
    this.assetsManager.reset();
  }
}