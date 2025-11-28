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

    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const middleKnuckle = landmarks[9];

    // Update claw position based on hand position (using middle knuckle for stability)
    // MediaPipe coordinates are normalized [0, 1]
    // gameScene.updateClawPosition(middleKnuckle.x, middleKnuckle.y);

    // Detect Pinch
    // Simple distance check in 2D (or 3D if z is reliable)
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isPinching = distance < 0.05;

    gameScene.updateHandInteraction(middleKnuckle.x, middleKnuckle.y, isPinching);
});

handTracking.start();

function animate() {
    requestAnimationFrame(animate);
    gameScene.render();
}

animate();
