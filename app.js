/**
 * CLASH FIRE - Core Application Script
 * Live Firebase Firestore Sync, Direct Diamond Engine, Referral System, Offerwall & Gamezop Integrations, Dedicated Official Community Engine, Dynamic Popunder & Dual Banner Engine
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
            dailyLinkCompletedCount: 0,
            completedLinks: {},
            redemptionHistory: [],
            lastResetDate: new Date().toISOString().split('T')[0],
            referredBy: null,
            referralClaimed: false,
            referredDevices: [],
            completedDailyVisits: {}
        };
        this.globalSettings = {
            linkReward: 5,
            referralCommissionPercent: 10
        };
        this.integrations = {
            gamezopUrl: "https://www.gamezop.com",
            gamezopReward: 5,
            gamezopEnabled: false,
            bannerHtmlCode: '',
            bannerMiddleHtmlCode: '',
            bannerBottomHtmlCode: '',
            bannerEnabled: false,
            popunderHtmlCode: '',
            popunderEnabled: false,
            sponsorTitle: 'Join Our Channel',
            sponsorReward: 10,
            sponsorUrl: 'https://t.me',
            sponsorBtnText: 'JOIN NOW',
            sponsorIcon: 'telegram',
            sponsorEnabled: false
        };
        this.dailyVisit = {
            enabled: false,
            items: []
        };
        this.db = null;
        this.firestoreActive = false;
        this.dvHasReturned = false;
        this.userListenerUnsubscribe = null;

        // Dynamic Mission Tasks Array (1-indexed task IDs)
        this.dailyLinks = [
            { id: 0, taskId: 1, title: "Daily Mission Supply #1", url: "https://www.freediamond.in/verify?task=1" },
            { id: 1, taskId: 2, title: "Daily Mission Elite #2", url: "https://www.freediamond.in/verify?task=2" },
            { id: 2, taskId: 3, title: "Daily Mission Vault #3", url: "https://www.freediamond.in/verify?task=3" },
            { id: 3, taskId: 4, title: "Daily Mission Armor #4", url: "https://www.freediamond.in/verify?task=4" },
            { id: 4, taskId: 5, title: "Daily Mission Heroic #5", url: "https://www.freediamond.in/verify?task=5" }
        ];

        this.init();
    }

    async init() {
        window.name = 'ClashFireDashboard';
        this.initFirebase();
        // Auto-capture referral code from URL into sessionStorage immediately
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const refParam = urlParams.get('ref');
            if (refParam) {
                sessionStorage.setItem('CF_PENDING_REF', refParam.trim());
            }
        } catch(e){}

        // Listen for Firebase Auth state changes
        if (this.firestoreActive) {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.deviceId = user.uid;
                    localStorage.setItem('CLASH_LOGGED_IN', 'true');
                    
                    // Show logout button in header
                    const logoutBtn = document.getElementById('btn-logout');
                    if (logoutBtn) logoutBtn.classList.remove('hidden');

                    // Hide auth form section on homepage
                    const authSection = document.getElementById('auth-section');
                    if (authSection) authSection.classList.add('hidden');

                    // Load user data securely
                    await this.loadUserProfile();
                    await this.checkReferralBonus();
                } else {
                    this.deviceId = null;
                    this.user = { coins: 0, completedLinks: {}, dailyLinkCompletedCount: 0 };
                    localStorage.removeItem('CLASH_LOGGED_IN');
                    localStorage.removeItem('CLASH_LAST_FF_UID');
                    localStorage.removeItem('CLASH_LAST_COINS');
                    
                    // Hide logout button in header
                    const logoutBtn = document.getElementById('btn-logout');
                    if (logoutBtn) logoutBtn.classList.add('hidden');

                    // Show auth form section on homepage
                    const authSection = document.getElementById('auth-section');
                    if (authSection) authSection.classList.remove('hidden');

                    const devElem = document.getElementById('display-device-id');
                    if (devElem) devElem.innerText = "UID: Not Logged In";

                    this.renderDashboard();
                }

                // Execute delayed tab switching now that auth status is finalized
                if (this.pendingTab) {
                    this.switchAppTab(this.pendingTab);
                    this.pendingTab = null;
                }
            });
        } else {
            const devElem = document.getElementById('display-device-id');
            if (devElem) devElem.innerText = "UID: Database Offline";
        }

        this.renderDashboard(); // Render static constructor links immediately (no spinner lag)
        this.startCountdownTimer();
        this.startLiveProofsTicker();
        this.protectAppFromInspect();

        // Read URL query parameter to support direct landing on specific tab (delayed until auth state load completes)
        const urlParams = new URLSearchParams(window.location.search);
        const activeTab = urlParams.get('tab');
        if (activeTab === 'tasks' || activeTab === 'redeem') {
            this.pendingTab = 'tab-' + activeTab;
        }

        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && this.deviceId) {
                await this.loadUserProfile();
                this.renderDashboard();
            }
        });
    }

    switchAppTab(tabId, btnElem) {
        // Logged-out user tab redirection block with scroll-to-focus on login card
        if (!this.deviceId && (tabId === 'tab-tasks' || tabId === 'tab-redeem')) {
            this.showToast('AUTHENTICATION REQUIRED', 'Enter your Free Fire UID and PIN to continue.', 'error');
            const authSection = document.getElementById('auth-section');
            if (authSection) {
                authSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    const uidInput = document.getElementById('auth-ff-uid');
                    if (uidInput) uidInput.focus();
                }, 500);
            }
            return;
        }

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

        // Set Dynamic Pretty URLs inside Address bar on tab navigation
        if (tabId === 'tab-home') {
            window.history.pushState({}, '', '/');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    initFirebase() {
        try {
            if (typeof firebase !== 'undefined' && firebase.initializeApp) {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.firestore();
                this.auth = firebase.auth();
                this.functions = firebase.functions();
                this.firestoreActive = true;
            }
        } catch (e) { console.warn("Firebase Init Error: ", e.message); this.firestoreActive = false; }
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
                        if (linksData.items && Array.isArray(linksData.items)) {
                            this.dailyLinks = linksData.items.map((item, i) => ({
                                id: i,
                                taskId: item.taskId || (i + 1),
                                title: item.title || (`Daily Mission #${i+1}`),
                                url: item.url
                            }));
                        } else if (linksData.urls && Array.isArray(linksData.urls)) {
                            this.dailyLinks = linksData.urls.map((u, i) => ({
                                id: i,
                                taskId: i + 1,
                                title: `Daily Mission Supply #${i+1}`,
                                url: u
                            }));
                        }
                        this.renderDashboard();
                    }
                });

                this.db.collection("settings").doc("integrations").onSnapshot(doc => {
                    if (doc.exists) {
                        this.integrations = { ...this.integrations, ...doc.data() };
                        this.renderDashboard();
                    }
                });
                this.db.collection("settings").doc("dailyvisit").onSnapshot(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        this.dailyVisit.enabled = (data.enabled === true || data.enabled === 'true');
                        if (data.items && Array.isArray(data.items)) {
                            this.dailyVisit.items = data.items;
                        } else if (data.url) {
                            this.dailyVisit.items = [{ id: 0, taskId: 1, title: "Daily Visit Task #1", url: data.url, duration: data.duration || 15, reward: data.reward || 10 }];
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

    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 50;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            
            // Draw shapes and colors to trigger hardware rendering paths
            ctx.fillStyle = '#f60';
            ctx.fillRect(10, 10, 100, 30);
            ctx.fillStyle = '#069';
            ctx.font = '16px "Outfit", Arial';
            ctx.textBaseline = 'top';
            ctx.fillText('ClashFire_HW_2026', 15, 12);
            
            // Draw a subtle transparent overlay to catch subpixel differences
            ctx.fillStyle = 'rgba(102, 204, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(60, 25, 15, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();
            
            const dataUrl = canvas.toDataURL();
            let hash = 0;
            for (let i = 0; i < dataUrl.length; i++) {
                const char = dataUrl.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            return Math.abs(hash).toString(16);
        } catch (e) {
            return '';
        }
    }

    async getOrCreateMultiLayerDeviceID() {
        let savedId = this.getCookie('CLASH_PERMANENT_HW_ID') || localStorage.getItem('CLASH_FIRE_HW_ID');
        if (savedId) {
            this.setCookie('CLASH_PERMANENT_HW_ID', savedId);
            localStorage.setItem('CLASH_FIRE_HW_ID', savedId);
            return savedId;
        }

        // Generate hybrid fingerprint (Canvas signature + Screen details + CPU + Timezone offset)
        // This persists across incognito mode / browser clearing on the same device
        const ratio = window.devicePixelRatio || 1;
        const physW = Math.round((window.screen.width || 360) * ratio);
        const physH = Math.round((window.screen.height || 640) * ratio);
        const cpus = navigator.hardwareConcurrency || 4;
        const tz = new Date().getTimezoneOffset();
        const depth = window.screen.colorDepth || 24;
        
        const canvasHash = this.getCanvasFingerprint();
        const rawString = `DISP:${physW}x${physH}x${ratio}||CPU:${cpus}||TZ:${tz}||DEPTH:${depth}||CANVAS:${canvasHash}`;
        
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

    async getSecureServerDate() {
        try {
            const res2 = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata');
            const data2 = await res2.json();
            if (data2 && data2.date) {
                const parts = data2.date.split('/');
                if (parts.length === 3) {
                    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                }
            }
        } catch (e) {
            try {
                const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Kolkata');
                const data = await res.json();
                if (data && data.datetime) {
                    return data.datetime.split('T')[0];
                }
            } catch (err) {}
        }
        // Secure Fallback: Local system UTC offset transformed to IST (+5:30)
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const istTime = new Date(utc + (3600000 * 5.5));
        return istTime.toISOString().split('T')[0];
    }

    async getUserStateLocation() {
        try {
            const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                if (data && data.region) {
                    return `${data.region}, ${data.country_code || 'IN'}`;
                }
            }
        } catch(e) {
            try {
                const res2 = await fetch("https://ip-api.com/json/?fields=regionName,countryCode", { signal: AbortSignal.timeout(3000) });
                if (res2.ok) {
                    const data2 = await res2.json();
                    if (data2 && data2.regionName) {
                        return `${data2.regionName}, ${data2.countryCode || 'IN'}`;
                    }
                }
            } catch(e2){}
        }
        return "Unknown";
    }

    async loadUserProfile() {
        // Step 1: Instantly read local cache to make sure UI gets updated instantly (0ms delay)
        const savedCache = localStorage.getItem('CLASH_USER_DATA_' + this.deviceId);
        if (savedCache) {
            try {
                this.user = { ...this.user, ...JSON.parse(savedCache) };
                if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
                if (!this.user.completedLinks || Array.isArray(this.user.completedLinks)) this.user.completedLinks = {};
                if (!this.user.referredDevices) this.user.referredDevices = [];
                if (!this.user.completedDailyVisits || Array.isArray(this.user.completedDailyVisits)) this.user.completedDailyVisits = {};
                this.renderDashboard();
            } catch(e){}
        }

        const today = await this.getSecureServerDate();

        if (this.firestoreActive) {
            try {
                const docRef = this.db.collection("accounts").doc(this.deviceId);
                
                // Unsubscribe from any active listener first to prevent duplication leaks
                if (this.userListenerUnsubscribe) {
                    this.userListenerUnsubscribe();
                }

                // Realtime subscription for instant dashboard updates
                this.userListenerUnsubscribe = docRef.onSnapshot(async doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        this.user = { ...this.user, ...data };
                        
                        this.displayUserId = data.ffUid;
                        if (this.displayUserId) {
                            localStorage.setItem('CLASH_LAST_FF_UID', this.displayUserId);
                        }
                        const devElem = document.getElementById('display-device-id');
                        if (devElem) devElem.innerText = "UID: " + (this.displayUserId || '');

                        if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
                        if (!this.user.completedLinks || Array.isArray(this.user.completedLinks)) this.user.completedLinks = {};
                        if (!this.user.referredDevices) this.user.referredDevices = [];
                        // Auto-populate missing state location for old existing users on next visit
                        if (!data.state || data.state === 'Unknown') {
                            this.getUserStateLocation().then(st => {
                                if (st && st !== 'Unknown') {
                                    docRef.update({ state: st }).catch(() => {});
                                }
                            });
                        }
                        
                        // Check date reset logic inside snapshot (applied locally for UI freshness)
                        if (this.user.lastResetDate !== today) {
                            this.user.dailyLinkCompletedCount = 0;
                            this.user.completedLinks = {};
                            this.user.completedDailyVisits = {};
                        }
                        
                        const formattedCoins = this.formatCoins(this.user.coins);
                        localStorage.setItem('CLASH_LAST_COINS', formattedCoins);
                        localStorage.setItem('CLASH_USER_DATA_' + this.deviceId, JSON.stringify(this.user));
                        this.renderDashboard();
                        await this.claimPendingReferralCommissions();
                    } else {
                        console.warn("Account document not found yet. Waiting for profile initialization...");
                    }
                });
                return;
            } catch (err) { console.error(err); }
        }

        const saved = localStorage.getItem('CLASH_USER_DATA_' + this.deviceId);
        if (saved) {
            this.user = { ...this.user, ...JSON.parse(saved) };
            if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
            if (!this.user.completedLinks || Array.isArray(this.user.completedLinks)) this.user.completedLinks = {};
            if (!this.user.referredDevices) this.user.referredDevices = [];
            if (!this.user.completedDailyVisits || Array.isArray(this.user.completedDailyVisits)) this.user.completedDailyVisits = {};
            if (this.user.lastResetDate !== today) {
                this.user.dailyLinkCompletedCount = 0;
                this.user.completedLinks = {};
                this.user.completedDailyVisits = {};
                this.user.lastResetDate = today;
                this.saveUserProfile();
            }
        } else {
            this.saveUserProfile();
        }
    }

    async claimPendingReferralCommissions() {
        if (!this.firestoreActive || !this.deviceId || !this.displayUserId) return;

        try {
            const today = await this.getSecureServerDate();
            // Query for all referees who joined using my displayUserId (referredBy == displayUserId)
            const snapshot = await this.db.collection("accounts").where("referredBy", "==", this.displayUserId).get();
            if (snapshot.empty) return;

            let totalRequiredMissions = 5;
            try {
                const linksDoc = await this.db.collection("settings").doc("links").get();
                if (linksDoc.exists && linksDoc.data().items && Array.isArray(linksDoc.data().items)) {
                    totalRequiredMissions = linksDoc.data().items.length;
                }
            } catch(e){}

            let commissionToClaim = 0;
            const updatedClaimedMap = { ...(this.user.claimedReferralCommissions || {}) };
            let claimedAny = false;

            snapshot.forEach(doc => {
                const refData = doc.data();
                const refId = doc.id;

                // Check if this referee has completed all links today
                const refereeResetDate = refData.lastResetDate;
                const completedCount = Object.keys(refData.completedLinks || {}).length;

                if (refereeResetDate === today && completedCount >= totalRequiredMissions) {
                    const claimKey = `${refId}_${today}`;
                    if (!updatedClaimedMap[claimKey]) {
                        let commPercent = 10;
                        try {
                            if (this.globalSettings && this.globalSettings.referralCommissionPercent !== undefined) {
                                commPercent = parseInt(this.globalSettings.referralCommissionPercent);
                            }
                        } catch(e){}

                        const totalDailyMissionsReward = totalRequiredMissions * 5; // Reward per link is 5
                        const commissionCoins = parseFloat((totalDailyMissionsReward * (commPercent / 100)).toFixed(2));
                        
                        if (commissionCoins > 0) {
                            commissionToClaim += commissionCoins;
                            updatedClaimedMap[claimKey] = true;
                            claimedAny = true;
                        }
                    }
                }
            });

            if (claimedAny && commissionToClaim > 0) {
                const myAccountRef = this.db.collection("accounts").doc(this.deviceId);
                await this.db.runTransaction(async (transaction) => {
                    const mySnap = await transaction.get(myAccountRef);
                    if (!mySnap.exists) return;
                    
                    const currentCoins = parseFloat(mySnap.data().coins || 0);
                    const newCoins = parseFloat((currentCoins + commissionToClaim).toFixed(2));

                    transaction.update(myAccountRef, {
                        coins: newCoins,
                        claimedReferralCommissions: updatedClaimedMap
                    });
                });

                this.showToast('REFERRAL COMMISSION!', `+${commissionToClaim} Diamonds claimed from referred friends!`, 'success');
            }
        } catch (err) {
            console.error("Error claiming referral commissions:", err);
        }
    }

    async checkReferralBonus() {
        const urlParams = new URLSearchParams(window.location.search);
        let refCode = urlParams.get('ref') || sessionStorage.getItem('CF_PENDING_REF');
        if (refCode) refCode = refCode.trim();
        
        if (!refCode || refCode === this.displayUserId) return;

        if (!this.firestoreActive || !this.deviceId) return;

        try {
            const myDocRef = this.db.collection("accounts").doc(this.deviceId);
            const myDoc = await myDocRef.get();

            // 1. Strictly block if this user has already claimed a referral or has been referred previously
            if (myDoc.exists) {
                const myData = myDoc.data();
                if (myData.referralClaimed === true || myData.referredBy) {
                    return; // Strictly block repeat referral!
                }
            }

            if (localStorage.getItem('REFERRAL_PROCESSED_' + this.deviceId)) {
                return;
            }

            // 2. Query Firestore directly to check if referrer exists by their ffUid
            const snapshot = await this.db.collection("accounts").where("ffUid", "==", refCode).limit(1).get();
            if (snapshot.empty) {
                return; // Referrer doesn't exist
            }

            const referrerDoc = snapshot.docs[0];
            if (referrerDoc.id === this.deviceId) {
                return; // Block self-referral
            }

            // 3. Update only my own document (referredBy = refCode). Referrer will read referees on login.
            this.user.referralClaimed = true;
            this.user.referredBy = refCode;

            await myDocRef.update({
                referralClaimed: true,
                referredBy: refCode
            });

            localStorage.setItem('REFERRAL_PROCESSED_' + this.deviceId, 'true');
            this.showToast('WELCOME TO FREEDIAMOND.IN', `Joined via referral link from ${refCode}!`, 'info');
        } catch(e) { console.error("Referral Sync Error:", e); }
    }

    async saveUserProfile(skipRemote = false) {
        localStorage.setItem('CLASH_USER_DATA_' + this.deviceId, JSON.stringify(this.user));
        if (this.firestoreActive && !skipRemote && this.deviceId) {
            try {
                await this.db.collection("accounts").doc(this.deviceId).set(this.user, { merge: true });
            } catch (err) { console.error("Error saving profile remote:", err); }
        }
    }

    formatCoins(coins) {
        if (typeof coins !== 'number') coins = parseInt(coins || '0');
        if (coins <= 9999) return coins.toLocaleString('en-US'); // Format with thousands comma below 9,999 (e.g. 5,600)
        
        // Format to 1 decimal place if fractional (e.g., 12500 -> 12.5K)
        const formatted = (coins / 1000).toFixed(1);
        return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'K' : formatted + 'K';
    }

    renderDashboard() {
        document.getElementById('user-coins').innerText = this.formatCoins(this.user.coins);
        const totalLinks = this.dailyLinks ? this.dailyLinks.length : 0;
        const bannerPointsElem = document.getElementById('banner-points');
        if (bannerPointsElem) {
            bannerPointsElem.innerText = `${this.user.dailyLinkCompletedCount}/${totalLinks} DONE`;
        }

        // Render Dynamic Unlimited Daily Visit Tasks
        const dvSection = document.getElementById('daily-visit-section');
        const dvContainer = document.getElementById('daily-visit-container');
        if (dvContainer && dvSection) {
            const isDvEnabled = (this.dailyVisit && (this.dailyVisit.enabled === true || this.dailyVisit.enabled === 'true'));
            const hasItems = this.dailyVisit && this.dailyVisit.items && this.dailyVisit.items.length > 0;
            if (isDvEnabled && hasItems) {
                dvSection.style.display = 'block';
                dvContainer.innerHTML = '';

                this.dailyVisit.items.forEach((item, index) => {
                    const taskId = item.taskId || (index + 1);
                    const isCompleted = this.user.completedDailyVisits && this.user.completedDailyVisits[taskId] === true;
                    
                    const card = document.createElement('div');
                    card.className = 'link-card';
                    card.style.marginBottom = '10px';
                    if (isCompleted) {
                        card.style.background = 'rgba(255, 255, 255, 0.02)';
                        card.style.border = '1px solid rgba(255, 255, 255, 0.03)';
                    } else {
                        card.style.background = 'linear-gradient(135deg, rgba(255, 69, 0, 0.08), rgba(255, 215, 0, 0.08))';
                        card.style.border = '1.5px solid rgba(255, 69, 0, 0.25)';
                    }

                    const btnStyle = isCompleted 
                        ? 'background: linear-gradient(135deg, #1e293b, #0f172a); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.05);' 
                        : 'background: linear-gradient(135deg, var(--primary-fire), #ff1744); color: white; border: none;';
                    
                    const btnText = isCompleted ? 'COMPLETED' : 'START VISIT';
                    const btnDisabled = isCompleted ? 'disabled' : '';

                    card.innerHTML = `
                        <div class="link-info">
                            <div class="link-icon-box" style="background: ${isCompleted ? 'rgba(255,255,255,0.03)' : 'rgba(255, 69, 0, 0.15)'}; color: ${isCompleted ? 'var(--text-muted)' : 'var(--primary-fire)'};">
                                <i class="fa-solid fa-calendar-check"></i>
                            </div>
                            <div class="link-details">
                                <h3>${item.title || 'Daily Visit Task #' + taskId}</h3>
                                <p style="color: ${isCompleted ? 'var(--text-muted)' : 'var(--accent-gold)'};">Wait ${item.duration || 15}s = +${item.reward || 10} Diamonds</p>
                            </div>
                        </div>
                        <button class="btn-primary" style="${btnStyle}" ${btnDisabled} onclick="app.startDailyVisit(${index})" aria-label="Start ${item.title || 'Daily Visit Task #' + taskId}">${btnText}</button>
                    `;
                    dvContainer.appendChild(card);
                });
            } else {
                dvSection.style.display = 'none';
            }
        }

        // Render Referral Statistics Dynamically
        const refPercent = (this.globalSettings.referralCommissionPercent || 10);

        const countElem = document.getElementById('ref-stat-count');
        const rewardElem = document.getElementById('ref-stat-reward');
        if (countElem) countElem.innerText = (this.user.referredDevices || []).length;
        if (rewardElem) rewardElem.innerText = refPercent + "% Rate";

        // Query Firestore live count of referred users
        if (this.firestoreActive && this.displayUserId) {
            this.db.collection("accounts").where("referredBy", "==", this.displayUserId).get().then(snap => {
                const liveCount = snap.size;
                if (countElem) countElem.innerText = liveCount;
            }).catch(()=>{});
        }

        const gzLabel = document.getElementById('gamezop-reward-label');
        if (gzLabel) gzLabel.innerText = `Play 3 Mins = +${this.integrations.gamezopReward || 5} Diamonds`;

        const gzStation = document.getElementById('gamezop-station');
        if (gzStation) {
            const isGzOn = (this.integrations.gamezopEnabled === true || this.integrations.gamezopEnabled === 'true');
            gzStation.style.display = isGzOn ? 'block' : 'none';
        }

        const commStation = document.getElementById('community-station');
        if (commStation) {
            const isCommOn = (this.integrations.sponsorEnabled === true || this.integrations.sponsorEnabled === 'true');
            commStation.style.display = isCommOn ? 'block' : 'none';
            
            const titleElem = document.getElementById('sponsor-task-title');
            if (titleElem) titleElem.innerText = this.integrations.sponsorTitle || 'Join Our Channel';
            
            const descElem = document.getElementById('sponsor-task-desc');
            if (descElem) descElem.innerText = `Join to claim +${this.integrations.sponsorReward || 10} Diamonds`;

            const btnElem = document.getElementById('sponsor-btn-action');
            if (btnElem) btnElem.innerText = this.integrations.sponsorBtnText || 'JOIN NOW';

            // Dynamic Platform Icon Rendering (YouTube 🔴 / Telegram ✈️ / Web 🌐)
            const iconBox = document.getElementById('sponsor-icon-box');
            const iconElem = document.getElementById('sponsor-icon-elem');
            const platform = this.integrations.sponsorIcon || 'telegram';

            if (iconBox && iconElem) {
                if (platform === 'youtube') {
                    iconBox.style.background = 'rgba(255, 0, 0, 0.15)';
                    iconBox.style.color = '#ff0000';
                    iconElem.className = 'fa-brands fa-youtube';
                } else if (platform === 'telegram') {
                    iconBox.style.background = 'rgba(0, 136, 204, 0.15)';
                    iconBox.style.color = '#0088cc';
                    iconElem.className = 'fa-solid fa-paper-plane';
                } else if (platform === 'globe') {
                    iconBox.style.background = 'rgba(0, 242, 254, 0.15)';
                    iconBox.style.color = 'var(--accent-cyan)';
                    iconElem.className = 'fa-solid fa-globe';
                } else {
                    iconBox.style.background = 'rgba(255, 69, 0, 0.15)';
                    iconBox.style.color = 'var(--primary-fire)';
                    iconElem.className = 'fa-solid fa-star';
                }
            }
        }

        // Dynamically inject Global Header Script (Monetag In-Page Push, Anti-Adblock, Header Scripts)
        const headerCode = (this.globalSettings.adScriptHeader || '').trim();
        let existingHeader = document.getElementById('cf-global-header-script');
        if (headerCode) {
            if (!existingHeader || existingHeader.dataset.code !== headerCode) {
                if (existingHeader) existingHeader.remove();

                const holder = document.createElement('div');
                holder.id = 'cf-global-header-script';
                holder.dataset.code = headerCode;
                holder.style.display = 'none';
                holder.innerHTML = headerCode;
                document.head.appendChild(holder);

                const scripts = holder.getElementsByTagName('script');
                if (scripts.length > 0) {
                    Array.from(scripts).forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        if (oldScript.src) newScript.src = oldScript.src;
                        if (oldScript.textContent) newScript.textContent = oldScript.textContent;
                        document.head.appendChild(newScript);
                    });
                } else {
                    const newScript = document.createElement('script');
                    newScript.textContent = headerCode;
                    document.head.appendChild(newScript);
                }
            }
        } else if (existingHeader) {
            existingHeader.remove();
        }

        // Dynamically inject Global Footer Script
        const footerCode = (this.globalSettings.adScriptFooter || '').trim();
        let existingFooter = document.getElementById('cf-global-footer-script');
        if (footerCode) {
            if (!existingFooter || existingFooter.dataset.code !== footerCode) {
                if (existingFooter) existingFooter.remove();

                const holder = document.createElement('div');
                holder.id = 'cf-global-footer-script';
                holder.dataset.code = footerCode;
                holder.style.display = 'none';
                holder.innerHTML = footerCode;
                document.body.appendChild(holder);

                const scripts = holder.getElementsByTagName('script');
                if (scripts.length > 0) {
                    Array.from(scripts).forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        if (oldScript.src) newScript.src = oldScript.src;
                        if (oldScript.textContent) newScript.textContent = oldScript.textContent;
                        document.body.appendChild(newScript);
                    });
                } else {
                    const newScript = document.createElement('script');
                    newScript.textContent = footerCode;
                    document.body.appendChild(newScript);
                }
            }
        } else if (existingFooter) {
            existingFooter.remove();
        }

        // Render Independent Top, Middle and Bottom Native Banner Ad Slots with Direct Native Execution
        const topSlot = document.getElementById('banner-ad-top');
        const midHomeSlot = document.getElementById('banner-ad-middle');
        const midRedeemSlot = document.getElementById('banner-ad-redeem-middle');
        const botSlot = document.getElementById('banner-ad-bottom');
        const isBannerOn = (this.integrations.bannerEnabled === true || this.integrations.bannerEnabled === 'true');

        if (isBannerOn) {
            if (topSlot && this.integrations.bannerHtmlCode) {
                topSlot.classList.remove('hidden');
                this.executeNativeAdScript(topSlot, this.integrations.bannerHtmlCode, 'top');
            } else if (topSlot) {
                topSlot.classList.add('hidden'); topSlot.innerHTML = '';
            }

            const midCode = this.integrations.bannerMiddleHtmlCode;
            if (midHomeSlot && midCode) {
                midHomeSlot.classList.remove('hidden');
                this.executeNativeAdScript(midHomeSlot, midCode, 'mid-home');
            } else if (midHomeSlot) {
                midHomeSlot.classList.add('hidden'); midHomeSlot.innerHTML = '';
            }

            if (midRedeemSlot && midCode) {
                midRedeemSlot.classList.remove('hidden');
                this.executeNativeAdScript(midRedeemSlot, midCode, 'mid-redeem');
            } else if (midRedeemSlot) {
                midRedeemSlot.classList.add('hidden'); midRedeemSlot.innerHTML = '';
            }

            const botCode = this.integrations.bannerBottomHtmlCode;
            if (botSlot && botCode) {
                botSlot.classList.remove('hidden');
                this.executeNativeAdScript(botSlot, botCode, 'bottom');
            } else if (botSlot) {
                botSlot.classList.add('hidden'); botSlot.innerHTML = '';
            }
        } else {
            if (topSlot) { topSlot.classList.add('hidden'); topSlot.innerHTML = ''; }
            if (midHomeSlot) { midHomeSlot.classList.add('hidden'); midHomeSlot.innerHTML = ''; }
            if (midRedeemSlot) { midRedeemSlot.classList.add('hidden'); midRedeemSlot.innerHTML = ''; }
            if (botSlot) { botSlot.classList.add('hidden'); botSlot.innerHTML = ''; }
        }

        if (this.user.ffUid) {
            const ffUidElem = document.getElementById('ff-uid');
            if (ffUidElem) {
                ffUidElem.value = this.user.ffUid;
                ffUidElem.readOnly = true;
                ffUidElem.disabled = true;
            }
        }

        // Dynamically inject Global Popunder script if enabled
        const popunderEnabled = (this.globalSettings.adScriptPopunderEnabled !== false && this.globalSettings.adScriptPopunderEnabled !== 'false');
        const popScriptCode = (this.globalSettings.adScriptPopunder || '').trim();
        let existingPop = document.getElementById('cf-global-popunder-script');

        if (popunderEnabled && popScriptCode) {
            if (!existingPop || existingPop.dataset.code !== popScriptCode) {
                if (existingPop) existingPop.remove();

                const holder = document.createElement('div');
                holder.id = 'cf-global-popunder-script';
                holder.dataset.code = popScriptCode;
                holder.style.display = 'none';
                holder.innerHTML = popScriptCode;
                document.body.appendChild(holder);

                const scripts = holder.getElementsByTagName('script');
                if (scripts.length > 0) {
                    Array.from(scripts).forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        if (oldScript.src) newScript.src = oldScript.src;
                        if (oldScript.textContent) newScript.textContent = oldScript.textContent;
                        document.head.appendChild(newScript);
                    });
                } else {
                    const newScript = document.createElement('script');
                    newScript.textContent = popScriptCode;
                    document.head.appendChild(newScript);
                }

                // Dispatch synthetic load event so async loaded Popunder script binds click listeners!
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    try {
                        window.dispatchEvent(new Event('DOMContentLoaded'));
                        window.dispatchEvent(new Event('load'));
                    } catch(e){}
                }
            }
        } else if (!popunderEnabled && existingPop) {
            existingPop.remove();
        }

        const refInput = document.getElementById('referral-link-input');
        if (refInput && this.displayUserId) {
            // Force clean root origin path to prevent appending subpaths like /free-fire-free-diamonds-2026
            refInput.value = `${window.location.origin}/?ref=${this.displayUserId}`;
        }

        const linksContainer = document.getElementById('links-container');
        linksContainer.innerHTML = '';

        const linkRewardAmt = this.globalSettings.linkReward || 5;

        if (this.dailyLinks && this.dailyLinks.length > 0) {
            this.dailyLinks.forEach((link, idx) => {
                const taskId = link.taskId || (idx + 1);
                const isDone = this.user.completedLinks && this.user.completedLinks[taskId];
                const card = document.createElement('div');
                card.className = `link-card ${isDone ? 'completed' : ''}`;
                card.innerHTML = `
                    <div class="link-info">
                        <div class="link-icon-box">
                            ${isDone ? '<i class="fa-solid fa-check"></i>' : '<img src="diamond.png" alt="Diamond Icon" style="width: 22px; height: 22px;">'}
                        </div>
                        <div class="link-details">
                            <h3>${link.title || ('Daily Mission #' + taskId)}</h3>
                            <p>Reward: +${linkRewardAmt} Diamonds</p>
                        </div>
                    </div>
                    <button class="btn-primary" ${isDone ? 'disabled' : ''} onclick="app.executeLinkTask(${idx})" aria-label="Visit and Complete ${link.title || ('Daily Mission #' + taskId)}">
                        ${isDone ? 'CLAIMED' : 'VISIT LINK'}
                    </button>
                `;
                linksContainer.appendChild(card);
            });
        } else {
            linksContainer.innerHTML = `<div style="text-align:center; color: var(--text-muted); padding: 15px;">No active missions right now. Check back soon!</div>`;
        }

        this.renderRedeemHistory();
    }

    openSponsorChannel() {
        const url = this.integrations.sponsorUrl || "https://t.me";
        window.open(url, '_blank', 'noopener,noreferrer');
        this.showToast('COMMUNITY LAUNCHED', 'Welcome to our official community!', 'success');
    }
    executeNativeAdScript(containerElement, rawHtmlCode, slotTag = 'slot') {
        if (!containerElement || !rawHtmlCode || !rawHtmlCode.trim()) return;
        
        const trimmedCode = rawHtmlCode.trim();
        if (containerElement.getAttribute('data-ad-code-hash') === trimmedCode) {
            return;
        }

        containerElement.setAttribute('data-ad-code-hash', trimmedCode);
        containerElement.setAttribute('data-ad-loaded', 'true');
        containerElement.innerHTML = trimmedCode;
        containerElement.style.height = 'auto';

        const scripts = containerElement.getElementsByTagName('script');
        Array.from(scripts).forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            if (oldScript.src) {
                newScript.src = oldScript.src;
            }
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
            if (oldScript.parentNode) {
                oldScript.parentNode.replaceChild(newScript, oldScript);
            }
        });
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

    launchGamezop() {
        const url = this.integrations.gamezopUrl || "https://www.gamezop.com";
        window.open(url, '_blank', 'noopener,noreferrer');
        this.showToast('GAMEZOP LAUNCHED', 'Play games for active entertainment!', 'success');
    }

    async selectPackage(cardElem, diamondAmount, costPoints) {
        if (!this.deviceId) {
            this.showToast('AUTHENTICATION REQUIRED', 'Please login first to redeem rewards.', 'error');
            return;
        }

        const uidInput = document.getElementById('ff-uid').value.trim();
        
        // Strict Free Fire UID Validation: Must be between 7 and 13 digits
        if (!uidInput || uidInput.length < 7 || uidInput.length > 13) {
            this.showToast('VALIDATION ERROR', 'Player UID must be between 7 and 13 digits!', 'error');
            document.getElementById('ff-uid').focus();
            return;
        }

        if (this.user.coins < costPoints) {
            this.showToast('INSUFFICIENT BALANCE', `You need ${costPoints} Diamonds to redeem ${diamondAmount} Diamonds!`, 'error');
            return;
        }

        if (!this.firestoreActive) {
            this.showToast('OFFLINE ERROR', 'Database service is offline. Please check your network and try again.', 'error');
            return;
        }

        this.showLoader(`PROCESSING ${diamondAmount} DIAMONDS PAYOUT...`);

        // Double-Click / Race Condition Protection
        const allRedeemBtns = document.querySelectorAll('.packages-grid button, .packages-grid .package-card');
        allRedeemBtns.forEach(elem => {
            if (elem.tagName === 'BUTTON') elem.disabled = true;
            elem.style.pointerEvents = 'none';
        });

        setTimeout(async () => {
            try {
                const myAccountRef = this.db.collection("accounts").doc(this.deviceId);
                const redemptionRef = this.db.collection("redemptions").doc();

                await this.db.runTransaction(async (transaction) => {
                    const mySnap = await transaction.get(myAccountRef);
                    if (!mySnap.exists) {
                        throw new Error("User account not found.");
                    }

                    const currentCoins = parseFloat(mySnap.data().coins || 0);
                    if (currentCoins < costPoints) {
                        throw new Error("Insufficient balance.");
                    }

                    const newCoins = parseFloat((currentCoins - costPoints).toFixed(2));

                    // 1. Deduct cost from account document
                    transaction.update(myAccountRef, {
                        coins: newCoins
                    });

                    // 2. Create the redemption request document
                    transaction.set(redemptionRef, {
                        accountId: this.deviceId,
                        ffUid: uidInput,
                        diamonds: diamondAmount,
                        cost: costPoints,
                        status: "pending",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                // Success!
                document.getElementById('modal-amount').innerText = `${diamondAmount} Diamonds`;
                document.getElementById('modal-uid').innerText = uidInput;
                document.getElementById('redeem-modal').classList.remove('hidden');
            } catch (e) {
                console.error("Redemption transaction failed:", e);
                this.showToast('REDEMPTION FAILED', e.message || 'Database error occurred. Please try again!', 'error');
            }

            this.hideLoader();

            // Re-enable click actions
            allRedeemBtns.forEach(elem => {
                if (elem.tagName === 'BUTTON') elem.disabled = false;
                elem.style.pointerEvents = 'auto';
            });
        }, 1500);
    }

    copyReferralLink() {
        const refInput = document.getElementById('referral-link-input');
        if (refInput) {
            refInput.select();
            refInput.setSelectionRange(0, 99999); // Mobile compatibility highlight selection range
            
            try {
                navigator.clipboard.writeText(refInput.value);
            } catch(err) {
                // Secondary fallback copy trigger
                document.execCommand('copy');
            }
            
            this.showToast('COPIED!', 'Referral link copied to clipboard!', 'success');
        }
    }

    shareNative() {
        const refLink = `${window.location.origin}/?ref=${this.displayUserId}`;
        const shareData = {
            title: 'FreeDiamond.in - Free Diamonds',
            text: `🔥 Play FreeDiamond.in & earn FREE Free Fire Diamonds daily! Join using my link:`,
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

            const timerElem = document.getElementById('daily-timer-title');
            if (timerElem) {
                timerElem.innerText = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
            }
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
            toast.style.transform = 'translateY(20px)';
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


    startDailyVisit(index) {
        const item = this.dailyVisit.items[index];
        if (!item) return;

        const taskId = item.taskId || (index + 1);
        const isCompleted = this.user.completedDailyVisits && this.user.completedDailyVisits[taskId] === true;

        if (isCompleted) {
            this.showToast('ALREADY COMPLETED', 'You have already completed this visit task today!', 'info');
            return;
        }

        this.activeVisitIndex = index;
        this.dvHasReturned = false; // Reset tab return state

        const overlay = document.getElementById('daily-visit-timer-overlay');
        const countdownVal = document.getElementById('daily-visit-countdown');
        const actionBox = document.getElementById('daily-visit-action-box');
        const warningText = document.getElementById('dv-warning-text');
        const overlayTitle = document.getElementById('dv-overlay-title');
        const resumeBox = document.getElementById('daily-visit-resume-box');

        if (overlay && countdownVal && actionBox && warningText && overlayTitle) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');

            actionBox.style.display = 'none';
            if (resumeBox) resumeBox.style.display = 'none';
            warningText.style.display = 'block';
            overlayTitle.innerText = "WAITING FOR VISIT";

            if (this.dvTimerId) clearInterval(this.dvTimerId);
            this.dvSecondsLeft = parseInt(item.duration || 15);
            countdownVal.innerText = this.dvSecondsLeft + "s";

            // Format target URL to ensure absolute protocol matching
            let targetUrl = item.url || window.location.origin;
            if (!/^https?:\/\//i.test(targetUrl)) {
                targetUrl = "https://" + targetUrl;
            }

            window.open(targetUrl, '_blank');
            this.showToast('VISIT STARTED', 'Stay on the visited tab and wait for countdown!', 'info');

            this.dvTimerId = setInterval(() => {
                const rBox = document.getElementById('daily-visit-resume-box');
                
                if (document.hidden) {
                    if (this.dvHasReturned) {
                        // User minimized app or is in background but needs to resume explicitly via continue button
                        overlayTitle.innerText = "⏱️ TIMER PAUSED";
                        warningText.innerText = "Timer is paused! Click the CONTINUE VISIT button to resume counting down.";
                        warningText.style.color = "#ff1744";
                        countdownVal.innerText = `PAUSED (${this.dvSecondsLeft}s)`;
                        if (rBox) rBox.style.display = 'block';
                    } else {
                        // User is actively browsing the target tab - resume countdown
                        overlayTitle.innerText = "WAITING FOR VISIT";
                        warningText.innerText = "Please view the opened webpage. Your reward will unlock soon.";
                        warningText.style.color = "var(--text-muted)";
                        if (rBox) rBox.style.display = 'none';

                        this.dvSecondsLeft--;
                        countdownVal.innerText = this.dvSecondsLeft + "s";

                        if (this.dvSecondsLeft <= 0) {
                            clearInterval(this.dvTimerId);
                            this.dvTimerId = null;
                            countdownVal.innerText = "✓ READY";
                            overlayTitle.innerText = "VISIT COMPLETED!";
                            warningText.style.display = 'none';
                            actionBox.style.display = 'block';
                            if (rBox) rBox.style.display = 'none';
                        }
                    }
                } else {
                    // User returned early to freediamond.in tab - pause timer and warn
                    this.dvHasReturned = true; // Set return lock
                    overlayTitle.innerText = "⏱️ TIMER PAUSED";
                    warningText.innerText = "You returned too early! Click the CONTINUE VISIT button to resume the timer.";
                    warningText.style.color = "#ff1744";
                    countdownVal.innerText = `PAUSED (${this.dvSecondsLeft}s)`;
                    if (rBox) rBox.style.display = 'block';
                }
            }, 1000);
        }
    }

    resumeDailyVisit() {
        const index = this.activeVisitIndex;
        if (index === null || index === undefined) return;

        const item = this.dailyVisit.items[index];
        if (!item) return;

        this.dvHasReturned = false; // Reset lock to false so it can decrement
        
        let targetUrl = item.url || window.location.origin;
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = "https://" + targetUrl;
        }

        window.open(targetUrl, '_blank');
        this.showToast('VISIT RESUMED', 'Timer resumed! Stay on the sponsor page.', 'info');
    }

    async claimActiveVisitReward() {
        const index = this.activeVisitIndex;
        if (index === null || index === undefined) return;

        const item = this.dailyVisit.items[index];
        if (!item) return;

        const taskId = item.taskId || (index + 1);
        const reward = parseInt(item.reward || 10);

        if (!this.user.completedDailyVisits) this.user.completedDailyVisits = {};
        this.user.completedDailyVisits[taskId] = true;
        this.user.coins += reward;

        await this.saveUserProfile();
        this.renderDashboard();

        const overlay = document.getElementById('daily-visit-timer-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.classList.add('hidden');
                overlay.style.opacity = '1';
            }, 300);
        }

        this.activeVisitIndex = null;
        this.showToast('REWARD CLAIMED!', `+${reward} Diamonds credited successfully!`, 'success');
    }

    executeLinkTask(idx) {
        const link = this.dailyLinks[idx];
        if (!link) return;

        const taskId = link.taskId || (idx + 1);
        const isDone = this.user.completedLinks && this.user.completedLinks[taskId];
        if (isDone) {
            this.showToast('ALREADY COMPLETED', 'You have already completed this mission today!', 'info');
            return;
        }

        // Write dynamic verification token
        const token = {
            time: Date.now(),
            authorized: true
        };
        localStorage.setItem("CF_ACTIVE_TOKEN_TASK_" + taskId, JSON.stringify(token));

        // Open the admin-configured sponsor shortener URL directly in a new tab.
        let targetUrl = link.url || (window.location.origin + "/verify?task=" + taskId);
        if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
            targetUrl = "https://" + targetUrl;
        }
        window.open(targetUrl, '_blank');
        this.showToast('MISSION STARTED', 'Please complete the shortener link to verify and claim diamonds!', 'info');
    }

    startLiveProofsTicker() {
        const tickerContainer = document.getElementById('proofs-ticker');
        if (!tickerContainer) return;

        // Seeded random number generator (Sine LCG)
        const getSeededRandom = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        const generateProofForSeed = (seedVal) => {
            // Generate deterministic user ID
            const userIdNum = Math.floor(1000 + getSeededRandom(seedVal + 1) * 9000);
            const userDisplayId = `CF-****${userIdNum}`;
            
            // Generate deterministic FF UID
            const ffUidPart1 = Math.floor(10 + getSeededRandom(seedVal + 2) * 90);
            const ffUidPart2 = Math.floor(10 + getSeededRandom(seedVal + 3) * 90);
            const ffUidDisplay = `${ffUidPart1}****${ffUidPart2}`;
            
            // Probabilistic selection among the active package options (520, 1060, 2180, 5600)
            const otherPackages = ["520 Diamonds", "1060 Diamonds", "2180 Diamonds", "5600 Diamonds"];
            const idx = Math.floor(getSeededRandom(seedVal + 5) * otherPackages.length);
            let diamondPackage = otherPackages[idx];

            // 70% probability SENT, 30% PENDING
            const isSent = getSeededRandom(seedVal + 6) < 0.7;
            const badgeStyle = isSent 
                ? 'background: rgba(0, 230, 118, 0.15); color: #00e676;' 
                : 'background: rgba(255, 145, 0, 0.15); color: #ff9100;';
            const badgeText = isSent 
                ? '<i class="fa-solid fa-circle-check"></i> SENT' 
                : '<i class="fa-solid fa-clock"></i> PENDING';

            // Create item HTML
            const proofItem = document.createElement('div');
            proofItem.className = 'proof-item';
            proofItem.innerHTML = `
                <div class="proof-user-info">
                    <span class="proof-user-id"><i class="fa-solid fa-user-check" style="color: var(--accent-cyan);"></i> ${userDisplayId}</span>
                    <span class="proof-uid">FF UID: ${ffUidDisplay}</span>
                </div>
                <div class="proof-details">
                    <span class="proof-amount">💎 ${diamondPackage}</span>
                    <span class="proof-badge" style="${badgeStyle}">${badgeText}</span>
                </div>
            `;
            return proofItem;
        };

        let lastT = 0;
        const updateTicker = () => {
            // Determine active time block (changes every 15 seconds globally)
            const T = Math.floor(Date.now() / 15000);
            if (T === lastT) return;
            lastT = T;

            // Seed initial state if empty
            if (tickerContainer.children.length === 0) {
                for (let i = 1; i >= 0; i--) {
                    const item = generateProofForSeed(T - i);
                    tickerContainer.appendChild(item);
                }
            } else {
                // Add the newest item at the top with slide-in animation
                const newestItem = generateProofForSeed(T);
                tickerContainer.insertBefore(newestItem, tickerContainer.firstChild);

                // Remove the oldest item
                while (tickerContainer.children.length > 2) {
                    tickerContainer.removeChild(tickerContainer.lastChild);
                }
            }
        };

        // Render immediately
        updateTicker();

        // Check and sync every second
        setInterval(updateTicker, 1000);
    }

    protectAppFromInspect() {
        // Disable Right Click
        document.addEventListener('contextmenu', e => e.preventDefault());

        // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        document.addEventListener('keydown', e => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
                (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
                (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
            ) {
                e.preventDefault();
                return false;
            }
        });
    }

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // Show loading spinner
    showLoader(message) {
        const loader = document.getElementById('global-loader');
        const loaderMsg = document.getElementById('loader-message');
        if (loader) {
            if (loaderMsg && message) loaderMsg.innerText = message;
            loader.classList.remove('hidden');
        }
    }

    // Hide loading spinner
    hideLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) loader.classList.add('hidden');
    }

    // PIN Recovery handlers
    showPinRecovery(event) {
        if (event) event.preventDefault();
        this.showToast('FORGOT PIN?', 'If you forgot your PIN, please contact support through the "Contact Us" form at the bottom of the page.', 'info');
    }

    // Login/Signup handlers
    async handleAuthSubmit(event) {
        if (event) event.preventDefault();

        const ffUid = document.getElementById('auth-ff-uid').value.trim();
        const pin = document.getElementById('auth-pin').value.trim();

        if (!/^\d{7,13}$/.test(ffUid)) {
            this.showToast('INVALID UID', 'UID must be a number between 7 and 13 digits.', 'error');
            return;
        }
        if (!/^\d{6}$/.test(pin)) {
            this.showToast('INVALID PIN', 'PIN must be exactly 6 digits.', 'error');
            return;
        }

        // Brute force check (client-side lock)
        const attemptsKey = 'CF_FAILED_ATTEMPTS_' + ffUid;
        const lockKey = 'CF_LOCKED_UNTIL_' + ffUid;
        const now = Date.now();
        const lockedUntil = parseInt(localStorage.getItem(lockKey) || '0');
        if (lockedUntil > now) {
            const minsLeft = Math.ceil((lockedUntil - now) / 60000);
            this.showToast('TOO MANY ATTEMPTS', `Account locked. Try again in ${minsLeft} minutes.`, 'error');
            return;
        }

        const submitBtn = document.getElementById('auth-submit-btn');
        if (submitBtn) submitBtn.disabled = true;
        this.showLoader("AUTHENTICATING...");

        try {
            const hashedUid = await this.sha256(ffUid);
            const bindingRef = this.db.collection("ffUidBindings").doc(hashedUid);
            const bindingDoc = await bindingRef.get();

            if (bindingDoc.exists) {
                // === LOGIN EXISTING ===
                const virtualEmail = `${ffUid}@clashfire.in`;
                const virtualPassword = `clash_pin_${pin}`;

                try {
                    await this.auth.signInWithEmailAndPassword(virtualEmail, virtualPassword);

                    // Success: Clear failed attempts
                    localStorage.removeItem(attemptsKey);
                    localStorage.removeItem(lockKey);
                    
                    this.showToast('WELCOME BACK!', `Logged in successfully as UID ${ffUid}`, 'success');
                } catch (signInErr) {
                    let failed = parseInt(localStorage.getItem(attemptsKey) || '0') + 1;
                    localStorage.setItem(attemptsKey, failed);
                    if (failed >= 5) {
                        localStorage.setItem(lockKey, Date.now() + 15 * 60000);
                        this.showToast('ACCOUNT LOCKED', 'Too many failed attempts. Locked for 15 minutes.', 'error');
                    } else {
                        this.showToast('AUTH FAILED', 'UID or PIN is incorrect.', 'error');
                    }
                    this.hideLoader();
                    if (submitBtn) submitBtn.disabled = false;
                    return;
                }
            } else {
                // === SIGNUP NEW ===
                const virtualEmail = `${ffUid}@clashfire.in`;
                const virtualPassword = `clash_pin_${pin}`;

                let userCredential;
                let isAlreadyInUse = false;

                try {
                    userCredential = await this.auth.createUserWithEmailAndPassword(virtualEmail, virtualPassword);
                } catch (signUpErr) {
                    if (signUpErr.code === 'auth/email-already-in-use') {
                        try {
                            userCredential = await this.auth.signInWithEmailAndPassword(virtualEmail, virtualPassword);
                            isAlreadyInUse = true;
                        } catch (signInErr) {
                            throw new Error("UID or PIN is incorrect.");
                        }
                    } else {
                        throw signUpErr;
                    }
                }

                const uid = userCredential.user.uid;
                const accountDoc = await this.db.collection("accounts").doc(uid).get();

                const pinHash = dcodeIO.bcrypt.hashSync(pin, 10);

                const today = await this.getSecureServerDate();
                const userState = await this.getUserStateLocation();

                // Capture pending referral code from URL or sessionStorage
                let validatedRefCode = null;
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    let targetRef = urlParams.get('ref') || sessionStorage.getItem('CF_PENDING_REF');
                    if (targetRef && targetRef.trim() !== ffUid) {
                        targetRef = targetRef.trim();
                        const refSnap = await this.db.collection("accounts").where("ffUid", "==", targetRef).limit(1).get();
                        if (!refSnap.empty) {
                            validatedRefCode = targetRef;
                        }
                    }
                } catch(e){}

                const newAccount = {
                    ffUid: ffUid,
                    email: virtualEmail,
                    pinHash: pinHash,
                    state: userState,
                    coins: 0,
                    completedLinks: {},
                    dailyLinkCompletedCount: 0,
                    redemptionHistory: [],
                    referredBy: validatedRefCode,
                    referralClaimed: validatedRefCode ? true : false,
                    referredDevices: [],
                    completedDailyVisits: {},
                    lastResetDate: today,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                    ...(accountDoc.exists ? accountDoc.data() : {})
                };
                if (accountDoc.exists) {
                    newAccount.state = userState;
                }

                // Check and perform 1-time migration of legacy profile if available
                if (!accountDoc.exists) {
                    const legacyId = this.getLegacyFingerprintID();
                    const legacyRef = this.db.collection("users").doc(legacyId);
                    const legacySnap = await legacyRef.get();
                    if (legacySnap.exists) {
                        const legacyData = legacySnap.data();
                        if (!legacyData.migrated) {
                            newAccount.coins = parseFloat(legacyData.coins || 0);
                            newAccount.completedLinks = legacyData.completedLinks || {};
                            newAccount.dailyLinkCompletedCount = parseInt(legacyData.dailyLinkCompletedCount || 0);
                            newAccount.redemptionHistory = legacyData.redemptionHistory || [];
                            newAccount.referredBy = legacyData.referredBy || null;
                            newAccount.referredDevices = legacyData.referredDevices || [];
                            newAccount.completedDailyVisits = legacyData.completedDailyVisits || {};
                            newAccount.lastResetDate = legacyData.lastResetDate || null;
                            
                            await legacyRef.update({
                                migrated: true,
                                status: "disabled",
                                migratedTo: uid
                            });
                        }
                    }
                }

                // Write new account and binding
                const batch = this.db.batch();
                batch.set(this.db.collection("accounts").doc(uid), newAccount);
                if (!bindingDoc.exists) {
                    batch.set(bindingRef, { accountId: uid });
                }
                await batch.commit();

                if (isAlreadyInUse && accountDoc.exists) {
                    this.showToast('WELCOME BACK!', `Logged in successfully as UID ${ffUid}`, 'success');
                } else {
                    this.showToast('ACCOUNT CREATED!', 'Your account has been created successfully!', 'success');
                }
            }
        } catch (err) {
            console.error("Auth failed:", err);
            this.showToast('AUTH FAILED', err.message || 'UID or PIN is incorrect.', 'error');
        }

        this.hideLoader();
        if (submitBtn) submitBtn.disabled = false;
    }

    async handleLogout() {
        try {
            this.showLoader("LOGGING OUT...");
            await this.auth.signOut();
            localStorage.removeItem('CLASH_USER_DATA_' + this.deviceId);
            this.showToast('LOGGED OUT', 'You have been logged out successfully.', 'info');
        } catch(e) {
            console.error("Logout error:", e);
        }
        this.hideLoader();
    }

    getLegacyFingerprintID() {
        let savedId = this.getCookie('CLASH_PERMANENT_HW_ID') || localStorage.getItem('CLASH_FIRE_HW_ID');
        if (savedId && savedId.startsWith('CLASH_HW_') && savedId.length < 25) {
            return savedId;
        }
        
        let hardwareTokens = [];
        const ratio = window.devicePixelRatio || 1;
        const physW = Math.round((window.screen.width || 360) * ratio);
        const physH = Math.round((window.screen.height || 640) * ratio);
        hardwareTokens.push(`PHYS_DISP:${physW}x${physH}x${ratio}`);

        const cpus = navigator.hardwareConcurrency || 4;
        hardwareTokens.push(`CPU_CORES:${cpus}`);

        const tz = new Date().getTimezoneOffset();
        const depth = window.screen.colorDepth || 24;
        hardwareTokens.push(`TZ:${tz}_DEPTH:${depth}`);

        const rawString = hardwareTokens.join('||');
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            const char = rawString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return `CLASH_HW_${Math.abs(hash)}`;
    }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new ClashFireApp();
});
