// --- history.js ---
// localStorage-based workout history, milestones, and leaderboard

const { ref } = Vue;

const HISTORY_KEY = 'ai_fitness_history';

function getAllHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
    } catch {
        return {};
    }
}

function saveAllHistory(data) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
}

// =============================================
// MILESTONE DEFINITIONS
// =============================================
const MILESTONES = [
    // Rep-based milestones
    { id: 'first_rep', name: 'First Rep!', icon: '🎯', description: 'Complete your first rep', check: (s) => s.totalReps >= 1 },
    { id: 'rep_10', name: 'Getting Started', icon: '🌱', description: 'Complete 10 total reps', check: (s) => s.totalReps >= 10 },
    { id: 'rep_50', name: 'Warming Up', icon: '🔥', description: 'Complete 50 total reps', check: (s) => s.totalReps >= 50 },
    { id: 'rep_100', name: 'Century Club', icon: '💯', description: 'Complete 100 total reps', check: (s) => s.totalReps >= 100 },
    { id: 'rep_250', name: 'Beast Mode', icon: '💪', description: 'Complete 250 total reps', check: (s) => s.totalReps >= 250 },
    { id: 'rep_500', name: 'Half Thousand', icon: '🏅', description: 'Complete 500 total reps', check: (s) => s.totalReps >= 500 },
    { id: 'rep_1000', name: 'Legend', icon: '🏆', description: 'Complete 1000 total reps', check: (s) => s.totalReps >= 1000 },

    // Workout count milestones
    { id: 'workout_1', name: 'First Workout', icon: '⭐', description: 'Complete 1 workout', check: (s) => s.totalWorkouts >= 1 },
    { id: 'workout_5', name: 'Consistent', icon: '📅', description: 'Complete 5 workouts', check: (s) => s.totalWorkouts >= 5 },
    { id: 'workout_10', name: 'Dedicated', icon: '🎖️', description: 'Complete 10 workouts', check: (s) => s.totalWorkouts >= 10 },
    { id: 'workout_25', name: 'Committed', icon: '🔒', description: 'Complete 25 workouts', check: (s) => s.totalWorkouts >= 25 },
    { id: 'workout_50', name: 'Iron Will', icon: '⚔️', description: 'Complete 50 workouts', check: (s) => s.totalWorkouts >= 50 },

    // Exercise variety milestones
    { id: 'variety_3', name: 'Explorer', icon: '🧭', description: 'Try 3 different exercises', check: (s) => s.uniqueExercises >= 3 },
    { id: 'variety_5', name: 'Versatile', icon: '🌈', description: 'Try 5 different exercises', check: (s) => s.uniqueExercises >= 5 },
    { id: 'variety_10', name: 'All-Rounder', icon: '🎯', description: 'Try 10 different exercises', check: (s) => s.uniqueExercises >= 10 },
    { id: 'variety_all', name: 'Master of All', icon: '👑', description: 'Try every exercise', check: (s) => s.uniqueExercises >= 19 },

    // Duration milestones
    { id: 'time_5', name: '5 Minutes', icon: '⏱️', description: 'Spend 5 minutes exercising', check: (s) => s.totalDuration >= 300 },
    { id: 'time_30', name: 'Half Hour', icon: '🕐', description: 'Spend 30 minutes exercising', check: (s) => s.totalDuration >= 1800 },
    { id: 'time_60', name: 'Full Hour', icon: '⏰', description: 'Spend 1 hour exercising', check: (s) => s.totalDuration >= 3600 },

    // Streak milestones
    { id: 'streak_3', name: '3-Day Streak', icon: '🔥', description: 'Exercise 3 days in a row', check: (s) => s.streak >= 3 },
    { id: 'streak_7', name: 'Week Warrior', icon: '📆', description: 'Exercise 7 days in a row', check: (s) => s.streak >= 7 },
    { id: 'streak_30', name: 'Monthly Master', icon: '🗓️', description: 'Exercise 30 days in a row', check: (s) => s.streak >= 30 },
];

export { MILESTONES };

// =============================================
// STATS CALCULATOR
// =============================================
function calculateUserStats(workouts) {
    if (!workouts || workouts.length === 0) {
        return {
            totalReps: 0,
            totalWorkouts: 0,
            totalDuration: 0,
            uniqueExercises: 0,
            streak: 0,
            favoriteExercise: null,
            avgRepsPerWorkout: 0,
            activeDays: 0
        };
    }

    const totalReps = workouts.reduce((sum, w) => sum + (w.reps || 0), 0);
    const totalWorkouts = workouts.length;
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const uniqueExercises = new Set(workouts.map(w => w.exerciseId)).size;

    // Calculate streak
    const days = [...new Set(workouts.map(w => new Date(w.date).toDateString()))].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        if (days.includes(checkDate.toDateString())) {
            streak++;
        } else if (i > 0) {
            break; // Streak broken (skip today if no workout yet)
        }
    }

    // Favorite exercise
    const exerciseCounts = {};
    workouts.forEach(w => {
        exerciseCounts[w.exerciseName] = (exerciseCounts[w.exerciseName] || 0) + 1;
    });
    const favoriteExercise = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
        totalReps,
        totalWorkouts,
        totalDuration,
        uniqueExercises,
        streak,
        favoriteExercise,
        avgRepsPerWorkout: totalWorkouts > 0 ? Math.round(totalReps / totalWorkouts) : 0,
        activeDays: days.length
    };
}

// =============================================
// COMPOSABLE
// =============================================
export function useHistory(username) {
    const workoutHistory = ref([]);

    function loadHistory() {
        const all = getAllHistory();
        workoutHistory.value = all[username] || [];
    }

    function saveWorkout(exerciseId, exerciseName, reps, durationSeconds) {
        const all = getAllHistory();
        if (!all[username]) {
            all[username] = [];
        }
        all[username].push({
            exerciseId,
            exerciseName,
            reps,
            duration: durationSeconds,
            date: new Date().toISOString()
        });
        saveAllHistory(all);
        workoutHistory.value = all[username];
    }

    function getTodayStats() {
        const today = new Date().toDateString();
        const todayWorkouts = workoutHistory.value.filter(w => {
            return new Date(w.date).toDateString() === today;
        });
        return {
            totalExercises: todayWorkouts.length,
            totalReps: todayWorkouts.reduce((sum, w) => sum + (w.reps || 0), 0),
            totalDuration: todayWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0)
        };
    }

    function getRecentWorkouts(limit = 10) {
        return workoutHistory.value.slice(-limit).reverse();
    }

    function getFullStats() {
        return calculateUserStats(workoutHistory.value);
    }

    function getUnlockedMilestones() {
        const stats = getFullStats();
        return MILESTONES.filter(m => m.check(stats));
    }

    function getMilestoneProgress() {
        const stats = getFullStats();
        return MILESTONES.map(m => ({
            ...m,
            unlocked: m.check(stats)
        }));
    }

    // Load on creation
    loadHistory();

    return {
        workoutHistory,
        saveWorkout,
        getTodayStats,
        getRecentWorkouts,
        getFullStats,
        getUnlockedMilestones,
        getMilestoneProgress,
        loadHistory
    };
}

// =============================================
// LEADERBOARD (cross-user)
// =============================================
export function getLeaderboard() {
    const all = getAllHistory();
    const leaderboard = [];

    for (const [username, workouts] of Object.entries(all)) {
        const stats = calculateUserStats(workouts);
        const unlocked = MILESTONES.filter(m => m.check(stats)).length;
        leaderboard.push({
            username,
            totalReps: stats.totalReps,
            totalWorkouts: stats.totalWorkouts,
            totalDuration: stats.totalDuration,
            streak: stats.streak,
            uniqueExercises: stats.uniqueExercises,
            milestonesUnlocked: unlocked,
            totalMilestones: MILESTONES.length,
            score: stats.totalReps + (stats.totalWorkouts * 10) + (stats.streak * 50) + (unlocked * 100)
        });
    }

    // Sort by score descending
    leaderboard.sort((a, b) => b.score - a.score);
    return leaderboard;
}
