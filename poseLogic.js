// Import 'ref' from the global 'Vue' object
const { ref } = Vue;

/**
 * Calculates the angle between three 2D points.
 * (This function is identical to the original)
 */
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

/**
 * A Vue Composable that encapsulates all pose logic and state.
 */
export function usePoseLogic() {
  
  // --- STATE ---
  // These are now reactive Vue 'refs'
  const repCounter = ref(0);
  const stage = ref('UP');
  const feedbackMessage = ref(null);

  // --- UI HELPER FUNCTIONS ---
  // These now update the reactive 'feedbackMessage' ref
  function showFeedback(message) {
    feedbackMessage.value = message;
  }

  function hideFeedback() {
    feedbackMessage.value = null;
  }
  
  // --- EXERCISE LOGIC (SQUAT) ---
  function processSquat(landmarks) {
    if (!landmarks) {
      return;
    }

    const leftShoulder = landmarks[11];
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightShoulder = landmarks[12];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const leftHeel = landmarks[29];
    const rightHeel = landmarks[30];
    const leftFootIndex = landmarks[31];
    const rightFootIndex = landmarks[32];

    let safetyFeedback = [];
    let performanceFeedback = [];

    if (!leftShoulder || !leftHip || !leftKnee || !leftAnkle ||
        !rightShoulder || !rightHip || !rightKnee || !rightAnkle ||
        !leftHeel || !rightHeel || !leftFootIndex || !rightFootIndex ||
        leftShoulder.visibility < 0.5 || leftHip.visibility < 0.5 || leftKnee.visibility < 0.5 || leftAnkle.visibility < 0.5 ||
        rightShoulder.visibility < 0.5 || rightHip.visibility < 0.5 || rightKnee.visibility < 0.5 || rightAnkle.visibility < 0.5 ||
        leftHeel.visibility < 0.5 || rightHeel.visibility < 0.5 || leftFootIndex.visibility < 0.5 || rightFootIndex.visibility < 0.5) {
      
      safetyFeedback.push("Move back - full body not visible!");
      showFeedback(safetyFeedback[0]);
      return;
    }

    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);

    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;

    const kneesDown = leftKneeAngle < 100 && rightKneeAngle < 100;
    const kneesUp = leftKneeAngle > 160 && rightKneeAngle > 160;

    const kneeDistance = Math.abs(leftKnee.x - rightKnee.x);
    const ankleDistance = Math.abs(leftAnkle.x - rightAnkle.x);
    // --- These are still calculated but no longer used for safety feedback ---
    const leftHeelLift = leftHeel.y < (leftFootIndex.y - 0.01);
    const rightHeelLift = rightHeel.y < (rightFootIndex.y - 0.01);

    // --- 3. Posture Feedback Logic ---

    // Priority 1: Back Posture (Safety)
    // --- REMOVED 'CHEST UP' CHECK ---
    // if (avgHipAngle < 80) {
    //   safetyFeedback.push("KEEP CHEST UP!");
    // }
    // --- END OF REMOVED BLOCK ---

    // Priority 2: Knee Valgus (Caving In) (Safety)
    if (avgKneeAngle < 150) {
      if (kneeDistance < ankleDistance * 0.7) {
        safetyFeedback.push("PUSH KNEES OUT!");
      }
    }

    // Priority 3: Heels Lifting (Form/Balance)
    // --- REMOVED 'HEELS DOWN' CHECK ---
    // if (avgKneeAngle < 150) {
    //   if (leftHeelLift || rightHeelLift) {
    //     safetyFeedback.push("KEEP HEELS DOWN!");
    //   }
    // }
    // --- END OF REMOVED BLOCK ---


    // --- 4. Rep Counting Logic (State Machine) ---
    if (kneesDown && stage.value === 'UP') {
      if (safetyFeedback.length > 0) {
        // Do nothing, user has bad form
      } else {
        stage.value = 'DOWN';
      }
    }
    else if (kneesUp && stage.value === 'DOWN') {
      stage.value = 'UP';
      repCounter.value++;
    }

    // --- 5. Depth Feedback ---
    if (safetyFeedback.length === 0 && stage.value === 'UP' && !kneesUp && avgKneeAngle > 100) {
      performanceFeedback.push("GO LOWER!");
    }

    // --- 6. Update UI and Feedback ---
    let finalMessage = null;
    if (safetyFeedback.length > 0) {
      finalMessage = safetyFeedback[0];
    } else if (performanceFeedback.length > 0) {
      finalMessage = performanceFeedback[0];
    }

    if (finalMessage) {
      showFeedback(finalMessage);
    } else {
      hideFeedback();
    }
  }

  // --- EXERCISE LOGIC (BICEP CURL) ---
  // (This function remains unchanged)
  function processBicepCurl(landmarks) {
    if (!landmarks) {
      return;
    }

    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const leftHip = landmarks[23];

    let safetyFeedback = [];
    let performanceFeedback = [];

    if (!leftShoulder || !leftElbow || !leftWrist || !leftHip ||
        leftShoulder.visibility < 0.5 || leftElbow.visibility < 0.5 || 
        leftWrist.visibility < 0.5 || leftHip.visibility < 0.5) {
      
      safetyFeedback.push("Show left side clearly!");
      showFeedback(safetyFeedback[0]);
      return;
    }

    const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);

    const elbowHipDistance = Math.abs(leftElbow.x - leftHip.x);
    if (elbowHipDistance > 0.1) {
      safetyFeedback.push("KEEP ELBOW AT SIDE!");
    }

    const curlUp = elbowAngle < 40;
    const curlDown = elbowAngle > 160;

    if (curlUp && stage.value === 'DOWN') {
      if (safetyFeedback.length > 0) {
        // Bad form
      } else {
        stage.value = 'UP';
      }
    } else if (curlDown && stage.value === 'UP') {
      stage.value = 'DOWN';
      repCounter.value++;
    }

    if (safetyFeedback.length === 0) {
      if (stage.value === 'DOWN' && !curlUp && elbowAngle < 160) {
        performanceFeedback.push("CURL HIGHER!");
      } else if (stage.value === 'UP' && !curlDown && elbowAngle > 40) {
        performanceFeedback.push("LOWER ALL THE WAY!");
      }
    }

    let finalMessage = null;
    if (safetyFeedback.length > 0) {
      finalMessage = safetyFeedback[0];
    } else if (performanceFeedback.length > 0) {
      finalMessage = performanceFeedback[0];
    }

    if (finalMessage) {
      showFeedback(finalMessage);
    } else {
      hideFeedback();
    }
  }

  // --- STATE RESET FUNCTION ---
  function setExercise(exercise) {
    if (exercise === 'SQUAT') {
      stage.value = 'UP';
    } else if (exercise === 'BICEP_CURL') {
      stage.value = 'DOWN';
    }
    repCounter.value = 0;
    feedbackMessage.value = null;
  }

  // --- RETURN ---
  // Expose the state and functions to main.js
  return {
    repCounter,
    stage,
    feedbackMessage,
    processSquat,
    processBicepCurl,
    setExercise
  };
}