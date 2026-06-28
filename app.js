/**
 * CLASH FIRE - Core Application Script
 * Live Firebase Firestore Sync, Direct Diamond Engine, Referral System, Torox & Gamezop Integrations, Auto Hardware Re-Sync
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
        this.integrations = {
            toroxUrl: localStorage.getItem('CF_CACHE_TOROX_URL') || "https://torox.io",
            toroxEnabled: true,
            gamezopUrl: "https://www.gamezop.com",
            gamezopReward: 5,
            gamezopEnabled: true
        };
        this.db = null;
        this.firestoreActive = false;

        // Base 5 Daily Shortener Tasks
        this.dailyLinks = [
            { id: 0, title: "Daily Mission Supply #1", url: "https://clash-fire.vercel.app/verify.html?task=0" },
            { id: 1, title: "Daily Mission Elite #2", url: "https://clash-fire.vercel.app/verify.html?task=1" },
            { id: 2, title: "Daily Mission Vault #3", url: "https://clash-fire.vercel.app/verify.html?task=2" },
            { id: 3, title: "Daily Mission Armor #4", url: "https://clash-fire.vercel.app/verify.html?task=3" },
            { id: 4, title: "Daily Mission Heroic #5", url: "https://clash-fire.vercel.app/verify.html?task=4" }
        ];

        this.init();
    }

    async init() {
        this.start3SecPageLoader();
        this.initFirebase();
        
        this.deviceId = await this.getOrCreateMultiLayerDeviceID();
        this.displayUserId = "CF-" + this.deviceId.substring(9, 15);
        
        const devElem = document.getElementById('display-device-id');
        if (devElem) devElem.innerText = "User ID: " + this.displayUserId;

        await this.loadGlobalSettings();
        await this.loadUserProfile();
        this.checkReferralBonus();

        this.renderDashboard();
        this.startCountdownTimer();
    }

    switchAppTab(tabId, btnElem) {
        document.querySelectorAll('.app-tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.main-nav-tabs .tab-btn').forEach(el => el.classList.remove('active'));
        
        const targetPane = document.getElementById(tabId);
        if (targetPane) targetPane.classList.add('active');

        if (btnElem) {
            btnElem.classList.add('active');
        } else {
            const btns = document.querySelectorAll('.main-nav-tabs .tab-btn');
            if (tabId === 'tab-home' && btns[0]) btns[0].classList.add('active');
            if (tabId === 'tab-tasks' && btns[1]) btns[1].classList.add('active');
            if (tabId === 'tab-redeem' && btns[2]) btns[2].classList.add('active');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    start3SecPageLoader() {
        const overlay = document.getElementById('page-loader-overlay');
        const fill = document.getElementById('loader-bar-fill');
        if (!overlay || !fill) return;

        let startTime = Date.now();
        const duration = 3000;

        const interval = setInterval(() => {
            let elapsed = Date.now() - startTime;
            let percent = Math.min(100, (elapsed / duration) * 100);
            fill.style.width = percent + '%';

            if (elapsed >= duration) {
                clearInterval(interval);
                overlay.style.opacity = '0';
                setTimeout(() => overlay.classList.add('hidden'), 500);
            }
        }, 30);
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
                // Realtime Listeners for instant settings synchronization
                this.db.collection("settings").doc("global").onSnapshot(doc => {
                    if (doc.exists) {
                        this.globalSettings = doc.data();
                        this.renderDashboard();
                    }
                });

                this.db.collection("settings").doc("links").onSnapshot(doc => {
                    if (doc.exists) {
                        const linksData = doc.data();
                        if (linksData.urls && Array.isArray(linksData.urls)) {
                            linksData.urls.forEach((u, i) => {
                                if (u && this.dailyLinks[i]) this.dailyLinks[i].url = u;
                            });
                            this.renderDashboard();
                        }
                    }
                });

                this.db.collection("settings").doc("integrations").onSnapshot(doc => {
                    if (doc.exists) {
                        this.integrations = doc.data();
                        if (this.integrations.toroxUrl) {
                            localStorage.setItem('CF_CACHE_TOROX_URL', this.integrations.toroxUrl);
                        }
                        this.renderDashboard();
                    }
                });
            } catch(e) { console.error(e); }
        }
    }

    setCookie(name, value, days = 3650) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i=0;i < ca.length;i++) {
            let c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    async getOrCreateMultiLayerDeviceID() {
        let savedId = this.getCookie('CLASH_PERMANENT_HW_ID') || localStorage.getItem('CLASH_FIRE_HW_ID');
        if (savedId) {
            this.setCookie('CLASH_PERMANENT_HW_ID', savedId);
            localStorage.setItem('CLASH_FIRE_HW_ID', savedId);
            return savedId;
        }

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
        this.setCookie('CLASH_PERMANENT_HW_ID', finalId);
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
        
        if (refCode && refCode !== this.displayUserId && !localStorage.getItem('REFERRAL_PROCESSED')) {
            localStorage.setItem('REFERRAL_PROCESSED', 'true');
            const bonus = this.globalSettings.referralReward || 10;
            
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

        const gzLabel = document.getElementById('gamezop-reward-label');
        if (gzLabel) gzLabel.innerText = `Play 3 Mins = +${this.integrations.gamezopReward || 5} Diamonds`;

        // Flexible Visibility Evaluation (handles boolean & string 'true'/'false')
        const toroxStation = document.getElementById('torox-station');
        if (toroxStation) {
            const isToroxOn = (this.integrations.toroxEnabled === true || this.integrations.toroxEnabled === 'true');
            toroxStation.style.display = isToroxOn ? 'block' : 'none';
        }

        const gzStation = document.getElementById('gamezop-station');
        if (gzStation) {
            const isGzOn = (this.integrations.gamezopEnabled === true || this.integrations.gamezopEnabled === 'true');
            gzStation.style.display = isGzOn ? 'block' : 'none';
        }

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
                        ${isDone ? '<i class="fa-solid fa-check"></i>' : '<img src="diamond.png" style="width: 22px; height: 22px;">'}
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
                    <div class="history-title"><img src="diamond.png" style="width: 18px; height: 18px; vertical-align: middle;"> ${item.diamonds} Diamonds</div>
                    <div class="history-sub">UID: ${item.ffUid} | ${item.date}</div>
                </div>
                <span class="history-status ${item.status.toLowerCase()}">${item.status}</span>
            `;
            historyContainer.appendChild(itemElem);
        });
    }

    openToroxOfferwall() {
        let url = (this.integrations && this.integrations.toroxUrl) ? this.integrations.toroxUrl : (localStorage.getItem('CF_CACHE_TOROX_URL') || "https://torox.io");
        
        // Dynamic Replacement for USER_ID=[USER_ID] and subid tracking
        if (url.includes('[USER_ID]')) {
            url = url.replace('[USER_ID]', this.displayUserId);
        } else if (url.includes('USER_ID=')) {
            url = url.replace(/USER_ID=[^&]*/, `USER_ID=${this.displayUserId}`);
        } else if (url.includes('subid=')) {
            url = url.replace(/subid=[^&]*/, `subid=${this.displayUserId}`);
        } else {
            url += (url.includes('?') ? '&' : '?') + `USER_ID=${this.displayUserId}&subid=${this.displayUserId}`;
        }

        // Dynamic Replacement for tag=[tag]
        if (url.includes('[tag]')) {
            url = url.replace('[tag]', 'clashfire');
        } else if (url.includes('tag=')) {
            url = url.replace(/tag=[^&]*/, 'tag=clashfire');
        }

        window.open(url, '_blank');
        this.showToast('TOROX OFFERWALL', 'Complete tasks on Torox tab to earn rewards!', 'info');
    }

    launchGamezop() {
        const url = this.integrations.gamezopUrl || "https://www.gamezop.com";
        window.open(url, '_blank');
        this.showToast('GAMEZOP LAUNCHED', 'Play games active for 3 mins to claim reward!', 'info');
        
        setTimeout(() => {
            const gzReward = this.integrations.gamezopReward || 5;
            this.user.coins += gzReward;
            this.saveUserProfile();
            this.renderDashboard();
            this.showToast('GAMEPLAY BONUS!', `+${gzReward} Diamonds credited for active gameplay!`, 'success');
        }, 180000); // 3-minute verified gameplay
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

    shareNative() {
        const refLink = `${window.location.origin}${window.location.pathname}?ref=${this.displayUserId}`;
        const shareData = {
            title: 'CLASH FIRE - Free Diamonds',
            text: `🔥 Play Clash Fire & earn FREE Free Fire Diamonds daily! Join using my link:`,
            url: refLink
        };

        if (navigator.share) {
            navigator.share(shareData).catch(err => console.log('Share error:', err));
        } else {
            this.copyReferralLink();
        }
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
        this.switchAppTab('tab-redeem');
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
