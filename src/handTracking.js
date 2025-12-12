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

        const videoWidth = results.image.width;
        const videoHeight = results.image.height;
        const canvasWidth = this.videoCanvas.width;
        const canvasHeight = this.videoCanvas.height;

        // Calculate "object-fit: cover" dimensions
        const videoAspectRatio = videoWidth / videoHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (canvasAspectRatio > videoAspectRatio) {
            // Canvas is wider than video -> Fit to width
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / videoAspectRatio;
            offsetX = 0;
            offsetY = (canvasHeight - drawHeight) / 2;
        } else {
            // Canvas is taller than video -> Fit to height
            drawHeight = canvasHeight;
            drawWidth = drawHeight * videoAspectRatio;
            offsetX = (canvasWidth - drawWidth) / 2;
            offsetY = 0;
        }

        // Draw Video Feed
        this.videoCtx.save();
        this.videoCtx.translate(this.videoCanvas.width, 0);
        this.videoCtx.scale(-1, 1);
        this.videoCtx.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
        this.videoCtx.drawImage(
            results.image, offsetX, offsetY, drawWidth, drawHeight);
        this.videoCtx.restore();

        // Draw Skeleton
        this.overlayCtx.save();
        // Clear first (using current transform or identity)
        this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Re-apply transforms for drawing
        this.overlayCtx.translate(this.overlayCanvas.width, 0);
        this.overlayCtx.scale(-1, 1);
        this.overlayCtx.translate(offsetX, offsetY);
        this.overlayCtx.scale(drawWidth / this.overlayCanvas.width, drawHeight / this.overlayCanvas.height);

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(this.overlayCtx, landmarks, HAND_CONNECTIONS,
                    { color: '#00FF00', lineWidth: 5 });
                drawLandmarks(this.overlayCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

                // Pass data to game
                if (this.onResultsCallback) {
                    // Create a copy of landmarks adjusted to screen coordinates
                    // Original (0..1) is relative to VIDEO.
                    // We need (0..1) relative to SCREEN (Canvas).
                    // screen_x = (video_x * drawWidth + offsetX) / canvasWidth

                    const adjustedLandmarks = landmarks.map(point => {
                        // 1. Map to Screen Pixels (Unmirrored)
                        const screenPixelX = point.x * drawWidth + offsetX;
                        const screenPixelY = point.y * drawHeight + offsetY;

                        // 2. Normalize to Screen (0..1)
                        const screenNormX = screenPixelX / canvasWidth;
                        const screenNormY = screenPixelY / canvasHeight;

                        // 3. Invert X for Game Logic (Mirroring)
                        return {
                            ...point,
                            x: 1 - screenNormX,
                            y: screenNormY
                        };
                    });

                    this.onResultsCallback(adjustedLandmarks);
                }
            }
        }
        this.overlayCtx.restore();
    }
}
