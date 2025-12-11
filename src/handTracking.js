import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';


export class HandTracking {
    constructor(onResultsCallback) {
        this.onResultsCallback = onResultsCallback;
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none'; // Hide the raw video
        document.body.appendChild(this.videoElement);

        // Canvas for the Video Feed (Background)
        this.videoCanvas = document.createElement('canvas');
        this.videoCanvas.style.position = 'absolute';
        this.videoCanvas.style.top = '0';
        this.videoCanvas.style.left = '0';
        this.videoCanvas.style.width = '100%';
        this.videoCanvas.style.height = '100%';
        this.videoCanvas.style.zIndex = '-1'; // Behind Three.js scene
        this.videoCanvas.style.objectFit = 'cover';
        document.body.appendChild(this.videoCanvas);
        this.videoCtx = this.videoCanvas.getContext('2d');

        // Canvas for the Skeleton/Hand (Foreground)
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.width = '100%';
        this.overlayCanvas.style.height = '100%';
        this.overlayCanvas.style.zIndex = '1'; // On top of Three.js scene
        this.overlayCanvas.style.pointerEvents = 'none'; // Let clicks pass through
        document.body.appendChild(this.overlayCanvas);
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onResults(results));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: this.videoElement });
            },
            width: 1280,
            height: 720
        });
    }

    start() {
        this.camera.start();
    }

    onResults(results) {
        // Update canvas dimensions to match window
        this.videoCanvas.width = window.innerWidth;
        this.videoCanvas.height = window.innerHeight;
        this.overlayCanvas.width = window.innerWidth;
        this.overlayCanvas.height = window.innerHeight;

        // Draw Video Feed on Background Canvas
        this.videoCtx.save();
        this.videoCtx.translate(this.videoCanvas.width, 0);
        this.videoCtx.scale(-1, 1);
        this.videoCtx.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
        this.videoCtx.drawImage(
            results.image, 0, 0, this.videoCanvas.width, this.videoCanvas.height);
        this.videoCtx.restore();

        // Draw Skeleton on Foreground Canvas
        this.overlayCtx.save();
        this.overlayCtx.translate(this.overlayCanvas.width, 0);
        this.overlayCtx.scale(-1, 1);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(this.overlayCtx, landmarks, HAND_CONNECTIONS,
                    { color: '#00FF00', lineWidth: 5 });
                drawLandmarks(this.overlayCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

                // Pass data to game
                if (this.onResultsCallback) {
                    // Create a copy of landmarks with inverted x for game logic
                    const invertedLandmarks = landmarks.map(point => ({
                        ...point,
                        x: 1 - point.x
                    }));
                    this.onResultsCallback(invertedLandmarks);
                }
            }
        }
        this.overlayCtx.restore();
    }
}
