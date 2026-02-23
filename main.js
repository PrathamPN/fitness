// --- main.js ---
// Main Vue app with page routing, auth, and exercise management

import { initializeMediaPipe } from './mediapipe.js';
import { usePoseLogic } from './poseLogic.js';
import { useAuth } from './auth.js';
import { EXERCISES, CATEGORIES, getExerciseById } from './exercises.js';
import { getLeaderboard, MILESTONES } from './history.js';

const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
  setup() {
    // =============================================
    // PAGE STATE
    // =============================================
    const currentPage = ref('login'); // 'login' | 'dashboard' | 'exercise'
    const currentExercise = ref(null);
    const selectedCategory = ref('ALL');
    const dashboardTab = ref('exercises'); // 'exercises' | 'profile' | 'leaderboard'

    // =============================================
    // AUTH
    // =============================================
    const { currentUser, authError, isLoggedIn, checkSession, signup, login, logout } = useAuth();
    const authMode = ref('login');
    const authUsername = ref('');
    const authPassword = ref('');

    // =============================================
    // HISTORY (initialized after login)
    // =============================================
    let history = null;
    const todayStats = ref({ totalExercises: 0, totalReps: 0, totalDuration: 0 });
    const recentWorkouts = ref([]);
    const profileStats = ref({ totalReps: 0, totalWorkouts: 0, totalDuration: 0, uniqueExercises: 0, streak: 0, favoriteExercise: null, avgRepsPerWorkout: 0, activeDays: 0, memberSince: '' });
    const milestoneProgress = ref([]);
    const unlockedCount = ref(0);
    const totalMilestones = ref(MILESTONES.length);
    const allWorkouts = ref([]);
    const leaderboardData = ref([]);

    function loadHistoryForUser() {
      import('./history.js').then(({ useHistory }) => {
        history = useHistory(currentUser.value);
        refreshDashboardData();
      });
    }

    function refreshDashboardData() {
      if (!history) return;
      todayStats.value = history.getTodayStats();
      recentWorkouts.value = history.getRecentWorkouts(10);
      allWorkouts.value = history.workoutHistory.value.slice().reverse();

      // Profile stats
      const stats = history.getFullStats();
      const userEntry = JSON.parse(localStorage.getItem('ai_fitness_users') || '{}');
      const memberDate = userEntry[currentUser.value]?.createdAt;
      profileStats.value = {
        ...stats,
        memberSince: memberDate ? new Date(memberDate).toLocaleDateString() : 'today'
      };

      // Milestones
      milestoneProgress.value = history.getMilestoneProgress();
      unlockedCount.value = milestoneProgress.value.filter(m => m.unlocked).length;
    }

    function refreshLeaderboard() {
      leaderboardData.value = getLeaderboard();
    }

    // =============================================
    // EXERCISE LOGIC
    // =============================================
    const {
      repCounter,
      stage,
      feedbackMessage,
      extraData,
      processExercise,
      setExercise
    } = usePoseLogic();

    // Camera state
    const isLoading = ref(true);
    const videoEl = ref(null);
    const canvasEl = ref(null);
    let canvasCtx = null;
    let cameraInstance = null;
    let sessionStart = null;
    const sessionDuration = ref(0);
    let sessionTimer = null;

    // =============================================
    // COMPUTED
    // =============================================
    const categories = computed(() => CATEGORIES);

    const filteredExercises = computed(() => {
      if (selectedCategory.value === 'ALL') return EXERCISES;
      return EXERCISES.filter(e => e.category === selectedCategory.value);
    });

    const currentExerciseData = computed(() => {
      return currentExercise.value ? getExerciseById(currentExercise.value) : null;
    });

    // =============================================
    // AUTH HANDLERS
    // =============================================
    async function handleAuth() {
      let success;
      if (authMode.value === 'login') {
        success = await login(authUsername.value, authPassword.value);
      } else {
        success = await signup(authUsername.value, authPassword.value);
      }
      if (success) {
        authUsername.value = '';
        authPassword.value = '';
        loadHistoryForUser();
        currentPage.value = 'dashboard';
      }
    }

    function handleLogout() {
      stopCamera();
      logout();
      currentPage.value = 'login';
    }

    // =============================================
    // EXERCISE HANDLERS
    // =============================================
    function startExercise(exerciseId) {
      currentExercise.value = exerciseId;
      setExercise(exerciseId);
      isLoading.value = true;
      sessionStart = Date.now();
      sessionDuration.value = 0;
      currentPage.value = 'exercise';

      // Start session timer
      sessionTimer = setInterval(() => {
        sessionDuration.value = Math.floor((Date.now() - sessionStart) / 1000);
      }, 1000);

      // Wait for DOM to render, then start camera
      setTimeout(() => {
        startCamera();
      }, 100);
    }

    function goBackToDashboard() {
      // Save workout before going back
      const duration = Math.floor((Date.now() - sessionStart) / 1000);
      if (history && repCounter.value > 0) {
        const ex = getExerciseById(currentExercise.value);
        history.saveWorkout(currentExercise.value, ex.name, repCounter.value, duration);
        refreshDashboardData();
      }

      stopCamera();
      clearInterval(sessionTimer);
      currentExercise.value = null;
      currentPage.value = 'dashboard';
    }

    // =============================================
    // MEDIAPIPE / CAMERA
    // =============================================
    function onResults(results) {
      if (isLoading.value) {
        isLoading.value = false;
      }

      if (!canvasCtx && canvasEl.value) {
        canvasCtx = canvasEl.value.getContext('2d');
      }
      if (!canvasCtx) return;

      // Process with correct exercise
      const landmarks = results.poseLandmarks;
      if (currentExercise.value) {
        processExercise(currentExercise.value, landmarks);
      }

      // Draw skeleton
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height);
      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
      }
      canvasCtx.restore();
    }

    function startCamera() {
      if (videoEl.value) {
        canvasCtx = null;
        initializeMediaPipe(videoEl.value, onResults)
          .catch(error => {
            console.error("Failed to start camera:", error);
            if (error.name === "NotAllowedError") {
              feedbackMessage.value = "Camera permission denied.";
            } else {
              feedbackMessage.value = "Error starting camera.";
            }
            isLoading.value = false;
          });
      }
    }

    function stopCamera() {
      // Stop video tracks
      if (videoEl.value && videoEl.value.srcObject) {
        videoEl.value.srcObject.getTracks().forEach(t => t.stop());
        videoEl.value.srcObject = null;
      }
      canvasCtx = null;
    }

    // =============================================
    // UTILITY
    // =============================================
    function getCategoryColor(cat) {
      return CATEGORIES[cat]?.color || '#6B7280';
    }

    function getCategoryLabel(cat) {
      return CATEGORIES[cat]?.label || cat;
    }

    function formatDuration(seconds) {
      if (!seconds) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatDate(dateStr) {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) return 'Today';
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString();
    }

    // =============================================
    // LIFECYCLE
    // =============================================
    onMounted(() => {
      // Check for existing session
      checkSession();
      if (isLoggedIn.value) {
        loadHistoryForUser();
        currentPage.value = 'dashboard';
      }
    });

    // =============================================
    // RETURN
    // =============================================
    return {
      // Page state
      currentPage,
      currentExercise,
      selectedCategory,
      dashboardTab,

      // Auth
      currentUser,
      authError,
      authMode,
      authUsername,
      authPassword,
      handleAuth,
      handleLogout,

      // Dashboard
      categories,
      filteredExercises,
      todayStats,
      recentWorkouts,
      getCategoryColor,
      getCategoryLabel,

      // Profile
      profileStats,
      milestoneProgress,
      unlockedCount,
      totalMilestones,
      allWorkouts,

      // Leaderboard
      leaderboardData,
      refreshLeaderboard,

      // Exercise
      currentExerciseData,
      isLoading,
      videoEl,
      canvasEl,
      repCounter,
      stage,
      feedbackMessage,
      extraData,
      sessionDuration,
      startExercise,
      goBackToDashboard,

      // Utility
      formatDuration,
      formatDate
    };
  }
}).mount('#app');