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

    // Use the Palm Center as the cursor position
    // Approximated by the centroid of Wrist (0), Index MCP (5), and Pinky MCP (17)
    const palmX = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;
    const palmY = (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3;

    const cursorX = palmX;
    const cursorY = palmY;

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
