// // --- main.js (The "Brain") ---
// // This file initializes and manages the Vue app state.

// import { getSquatFeedback, getBicepCurlFeedback } from './poseLogic.js';
// import { initializeMediaPipe } from './mediapipe.js';

// const { createApp } = Vue;

// createApp({
//     // --- DATA ---
//     data() {
//         return {
//             repCounter: 0,
//             stage: 'UP',
//             feedback: '',
//             currentExercise: 'SQUAT',
//             loading: true,
//             loadingMessage: 'Loading AI Model...',
//             canvasCtx: null,
//             // --- NEW: Watchdog timer to clear canvas ---
//             lastResultTime: null,
//             watchdogTimer: null,
//         }
//     },
    
//     // --- METHODS ---
//     methods: {
//         // --- Main Pose Processing Function ---
//         onResults(results) {
//             // --- NEW: Update the watchdog timer ---
//             this.lastResultTime = Date.now(); // Mark that we got a result
            
//             if (!results.poseLandmarks) {
//                 // If we get a result but no landmarks, clear the canvas
//                 this.clearCanvas();
//                 this.feedback = "Please face the camera";
//                 this.stage = (this.currentExercise === 'SQUAT' ? 'UP' : 'DOWN');
//                 return;
//             }
            
//             this.loading = false; // Hide loading spinner

//             const canvasElement = document.getElementById('output-canvas');
//             if (!this.canvasCtx) {
//                 this.canvasCtx = canvasElement.getContext('2d');
//             }
            
//             canvasElement.width = document.getElementById('input-video').videoWidth;
//             canvasElement.height = document.getElementById('input-video').videoHeight;

//             this.canvasCtx.save();
//             this.canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
//             drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#FFFFFF', lineWidth: 2 });
//             drawLandmarks(this.canvasCtx, results.poseLandmarks, { color: '#0EA5E9', lineWidth: 2, radius: 3 });
//             this.canvasCtx.restore();

//             let findings;
//             if (this.currentExercise === 'SQUAT') {
//                 findings = getSquatFeedback(results.poseLandmarks, this.stage);
//             } else if (this.currentExercise === 'BICEP_CURL') {
//                 findings = getBicepCurlFeedback(results.poseLandmarks, this.stage);
//             }

//             if (findings) {
//                 this.stage = findings.newStage;
//                 this.feedback = findings.feedback;
//                 this.repCounter += findings.repIncrement;
//             }
//         },

//         // --- Button Click Handler ---
//         selectExercise(exercise) {
//             this.currentExercise = exercise;
//             this.repCounter = 0;
//             this.feedback = '';
//             this.stage = (exercise === 'SQUAT' ? 'UP' : 'DOWN');
//             this.clearCanvas(); // Clear canvas on exercise switch
//         },

//         // --- PWA Service Worker Registration ---
//         registerServiceWorker() {
//             if ('serviceWorker' in navigator) {
//                 window.addEventListener('load', () => {
//                     navigator.serviceWorker.register('./sw.js')
//                         .then(registration => {
//                             console.log('ServiceWorker registration successful');
//                         })
//                         .catch(error => {
//                             console.log('ServiceWorker registration failed: ', error);
//                         });
//                 });
//             }
//         },

//         // --- NEW: Function to clear the canvas ---
//         clearCanvas() {
//             if (this.canvasCtx) {
//                 const canvasElement = document.getElementById('output-canvas');
//                 this.canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
//             }
//         },

//         // --- NEW: Watchdog timer to check for stale results ---
//         startWatchdog() {
//             this.watchdogTimer = setInterval(() => {
//                 if (this.loading) return; // Don't run while loading

//                 const now = Date.now();
//                 const timeSinceLastResult = now - (this.lastResultTime || 0);

//                 // If no result for 1.5 seconds, clear screen and reset.
//                 if (timeSinceLastResult > 1500) {
//                     this.clearCanvas();
//                     this.feedback = "Please face the camera";
//                     this.stage = (this.currentExercise === 'SQUAT' ? 'UP' : 'DOWN');
//                 }
//             }, 1000); // Check every 1 second
//         }
//     },
    
//     // --- MOUNTED ---
//     mounted() {
//         initializeMediaPipe(this.onResults.bind(this), (errorMessage) => {
//             this.loadingMessage = errorMessage;
//         });
        
//         this.registerServiceWorker();
        
//         // --- NEW: Start the watchdog timer ---
//         this.startWatchdog(); 
//     }
// }).mount('#app');

// Import Vue functions from the global 'Vue' object (loaded from CDN)
const { createApp, ref, computed, onMounted } = Vue;

// Import our separated logic
import { initializeMediaPipe } from './mediapipe.js';
import { usePoseLogic } from './poseLogic.js';

createApp({
  setup() {
    // --- 1. STATE (Reactive) ---
    const isLoading = ref(true);
    const currentExercise = ref('SQUAT');

    // Template refs (to get <video> and <canvas> elements)
    const videoEl = ref(null);
    const canvasEl = ref(null);
    let canvasCtx = null;

    // --- 2. LOGIC (Imported) ---
    // Get all the reactive state and logic functions from our composable
    const { 
      repCounter, 
      stage, 
      feedbackMessage, 
      processSquat, 
      processBicepCurl, 
      setExercise 
    } = usePoseLogic();

    // --- 3. COMPUTED PROPERTIES (for UI) ---
    const instructionsText = computed(() => {
      return currentExercise.value === 'SQUAT'
        ? "Stand back so your full body is visible."
        : "Sit sideways with your left arm visible.";
    });

    const squatBtnClass = computed(() => {
      return currentExercise.value === 'SQUAT'
        ? 'bg-blue-500 text-white py-2 px-6 rounded-lg font-semibold text-lg opacity-100'
        : 'bg-gray-700 text-gray-400 py-2 px-6 rounded-lg font-semibold text-lg opacity-50 hover:opacity-100';
    });

    const curlBtnClass = computed(() => {
      return currentExercise.value === 'BICEP_CURL'
        ? 'bg-blue-500 text-white py-2 px-6 rounded-lg font-semibold text-lg opacity-100'
        : 'bg-gray-700 text-gray-400 py-2 px-6 rounded-lg font-semibold text-lg opacity-50 hover:opacity-100';
    });

    // --- 4. METHODS ---
    function selectExercise(exercise) {
      currentExercise.value = exercise;
      setExercise(exercise); // Reset logic state
    }

    // --- 5. MEDIAPIPE CALLBACK ---
    function onResults(results) {
      if (isLoading.value) {
        isLoading.value = false;
      }

      // Get canvas context
      if (!canvasCtx && canvasEl.value) {
        canvasCtx = canvasEl.value.getContext('2d');
      }
      if (!canvasCtx) return;

      // --- Call the logic (from poselogic.js) ---
      const landmarks = results.poseLandmarks;
      if (currentExercise.value === 'SQUAT') {
        processSquat(landmarks);
      } else if (currentExercise.value === 'BICEP_CURL') {
        processBicepCurl(landmarks);
      }

      // --- Drawing: Visualize the results (identical to original) ---
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height);

      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
      }
      canvasCtx.restore();
    }

    // --- 6. LIFECYCLE (onMounted) ---
    onMounted(() => {
      if (videoEl.value) {
        // Initialize MediaPipe and start the camera
        initializeMediaPipe(videoEl.value, onResults)
          .catch(error => {
            console.error("Failed to start camera:", error);
            if (error.name === "NotAllowedError") {
              feedbackMessage.value = "Camera permission denied. Please allow camera access.";
            } else {
              feedbackMessage.value = "Error starting camera.";
            }
            isLoading.value = false;
          });
      }
    });

    // --- 7. RETURN (Expose to Template) ---
    return {
      isLoading,
      currentExercise,
      videoEl,
      canvasEl,
      repCounter,
      stage,
      feedbackMessage,
      instructionsText,
      squatBtnClass,
      curlBtnClass,
      selectExercise
    };
  }
}).mount('#app');