import * as THREE from 'three';

export class GameScene {
  constructor(onScoreUpdate) {
    this.onScoreUpdate = onScoreUpdate;
    this.score = 0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // Alpha true for video background
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    this.lights = [];
    this.prizes = [];
    this.heldObject = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Floor plane for intersection
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    // Camera Position
    this.updateCameraPosition();
    this.camera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);

    // Floor (Glass bottom of the machine)
    const floorGeo = new THREE.BoxGeometry(10, 0.2, 10);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -2;
    this.scene.add(floor);

    // Claw Machine Frame (Simple lines or boxes)
    this.createMachineFrame();

    // Chute
    this.createChute();

    // Prizes
    this.createPrizes();

    // Resize handler
    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  createMachineFrame() {
    // Just some pillars for context
    const pillarGeo = new THREE.BoxGeometry(0.5, 10, 0.5);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    const positions = [
      [-5, 3, -5],
      [5, 3, -5],
      [-5, 3, 5],
      [5, 3, 5]
    ];

    positions.forEach(pos => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(...pos);
      this.scene.add(pillar);
    });
  }

  createChute() {
    // Create a chute area (e.g., bottom right corner)
    // Visual representation: A red box with open top
    const chuteGeo = new THREE.BoxGeometry(2, 1, 2);
    const chuteMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    this.chute = new THREE.Mesh(chuteGeo, chuteMat);
    this.chute.position.set(4, -1.5, 4); // Corner position
    this.scene.add(this.chute);

    // Define chute bounds for logic
    this.chuteBounds = {
      minX: 3, maxX: 5,
      minZ: 3, maxZ: 5
    };
  }

  createPrizes() {
    const prizeGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];

    for (let i = 0; i < 20; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshStandardMaterial({ color: color });
      const prize = new THREE.Mesh(prizeGeo, mat);
      prize.userData = { velocity: new THREE.Vector3(0, 0, 0) };

      // Random position on the floor
      prize.position.set(
        (Math.random() - 0.5) * 8,
        -1.5, // Just above floor
        (Math.random() - 0.5) * 8
      );

      this.scene.add(prize);
      this.prizes.push(prize);
    }
  }

  updateHandInteraction(normalizedX, normalizedY, isPinching) {
    // Convert normalized hand coordinates (0..1) to NDC (-1..1)
    // Note: MediaPipe x increases left-to-right (0 to 1)
    // MediaPipe y increases top-to-bottom (0 to 1)
    // Three.js NDC x increases left-to-right (-1 to 1)
    // Three.js NDC y increases bottom-to-top (-1 to 1)

    // We need to invert X because the camera feed is usually mirrored for the user
    // But let's check how it feels. Usually:
    // Hand left (small x) -> Screen left (small x) -> NDC left (small x)
    // But if we want it to act like a mirror:
    // Hand move right -> Cursor move right.

    // Let's assume standard mapping first:
    // x: 0..1 -> -1..1
    // y: 0..1 -> 1..-1 (inverted)

    this.mouse.x = (normalizedX * 2) - 1;
    this.mouse.y = -(normalizedY * 2) + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Find intersection with the floor plane (y = -1.5 approx, or just 0 for logic)
    // Our prizes are at y = -1.5. Let's intersect with a plane at that height.
    const targetPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.5); // Plane at y = -1.5
    const targetPoint = new THREE.Vector3();

    this.raycaster.ray.intersectPlane(targetPlane, targetPoint);

    if (!targetPoint) return;

    // Visual marker for the "hand" (optional, but good for debugging)
    // We could move a light or a small sphere here.

    if (this.heldObject) {
      if (isPinching) {
        // Continue holding
        // Move object to a lifted position above the target point
        this.heldObject.position.x = targetPoint.x;
        this.heldObject.position.z = targetPoint.z;
        this.heldObject.position.y = 0; // Lifted height
      } else {
        // Release
        const droppedObject = this.heldObject;
        this.heldObject = null;

        // Check if dropped in chute
        if (this.checkChuteDrop(targetPoint)) {
          // Score!
          this.incrementScore();
          // Remove the prize
          this.removePrize(droppedObject);
        }
      }
    } else {
      if (isPinching) {
        // Try to grab using Raycasting for precision
        const intersects = this.raycaster.intersectObjects(this.prizes);
        if (intersects.length > 0) {
          this.heldObject = intersects[0].object;
        }
      }
    }

    // Physics is now handled in the update loop
  }

  checkChuteDrop(dropPoint) {
    // Check if the drop point is within the chute bounds
    return (
      dropPoint.x >= this.chuteBounds.minX &&
      dropPoint.x <= this.chuteBounds.maxX &&
      dropPoint.z >= this.chuteBounds.minZ &&
      dropPoint.z <= this.chuteBounds.maxZ
    );
  }

  incrementScore() {
    this.score += 1;
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score);
    }
  }

  removePrize(prize) {
    // Remove from scene
    this.scene.remove(prize);

    // Remove from array
    const index = this.prizes.indexOf(prize);
    if (index > -1) {
      this.prizes.splice(index, 1);
    }

    // Cleanup resources
    prize.geometry.dispose();
    prize.material.dispose();
  }

  onWindowResize() {
    this.updateCameraPosition();
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateCameraPosition() {
    const aspect = window.innerWidth / window.innerHeight;
    // Base distance is 10 for landscape (aspect > 1).
    // For portrait, we increase distance to keep the floor visible.
    // Floor width is ~10. Visible width needed ~12-14.
    // Distance = Width / (Aspect * 2 * tan(FOV/2))
    // Approximate scaling:
    this.camera.position.z = Math.max(10, 8.0 / aspect);
    this.camera.position.y = 5; // Keep height constant
  }

  update() {
    const dt = this.clock.getDelta();
    const gravity = 40.0; // Gravity strength

    for (const prize of this.prizes) {
      if (prize !== this.heldObject) {
        // Apply gravity
        prize.userData.velocity.y -= gravity * dt;

        // Apply velocity
        prize.position.x += prize.userData.velocity.x * dt;
        prize.position.y += prize.userData.velocity.y * dt;
        prize.position.z += prize.userData.velocity.z * dt;

        // Floor collision
        if (prize.position.y <= -1.5) {
          prize.position.y = -1.5;
          // Bounce / Friction
          prize.userData.velocity.y = -prize.userData.velocity.y * 0.3; // Small bounce
          if (Math.abs(prize.userData.velocity.y) < 0.1) prize.userData.velocity.y = 0;

          // Ground friction
          prize.userData.velocity.x *= 0.95;
          prize.userData.velocity.z *= 0.95;
        }

        // Boundaries (Clamp to floor area)
        const floorSize = 5;
        if (prize.position.x < -floorSize) {
          prize.position.x = -floorSize;
          prize.userData.velocity.x *= -0.5;
        }
        if (prize.position.x > floorSize) {
          prize.position.x = floorSize;
          prize.userData.velocity.x *= -0.5;
        }
        if (prize.position.z < -floorSize) {
          prize.position.z = -floorSize;
          prize.userData.velocity.z *= -0.5;
        }
        if (prize.position.z > floorSize) {
          prize.position.z = floorSize;
          prize.userData.velocity.z *= -0.5;
        }
      } else {
        // Reset velocity while held so it doesn't accumulate gravity
        prize.userData.velocity.set(0, 0, 0);
      }
    }
  }

  render() {
    this.update();
    this.renderer.render(this.scene, this.camera);
  }
}
