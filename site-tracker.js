/*!
 * Samarpan — site-tracker.js
 * Lightweight visitor tracker that feeds the "Visitors" / "Live Activity"
 * panels in admin.html. Writes ONE document per page view to the Firestore
 * collection `homepage_visitors`.
 *
 * Security note: Firestore rules for this collection already allow
 *   allow create: if true;
 *   allow read, update, delete: if isAdmin();
 * so this script can only ADD documents — it can never read, edit, or
 * delete visitor data, and it never touches leads/bookings/forms.
 *
 * HOW TO INSTALL ON A PAGE (once per HTML file, right before </body>):
 *
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
 *   <script src="site-tracker.js"></script>
 *
 * If a page already loads the Firebase compat SDK for another reason,
 * just add the single <script src="site-tracker.js"></script> line —
 * this file re-uses whatever `firebase` app is already initialised.
 */
(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDSK1aO2VlYeUAdf5IZ8dA9Y69wM7pkrHQ",
    authDomain: "thesamrpan.firebaseapp.com",
    projectId: "thesamrpan",
    storageBucket: "thesamrpan.firebasestorage.app",
    messagingSenderId: "510287005957",
    appId: "1:510287005957:web:978533c6dbca0f4969cf6c",
    measurementId: "G-ML1QLKGR3K"
  };

  function getDb() {
    if (typeof firebase === 'undefined') return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      return firebase.firestore();
    } catch (e) { return null; }
  }

  function getSessionId() {
    try {
      var key = 'samarpan_session_id';
      var id = sessionStorage.getItem(key);
      if (!id) {
        id = 'sid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return 'sid_' + Date.now().toString(36);
    }
  }

  function getDevice() {
    var ua = navigator.userAgent || '';
    return /Mobile|Android|iPhone|iPad|iPod/i.test(ua) ? 'Mobile' : 'Desktop';
  }

  function nowIST() {
    var d = new Date();
    var date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    var time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    return { date: date, time: time };
  }

  // IP + city/region/country via a free geolocation lookup (best-effort).
  // Cached per-tab so we only call it once per session, not once per page view.
  function getGeo(cb) {
    var cacheKey = 'samarpan_geo_cache';
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) { cb(JSON.parse(cached)); return; }
    } catch (e) {}
    fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var geo = data ? {
          ip: data.ip || '',
          city: data.city || '',
          region: data.region || '',
          country: data.country_name || ''
        } : { ip: '', city: '', region: '', country: '' };
        try { sessionStorage.setItem(cacheKey, JSON.stringify(geo)); } catch (e) {}
        cb(geo);
      })
      .catch(function () { cb({ ip: '', city: '', region: '', country: '' }); });
  }

  function track() {
    var db = getDb();
    if (!db) return; // Firebase SDK not present on this page — skip silently

    var t = nowIST();
    var base = {
      page: (window.location.pathname.split('/').pop() || 'index.html'),
      device: getDevice(),
      referrer: document.referrer || 'direct',
      session_id: getSessionId(),
      date: t.date,
      time: t.time,
      timestamp: new Date().toISOString()
    };

    getGeo(function (geo) {
      db.collection('homepage_visitors').add(Object.assign({}, base, geo))
        .catch(function () { /* never block the page for analytics */ });
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(track, 300);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(track, 300); });
  }
})();
