// --- auth.js ---
// localStorage-based authentication composable

const { ref, computed } = Vue;

const AUTH_KEY = 'ai_fitness_users';
const SESSION_KEY = 'ai_fitness_session';

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY)) || {};
    } catch {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

// Simple hash function for passwords (not cryptographically secure, but functional)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useAuth() {
    const currentUser = ref(null);
    const authError = ref('');

    // Check for existing session on load
    function checkSession() {
        const session = localStorage.getItem(SESSION_KEY);
        if (session) {
            const users = getUsers();
            if (users[session]) {
                currentUser.value = session;
            }
        }
    }

    async function signup(username, password) {
        authError.value = '';

        if (!username || !password) {
            authError.value = 'Please fill in all fields.';
            return false;
        }
        if (username.length < 3) {
            authError.value = 'Username must be at least 3 characters.';
            return false;
        }
        if (password.length < 4) {
            authError.value = 'Password must be at least 4 characters.';
            return false;
        }

        const users = getUsers();
        if (users[username]) {
            authError.value = 'Username already exists.';
            return false;
        }

        const hashedPw = await hashPassword(password);
        users[username] = {
            passwordHash: hashedPw,
            createdAt: new Date().toISOString()
        };
        saveUsers(users);
        currentUser.value = username;
        localStorage.setItem(SESSION_KEY, username);
        return true;
    }

    async function login(username, password) {
        authError.value = '';

        if (!username || !password) {
            authError.value = 'Please fill in all fields.';
            return false;
        }

        const users = getUsers();
        if (!users[username]) {
            authError.value = 'User not found.';
            return false;
        }

        const hashedPw = await hashPassword(password);
        if (users[username].passwordHash !== hashedPw) {
            authError.value = 'Incorrect password.';
            return false;
        }

        currentUser.value = username;
        localStorage.setItem(SESSION_KEY, username);
        return true;
    }

    function logout() {
        currentUser.value = null;
        localStorage.removeItem(SESSION_KEY);
    }

    const isLoggedIn = computed(() => !!currentUser.value);

    return {
        currentUser,
        authError,
        isLoggedIn,
        checkSession,
        signup,
        login,
        logout
    };
}
