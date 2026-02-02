import {
  Vector3,
  Ray,
  SpotLight,
  Color3,
  TransformNode,
  HemisphericLight,
} from "@babylonjs/core";

const VIEWMODEL_MASK = 0x10000000;

export class PlayerController {
  constructor(camera, scene, systems) {
    this.camera = camera;
    this.scene = scene;
    this.systems = systems;

    this.moveSpeed = 3.0;
    this.mouseSensitivity = 0.002;
    this.isMoving = false;
    this.lastFootstepTime = 0;
    this.footstepInterval = 500;

    // Flashlight
    this.flashlight = null;
    this.flashlightEnabled = false;
    this.batteryLevel = 100;
    this.batteryDrainRate = 2;
    this.flickerChance = 0.02;

    // Viewmodel (radio)
    this.viewmodelCamera = null;
    this.viewmodelLight = null;
    this.radioHolder = null;
    this.radioRoot = null;

    // Debug (ponlo en false cuando ya funcione)
    this.debugViewmodel = true;

    this.keys = {};
    this.mouseMovement = { x: 0, y: 0 };

    this.setupControls();
    this.setupFlashlight();
    this.setupPointerLock();

    this.setupViewmodelCamera();
    this.setupRadio();
  }

  setupViewmodelCamera() {
    // Asegura cámara activa principal (para input/controles)
    this.scene.activeCamera = this.camera;
/*
    // Mundo: todo menos VIEWMODEL_MASK
    this.camera.layerMask = 0x0fffffff;

    // Viewmodel cam: solo VIEWMODEL_MASK
    this.viewmodelCamera = this.camera.clone("viewmodelCamera");
    this.viewmodelCamera.parent = this.camera;
    this.viewmodelCamera.layerMask = VIEWMODEL_MASK;

    // Render order: mundo -> viewmodel
    this.scene.activeCameras = [this.camera, this.viewmodelCamera];

    // Viewmodel clipping
    this.viewmodelCamera.minZ = 0.01;
    this.viewmodelCamera.maxZ = 10.0;
    this.viewmodelCamera.fov = this.camera.fov * 0.9;

    // Luz solo para viewmodel
    this.viewmodelLight = new HemisphericLight(
      "vmLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    this.viewmodelLight.intensity = 1.2;
    this.viewmodelLight.includeOnlyWithLayerMask = VIEWMODEL_MASK;

    console.log("[Viewmodel] RH:", this.scene.useRightHandedSystem);
    console.log("[Viewmodel] activeCameras:", this.scene.activeCameras?.length);
  */}

async setupRadio() {
  if (!this.systems?.assetManager) return;

  try {
    console.log("[Radio] Loading...");
    await this.systems.assetManager.loadModel(
      "radio",
      "jgc_radio.glb"
    );

    // ✅ Ahora SÍ puedes apagar el template (porque YA NO usamos instances)
    const template = this.systems.assetManager.getLoadedModel("radio");
    if (template?.meshes?.length) {
      template.meshes.forEach((m) => {
        if (!m) return;
        m.setEnabled(false);
        m.isVisible = false;
        m.checkCollisions = false;
        m.isPickable = false;
      });
    }

    // Luz para que no salga negro
    if (!this._radioTestLight) {
      this._radioTestLight = new HemisphericLight(
        "radioTestLight",
        new Vector3(0, 1, 0),
        this.scene
      );
      this._radioTestLight.intensity = 2.0;
    }

    // Holder pegado a la cámara
    this.radioHolder = new TransformNode("radioHolder", this.scene);
    this.radioHolder.parent = this.camera;

    // RH=false => forward es +Z
    // más a la derecha, más abajo, un poco más lejos
this.radioHolder.position = new Vector3(0.55, -0.40, 1.35);
this.radioHolder.rotation = new Vector3(0.15, Math.PI / 2 + 0.18, -0.10);

const radioRoot = await this.systems.assetManager.createModelInstance(
  "radio",
  Vector3.Zero(),
  Vector3.Zero(),
  new Vector3(0.06, 0.06, 0.06)
);

    if (!radioRoot) {
      console.warn("[Radio] createModelInstance returned null");
      return;
    }

    this.radioRoot = radioRoot;
    radioRoot.parent = this.radioHolder;
    radioRoot.rotation.y = Math.PI/2;
    radioRoot.rotation.x = -Math.PI / 2;
    // Forzar visible
    radioRoot.setEnabled(true);

    const meshes = radioRoot.getChildMeshes(true);
    console.log("[Radio] child meshes:", meshes.length);

    meshes.forEach((m) => {
      m.setEnabled(true);
      m.isVisible = true;
      m.visibility = 1;
      m.checkCollisions = false;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    });

    console.log("[Radio] OK - should be visible now (CLONES)");
  } catch (e) {
    console.warn("Failed to setup radio on camera:", e);
  }
}


  setupControls() {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();

      if (kbInfo.type === 1) {
        this.keys[key] = true;

        if (key === "f") this.toggleFlashlight();
        if (key === "e") this.systems?.interactionManager?.tryInteract?.();
      } else if (kbInfo.type === 2) {
        this.keys[key] = false;
      }
    });

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === 4) {
        if (
          document.pointerLockElement ===
          this.scene.getEngine().getRenderingCanvas()
        ) {
          this.mouseMovement.x = pointerInfo.event.movementX || 0;
          this.mouseMovement.y = pointerInfo.event.movementY || 0;
        }
      }
    });
  }

  setupFlashlight() {
    this.flashlight = new SpotLight(
      "flashlight",
      this.camera.position,
      this.camera.getForwardRay().direction,
      Math.PI / 6,
      2,
      this.scene
    );

    this.flashlight.diffuse = new Color3(1, 0.9, 0.7);
    this.flashlight.intensity = 0;
    this.flashlight.range = 15;
    this.flashlight.parent = this.camera;
  }

  setupPointerLock() {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    canvas.addEventListener("click", () => canvas.requestPointerLock());
  }

  update(deltaTime) {
    // ✅ IMPORTANTÍSIMO: algunos proyectos reescriben activeCameras
    // Esto lo “re-fija” siempre para que el viewmodel no desaparezca.
    if (
      !this.scene.activeCameras ||
      this.scene.activeCameras.length !== 2 ||
      this.scene.activeCameras[0] !== this.camera
    ) {
      this.scene.activeCamera = this.camera;
      this.scene.activeCameras = [this.camera, this.viewmodelCamera].filter(Boolean);
    }

    this.handleMovement(deltaTime);
    this.handleMouseLook();
    this.updateFlashlight(deltaTime);
    this.updateFootsteps();
    this.updateUI();
  }

  handleMovement(deltaTime) {
    const moveVector = Vector3.Zero();
    let moving = false;

    if (this.keys["w"]) {
      moveVector.addInPlace(this.camera.getForwardRay().direction);
      moving = true;
    }
    if (this.keys["s"]) {
      moveVector.subtractInPlace(this.camera.getForwardRay().direction);
      moving = true;
    }
    if (this.keys["a"]) {
      const rightVector = new Vector3(
        Math.cos(this.camera.rotation.y + Math.PI / 2),
        0,
        Math.sin(this.camera.rotation.y + Math.PI / 2)
      );
      moveVector.subtractInPlace(rightVector);
      moving = true;
    }
    if (this.keys["d"]) {
      const rightVector = new Vector3(
        Math.cos(this.camera.rotation.y + Math.PI / 2),
        0,
        Math.sin(this.camera.rotation.y + Math.PI / 2)
      );
      moveVector.addInPlace(rightVector);
      moving = true;
    }

    if (moving) {
      moveVector.normalize();
      moveVector.scaleInPlace(this.moveSpeed * deltaTime);
      moveVector.y = 0;

      const newPos = this.camera.position.add(moveVector);
      const ray = new Ray(this.camera.position, moveVector.normalize());
      const hit = this.scene.pickWithRay(ray, (mesh) => mesh.checkCollisions);

      if (!hit.hit || hit.distance > moveVector.length()) {
        this.camera.position.copyFrom(newPos);
      }
    }

    this.isMoving = moving;
  }

  handleMouseLook() {
    if (this.mouseMovement.x !== 0 || this.mouseMovement.y !== 0) {
      this.camera.rotation.y += this.mouseMovement.x * this.mouseSensitivity;
      this.camera.rotation.x += this.mouseMovement.y * this.mouseSensitivity;

      this.camera.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.camera.rotation.x)
      );

      this.mouseMovement.x = 0;
      this.mouseMovement.y = 0;
    }
  }

  updateFlashlight(deltaTime) {
    if (this.flashlightEnabled) {
      this.batteryLevel = Math.max(
        0,
        this.batteryLevel - this.batteryDrainRate * deltaTime
      );

      let intensity = 2.0;
      if (this.batteryLevel < 20) {
        if (Math.random() < this.flickerChance * (21 - this.batteryLevel)) {
          intensity = Math.random() * 0.5;
        }
      }

      if (this.batteryLevel <= 0) {
        intensity = 0;
        this.flashlightEnabled = false;
      }

      this.flashlight.intensity = intensity;
    } else {
      this.flashlight.intensity = 0;
    }

    this.flashlight.position.copyFrom(this.camera.position);
    this.flashlight.direction.copyFrom(this.camera.getForwardRay().direction);
  }

  updateFootsteps() {
    if (this.isMoving) {
      const currentTime = Date.now();
      if (currentTime - this.lastFootstepTime > this.footstepInterval) {
        this.systems?.audioManager?.playFootstep?.();
        this.lastFootstepTime = currentTime;
      }
    }
  }

  updateUI() {
    const batteryElement = document.getElementById("battery");
    if (batteryElement) batteryElement.textContent = `${Math.floor(this.batteryLevel)}%`;
  }

  toggleFlashlight() {
    if (this.batteryLevel > 0) {
      this.flashlightEnabled = !this.flashlightEnabled;
      this.systems?.audioManager?.playSound?.("flashlight_click");
    }
  }

  getPosition() {
    return this.camera.position.clone();
  }

  getForwardDirection() {
    return this.camera.getForwardRay().direction.clone();
  }
}
