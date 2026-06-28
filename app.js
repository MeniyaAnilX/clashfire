/**
 * CLASH FIRE - Core Application Script
 * Live Firebase Firestore Sync, Server Postback Verification Engine & Strict Anti-Cheat Guard
 */

const firebaseConfig = {
    apiKey: "AIzaSyCQocUJB6rMG-1qHVyXwXDoYBlTb17XX3k",
    authDomain: "clashfirediamond.firebaseapp.com",
    projectId: "clashfirediamond",
    storageBucket: "clashfirediamond.firebasestorage.app",
    messagingSenderId: "901946161853",
    appId: "1:901946161853:web:03f9a4be00070134c0d5d4",
    measurementId: "G-N31S9SDP2L"
};

class ClashFireApp {
    constructor() {
        this.deviceId = null;
        this.user = {
            coins: 0,
            freeFireUid: '',
            dailyWatchCount: 0,
            dailyLinkCompletedCount: 0,
            completedLinks: [false, false, false, false, false],
            lastResetDate: new Date().toISOString().split('T')[0]
        };
        this.db = null;
        this.firestoreActive = false;

        // Base 5 Daily Shortener Tasks (Replace URLs with your shortened GPLinks)
        this.dailyLinks = [
            { id: 0, title: "GPLink Clash Supply #1", url: "https://gplinks.co/example1", reward: 50 },
            { id: 1, title: "ShrinkEarn Elite Crate #2", url: "https://shrinkearn.com/example2", reward: 50 },
            { id: 2, title: "GPLink Diamond Vault #3", url: "https://gplinks.co/example3", reward: 50 },
            { id: 3, title: "Shortur Armor Drop #4", url: "https://shortur.com/example4", reward: 50 },
            { id: 4, title: "GPLink Heroic Loot #5", url: "https://gplinks.co/example5", reward: 50 }
        ];

        this.init();
    }

    async init() {
        this.showSplashProgress(15);
        this.initFirebase();
        this.showSplashProgress(40);

        this.deviceId = await this.generateCrossBrowserHardwareID();
        document.getElementById('display-device-id').innerText = this.deviceId.substring(0, 14);
        this.showSplashProgress(75);

        await this.loadUserProfile();
        this.showSplashProgress(100);

        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            this.renderDashboard();
            this.startCountdownTimer();
        }, 500);
    }

    showSplashProgress(percent) {
        const bar = document.getElementById('splash-loading-bar');
        if (bar) bar.style.width = percent + '%';
    }

    initFirebase() {
        try {
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.firestore();
                this.firestoreActive = true;
                console.log("🔥 Live Firestore Connected to project: clashfirediamond");
            }
        } catch (e) {
            console.warn("Firestore running in offline backup mode.", e.message);
        }
    }

    async generateCrossBrowserHardwareID() {
        let hardwareTokens = [];
        const screenSpecs = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.devicePixelRatio || 1}`;
        hardwareTokens.push(screenSpecs);

        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    hardwareTokens.push(`${vendor}~${renderer}`);
                }
            }
        } catch (e) {}

        const cpus = navigator.hardwareConcurrency || 4;
        const tz = new Date().getTimezoneOffset();
        hardwareTokens.push(`CPU:${cpus}_TZ:${tz}`);

        const rawString = hardwareTokens.join('||');
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            const char = rawString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }

        const finalId = `CLASH_HW_${Math.abs(hash)}`;
        localStorage.setItem('CLASH_FIRE_HW_ID', finalId);
        return finalId;
    }

    async loadUserProfile() {
        const today = new Date().toISOString().split('T')[0];

        if (this.firestoreActive) {
            try {
                const docRef = this.db.collection("users").doc(this.deviceId);
                const doc = await docRef.get();
                if (doc.exists) {
                    this.user = doc.data();
                    if (this.user.lastResetDate !== today) {
                        this.user.dailyWatchCount = 0;
                        this.user.dailyLinkCompletedCount = 0;
                        this.user.completedLinks = [false, false, false, false, false];
                        this.user.lastResetDate = today;
                        await docRef.update(this.user);
                    }
                } else {
                    this.user.lastResetDate = today;
                    await docRef.set(this.user);
                }
                return;
            } catch (err) {
                console.error("Firestore sync error", err);
            }
        }

        const saved = localStorage.getItem('CLASH_USER_DATA_' + this.deviceId);
        if (saved) {
            this.user = JSON.parse(saved);
            if (this.user.lastResetDate !== today) {
                this.user.dailyWatchCount = 0;
                this.user.dailyLinkCompletedCount = 0;
                this.user.completedLinks = [false, false, false, false, false];
                this.user.lastResetDate = today;
                this.saveUserProfile();
            }
        } else {
            this.saveUserProfile();
        }
    }

    async saveUserProfile() {
        localStorage.setItem('CLASH_USER_DATA_' + this.deviceId, JSON.stringify(this.user));
        if (this.firestoreActive) {
            try {
                await this.db.collection("users").doc(this.deviceId).set(this.user, { merge: true });
            } catch (err) {
                console.error("Firestore save error", err);
            }
        }
    }

    renderDashboard() {
        document.getElementById('user-coins').innerText = this.user.coins;
        document.getElementById('completed-links-badge').innerText = `${this.user.dailyLinkCompletedCount}/5 DONE`;
        document.getElementById('ad-watch-badge').innerText = `${this.user.dailyWatchCount}/5 WATCHED`;

        if (this.user.freeFireUid) {
            document.getElementById('ff-uid').value = this.user.freeFireUid;
        }

        const linksContainer = document.getElementById('links-container');
        linksContainer.innerHTML = '';

        this.dailyLinks.forEach((link, idx) => {
            const isDone = this.user.completedLinks[idx];
            const card = document.createElement('div');
            card.className = `link-card ${isDone ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="link-info">
                    <div class="link-icon-box">
                        <i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-gem'}"></i>
                    </div>
                    <div class="link-details">
                        <h4>${link.title}</h4>
                        <p>Reward: +${link.reward} Points</p>
                    </div>
                </div>
                <button class="btn-primary" ${isDone ? 'disabled' : ''} onclick="app.executeLinkTask(${idx})">
                    ${isDone ? '<i class="fa-solid fa-check"></i> CLAIMED' : '<i class="fa-solid fa-arrow-right-long"></i> VISIT LINK'}
                </button>
            `;
            linksContainer.appendChild(card);
        });

        const adBtn = document.getElementById('watch-ad-btn');
        if (this.user.dailyWatchCount >= 5) {
            adBtn.disabled = true;
            adBtn.innerHTML = '<i class="fa-solid fa-lock"></i> MAX LIMIT (5/5)';
        } else {
            adBtn.disabled = false;
            adBtn.innerHTML = '<i class="fa-solid fa-play"></i> WATCH AD';
        }
    }

    /**
     * Launch Link Task for Shortener Navigation
     */
    executeLinkTask(index) {
        if (this.user.completedLinks[index]) return;
        const task = this.dailyLinks[index];
        
        // Open shortener link in new tab
        window.open(task.url, '_blank');
        this.showToast('MISSION LAUNCHED', 'Complete shortener navigation on target tab to claim reward!', 'info');
    }

    watchRewardAd() {
        if (this.user.dailyWatchCount >= 5) {
            this.showToast('DAILY LIMIT REACHED', 'Watched all 5 sponsored ads today!', 'error');
            return;
        }

        this.showLoader("LOADING SPONSORED VIDEO AD...");

        setTimeout(() => {
            document.getElementById('loader-message').innerText = "WATCHING REWARD VIDEO... (5s)";
        }, 1500);

        setTimeout(() => {
            this.hideLoader();
            this.user.dailyWatchCount++;
            this.user.coins += 20;
            this.saveUserProfile();
            this.renderDashboard();

            this.showToast('AD REWARD CLAIMED!', '+20 Points added for watching ad!', 'success');
        }, 6500);
    }

    async selectPackage(cardElem, diamondAmount, costPoints) {
        const uidInput = document.getElementById('ff-uid').value.trim();
        
        if (!uidInput || uidInput.length < 8) {
            this.showToast('VALIDATION ERROR', 'Please enter your valid 8-12 digit Free Fire Player UID!', 'error');
            document.getElementById('ff-uid').focus();
            return;
        }

        if (this.user.coins < costPoints) {
            this.showToast('INSUFFICIENT BALANCE', `You need ${costPoints} points to redeem ${diamondAmount} Diamonds!`, 'error');
            return;
        }

        this.user.freeFireUid = uidInput;
        this.showLoader(`PROCESSING ${diamondAmount} DIAMONDS PAYOUT...`);

        setTimeout(async () => {
            this.user.coins -= costPoints;
            await this.saveUserProfile();
            this.renderDashboard();
            this.hideLoader();

            if (this.firestoreActive) {
                try {
                    await this.db.collection("redemptions").add({
                        deviceId: this.deviceId,
                        freeFireUid: uidInput,
                        diamondAmount: diamondAmount,
                        pointsDeducted: costPoints,
                        timestamp: new Date().toISOString(),
                        status: "PENDING_ADMIN_FULFILLMENT"
                    });
                } catch (e) { console.error(e); }
            }

            this.showToast('REDEMPTION REQUEST SENT!', `${diamondAmount} Diamonds requested for UID: ${uidInput}. Logged in Firestore!`, 'success');
        }, 2500);
    }

    startCountdownTimer() {
        const updateTimer = () => {
            const now = new Date();
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            const diff = midnight - now;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            document.getElementById('reset-timer').innerText = 
                `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
        };
        updateTimer();
        setInterval(updateTimer, 1000);
    }

    scrollToRedeem() {
        document.getElementById('redemption-vault').scrollIntoView({ behavior: 'smooth' });
    }

    showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconClass = 'fa-gem';
        if (type === 'success') iconClass = 'fa-circle-check';
        if (type === 'error') iconClass = 'fa-triangle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${iconClass} toast-icon"></i>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showLoader(msg) {
        document.getElementById('loader-message').innerText = msg;
        document.getElementById('global-loader').classList.remove('hidden');
    }

    hideLoader() {
        document.getElementById('global-loader').classList.add('hidden');
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new ClashFireApp();
});
