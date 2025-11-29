import './style.css'
import { GameScene } from './scene.js';
import { HandTracking } from './handTracking.js';

const scoreElement = document.getElementById('score');
const gameScene = new GameScene((score) => {
    scoreElement.innerText = `Score: ${score}`;
});

const handTracking = new HandTracking((landmarks) => {
    // landmarks is an array of 21 points
    // Point 9 is the middle finger knuckle (good center point)
    // Point 8 is index tip, 4 is thumb tip

    // Use the middle finger knuckle (9) as the cursor position for stability
    const cursorX = landmarks[9].x;
    const cursorY = landmarks[9].y;

    // Detect Fist (Grabbing)
    // Check if finger tips are close to the wrist (Landmark 0)
    const wrist = landmarks[0];
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]]; // Index, Middle, Ring, Pinky tips

    let totalDistance = 0;
    for (const tip of tips) {
        const dx = tip.x - wrist.x;
        const dy = tip.y - wrist.y;
        totalDistance += Math.sqrt(dx * dx + dy * dy);
    }
    const avgDistance = totalDistance / tips.length;

    // Threshold for fist detection - this might need tuning
    // 0.15 is a rough starting point for normalized coordinates
    const isGrabbing = avgDistance < 0.2;

    gameScene.updateHandInteraction(cursorX, cursorY, isGrabbing);
});

handTracking.start();

function animate() {
    requestAnimationFrame(animate);
    gameScene.render();
}

animate();
