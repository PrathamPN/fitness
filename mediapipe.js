// // --- mediapipe.js (The "Engine") ---
// // This file's only job is to initialize MediaPipe and the camera.

// export function initializeMediaPipe(onResultsCallback, onErrorCallback) {
//     const videoElement = document.getElementById('input-video');

//     // --- Initialize MediaPipe ---
//     const pose = new Pose({
//         locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`
//     });

//     pose.setOptions({
//         modelComplexity: 1,
//         smoothLandmarks: true,
//         enableSegmentation: false,
//         smoothSegmentation: true,
//         minDetectionConfidence: 0.5,
//         minTrackingConfidence: 0.5
//     });
    
//     // Set the callback that will be run on every frame
//     pose.onResults(onResultsCallback);

//     // --- Initialize Camera ---
//     const camera = new Camera(videoElement, {
//         onFrame: async () => {
//             await pose.send({ image: videoElement });
//         },
//         width: 1280,
//         height: 720
//     });
    
//     camera.start().catch(err => {
//         console.error("Camera start failed:", err);
//         let message = "Camera error. Please refresh.";
//         if (err.name === "NotAllowedError") {
//             message = "Camera permission denied. Please allow camera access and refresh.";
//         }
//         onErrorCallback(message);
//     });
// }

/**
 * Initializes and starts the MediaPipe Pose and Camera.
 * @param {HTMLVideoElement} videoElement - The <video> element.
 * @param {Function} onResultsCallback - The function to call with pose results.
 * @returns {Promise} A promise that resolves when the camera starts, or rejects on error.
 */
export function initializeMediaPipe(videoElement, onResultsCallback) {
  
  // 1. Initialize Pose
  const pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    },
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  // Set the 'onResults' function as the callback
  pose.onResults(onResultsCallback);

  // 2. Initialize the Camera
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      // Send the video frame to MediaPipe
      await pose.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
  });
  
  // 3. Start the camera and return the promise
  return camera.start();
}