// This file is the "offline engine" for your app.
// It intercepts network requests and serves cached files when you're offline.

const CACHE_NAME = 'ai-fitness-coach-v3-multi-file'; // Updated cache name

// This is the list of files your app needs to save to work offline.
const URLS_TO_CACHE = [
    // The main app files
    '/',
    'index.html',
    'style.css',
    'main.js',
    'poseLogic.js',
    'mediapipe.js',
    
    // The MediaPipe JavaScript libraries
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6/control_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
    
    // The AI model files loaded by pose.js
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose_solution.binarypb',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose_landmark_heavy.tflite',
    
    // Tailwind CSS
    'https://cdn.tailwindcss.com',
    
    // The Vue.js Framework
    'https://unpkg.com/vue@3/dist/vue.global.js'
];

// --- 1. Install Event ---
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache. Caching all files...');
                // Use addAllSettled to be more resilient
                return Promise.all(URLS_TO_CACHE.map(url => {
                    // We must use "no-cors" for CDN requests
                    // or they might fail to cache
                    const request = new Request(url, { mode: 'no-cors' });
                    return cache.add(request).catch(err => {
                        console.warn(`Failed to cache ${url}: ${err}`);
                    });
                }));
            })
    );
});

// --- 2. Fetch Event ---
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // If we found it in the cache, return it
                if (response) {
                    return response;
                }
                
                // Otherwise, try to get it from the network
                return fetch(event.request).then(networkResponse => {
                    // Optional: Cache new requests dynamically
                    // This is good but can fill up cache fast.
                    return networkResponse;
                }).catch(err => {
                    console.error('Fetch failed:', err);
                    // You could return a custom offline page here
                });
            })
    );
});

// --- 3. Activate Event ---
// This runs when the new service worker activates.
// It cleans up old caches.
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});