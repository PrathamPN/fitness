// --- poseLogic.js ---
// All exercise processing logic as a Vue composable

const { ref } = Vue;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/** Calculates the angle between three 2D points. */
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

/** Euclidean distance between two 2D points */
function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Check if key landmarks are visible */
function landmarksVisible(landmarks, indices, minVisibility = 0.5) {
  for (const i of indices) {
    if (!landmarks[i] || landmarks[i].visibility < minVisibility) return false;
  }
  return true;
}

/** Get midpoint between two landmarks */
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// =====================================================
// MAIN COMPOSABLE
// =====================================================

export function usePoseLogic() {
  // --- SHARED STATE ---
  const repCounter = ref(0);
  const stage = ref('UP');
  const feedbackMessage = ref(null);
  const extraData = ref(null); // For analysis modes (angles, scores, etc.)

  // --- Internal state for multi-phase exercises ---
  let _lastKneePhase = null; // for high knees alternation
  let _burpeePhase = 'STANDING';
  let _plankStartTime = null;
  let _plankDuration = ref(0);
  let _jumpBaseline = null;
  let _jumpMaxHeight = ref(0);
  let _stepPhase = null;
  let _balanceHistory = [];
  let _yogaPose = ref('None');
  let _taiChiSmoothing = [];

  function showFeedback(message) { feedbackMessage.value = message; }
  function hideFeedback() { feedbackMessage.value = null; }

  // =====================================================
  // 1. SQUAT
  // =====================================================
  function processSquat(landmarks) {
    if (!landmarks) return;
    const required = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    if (!landmarksVisible(landmarks, required)) {
      showFeedback("Move back - full body not visible!");
      return;
    }

    const leftKneeAngle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
    const rightKneeAngle = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
    const kneeDistance = Math.abs(landmarks[25].x - landmarks[26].x);
    const ankleDistance = Math.abs(landmarks[27].x - landmarks[28].x);

    let safetyFeedback = [];
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    if (avgKneeAngle < 150 && kneeDistance < ankleDistance * 0.7) {
      safetyFeedback.push("PUSH KNEES OUT!");
    }

    const kneesDown = leftKneeAngle < 100 && rightKneeAngle < 100;
    const kneesUp = leftKneeAngle > 160 && rightKneeAngle > 160;

    if (kneesDown && stage.value === 'UP' && safetyFeedback.length === 0) {
      stage.value = 'DOWN';
    } else if (kneesUp && stage.value === 'DOWN') {
      stage.value = 'UP';
      repCounter.value++;
    }

    if (safetyFeedback.length > 0) {
      showFeedback(safetyFeedback[0]);
    } else if (stage.value === 'UP' && !kneesUp && avgKneeAngle > 100) {
      showFeedback("GO LOWER!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 2. BICEP CURL
  // =====================================================
  function processBicepCurl(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 13, 15, 23])) {
      showFeedback("Show left side clearly!");
      return;
    }

    const elbowAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    const elbowHipDistance = Math.abs(landmarks[13].x - landmarks[23].x);

    let safetyFeedback = [];
    if (elbowHipDistance > 0.1) safetyFeedback.push("KEEP ELBOW AT SIDE!");

    const curlUp = elbowAngle < 40;
    const curlDown = elbowAngle > 160;

    if (curlUp && stage.value === 'DOWN' && safetyFeedback.length === 0) {
      stage.value = 'UP';
    } else if (curlDown && stage.value === 'UP') {
      stage.value = 'DOWN';
      repCounter.value++;
    }

    if (safetyFeedback.length > 0) {
      showFeedback(safetyFeedback[0]);
    } else if (stage.value === 'DOWN' && !curlUp && elbowAngle < 160) {
      showFeedback("CURL HIGHER!");
    } else if (stage.value === 'UP' && !curlDown && elbowAngle > 40) {
      showFeedback("LOWER ALL THE WAY!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 3. PUSH-UP
  // =====================================================
  function processPushUp(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 13, 15, 23, 25, 27])) {
      showFeedback("Show your side profile clearly!");
      return;
    }

    const elbowAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    const bodyAngle = calculateAngle(landmarks[11], landmarks[23], landmarks[27]);

    let feedback = [];

    // Check if in plank-ish position (body relatively horizontal)
    if (bodyAngle < 140) {
      feedback.push("KEEP BODY STRAIGHT!");
    }

    const armDown = elbowAngle < 90;
    const armUp = elbowAngle > 150;

    if (armDown && stage.value === 'UP' && feedback.length === 0) {
      stage.value = 'DOWN';
    } else if (armUp && stage.value === 'DOWN') {
      stage.value = 'UP';
      repCounter.value++;
    }

    if (feedback.length > 0) {
      showFeedback(feedback[0]);
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 4. SIT-UP
  // =====================================================
  function processSitUp(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 23, 25])) {
      showFeedback("Lie on your side, facing camera!");
      return;
    }

    const hipAngle = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);

    const isDown = hipAngle > 140;
    const isUp = hipAngle < 70;

    if (isDown && stage.value === 'UP') {
      stage.value = 'DOWN';
    } else if (isUp && stage.value === 'DOWN') {
      stage.value = 'UP';
      repCounter.value++;
    }

    if (stage.value === 'DOWN' && !isUp && hipAngle > 70) {
      showFeedback("COME UP HIGHER!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 5. JUMPING JACK
  // =====================================================
  function processJumpingJack(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 12, 15, 16, 23, 24, 27, 28])) {
      showFeedback("Stand facing camera, full body visible!");
      return;
    }

    const leftArmAngle = calculateAngle(landmarks[23], landmarks[11], landmarks[15]);
    const rightArmAngle = calculateAngle(landmarks[24], landmarks[12], landmarks[16]);
    const legSpread = Math.abs(landmarks[27].x - landmarks[28].x);

    const armsUp = leftArmAngle > 140 && rightArmAngle > 140;
    const armsDown = leftArmAngle < 50 && rightArmAngle < 50;
    const legsApart = legSpread > 0.15;
    const legsTogether = legSpread < 0.08;

    const isOpen = armsUp && legsApart;
    const isClosed = armsDown && legsTogether;

    if (isOpen && stage.value === 'DOWN') {
      stage.value = 'UP';
    } else if (isClosed && stage.value === 'UP') {
      stage.value = 'DOWN';
      repCounter.value++;
    }

    hideFeedback();
  }

  // =====================================================
  // 6. LUNGE
  // =====================================================
  function processLunge(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [23, 24, 25, 26, 27, 28])) {
      showFeedback("Full body must be visible!");
      return;
    }

    const leftKneeAngle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
    const rightKneeAngle = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);

    // Detect which leg is forward (lower knee)
    const frontKneeAngle = Math.min(leftKneeAngle, rightKneeAngle);
    const backKneeAngle = Math.max(leftKneeAngle, rightKneeAngle);

    const isDown = frontKneeAngle < 110;
    const isUp = frontKneeAngle > 160 && backKneeAngle > 160;

    let feedback = [];
    if (isDown && frontKneeAngle < 70) {
      feedback.push("DON'T GO TOO LOW!");
    }

    if (isDown && stage.value === 'UP' && feedback.length === 0) {
      stage.value = 'DOWN';
    } else if (isUp && stage.value === 'DOWN') {
      stage.value = 'UP';
      repCounter.value++;
    }

    if (feedback.length > 0) {
      showFeedback(feedback[0]);
    } else if (stage.value === 'UP' && frontKneeAngle < 160 && frontKneeAngle > 110) {
      showFeedback("GO LOWER!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 7. SHOULDER PRESS
  // =====================================================
  function processShoulderPress(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 12, 13, 14, 15, 16])) {
      showFeedback("Upper body must be visible!");
      return;
    }

    const leftElbowAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    const rightElbowAngle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Check if wrists are above shoulders (pressed up)
    const leftWristAbove = landmarks[15].y < landmarks[11].y;
    const rightWristAbove = landmarks[16].y < landmarks[12].y;

    const isUp = avgElbowAngle > 160 && leftWristAbove && rightWristAbove;
    const isDown = avgElbowAngle < 90;

    if (isDown && stage.value === 'UP') {
      stage.value = 'DOWN';
    } else if (isUp && stage.value === 'DOWN') {
      stage.value = 'UP';
      repCounter.value++;
    }

    // Symmetry check
    const armDiff = Math.abs(leftElbowAngle - rightElbowAngle);
    if (armDiff > 30) {
      showFeedback("EVEN OUT YOUR ARMS!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 8. ARM RAISE (Lateral)
  // =====================================================
  function processArmRaise(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 12, 13, 14, 15, 16, 23, 24])) {
      showFeedback("Full upper body must be visible!");
      return;
    }

    const leftArmAngle = calculateAngle(landmarks[23], landmarks[11], landmarks[15]);
    const rightArmAngle = calculateAngle(landmarks[24], landmarks[12], landmarks[16]);
    const avgArmAngle = (leftArmAngle + rightArmAngle) / 2;

    const armsUp = avgArmAngle > 70;
    const armsDown = avgArmAngle < 25;

    if (armsUp && stage.value === 'DOWN') {
      stage.value = 'UP';
    } else if (armsDown && stage.value === 'UP') {
      stage.value = 'DOWN';
      repCounter.value++;
    }

    const armDiff = Math.abs(leftArmAngle - rightArmAngle);
    if (armDiff > 25) {
      showFeedback("RAISE BOTH ARMS EVENLY!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 9. HIGH KNEES
  // =====================================================
  function processHighKnees(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [23, 24, 25, 26])) {
      showFeedback("Full body must be visible!");
      return;
    }

    const hipY = (landmarks[23].y + landmarks[24].y) / 2;
    const leftKneeHigh = landmarks[25].y < hipY - 0.02;
    const rightKneeHigh = landmarks[26].y < hipY - 0.02;

    if (leftKneeHigh && _lastKneePhase !== 'LEFT') {
      _lastKneePhase = 'LEFT';
      repCounter.value++;
      stage.value = 'LEFT';
    } else if (rightKneeHigh && _lastKneePhase !== 'RIGHT') {
      _lastKneePhase = 'RIGHT';
      repCounter.value++;
      stage.value = 'RIGHT';
    } else if (!leftKneeHigh && !rightKneeHigh) {
      _lastKneePhase = null;
      stage.value = 'READY';
    }

    if (!leftKneeHigh && !rightKneeHigh) {
      showFeedback("KNEES HIGHER!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 10. MOUNTAIN CLIMBER
  // =====================================================
  function processMountainClimber(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 23, 25, 26, 27, 28])) {
      showFeedback("Full body must be visible, side view!");
      return;
    }

    // Detect plank-like position (shoulders higher than hips roughly level)
    const bodyAngle = calculateAngle(landmarks[11], landmarks[23], landmarks[27]);

    const leftKneeAngle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
    const rightKneeAngle = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);

    const leftKneeDriven = leftKneeAngle < 90;
    const rightKneeDriven = rightKneeAngle < 90;

    if (leftKneeDriven && _lastKneePhase !== 'LEFT') {
      _lastKneePhase = 'LEFT';
      repCounter.value++;
      stage.value = 'LEFT';
    } else if (rightKneeDriven && _lastKneePhase !== 'RIGHT') {
      _lastKneePhase = 'RIGHT';
      repCounter.value++;
      stage.value = 'RIGHT';
    } else if (!leftKneeDriven && !rightKneeDriven) {
      _lastKneePhase = null;
    }

    if (bodyAngle < 140) {
      showFeedback("KEEP BODY STRAIGHT!");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 11. BURPEE
  // =====================================================
  function processBurpee(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 23, 25, 27])) {
      showFeedback("Full body must be visible!");
      return;
    }

    const hipAngle = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
    const kneeAngle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);

    // Standing: hip and knee angles > 160
    const isStanding = hipAngle > 150 && kneeAngle > 150;
    // Squat: knees bent
    const isSquat = kneeAngle < 110 && hipAngle < 120;
    // Plank: body horizontal (hip angle close to 180, low position)
    const isPlank = hipAngle > 150 && landmarks[23].y > 0.6;

    if (_burpeePhase === 'STANDING' && isSquat) {
      _burpeePhase = 'SQUAT_DOWN';
      stage.value = 'SQUAT';
    } else if (_burpeePhase === 'SQUAT_DOWN' && isPlank) {
      _burpeePhase = 'PLANK';
      stage.value = 'PLANK';
    } else if (_burpeePhase === 'PLANK' && isSquat) {
      _burpeePhase = 'SQUAT_UP';
      stage.value = 'SQUAT';
    } else if (_burpeePhase === 'SQUAT_UP' && isStanding) {
      _burpeePhase = 'STANDING';
      stage.value = 'STAND';
      repCounter.value++;
    }

    hideFeedback();
  }

  // =====================================================
  // 12. STEP COUNTER
  // =====================================================
  function processStepCounter(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [27, 28])) {
      showFeedback("Feet must be visible!");
      return;
    }

    // Detect alternating foot lifts
    const leftAnkleY = landmarks[27].y;
    const rightAnkleY = landmarks[28].y;
    const diff = leftAnkleY - rightAnkleY;

    if (diff > 0.04 && _stepPhase !== 'RIGHT') {
      _stepPhase = 'RIGHT';
      repCounter.value++;
      stage.value = 'STEP';
    } else if (diff < -0.04 && _stepPhase !== 'LEFT') {
      _stepPhase = 'LEFT';
      repCounter.value++;
      stage.value = 'STEP';
    }

    hideFeedback();
  }

  // =====================================================
  // 13. PLANK HOLD
  // =====================================================
  function processPlank(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 13, 23, 25, 27])) {
      showFeedback("Side view: full body must be visible!");
      return;
    }

    const bodyAngle = calculateAngle(landmarks[11], landmarks[23], landmarks[27]);
    const hipSag = bodyAngle < 155;
    const hipPike = bodyAngle > 190 || (landmarks[23].y < landmarks[11].y && landmarks[23].y < landmarks[27].y);

    if (hipSag) {
      showFeedback("HIPS TOO LOW! Engage core.");
      _plankStartTime = null;
      _plankDuration.value = 0;
    } else if (hipPike) {
      showFeedback("HIPS TOO HIGH! Flatten your back.");
      _plankStartTime = null;
      _plankDuration.value = 0;
    } else {
      hideFeedback();
      if (!_plankStartTime) _plankStartTime = Date.now();
      _plankDuration.value = Math.floor((Date.now() - _plankStartTime) / 1000);
    }

    stage.value = _plankDuration.value + 's';
    repCounter.value = _plankDuration.value;
    extraData.value = { duration: _plankDuration.value, bodyAngle: Math.round(bodyAngle) };
  }

  // =====================================================
  // 14. YOGA POSE DETECTION
  // =====================================================
  function processYoga(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28])) {
      showFeedback("Full body must be visible!");
      return;
    }

    // Tree Pose: one foot near opposite knee, arms up
    const leftAnkleNearRightKnee = distance(landmarks[27], landmarks[26]) < 0.08;
    const rightAnkleNearLeftKnee = distance(landmarks[28], landmarks[25]) < 0.08;
    const armsAboveHead = landmarks[15].y < landmarks[11].y && landmarks[16].y < landmarks[12].y;

    // Warrior II: arms spread, legs wide, front knee bent
    const armSpread = Math.abs(landmarks[15].x - landmarks[16].x) > 0.4;
    const legSpread = Math.abs(landmarks[27].x - landmarks[28].x) > 0.2;
    const frontKneeBent = calculateAngle(landmarks[23], landmarks[25], landmarks[27]) < 120 ||
      calculateAngle(landmarks[24], landmarks[26], landmarks[28]) < 120;

    // T-Pose / Warrior I: standing with arms out
    const leftArmAngle = calculateAngle(landmarks[23], landmarks[11], landmarks[15]);
    const rightArmAngle = calculateAngle(landmarks[24], landmarks[12], landmarks[16]);
    const armsLevel = leftArmAngle > 70 && leftArmAngle < 120 && rightArmAngle > 70 && rightArmAngle < 120;

    if ((leftAnkleNearRightKnee || rightAnkleNearLeftKnee) && armsAboveHead) {
      _yogaPose.value = 'Tree Pose 🌳';
      stage.value = 'TREE';
      showFeedback("Great Tree Pose! Hold it!");
    } else if (armSpread && legSpread && frontKneeBent) {
      _yogaPose.value = 'Warrior II ⚔️';
      stage.value = 'WARRIOR';
      showFeedback("Strong Warrior II!");
    } else if (armsLevel && !legSpread) {
      _yogaPose.value = 'T-Pose ✈️';
      stage.value = 'T-POSE';
      hideFeedback();
    } else {
      _yogaPose.value = 'No Pose';
      stage.value = 'READY';
      showFeedback("Try a yoga pose!");
    }

    extraData.value = { pose: _yogaPose.value };
  }

  // =====================================================
  // 15. KNEE ANGLE ANALYSIS
  // =====================================================
  function processKneeAngle(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [23, 24, 25, 26, 27, 28])) {
      showFeedback("Legs must be fully visible!");
      return;
    }

    const leftKneeAngle = Math.round(calculateAngle(landmarks[23], landmarks[25], landmarks[27]));
    const rightKneeAngle = Math.round(calculateAngle(landmarks[24], landmarks[26], landmarks[28]));

    stage.value = `L:${leftKneeAngle}°`;
    repCounter.value = rightKneeAngle;

    extraData.value = {
      leftKnee: leftKneeAngle,
      rightKnee: rightKneeAngle,
      label: `Left: ${leftKneeAngle}° | Right: ${rightKneeAngle}°`
    };

    if (leftKneeAngle < 90 || rightKneeAngle < 90) {
      showFeedback("Deep bend detected");
    } else if (leftKneeAngle > 170 && rightKneeAngle > 170) {
      showFeedback("Legs straight");
    } else {
      hideFeedback();
    }
  }

  // =====================================================
  // 16. BALANCE STABILITY
  // =====================================================
  function processBalance(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 12, 23, 24, 27, 28])) {
      showFeedback("Full body must be visible!");
      return;
    }

    // Center of gravity approximation (mid-hip)
    const cog = midpoint(landmarks[23], landmarks[24]);

    _balanceHistory.push({ x: cog.x, y: cog.y, t: Date.now() });
    if (_balanceHistory.length > 60) _balanceHistory.shift(); // ~2 seconds of data

    // Calculate sway (standard deviation of x positions)
    const xValues = _balanceHistory.map(p => p.x);
    const mean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const variance = xValues.reduce((a, b) => a + (b - mean) ** 2, 0) / xValues.length;
    const sway = Math.sqrt(variance);

    const score = Math.max(0, Math.round(100 - sway * 2000));

    repCounter.value = score;
    stage.value = score > 80 ? 'STABLE' : score > 50 ? 'FAIR' : 'UNSTABLE';

    extraData.value = { score, sway: (sway * 100).toFixed(2) };

    if (score > 80) {
      showFeedback("Excellent balance!");
    } else if (score > 50) {
      showFeedback("Try to hold still!");
    } else {
      showFeedback("Too much sway!");
    }
  }

  // =====================================================
  // 17. JUMP HEIGHT
  // =====================================================
  function processJumpHeight(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [23, 24, 27, 28])) {
      showFeedback("Full body must be visible!");
      return;
    }

    const hipY = (landmarks[23].y + landmarks[24].y) / 2;
    const ankleY = (landmarks[27].y + landmarks[28].y) / 2;

    // Set baseline on ground (when standing still)
    if (!_jumpBaseline) {
      _jumpBaseline = hipY;
      showFeedback("Stand still to calibrate, then JUMP!");
      return;
    }

    // Detect jump (hip rises above baseline)
    const jumpDelta = _jumpBaseline - hipY;
    const jumpCm = Math.round(jumpDelta * 300); // Rough cm estimate

    if (jumpCm > 5) {
      if (jumpCm > _jumpMaxHeight.value) {
        _jumpMaxHeight.value = jumpCm;
        repCounter.value = jumpCm;
      }
      stage.value = 'AIR';
      showFeedback(`${jumpCm} cm!`);
    } else {
      stage.value = 'GROUND';
      if (_jumpMaxHeight.value > 0) {
        showFeedback(`Best: ${_jumpMaxHeight.value} cm. Jump again!`);
      } else {
        hideFeedback();
      }
    }

    extraData.value = { currentHeight: jumpCm, maxHeight: _jumpMaxHeight.value };
  }

  // =====================================================
  // 18. RUNNING POSTURE
  // =====================================================
  function processRunningPosture(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [0, 11, 12, 23, 24, 25, 26])) {
      showFeedback("Full body must be visible!");
      return;
    }

    // Spine angle (ear-shoulder-hip alignment)
    const spineAngle = calculateAngle(landmarks[0], landmarks[11], landmarks[23]);

    // Forward lean check
    const shoulderHipAngle = calculateAngle(
      { x: landmarks[11].x, y: 0 }, // vertical reference
      landmarks[11],
      landmarks[23]
    );

    let postureFeedback = [];
    let score = 100;

    if (spineAngle < 150) {
      postureFeedback.push("HEAD FORWARD - look ahead!");
      score -= 20;
    }

    // Check arm swing symmetry
    const leftElbowAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    const rightElbowAngle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
    if (Math.abs(leftElbowAngle - rightElbowAngle) > 40) {
      postureFeedback.push("ARM SWING UNEVEN!");
      score -= 15;
    }

    // Check knee lift
    const leftKneeY = landmarks[25].y;
    const rightKneeY = landmarks[26].y;
    const kneeLifting = Math.abs(leftKneeY - rightKneeY) > 0.03;

    if (!kneeLifting) {
      postureFeedback.push("LIFT KNEES HIGHER!");
      score -= 10;
    }

    score = Math.max(0, score);
    repCounter.value = score;
    stage.value = score > 80 ? 'GOOD' : score > 50 ? 'FAIR' : 'POOR';

    if (postureFeedback.length > 0) {
      showFeedback(postureFeedback[0]);
    } else {
      showFeedback("Great running form!");
    }

    extraData.value = { score, spineAngle: Math.round(spineAngle) };
  }

  // =====================================================
  // 19. TAI CHI FLOW
  // =====================================================
  function processTaiChi(landmarks) {
    if (!landmarks) return;
    if (!landmarksVisible(landmarks, [11, 12, 15, 16, 23, 24])) {
      showFeedback("Full body must be visible!");
      return;
    }

    // Track wrist positions for smoothness analysis
    const wristPos = {
      left: { x: landmarks[15].x, y: landmarks[15].y },
      right: { x: landmarks[16].x, y: landmarks[16].y },
      t: Date.now()
    };
    _taiChiSmoothing.push(wristPos);
    if (_taiChiSmoothing.length > 30) _taiChiSmoothing.shift();

    if (_taiChiSmoothing.length < 5) {
      showFeedback("Begin moving slowly...");
      return;
    }

    // Calculate movement smoothness (lower jerk = smoother)
    let totalJerk = 0;
    for (let i = 2; i < _taiChiSmoothing.length; i++) {
      const v1 = {
        x: _taiChiSmoothing[i - 1].left.x - _taiChiSmoothing[i - 2].left.x,
        y: _taiChiSmoothing[i - 1].left.y - _taiChiSmoothing[i - 2].left.y
      };
      const v2 = {
        x: _taiChiSmoothing[i].left.x - _taiChiSmoothing[i - 1].left.x,
        y: _taiChiSmoothing[i].left.y - _taiChiSmoothing[i - 1].left.y
      };
      const jerk = Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
      totalJerk += jerk;
    }

    const avgJerk = totalJerk / _taiChiSmoothing.length;
    const smoothness = Math.max(0, Math.round(100 - avgJerk * 5000));

    repCounter.value = smoothness;
    stage.value = smoothness > 80 ? 'FLOW' : smoothness > 50 ? 'GOOD' : 'CHOPPY';

    if (smoothness > 80) {
      showFeedback("Beautiful flow! 🌊");
    } else if (smoothness > 50) {
      showFeedback("Slow down, breathe...");
    } else {
      showFeedback("Move more smoothly");
    }

    extraData.value = { smoothness };
  }

  // =====================================================
  // EXERCISE DISPATCHER
  // =====================================================
  function processExercise(exerciseId, landmarks) {
    const processors = {
      'SQUAT': processSquat,
      'BICEP_CURL': processBicepCurl,
      'PUSH_UP': processPushUp,
      'SIT_UP': processSitUp,
      'JUMPING_JACK': processJumpingJack,
      'LUNGE': processLunge,
      'SHOULDER_PRESS': processShoulderPress,
      'ARM_RAISE': processArmRaise,
      'HIGH_KNEES': processHighKnees,
      'MOUNTAIN_CLIMBER': processMountainClimber,
      'BURPEE': processBurpee,
      'STEP_COUNTER': processStepCounter,
      'PLANK': processPlank,
      'YOGA': processYoga,
      'KNEE_ANGLE': processKneeAngle,
      'BALANCE': processBalance,
      'JUMP_HEIGHT': processJumpHeight,
      'RUNNING_POSTURE': processRunningPosture,
      'TAI_CHI': processTaiChi,
    };

    const processor = processors[exerciseId];
    if (processor) {
      processor(landmarks);
    }
  }

  // =====================================================
  // STATE RESET
  // =====================================================
  function setExercise(exercise) {
    // Reset all state
    repCounter.value = 0;
    feedbackMessage.value = null;
    extraData.value = null;
    _lastKneePhase = null;
    _burpeePhase = 'STANDING';
    _plankStartTime = null;
    _plankDuration.value = 0;
    _jumpBaseline = null;
    _jumpMaxHeight.value = 0;
    _stepPhase = null;
    _balanceHistory = [];
    _yogaPose.value = 'None';
    _taiChiSmoothing = [];

    // Set initial stage based on exercise type
    const downFirst = ['BICEP_CURL', 'JUMPING_JACK', 'ARM_RAISE', 'SHOULDER_PRESS'];
    stage.value = downFirst.includes(exercise) ? 'DOWN' : 'UP';

    if (exercise === 'PLANK') stage.value = '0s';
    if (exercise === 'YOGA') stage.value = 'READY';
    if (exercise === 'BALANCE') stage.value = 'READY';
    if (exercise === 'JUMP_HEIGHT') stage.value = 'GROUND';
    if (exercise === 'RUNNING_POSTURE') stage.value = 'READY';
    if (exercise === 'TAI_CHI') stage.value = 'READY';
    if (exercise === 'KNEE_ANGLE') stage.value = '0°';
    if (exercise === 'STEP_COUNTER') stage.value = 'READY';
  }

  return {
    repCounter,
    stage,
    feedbackMessage,
    extraData,
    processExercise,
    setExercise
  };
}