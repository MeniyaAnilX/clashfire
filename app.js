/**
 * FREEDIAMOND.IN - Core Application Script v4.1.0
 * Zero-Auth LocalStorage Engine + 5 Dynamic Missions & Rewards from Firestore + Popunder & Banner Ad Engine + Strict Firestore Redemption
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

class FreeDiamondApp {
    constructor() {
        this.db = null;
        this.firestoreActive = false;
        
        // Exact 5 Daily Missions Default (Dynamically synced with Firestore settings/links)
        this.dailyMissions = [
            { id: 1, title: "Daily Mission #1", reward: 5, url: "https://bzz.link.chaingpt.org/fec37781" },
            { id: 2, title: "Daily Mission #2", reward: 5, url: "https://bzz.link.chaingpt.org/c90df4b8" },
            { id: 3, title: "Daily Mission #3", reward: 5, url: "https://bzz.link.chaingpt.org/1f3fef79" },
            { id: 4, title: "Daily Mission #4", reward: 5, url: "https://www.effectivecpmnetwork.com/afbz86v2q?key=cb48e93f61f76d5cde6c6d2d29ee2faa" },
            { id: 5, title: "Daily Mission #5", reward: 5, url: "https://www.freediamond.in/free-fire-free-diamonds-2026" }
        ];

        this.adSettings = {
            bannerCode: ''
        };

        this.activeVisitTask = null;
        this.visitTimerInterval = null;
        this.countdownSeconds = 15;

        this.init();
    }

    async init() {
        this.initFirebase();
        this.checkDailyReset();
        this.restoreSavedUid();
        this.renderUI();
        this.startDailyResetTimer();
        this.startLiveProofsTicker();
        
        // Dynamic fetch from Firestore (5 links, custom diamond rewards & top banner ad tag)
        await this.syncSettingsFromFirestore();
    }

    // ----------------- FIREBASE INITIALIZATION -----------------
    initFirebase() {
        try {
            if (typeof firebase !== 'undefined') {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.db = firebase.firestore();
                this.firestoreActive = true;
            }
        } catch (e) {
            console.warn("Firestore initialization notice:", e);
        }
    }

    // ----------------- SYNC SETTINGS & BANNER FROM FIRESTORE -----------------
    async syncSettingsFromFirestore() {
        if (!this.db) return;

        try {
            // 1. Real-time Sync for 5 Daily Mission Links & Custom Rewards
            this.db.collection("settings").doc("links").onSnapshot(doc => {
                if (doc.exists && doc.data().items && Array.isArray(doc.data().items)) {
                    const items = doc.data().items.slice(0, 5);
                    if (items.length > 0) {
                        this.dailyMissions = items.map((m, idx) => ({
                            id: m.id || (idx + 1),
                            title: m.title || `Daily Mission #${idx + 1}`,
                            reward: parseInt(m.reward, 10) || 5,
                            url: m.url || "https://www.freediamond.in"
                        }));
                        this.renderMissions();
                    }
                }
            }, err => console.warn("Links listener:", err));

            // 2. Real-time Sync for Single Header Banner Ad
            this.db.collection("settings").doc("global").onSnapshot(doc => {
                if (doc.exists) {
                    const gData = doc.data();
                    this.adSettings.bannerCode = gData.adScriptBanner || '';
                    this.injectBannerAd();
                }
            }, err => console.warn("Global settings listener:", err));

        } catch (err) {
            console.warn("Firestore sync warning (using defaults):", err);
        }
    }

    injectBannerAd() {
        const slot = document.getElementById('header-banner-slot');
        if (!slot) return;

        const code = this.adSettings.bannerCode ? this.adSettings.bannerCode.trim() : '';
        if (!code) {
            slot.innerHTML = '';
            slot.style.display = 'none';
            return;
        }

        slot.style.display = 'flex';
        slot.style.justifyContent = 'center';
        slot.style.alignItems = 'center';
        slot.style.margin = '8px 0 14px 0';
        slot.style.width = '100%';
        slot.style.minHeight = '50px';
        slot.style.overflow = 'hidden';

        if (code.includes('<script') || code.includes('atOptions') || code.includes('invoke.js')) {
            const iframe = document.createElement('iframe');
            iframe.style.border = 'none';
            iframe.style.width = '100%';
            iframe.style.maxWidth = '320px';
            iframe.style.height = '60px';
            iframe.style.overflow = 'hidden';
            iframe.scrolling = 'no';
            slot.innerHTML = '';
            slot.appendChild(iframe);

            try {
                const doc = iframe.contentWindow.document;
                doc.open();
                doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;background:transparent;overflow:hidden;}</style></head><body>${code}</body></html>`);
                doc.close();
            } catch (e) {
                slot.innerHTML = code;
            }
        } else {
            slot.innerHTML = code;
        }
    }

    // ----------------- LOCAL STORAGE STATE MANAGER -----------------
    getDiamonds() {
        const val = localStorage.getItem('FD_DIAMONDS');
        return val ? parseInt(val, 10) : 0;
    }

    setDiamonds(amount) {
        localStorage.setItem('FD_DIAMONDS', amount);
        const coinEl = document.getElementById('user-coins');
        if (coinEl) {
            coinEl.innerText = amount;
            coinEl.parentElement.classList.add('pulse-anim');
            setTimeout(() => coinEl.parentElement.classList.remove('pulse-anim'), 600);
        }
    }

    addDiamonds(amount) {
        const current = this.getDiamonds();
        const updated = current + amount;
        this.setDiamonds(updated);
        return updated;
    }

    deductDiamonds(amount) {
        const current = this.getDiamonds();
        if (current >= amount) {
            const updated = current - amount;
            this.setDiamonds(updated);
            return true;
        }
        return false;
    }

    getCompletedTasks() {
        try {
            const val = localStorage.getItem('FD_COMPLETED_TASKS');
            return val ? JSON.parse(val) : {};
        } catch (e) {
            return {};
        }
    }

    setCompletedTask(taskId) {
        const tasks = this.getCompletedTasks();
        tasks[taskId] = Date.now();
        localStorage.setItem('FD_COMPLETED_TASKS', JSON.stringify(tasks));
    }

    checkDailyReset() {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastReset = localStorage.getItem('FD_LAST_RESET');
        if (lastReset !== todayStr) {
            localStorage.setItem('FD_COMPLETED_TASKS', JSON.stringify({}));
            localStorage.setItem('FD_LAST_RESET', todayStr);
        }
    }

    getSavedUid() {
        return localStorage.getItem('FD_SAVED_UID') || '';
    }

    setSavedUid(uid) {
        localStorage.setItem('FD_SAVED_UID', uid);
    }

    getLocalHistory() {
        try {
            const val = localStorage.getItem('FD_HISTORY');
            return val ? JSON.parse(val) : [];
        } catch (e) {
            return [];
        }
    }

    saveLocalHistory(entry) {
        const history = this.getLocalHistory();
        history.unshift(entry);
        localStorage.setItem('FD_HISTORY', JSON.stringify(history));
    }

    restoreSavedUid() {
        const savedUid = this.getSavedUid();
        if (savedUid) {
            const uidInput = document.getElementById('ff-uid');
            if (uidInput) uidInput.value = savedUid;
        }
    }

    // ----------------- UI RENDERING -----------------
    renderUI() {
        // Update wallet
        const diamonds = this.getDiamonds();
        const coinEl = document.getElementById('user-coins');
        if (coinEl) coinEl.innerText = diamonds;

        // Render missions
        this.renderMissions();

        // Render redemption history
        this.renderHistory();
    }

    renderMissions() {
        const container = document.getElementById('links-container');
        if (!container) return;

        const completedTasks = this.getCompletedTasks();
        const completedCount = Object.keys(completedTasks).length;
        const totalCount = this.dailyMissions.length;

        // Update banner badge (e.g. 0/5 DONE)
        const bannerPoints = document.getElementById('banner-points');
        if (bannerPoints) bannerPoints.innerText = `${completedCount}/${totalCount} DONE`;

        container.innerHTML = '';

        this.dailyMissions.forEach(m => {
            const isDone = !!completedTasks[m.id];
            const rewardAmt = m.reward || 5;

            const card = document.createElement('div');
            card.className = `link-card ${isDone ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="link-info">
                    <div class="link-icon-box" style="${isDone ? 'border-color: #00e676;' : ''}">
                        <img src="diamond.png" alt="Diamond" width="22" height="22" loading="lazy" style="width: 22px; height: 22px;">
                    </div>
                    <div class="link-details">
                        <h3>${m.title}</h3>
                        <p style="color: ${isDone ? '#00e676' : 'var(--accent-gold)'}; font-weight: 700;">
                            ${isDone ? '<i class="fa-solid fa-circle-check"></i> Completed' : `Reward: +${rewardAmt} Diamonds`}
                        </p>
                    </div>
                </div>
                ${!isDone ? `
                    <button class="btn-primary" onclick="app.startDailyMission(${m.id})">
                        VISIT LINK
                    </button>
                ` : `
                    <button class="btn-primary" style="background: rgba(0,230,118,0.15); color: #00e676; border: 1px solid rgba(0,230,118,0.3);" disabled>
                        <i class="fa-solid fa-check"></i> DONE
                    </button>
                `}
            `;
            container.appendChild(card);
        });
    }

    renderHistory() {
        const container = document.getElementById('history-container');
        if (!container) return;

        const history = this.getLocalHistory();
        if (history.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 15px;">No redemptions yet. Complete missions to earn diamonds!</div>`;
            return;
        }

        container.innerHTML = '';
        history.forEach(h => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 10px; margin-bottom: 8px; font-size: 0.82rem;';
            item.innerHTML = `
                <div>
                    <div style="font-weight: 700; color: #fff;">UID: ${h.uid}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${h.date}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 800; color: var(--accent-cyan);">${h.diamonds} 💎</div>
                    <span style="font-size: 0.7rem; color: var(--accent-gold); font-weight: 700;">PENDING</span>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // ----------------- TAB SWITCHING -----------------
    switchAppTab(tabId, btnElem) {
        document.querySelectorAll('.app-tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.main-nav-tabs .tab-btn').forEach(el => el.classList.remove('active'));

        const targetPane = document.getElementById(tabId);
        if (targetPane) targetPane.classList.add('active');

        if (btnElem) {
            btnElem.classList.add('active');
        } else {
            const defaultBtn = tabId === 'tab-missions' ? document.getElementById('btn-tab-missions') : document.getElementById('btn-tab-redeem');
            if (defaultBtn) defaultBtn.classList.add('active');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ----------------- DAILY MISSIONS TASK LOGIC -----------------
    startDailyMission(missionId) {
        const mission = this.dailyMissions.find(m => m.id === missionId);
        if (!mission) return;

        const completed = this.getCompletedTasks();
        if (completed[missionId]) {
            this.showToast('TASK COMPLETED', 'You have already completed this mission today!', 'info');
            return;
        }

        this.activeVisitTask = mission;
        this.countdownSeconds = 15;

        // Open target direct ad URL in new tab
        try {
            window.open(mission.url, '_blank');
        } catch (e) {}

        // Show floating countdown overlay
        const overlay = document.getElementById('daily-visit-timer-overlay');
        const countdownEl = document.getElementById('daily-visit-countdown');
        const actionBox = document.getElementById('daily-visit-action-box');
        const resumeBox = document.getElementById('daily-visit-resume-box');
        const claimBtn = document.getElementById('claim-reward-btn');

        if (claimBtn) {
            claimBtn.innerText = `CLAIM +${mission.reward || 5} DIAMONDS`;
        }

        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }
        if (countdownEl) countdownEl.innerText = `${this.countdownSeconds}s`;
        if (actionBox) actionBox.style.display = 'none';
        if (resumeBox) resumeBox.style.display = 'none';

        clearInterval(this.visitTimerInterval);
        this.visitTimerInterval = setInterval(() => {
            this.countdownSeconds--;
            if (countdownEl) countdownEl.innerText = `${this.countdownSeconds}s`;

            if (this.countdownSeconds <= 0) {
                clearInterval(this.visitTimerInterval);
                if (countdownEl) countdownEl.innerText = 'READY!';
                if (actionBox) actionBox.style.display = 'block';
            }
        }, 1000);
    }

    claimActiveVisitReward() {
        if (!this.activeVisitTask) return;

        clearInterval(this.visitTimerInterval);
        const mission = this.activeVisitTask;
        const reward = mission.reward || 5;

        this.setCompletedTask(mission.id);
        this.addDiamonds(reward);

        // Close overlay
        const overlay = document.getElementById('daily-visit-timer-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.add('hidden');
        }

        this.showToast('DIAMONDS EARNED!', `+${reward} Diamonds added to your wallet!`, 'success');
        this.activeVisitTask = null;
        this.renderMissions();
    }

    resumeDailyVisit() {
        if (this.activeVisitTask) {
            window.open(this.activeVisitTask.url, '_blank');
        }
    }

    // ----------------- REDEEM & STRICT FIRESTORE SUBMISSION -----------------
    async selectPackage(cardElem, diamondAmount, cost) {
        const uidInput = document.getElementById('ff-uid');
        const playerUid = uidInput ? uidInput.value.trim() : '';

        if (!playerUid) {
            this.showToast('UID REQUIRED', 'Please enter your Free Fire Player UID first!', 'error');
            if (uidInput) {
                uidInput.focus();
                uidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        if (playerUid.length < 6 || !/^\d+$/.test(playerUid)) {
            this.showToast('INVALID UID', 'Please enter a valid numeric Free Fire UID (min 6 digits).', 'error');
            if (uidInput) uidInput.focus();
            return;
        }

        const currentDiamonds = this.getDiamonds();
        if (currentDiamonds < cost) {
            this.showToast(
                'INSUFFICIENT DIAMONDS',
                `You have ${currentDiamonds} / ${cost} diamonds. Complete daily missions to earn more!`,
                'error'
            );
            return;
        }

        this.setSavedUid(playerUid);

        const loader = document.getElementById('global-loader');
        if (loader) loader.classList.remove('hidden');

        try {
            // STRICT PAYLOAD: ONLY { uid, diamonds }
            if (this.db) {
                await this.db.collection("redemptions").add({
                    uid: String(playerUid),
                    diamonds: Number(diamondAmount)
                });
            }

            // Deduct coins locally
            this.deductDiamonds(cost);

            // Save to local redemption history
            this.saveLocalHistory({
                uid: playerUid,
                diamonds: diamondAmount,
                date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            });

            if (loader) loader.classList.add('hidden');
            this.renderHistory();

            document.getElementById('modal-amount').innerText = `${diamondAmount} 💎`;
            document.getElementById('modal-uid').innerText = playerUid;

            const redeemModal = document.getElementById('redeem-modal');
            if (redeemModal) redeemModal.classList.remove('hidden');

        } catch (error) {
            if (loader) loader.classList.add('hidden');
            console.error("Firestore redemption error:", error);
            this.deductDiamonds(cost);
            this.saveLocalHistory({
                uid: playerUid,
                diamonds: diamondAmount,
                date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            });
            this.renderHistory();
            document.getElementById('modal-amount').innerText = `${diamondAmount} 💎`;
            document.getElementById('modal-uid').innerText = playerUid;
            const redeemModal = document.getElementById('redeem-modal');
            if (redeemModal) redeemModal.classList.remove('hidden');
        }
    }

    closeRedeemModal() {
        const modal = document.getElementById('redeem-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ----------------- TOAST NOTIFICATIONS -----------------
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <div>
                <strong>${title}</strong>
                <p style="margin: 2px 0 0 0; font-size: 0.78rem; opacity: 0.9;">${message}</p>
            </div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ----------------- TIMERS & TICKERS -----------------
    startDailyResetTimer() {
        const timerEl = document.getElementById('daily-timer-title');
        if (!timerEl) return;

        const updateTimer = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
            const diff = tomorrow - now;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            timerEl.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    }

    startLiveProofsTicker() {
        const ticker = document.getElementById('proofs-ticker');
        if (!ticker) return;

        const sampleUids = [
            '284918294', '593810291', '109284719', '892719204', '391029481',
            '719284019', '401928471', '601928472', '301928491', '901827491'
        ];
        const sampleAmounts = [520, 1060, 520, 2180, 520, 1060, 5600];

        const generateItem = () => {
            const uid = sampleUids[Math.floor(Math.random() * sampleUids.length)];
            const maskedUid = uid.slice(0, 3) + '***' + uid.slice(-2);
            const amt = sampleAmounts[Math.floor(Math.random() * sampleAmounts.length)];
            const mins = Math.floor(Math.random() * 8) + 1;

            const item = document.createElement('div');
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(0, 242, 254, 0.04); border: 1px solid rgba(0, 242, 254, 0.12); padding: 8px 12px; border-radius: 8px; font-size: 0.76rem; animation: fadeIn 0.4s ease;';
            item.innerHTML = `
                <div>
                    <span style="color: #fff; font-weight: 700;">UID: ${maskedUid}</span>
                    <span style="color: var(--accent-cyan); margin-left: 6px;">+${amt} 💎</span>
                </div>
                <span style="color: var(--text-muted); font-size: 0.7rem;">${mins}m ago</span>
            `;

            ticker.prepend(item);
            if (ticker.children.length > 5) {
                ticker.lastElementChild.remove();
            }
        };

        for (let i = 0; i < 3; i++) generateItem();
        setInterval(generateItem, 6000);
    }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FreeDiamondApp();
});
