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
            toroxUrl: localStorage.getItem('CF_CACHE_TOROX_URL') || "https://torox.io",
            toroxEnabled: true,
            gamezopUrl: "https://www.gamezop.com",
            gamezopReward: 5,
            gamezopEnabled: true,
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
            sponsorEnabled: true,
            cpxAppId: '34050',
            cpxSecureHash: 'ucHVQYc5kg6SooA56Z2sQBl12wkU61T4',
            cpxEnabled: false
        };
        this.dailyVisit = {
            items: [
                { id: 0, taskId: 1, title: "Daily Visit Task #1", url: "https://ffire.xyz", duration: 15, reward: 10 }
            ]
        };
        this.db = null;
        this.firestoreActive = false;
        this.dvHasReturned = false;

        // Dynamic Mission Tasks Array (1-indexed task IDs)
        this.dailyLinks = [
            { id: 0, taskId: 1, title: "Daily Mission Supply #1", url: "https://ffire.xyz/verify.html?task=1" },
            { id: 1, taskId: 2, title: "Daily Mission Elite #2", url: "https://ffire.xyz/verify.html?task=2" },
            { id: 2, taskId: 3, title: "Daily Mission Vault #3", url: "https://ffire.xyz/verify.html?task=3" },
            { id: 3, taskId: 4, title: "Daily Mission Armor #4", url: "https://ffire.xyz/verify.html?task=4" },
            { id: 4, taskId: 5, title: "Daily Mission Heroic #5", url: "https://ffire.xyz/verify.html?task=5" }
        ];

        this.init();
    }

    async init() {
        this.renderDashboard(); // Render static constructor links immediately (no spinner lag)
        this.start3SecPageLoader();
        this.initFirebase();
        
        this.deviceId = await this.getOrCreateMultiLayerDeviceID();
        this.displayUserId = "CF-" + this.deviceId.substring(9, 15);
        
        const devElem = document.getElementById('display-device-id');
        if (devElem) devElem.innerText = "User ID: " + this.displayUserId;

        await this.loadGlobalSettings();
        await this.loadUserProfile();
        await this.checkReferralBonus();
        await this.checkSurveyReward();


        this.renderDashboard();
        this.startCountdownTimer();
        this.startLiveProofsTicker();
        this.protectAppFromInspect();
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
        const duration = 1000; // 1-second ultra-fast loading

        const interval = setInterval(() => {
            let elapsed = Date.now() - startTime;
            let percent = Math.min(100, (elapsed / duration) * 100);
            fill.style.width = percent + '%';

            if (elapsed >= duration) {
                clearInterval(interval);
                overlay.style.opacity = '0';
                setTimeout(() => overlay.classList.add('hidden'), 300);
            }
        }, 20);
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
                        if (this.integrations.toroxUrl) {
                            localStorage.setItem('CF_CACHE_TOROX_URL', this.integrations.toroxUrl);
                        }
                        this.renderDashboard();
                    }
                });
                this.db.collection("settings").doc("dailyvisit").onSnapshot(doc => {
                    if (doc.exists) {
                        const data = doc.data();
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

    async getOrCreateMultiLayerDeviceID() {
        let savedId = this.getCookie('CLASH_PERMANENT_HW_ID') || localStorage.getItem('CLASH_FIRE_HW_ID');
        if (savedId) {
            this.setCookie('CLASH_PERMANENT_HW_ID', savedId);
            localStorage.setItem('CLASH_FIRE_HW_ID', savedId);
            return savedId;
        }

        let hardwareTokens = [];
        // 1. Physical Screen Pixels (Width & Height scaled by devicePixelRatio)
        const ratio = window.devicePixelRatio || 1;
        const physW = Math.round((window.screen.width || 360) * ratio);
        const physH = Math.round((window.screen.height || 640) * ratio);
        hardwareTokens.push(`PHYS_DISP:${physW}x${physH}x${ratio}`);

        // 2. Physical CPU Concurrency Cores
        const cpus = navigator.hardwareConcurrency || 4;
        hardwareTokens.push(`CPU_CORES:${cpus}`);

        // 3. Physical Timezone Offset & Color Depth
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
                    this.user = { ...this.user, ...doc.data() };
                    if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
                    if (!this.user.completedLinks || Array.isArray(this.user.completedLinks)) this.user.completedLinks = {};
                    if (!this.user.referredDevices) this.user.referredDevices = [];
                    if (!this.user.completedDailyVisits || Array.isArray(this.user.completedDailyVisits)) this.user.completedDailyVisits = {};
                    if (this.user.lastResetDate !== today) {
                        this.user.dailyLinkCompletedCount = 0;
                        this.user.completedLinks = {};
                        this.user.completedDailyVisits = {};
                        this.user.lastResetDate = today;
                        await docRef.update({
                            dailyLinkCompletedCount: 0,
                            completedLinks: {},
                            completedDailyVisits: {},
                            lastResetDate: today
                        });
                    }
                } else {
                    this.user.lastResetDate = today;
                    this.user.redemptionHistory = [];
                    this.user.completedLinks = {};
                    await docRef.set(this.user);
                }
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

    async checkReferralBonus() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (!refCode || refCode === this.displayUserId) return;

        if (!this.firestoreActive) return;

        try {
            const myDocRef = this.db.collection("users").doc(this.deviceId);
            const myDoc = await myDocRef.get();

            // 1. Strictly block if this device has already claimed a referral or has been referred previously
            if (myDoc.exists) {
                const myData = myDoc.data();
                if (myData.referralClaimed === true || myData.referredBy) {
                    return; // Strictly block repeat referral!
                }
            }

            if (localStorage.getItem('REFERRAL_PROCESSED_' + this.deviceId)) {
                return;
            }

            // 2. Synchronous iteration over users to find referrer and check array
            const snapshot = await this.db.collection("users").get();
            let referrerDocRef = null;
            let referrerData = null;
            let referrerDeviceId = null;

            for (const doc of snapshot.docs) {
                const displayId = "CF-" + doc.id.substring(9, 15);
                if (displayId === refCode && doc.id !== this.deviceId) {
                    referrerDocRef = doc.ref;
                    referrerData = doc.data();
                    referrerDeviceId = doc.id;
                    break;
                }
            }

            if (referrerDocRef && referrerData) {
                // Check Cross-Referral / Mutual Loop: If my device has already referred this referrer, BLOCK!
                const myReferredDevices = (myDoc.exists && myDoc.data().referredDevices) ? myDoc.data().referredDevices : [];
                if (myReferredDevices.includes(referrerDeviceId) || referrerData.referredBy === this.displayUserId) {
                    return; // Strictly block mutual cross-referral loop!
                }

                const referredDevices = referrerData.referredDevices || [];
                
                // 3. Check if my device ID is already in referrer's referredDevices array
                if (referredDevices.includes(this.deviceId)) {
                    return; // Hard-blocked! Already referred by this user.
                }

                referredDevices.push(this.deviceId);

                // 4. Update referrer referredDevices array in Firestore
                await referrerDocRef.update({
                    referredDevices: referredDevices
                });

                // 5. Permanently lock my own device profile in Firestore as referred
                this.user.referralClaimed = true;
                this.user.referredBy = refCode;

                await myDocRef.set({
                    referralClaimed: true,
                    referredBy: refCode
                }, { merge: true });

                localStorage.setItem('REFERRAL_PROCESSED_' + this.deviceId, 'true');
                this.showToast('WELCOME TO FFIRE.XYZ', `Joined via referral link from ${refCode}!`, 'info');
            }
        } catch(e) { console.error("Referral Sync Error:", e); }
    }

    async checkSurveyReward() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('survey_success') === 'true') {
            const rewardPoints = parseInt(urlParams.get('reward') || '0');
            if (rewardPoints > 0) {
                const txId = urlParams.get('tx_id') || 'survey_' + Date.now();
                
                // Anti-Double Reward: check if this transaction was already processed
                if (localStorage.getItem('CF_SURVEY_TX_' + txId)) return;

                this.user.coins += rewardPoints;
                await this.saveUserProfile();
                localStorage.setItem('CF_SURVEY_TX_' + txId, 'true');
                
                // Clear URL parameters silently
                window.history.replaceState({}, document.title, window.location.pathname);
                this.showToast('SURVEY COMPLETED!', `+${rewardPoints} Diamonds credited successfully!`, 'success');
            }
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
        const totalLinks = this.dailyLinks ? this.dailyLinks.length : 0;
        document.getElementById('completed-links-badge').innerText = `${this.user.dailyLinkCompletedCount}/${totalLinks} DONE`;

        // Render Dynamic Unlimited Daily Visit Tasks
        const dvSection = document.getElementById('daily-visit-section');
        const dvContainer = document.getElementById('daily-visit-container');
        if (dvContainer && dvSection) {
            const hasItems = this.dailyVisit && this.dailyVisit.items && this.dailyVisit.items.length > 0;
            if (hasItems) {
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
                                <h4>${item.title || 'Daily Visit Task #' + taskId}</h4>
                                <p style="color: ${isCompleted ? 'var(--text-muted)' : 'var(--accent-gold)'};">Wait ${item.duration || 15}s = +${item.reward || 10} Diamonds</p>
                            </div>
                        </div>
                        <button class="btn-primary" style="${btnStyle}" ${btnDisabled} onclick="app.startDailyVisit(${index})">${btnText}</button>
                    `;
                    dvContainer.appendChild(card);
                });
            } else {
                dvSection.style.display = 'none';
            }
        }

        // Render Referral Statistics Dynamically
        const refCount = (this.user.referredDevices || []).length;
        const refPercent = (this.globalSettings.referralCommissionPercent || 10);

        const countElem = document.getElementById('ref-stat-count');
        const rewardElem = document.getElementById('ref-stat-reward');
        if (countElem) countElem.innerText = refCount;
        if (rewardElem) rewardElem.innerText = refPercent + "% Rate";

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

        const cpxStation = document.getElementById('cpx-station');
        if (cpxStation) {
            const isCpxOn = (this.integrations.cpxEnabled === true || this.integrations.cpxEnabled === 'true');
            cpxStation.style.display = isCpxOn ? 'block' : 'none';
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

        // Render Independent Top, Middle and Bottom Native Banner Ad Slots with Dynamic Zero-Space Auto-Height
        const topSlot = document.getElementById('banner-ad-top');
        const midHomeSlot = document.getElementById('banner-ad-middle');
        const midRedeemSlot = document.getElementById('banner-ad-redeem-middle');
        const botSlot = document.getElementById('banner-ad-bottom');
        const isBannerOn = (this.integrations.bannerEnabled === true || this.integrations.bannerEnabled === 'true');

        if (isBannerOn) {
            if (topSlot && this.integrations.bannerHtmlCode) {
                topSlot.classList.remove('hidden');
                this.executeIsolatedAdScript(topSlot, this.integrations.bannerHtmlCode, 'top');
            } else if (topSlot) {
                topSlot.classList.add('hidden'); topSlot.innerHTML = '';
            }

            const midCode = this.integrations.bannerMiddleHtmlCode || this.integrations.bannerHtmlCode;
            if (midHomeSlot && midCode) {
                midHomeSlot.classList.remove('hidden');
                this.executeIsolatedAdScript(midHomeSlot, midCode, 'mid-home');
            } else if (midHomeSlot) {
                midHomeSlot.classList.add('hidden'); midHomeSlot.innerHTML = '';
            }

            if (midRedeemSlot && midCode) {
                midRedeemSlot.classList.remove('hidden');
                this.executeIsolatedAdScript(midRedeemSlot, midCode, 'mid-redeem');
            } else if (midRedeemSlot) {
                midRedeemSlot.classList.add('hidden'); midRedeemSlot.innerHTML = '';
            }

            const botCode = this.integrations.bannerBottomHtmlCode || this.integrations.bannerHtmlCode;
            if (botSlot && botCode) {
                botSlot.classList.remove('hidden');
                this.executeIsolatedAdScript(botSlot, botCode, 'bottom');
            } else if (botSlot) {
                botSlot.classList.add('hidden'); botSlot.innerHTML = '';
            }
        } else {
            if (topSlot) { topSlot.classList.add('hidden'); topSlot.innerHTML = ''; }
            if (midHomeSlot) { midHomeSlot.classList.add('hidden'); midHomeSlot.innerHTML = ''; }
            if (midRedeemSlot) { midRedeemSlot.classList.add('hidden'); midRedeemSlot.innerHTML = ''; }
            if (botSlot) { botSlot.classList.add('hidden'); botSlot.innerHTML = ''; }
        }

        // Handle Dynamic Popunder Injection (Zero Diamond Reward)
        this.handlePopunderExecution();

        if (this.user.freeFireUid) {
            document.getElementById('ff-uid').value = this.user.freeFireUid;
        }

        const refInput = document.getElementById('referral-link-input');
        if (refInput && this.displayUserId) {
            refInput.value = `${window.location.origin}${window.location.pathname}?ref=${this.displayUserId}`;
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
                            ${isDone ? '<i class="fa-solid fa-check"></i>' : '<img src="diamond.png" style="width: 22px; height: 22px;">'}
                        </div>
                        <div class="link-details">
                            <h4>${link.title || ('Daily Mission #' + taskId)}</h4>
                            <p>Reward: +${linkRewardAmt} Diamonds</p>
                        </div>
                    </div>
                    <button class="btn-primary" ${isDone ? 'disabled' : ''} onclick="app.executeLinkTask(${idx})">
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
        window.open(url, '_blank');
        this.showToast('COMMUNITY LAUNCHED', 'Claiming community diamond bonus...', 'info');

        if (!localStorage.getItem('CF_COMMUNITY_CLAIMED')) {
            localStorage.setItem('CF_COMMUNITY_CLAIMED', 'true');
            setTimeout(() => {
                const bonus = parseInt(this.integrations.sponsorReward || 10);
                this.user.coins += bonus;
                this.saveUserProfile();
                this.renderDashboard();
                this.showToast('BONUS CREDITED!', `+${bonus} Diamonds credited for joining community!`, 'success');
            }, 3000);
        } else {
            this.showToast('ALREADY CLAIMED', 'You have already claimed your community bonus!', 'info');
        }
    }

    handlePopunderExecution() {
        const isPopunderOn = (this.integrations.popunderEnabled === true || this.integrations.popunderEnabled === 'true');
        const popCode = this.integrations.popunderHtmlCode;

        const existingHolder = document.getElementById('cf-popunder-holder');
        if (existingHolder) existingHolder.remove();

        if (isPopunderOn && popCode) {
            const holder = document.createElement('div');
            holder.id = 'cf-popunder-holder';
            holder.style.display = 'none';
            holder.innerHTML = popCode;
            document.body.appendChild(holder);

            const scripts = holder.getElementsByTagName('script');
            Array.from(scripts).forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                document.body.appendChild(newScript);
            });
        }
    }

    executeIsolatedAdScript(containerElement, rawHtmlCode, slotTag = 'slot') {
        if (!containerElement) return;
        containerElement.innerHTML = '';

        // Initial height estimation based on format
        let initialHeight = 90;
        if (rawHtmlCode.includes('250') || rawHtmlCode.includes('300x250')) {
            initialHeight = 250;
        } else if (rawHtmlCode.includes('50') || rawHtmlCode.includes('320x50')) {
            initialHeight = 50;
        }

        containerElement.style.height = (initialHeight + 8) + 'px';

        // Isolated Iframe Sandbox preventing global atOptions collision and auto-resizing
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = initialHeight + 'px';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.scrolling = 'no';

        containerElement.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <base target="_blank">
                <style>
                    html, body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; overflow: hidden; }
                    iframe, img, div { max-width: 100% !important; margin: 0 auto; display: block; }
                </style>
            </head>
            <body>
                ${rawHtmlCode}
            </body>
            </html>
        `);
        doc.close();

        // Dynamic Real-time Height Auto-fit Detection
        const adjustHeight = () => {
            try {
                if (iframe.contentWindow && iframe.contentWindow.document && iframe.contentWindow.document.body) {
                    const body = iframe.contentWindow.document.body;
                    const childElems = body.querySelectorAll('iframe, img, div');
                    let maxChildH = 0;
                    childElems.forEach(el => {
                        if (el.offsetHeight > maxChildH) maxChildH = el.offsetHeight;
                    });
                    
                    const actualH = maxChildH > 30 ? maxChildH : body.scrollHeight;
                    if (actualH > 30) {
                        iframe.style.height = actualH + 'px';
                        containerElement.style.height = (actualH + 8) + 'px';
                    }
                }
            } catch(e){}
        };

        setTimeout(adjustHeight, 600);
        setTimeout(adjustHeight, 1500);
        setTimeout(adjustHeight, 3000);
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
        this.showToast('OFFERWALL LAUNCHED', 'Complete tasks on offerwall tab to earn rewards!', 'info');
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

    openCpxSurveys() {
        const appId = this.integrations.cpxAppId || '34050';
        const secureHashKey = this.integrations.cpxSecureHash || 'ucHVQYc5kg6SooA56Z2sQBl12wkU61T4';
        const userId = this.displayUserId;

        // Calculate Secure MD5 Hash: md5(userId-secureHashKey)
        const rawHashString = `${userId}-${secureHashKey}`;
        const finalMd5 = this.calculateJSmd5(rawHashString);

        // Build target CPX Offerwall URL by dynamically replacing dashboard template placeholders
        let cpxUrl = "https://offers.cpx-research.com/index.php?app_id={app_id}&ext_user_id={unique_user_id}&secure_hash={secure_hash}&username={user_name}&email={user_email}&subid_1=&subid_2";
        
        cpxUrl = cpxUrl.replace('{app_id}', appId);
        cpxUrl = cpxUrl.replace('{unique_user_id}', userId);
        cpxUrl = cpxUrl.replace('{secure_hash}', finalMd5);
        cpxUrl = cpxUrl.replace('{user_name}', userId);
        cpxUrl = cpxUrl.replace('{user_email}', `${userId}@clashfire.com`);

        window.open(cpxUrl, '_blank');
        this.showToast('SURVEYS LAUNCHED', 'Complete premium surveys on target tab to earn rewards!', 'info');
    }

    calculateJSmd5(string) {
        function RotateLeft(lValue, iShiftBits) {
            return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
        }
        function AddUnsigned(lX,lY) {
            var lX4,lY4,lX8,lY8,lResult;
            lX8 = (lX & 0x80000000);
            lY8 = (lY & 0x80000000);
            lX4 = (lX & 0x40000000);
            lY4 = (lY & 0x40000000);
            lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
            if (lX4 & lY4) {
                return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
            }
            if (lX4 | lY4) {
                if (lResult & 0x40000000) {
                    return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
                } else {
                    return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
                }
            } else {
                return (lResult ^ lX8 ^ lY8);
            }
        }
        function F(x,y,z) { return (x & y) | ((~x) & z); }
        function G(x,y,z) { return (x & z) | (y & (~z)); }
        function H(x,y,z) { return (x ^ y ^ z); }
        function I(x,y,z) { return (y ^ (x | (~z))); }
        function FF(a,b,c,d,x,s,ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b,c,d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };
        function GG(a,b,c,d,x,s,ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b,c,d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };
        function HH(a,b,c,d,x,s,ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b,c,d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };
        function II(a,b,c,d,x,s,ac) {
            a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b,c,d), x), ac));
            return AddUnsigned(RotateLeft(a, s), b);
        };
        function ConvertToWordArray(string) {
            var lWordCount;
            var lMessageLength = string.length;
            var lNumberOfWords_temp1=lMessageLength + 8;
            var lNumberOfWords_temp2=(lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64))/64;
            var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
            var lWordArray=Array(lNumberOfWords-1);
            var lBytePosition = 0;
            var lByteCount = 0;
            while ( lByteCount < lMessageLength ) {
                lWordCount = (lByteCount - (lByteCount % 4))/4;
                lBytePosition = (lByteCount % 4)*8;
                lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
                lByteCount++;
            }
            lWordCount = (lByteCount - (lByteCount % 4))/4;
            lBytePosition = (lByteCount % 4)*8;
            lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
            lWordArray[lNumberOfWords-2] = lMessageLength<<3;
            lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
            return lWordArray;
        };
        function WordToHex(lValue) {
            var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
            for (lCount = 0;lCount<=3;lCount++) {
                lByte = (lValue>>>(lCount*8)) & 255;
                WordToHexValue_temp = "0" + lByte.toString(16);
                WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
            }
            return WordToHexValue;
        };
        function Utf8Encode(string) {
            string = string.replace(/\r\n/g,"\n");
            var utftext = "";
            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);
                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }
            return utftext;
        };
        var x=Array();
        var k,AA,BB,CC,DD,a,b,c,d;
        var S11=7, S12=12, S13=17, S14=22;
        var S21=5, S22=9 , S23=14, S24=20;
        var S31=4, S32=11, S33=16, S34=23;
        var S41=6, S42=10, S43=15, S44=21;
        string = Utf8Encode(string);
        x = ConvertToWordArray(string);
        a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
        for (k=0;k<x.length;k+=16) {
            AA=a; BB=b; CC=c; DD=d;
            a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
            d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
            c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
            b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
            a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
            d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
            c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
            b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
            a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
            d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
            c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
            b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
            a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
            d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
            c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
            b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
            a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
            d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
            c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
            b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
            a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
            d=GG(d,a,b,c,x[k+10],S22,0x2441453);
            c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
            b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
            a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
            d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
            c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
            b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
            a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
            d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
            c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
            b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
            a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
            d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
            c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
            b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
            a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
            d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
            c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
            b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
            a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
            d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
            c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
            b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
            a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
            d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
            c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
            b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
            a=II(a,b,c,d,x[k+0], S41,0xF4292244);
            d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
            c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
            b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
            a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
            d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
            c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
            b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
            a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
            d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
            c=II(c,d,a,b,x[k+6], S43,0xA3014314);
            b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
            a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
            d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
            c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
            b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
            a=AddUnsigned(a,AA);
            b=AddUnsigned(b,BB);
            c=AddUnsigned(c,CC);
            d=AddUnsigned(d,DD);
        }
        var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);
        return temp.toLowerCase();
    }

    async selectPackage(cardElem, diamondAmount, costPoints) {
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
            title: 'FFire.xyz - Free Diamonds',
            text: `🔥 Play FFire.xyz & earn FREE Free Fire Diamonds daily! Join using my link:`,
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
            let targetUrl = item.url || "https://ffire.xyz";
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
                    // User returned early to FFire.xyz tab - pause timer and warn
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
        
        let targetUrl = item.url || "https://ffire.xyz";
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

        // Open shortener link in a new tab. When finished, it redirects back to verify.html?task=X
        const targetUrl = link.url;
        window.open(targetUrl, '_blank');
        this.showToast('MISSION STARTED', 'Complete verification on shortener page to claim diamonds!', 'info');
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
            
            // 70% probability for 310 Diamonds, 30% for others
            let diamondPackage = "310 Diamonds";
            if (getSeededRandom(seedVal + 4) >= 0.7) {
                const otherPackages = ["520 Diamonds", "1060 Diamonds", "2180 Diamonds", "5600 Diamonds", "11,500 Diamonds"];
                const idx = Math.floor(getSeededRandom(seedVal + 5) * otherPackages.length);
                diamondPackage = otherPackages[idx];
            }

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
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new ClashFireApp();
});
