/**
 * CLASH FIRE - Core Application Script
 * Live Firebase Firestore Sync, Direct Diamond Engine, Referral System & Quota Shield
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
        this.displayUserId = null;
        this.user = {
            coins: 0, // Direct Diamonds balance
            freeFireUid: '',
            dailyWatchCount: 0,
            dailyLinkCompletedCount: 0,
            completedLinks: [false, false, false, false, false],
            redemptionHistory: [],
            lastResetDate: new Date().toISOString().split('T')[0]
        };
        this.globalSettings = {
            linkReward: 5,
            adReward: 2,
            referralReward: 10
        };
        this.db = null;
        this.firestoreActive = false;

        // Base 5 Daily Shortener Tasks
        this.dailyLinks = [
            { id: 0, title: "GPLink Clash Supply #1", url: "https://gplinks.co/example1" },
            { id: 1, title: "ShrinkEarn Elite Crate #2", url: "https://shrinkearn.com/example2" },
            { id: 2, title: "GPLink Diamond Vault #3", url: "https://gplinks.co/example3" },
            { id: 3, title: "Shortur Armor Drop #4", url: "https://shortur.com/example4" },
            { id: 4, title: "GPLink Heroic Loot #5", url: "https://gplinks.co/example5" }
        ];

        this.init();
    }

    async init() {
        this.showSplashProgress(20);
        this.initFirebase();
        this.showSplashProgress(50);

        this.deviceId = await this.generateCrossBrowserHardwareID();
        this.displayUserId = "CF-" + this.deviceId.substring(9, 15);
        document.getElementById('display-device-id').innerText = "User ID: " + this.displayUserId;
        this.showSplashProgress(75);

        await this.loadGlobalSettings();
        await this.loadUserProfile();
        this.checkReferralBonus();
        this.showSplashProgress(100);

        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            this.renderDashboard();
            this.startCountdownTimer();
        }, 400);
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
            }
        } catch (e) { console.warn(e.message); }
    }

    async loadGlobalSettings() {
        if (this.firestoreActive) {
            try {
                const doc = await this.db.collection("settings").doc("global").get();
                if (doc.exists) {
                    this.globalSettings = doc.data();
                }
            } catch(e) { console.error(e); }
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
                    if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
                    if (this.user.lastResetDate !== today) {
                        this.user.dailyWatchCount = 0;
                        this.user.dailyLinkCompletedCount = 0;
                        this.user.completedLinks = [false, false, false, false, false];
                        this.user.lastResetDate = today;
                        await docRef.update(this.user);
                    }
                } else {
                    this.user.lastResetDate = today;
                    this.user.redemptionHistory = [];
                    await docRef.set(this.user);
                }
                return;
            } catch (err) { console.error(err); }
        }

        const saved = localStorage.getItem('CLASH_USER_DATA_' + this.deviceId);
        if (saved) {
            this.user = JSON.parse(saved);
            if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
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

    async checkReferralBonus() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        // Award referral bonus ONLY to the referrer (not the new user)
        if (refCode && refCode !== this.displayUserId && !localStorage.getItem('REFERRAL_PROCESSED')) {
            localStorage.setItem('REFERRAL_PROCESSED', 'true');
            const bonus = this.globalSettings.referralReward || 10;
            
            // Credit referrer in Firestore directly
            if (this.firestoreActive) {
                try {
                    const snapshot = await this.db.collection("users").get();
                    snapshot.forEach(async doc => {
                        let data = doc.data();
                        let docRefId = "CF-" + doc.id.substring(9, 15);
                        if (docRefId === refCode) {
                            await this.db.collection("users").doc(doc.id).update({
                                coins: (data.coins || 0) + bonus
                            });
                        }
                    });
                } catch(e) { console.error(e); }
            }
            this.showToast('WELCOME TO CLASH FIRE', `Joined via referral link from ${refCode}!`, 'info');
        }
    }

    async saveUserProfile() {
        localStorage.setItem('CLASH_USER_DATA_' + this.deviceId, JSON.stringify(this.user));
        if (this.firestoreActive) {
            try {
                await this.db.collection("users").doc(this.deviceId).set(this.user, { merge: true });
            } catch (err) { console.error(err); }
        }
    }

    renderDashboard() {
        document.getElementById('user-coins').innerText = this.user.coins;
        document.getElementById('completed-links-badge').innerText = `${this.user.dailyLinkCompletedCount}/5 DONE`;
        document.getElementById('ad-watch-badge').innerText = `${this.user.dailyWatchCount}/5 WATCHED`;
        
        const adLabel = document.getElementById('ad-reward-label');
        if (adLabel) adLabel.innerText = `Reward: +${this.globalSettings.adReward || 2} Diamonds`;

        if (this.user.freeFireUid) {
            document.getElementById('ff-uid').value = this.user.freeFireUid;
        }

        const refInput = document.getElementById('referral-link-input');
        if (refInput) {
            refInput.value = `${window.location.origin}${window.location.pathname}?ref=${this.displayUserId}`;
        }

        const linksContainer = document.getElementById('links-container');
        linksContainer.innerHTML = '';

        const linkRewardAmt = this.globalSettings.linkReward || 5;

        this.dailyLinks.forEach((link, idx) => {
            const isDone = this.user.completedLinks[idx];
            const card = document.createElement('div');
            card.className = `link-card ${isDone ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="link-info">
                    <div class="link-icon-box">
                        <i class="fa-solid ${isDone ? 'fa-check' : 'fa-gem'}"></i>
                    </div>
                    <div class="link-details">
                        <h4>${link.title}</h4>
                        <p>Reward: +${linkRewardAmt} Diamonds</p>
                    </div>
                </div>
                <button class="btn-primary" ${isDone ? 'disabled' : ''} onclick="app.executeLinkTask(${idx})">
                    ${isDone ? 'CLAIMED' : 'VISIT LINK'}
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

        this.renderRedeemHistory();
    }

    renderRedeemHistory() {
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;
        historyContainer.innerHTML = '';

        const history = this.user.redemptionHistory || [];
        if (history.length === 0) {
            historyContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 15px; font-size: 0.85rem;">No redemption history found. Redeem diamonds above!</div>`;
            return;
        }

        history.slice().reverse().forEach(item => {
            const itemElem = document.createElement('div');
            itemElem.className = 'history-item';
            itemElem.innerHTML = `
                <div class="history-info">
                    <div class="history-title"><i class="fa-solid fa-gem"></i> ${item.diamonds} Diamonds</div>
                    <div class="history-sub">UID: ${item.ffUid} | ${item.date}</div>
                </div>
                <span class="history-status ${item.status.toLowerCase()}">${item.status}</span>
            `;
            historyContainer.appendChild(itemElem);
        });
    }

    async executeLinkTask(index) {
        if (this.user.completedLinks[index]) return;
        const task = this.dailyLinks[index];
        
        const oneTimeToken = "TOK_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
        localStorage.setItem("ACTIVE_TOKEN_" + index, oneTimeToken);

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
            const rewardAmt = this.globalSettings.adReward || 2;
            this.user.coins += rewardAmt;
            this.saveUserProfile();
            this.renderDashboard();

            this.showToast('AD REWARD CLAIMED!', `+${rewardAmt} Diamonds added for watching ad!`, 'success');
        }, 6500);
    }

    async selectPackage(cardElem, diamondAmount, costPoints) {
        const uidInput = document.getElementById('ff-uid').value.trim();
        
        if (!uidInput || uidInput.length < 8) {
            this.showToast('VALIDATION ERROR', 'Please enter your valid Player UID!', 'error');
            document.getElementById('ff-uid').focus();
            return;
        }

        if (this.user.coins < costPoints) {
            this.showToast('INSUFFICIENT BALANCE', `You need ${costPoints} Diamonds to redeem ${diamondAmount} Diamonds!`, 'error');
            return;
        }

        this.user.freeFireUid = uidInput;
        this.showLoader(`PROCESSING ${diamondAmount} DIAMONDS PAYOUT...`);

        setTimeout(async () => {
            this.user.coins -= costPoints;
            const reqId = "REQ_" + Date.now();
            
            const redemptionItem = {
                id: reqId,
                diamonds: diamondAmount,
                points: costPoints,
                ffUid: uidInput,
                status: "PENDING",
                date: new Date().toLocaleDateString()
            };

            if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
            this.user.redemptionHistory.push(redemptionItem);

            await this.saveUserProfile();
            this.renderDashboard();
            this.hideLoader();

            if (this.firestoreActive) {
                try {
                    await this.db.collection("redemptions").doc(reqId).set({
                        reqId: reqId,
                        deviceId: this.deviceId,
                        freeFireUid: uidInput,
                        diamondAmount: diamondAmount,
                        pointsDeducted: costPoints,
                        timestamp: new Date().toISOString(),
                        date: new Date().toLocaleDateString(),
                        status: "PENDING"
                    });
                } catch (e) { console.error(e); }
            }

            document.getElementById('modal-amount').innerText = `${diamondAmount} Diamonds`;
            document.getElementById('modal-uid').innerText = uidInput;
            document.getElementById('redeem-modal').classList.remove('hidden');

        }, 2000);
    }

    copyReferralLink() {
        const refInput = document.getElementById('referral-link-input');
        refInput.select();
        navigator.clipboard.writeText(refInput.value);
        this.showToast('COPIED!', 'Referral link copied to clipboard!', 'success');
    }

    shareWhatsApp() {
        const refLink = `${window.location.origin}${window.location.pathname}?ref=${this.displayUserId}`;
        const text = `🔥 Play Clash Fire & earn FREE Free Fire Diamonds daily! Join using my link: ${refLink}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }

    closeRedeemModal() {
        document.getElementById('redeem-modal').classList.add('hidden');
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
        }, 3500);
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
