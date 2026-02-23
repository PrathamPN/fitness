// --- exercises.js ---
// Exercise registry with metadata, instructions, and categories

export const CATEGORIES = {
    STRENGTH: { label: 'Strength', color: '#EF4444', icon: '💪' },
    CARDIO: { label: 'Cardio', color: '#F59E0B', icon: '🔥' },
    FLEXIBILITY: { label: 'Flexibility', color: '#10B981', icon: '🧘' },
    ANALYSIS: { label: 'Analysis', color: '#6366F1', icon: '📊' }
};

export const EXERCISES = [
    // --- STRENGTH ---
    {
        id: 'SQUAT',
        name: 'Squats',
        icon: '🦵',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Stand back so your full body is visible.',
        description: 'Track your squats with knee angle detection and form feedback.'
    },
    {
        id: 'BICEP_CURL',
        name: 'Bicep Curls',
        icon: '💪',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Sit sideways with your left arm visible.',
        description: 'Count bicep curls and check elbow positioning.'
    },
    {
        id: 'PUSH_UP',
        name: 'Push-ups',
        icon: '🫸',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Place camera at side angle to see your full body.',
        description: 'Detect push-up reps by tracking arm extension and body alignment.'
    },
    {
        id: 'SIT_UP',
        name: 'Sit-ups',
        icon: '🔄',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Lie down with your side facing the camera.',
        description: 'Count sit-ups by monitoring torso angle changes.'
    },
    {
        id: 'LUNGE',
        name: 'Lunges',
        icon: '🏋️',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Stand facing the camera with room to step forward.',
        description: 'Track lunge reps and check knee alignment.'
    },
    {
        id: 'SHOULDER_PRESS',
        name: 'Shoulder Press',
        icon: '🙌',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Stand facing the camera, arms visible.',
        description: 'Count overhead press reps and track arm symmetry.'
    },
    {
        id: 'ARM_RAISE',
        name: 'Arm Raises',
        icon: '🤚',
        category: 'STRENGTH',
        type: 'counter',
        tier: 1,
        instruction: 'Stand facing the camera with arms at your sides.',
        description: 'Count lateral arm raises to shoulder height.'
    },

    // --- CARDIO ---
    {
        id: 'JUMPING_JACK',
        name: 'Jumping Jacks',
        icon: '⭐',
        category: 'CARDIO',
        type: 'counter',
        tier: 1,
        instruction: 'Stand with full body visible, arms at sides.',
        description: 'Count jumping jacks by detecting arm and leg spread.'
    },
    {
        id: 'HIGH_KNEES',
        name: 'High Knees',
        icon: '🦶',
        category: 'CARDIO',
        type: 'counter',
        tier: 1,
        instruction: 'Stand facing the camera, full body visible.',
        description: 'Count high knee lifts alternating left and right.'
    },
    {
        id: 'MOUNTAIN_CLIMBER',
        name: 'Mountain Climbers',
        icon: '⛰️',
        category: 'CARDIO',
        type: 'counter',
        tier: 2,
        instruction: 'Position camera at side angle in plank position.',
        description: 'Count mountain climber reps by tracking alternating knee drives.'
    },
    {
        id: 'BURPEE',
        name: 'Burpees',
        icon: '🏃',
        category: 'CARDIO',
        type: 'counter',
        tier: 2,
        instruction: 'Stand with full body visible, enough room to drop down.',
        description: 'Track full burpee cycles: stand → squat → plank → stand.'
    },
    {
        id: 'STEP_COUNTER',
        name: 'Step Counter',
        icon: '👣',
        category: 'CARDIO',
        type: 'counter',
        tier: 3,
        instruction: 'Walk or jog in place, facing the camera.',
        description: 'Camera-based step counting via leg motion detection.'
    },

    // --- FLEXIBILITY ---
    {
        id: 'PLANK',
        name: 'Plank Hold',
        icon: '🧱',
        category: 'FLEXIBILITY',
        type: 'timer',
        tier: 2,
        instruction: 'Position camera at side angle in plank position.',
        description: 'Hold plank with real-time posture feedback and timer.'
    },
    {
        id: 'YOGA',
        name: 'Yoga Poses',
        icon: '🧘',
        category: 'FLEXIBILITY',
        type: 'pose',
        tier: 2,
        instruction: 'Stand with full body visible. Hold each pose steadily.',
        description: 'Detect and score Tree Pose, Warrior I/II, and more.'
    },
    {
        id: 'TAI_CHI',
        name: 'Tai Chi Flow',
        icon: '☯️',
        category: 'FLEXIBILITY',
        type: 'flow',
        tier: 3,
        instruction: 'Stand facing the camera with arms relaxed.',
        description: 'Analyze smooth movement flow and coordination.'
    },

    // --- ANALYSIS ---
    {
        id: 'KNEE_ANGLE',
        name: 'Knee Angle',
        icon: '📐',
        category: 'ANALYSIS',
        type: 'analysis',
        tier: 2,
        instruction: 'Stand with full body visible for real-time angle display.',
        description: 'Real-time knee angle measurement and display.'
    },
    {
        id: 'BALANCE',
        name: 'Balance Test',
        icon: '⚖️',
        category: 'ANALYSIS',
        type: 'analysis',
        tier: 3,
        instruction: 'Stand on one leg, facing the camera.',
        description: 'Analyze balance stability and body sway.'
    },
    {
        id: 'JUMP_HEIGHT',
        name: 'Jump Height',
        icon: '📏',
        category: 'ANALYSIS',
        type: 'measurement',
        tier: 3,
        instruction: 'Stand facing the camera. Jump when ready.',
        description: 'Measure vertical jump height from hip displacement.'
    },
    {
        id: 'RUNNING_POSTURE',
        name: 'Running Form',
        icon: '🏃‍♂️',
        category: 'ANALYSIS',
        type: 'analysis',
        tier: 3,
        instruction: 'Run in place or on a treadmill, side view preferred.',
        description: 'Analyze running posture, spine alignment, and stride.'
    }
];

export function getExerciseById(id) {
    return EXERCISES.find(e => e.id === id);
}

export function getExercisesByCategory(category) {
    return EXERCISES.filter(e => e.category === category);
}
