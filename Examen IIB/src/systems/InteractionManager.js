import { Ray, Vector3 } from '@babylonjs/core';

export class InteractionManager {
    constructor(scene, systems) {
        this.scene = scene;
        this.systems = systems;
        this.interactables = new Map();
        this.currentInteractable = null;
        this.interactionRange = 3.0;
        
        this.setupUI();
    }
    
    setupUI() {
        this.interactionUI = document.getElementById('interaction');
    }
    
    registerInteractable(mesh, type, data = {}) {
        const interactable = {
            mesh: mesh,
            type: type,
            data: data,
            isActive: true
        };
        
        this.interactables.set(mesh.id, interactable);
        
        // Add interaction highlight material if needed
        if (!mesh.material) {
            mesh.material = this.systems.assetManager.createPlaceholderMaterial();
        }
    }
    
    update(deltaTime) {
        this.checkForInteractables();
    }
    
    checkForInteractables() {
        const camera = this.scene.activeCamera;
        const ray = new Ray(camera.position, camera.getForwardRay().direction);
        
        let closestInteractable = null;
        let closestDistance = this.interactionRange;
        
        this.interactables.forEach((interactable) => {
            if (!interactable.isActive) return;
            
            const distance = Vector3.Distance(camera.position, interactable.mesh.position);
            if (distance <= this.interactionRange) {
                // Check if player is looking at the object
                const hit = this.scene.pickWithRay(ray);
                if (hit.hit && hit.pickedMesh === interactable.mesh && distance < closestDistance) {
                    closestInteractable = interactable;
                    closestDistance = distance;
                }
            }
        });
        
        this.updateInteractionUI(closestInteractable);
        this.currentInteractable = closestInteractable;
    }
    
    updateInteractionUI(interactable) {
        if (interactable) {
            this.interactionUI.style.display = 'block';
            this.interactionUI.textContent = this.getInteractionText(interactable);
        } else {
            this.interactionUI.style.display = 'none';
        }
    }
    
    getInteractionText(interactable) {
        switch (interactable.type) {
            case 'door':
                return interactable.data.locked ? 'Locked' : 'Press E to open';
            case 'note':
                return 'Press E to read';
            case 'key':
                return 'Press E to pick up';
            case 'switch':
                return 'Press E to flip switch';
            case 'generator':
                return 'Press E to start generator';
            default:
                return 'Press E to interact';
        }
    }
    
    tryInteract() {
        if (!this.currentInteractable) return false;
        
        const interactable = this.currentInteractable;
        
        switch (interactable.type) {
            case 'door':
                return this.interactWithDoor(interactable);
            case 'note':
                return this.interactWithNote(interactable);
            case 'key':
                return this.interactWithKey(interactable);
            case 'switch':
                return this.interactWithSwitch(interactable);
            case 'generator':
                return this.interactWithGenerator(interactable);
            default:
                return false;
        }
    }
    
    interactWithDoor(interactable) {
        if (interactable.data.locked) {
            if (this.systems.playerController.hasKey && this.systems.playerController.hasKey(interactable.data.keyId)) {
                interactable.data.locked = false;
                this.systems.audioManager.playSound('door_creak');
                this.systems.eventSystem.emit('door_unlocked', interactable.data);
                return true;
            } else {
                this.systems.audioManager.playSound('door_locked');
                return false;
            }
        } else {
            this.systems.audioManager.playSound('door_creak');
            this.systems.eventSystem.emit('door_opened', interactable.data);
            
            // Simple door opening animation
            if (!interactable.data.isOpen) {
                interactable.mesh.rotation.y += Math.PI / 2;
                interactable.data.isOpen = true;
            }
            return true;
        }
    }
    
    interactWithNote(interactable) {
        this.systems.audioManager.playSound('paper_rustle');
        this.systems.eventSystem.emit('note_read', {
            title: interactable.data.title || 'Document',
            content: interactable.data.content || 'The text is too faded to read...'
        });
        
        // Mark as read
        interactable.data.isRead = true;
        return true;
    }
    
    interactWithKey(interactable) {
        this.systems.audioManager.playSound('key_pickup');
        this.systems.eventSystem.emit('key_collected', interactable.data);
        
        // Remove from scene
        interactable.mesh.dispose();
        this.interactables.delete(interactable.mesh.id);
        
        // Add to inventory
        this.addToInventory('key', interactable.data);
        return true;
    }
    
    interactWithSwitch(interactable) {
        interactable.data.isOn = !interactable.data.isOn;
        this.systems.audioManager.playSound('switch_flip');
        this.systems.eventSystem.emit('switch_toggled', interactable.data);
        
        // Visual feedback
        if (interactable.data.isOn) {
            interactable.mesh.material.emissiveColor = new Color3(0, 1, 0);
        } else {
            interactable.mesh.material.emissiveColor = new Color3(1, 0, 0);
        }
        
        return true;
    }
    
    interactWithGenerator(interactable) {
        if (!interactable.data.isRunning) {
            interactable.data.isRunning = true;
            this.systems.audioManager.playSound('generator_start');
            this.systems.eventSystem.emit('generator_started', interactable.data);
            
            // Start generator sound loop
            this.systems.audioManager.playAmbient('generator_running');
            return true;
        }
        return false;
    }
    
    addToInventory(type, data) {
        // Simple inventory system
        if (!this.inventory) {
            this.inventory = [];
        }
        
        this.inventory.push({ type, data });
        
        // Update UI
        const itemsElement = document.getElementById('items');
        if (itemsElement) {
            itemsElement.textContent = this.inventory.length.toString();
        }
    }
    
    hasItem(type, id) {
        if (!this.inventory) return false;
        return this.inventory.some(item => item.type === type && item.data.id === id);
    }
    
    removeInteractable(meshId) {
        this.interactables.delete(meshId);
    }
    
    dispose() {
        this.interactables.clear();
    }
}