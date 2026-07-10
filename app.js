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
        window.name = 'ClashFireDashboard';
        this.renderDashboard(); // Render static constructor links immediately (no spinner lag)
        this.start3SecPageLoader();
        this.initFirebase();
        
        this.deviceId = await this.getOrCreateMultiLayerDeviceID();
        this.displayUserId = "CF-" + this.deviceId.substring(9, 15);
        
        const devElem = document.getElementById('display-device-id');
        if (devElem) devElem.innerText = "User ID: " + this.displayUserId;

        this.loadGlobalSettings();
        this.loadUserProfile();
        this.checkReferralBonus();
        this.checkSurveyReward();


        this.renderDashboard();
        this.startCountdownTimer();
        this.startLiveProofsTicker();
        this.protectAppFromInspect();

        // Check if loading specific blog post from URL slug
        const urlParams = new URLSearchParams(window.location.search);
        let postSlug = urlParams.get('post');
        
        const cleanPath = window.location.pathname.replace(/^\/+/g, '').trim();
        
        if (cleanPath === 'free-fire-free-diamonds-2026') {
            postSlug = cleanPath;
        }

        if (postSlug) {
            this.switchAppTab('tab-blog');
            this.openBlogPost(postSlug);
        }

        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                await this.loadUserProfile();
                this.renderDashboard();
            }
        });
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

        // Auto close open blog posts if switching tabs (and reset URL to / or legal sub-path)
        if (tabId !== 'tab-blog') {
            this.closeBlogPost(false); // Close sub view without clearing history yet
        }

        // Set Dynamic Pretty URLs inside Address bar on tab navigation
        if (tabId === 'tab-home') {
            window.history.pushState({}, '', '/');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openBlogPost(postSlug) {
        const listView = document.getElementById('blog-list-view');
        const postView = document.getElementById('blog-post-view');
        if (listView && postView) {
            listView.style.display = 'none';
            postView.style.display = 'block';
            
            // Set dynamic routing parameter in URL (Pretty URL format)
            window.history.pushState({ blogPost: postSlug }, '', `/${postSlug}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    closeBlogPost(updateHistory = true) {
        const listView = document.getElementById('blog-list-view');
        const postView = document.getElementById('blog-post-view');
        if (listView && postView) {
            listView.style.display = 'block';
            postView.style.display = 'none';
            
            if (updateHistory) {
                // Clear URL parameters and return to root path
                window.history.pushState({}, '', '/');
            }
        }
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
                const docRef = this.db.collection("users").doc(this.deviceId);
                
                // Realtime subscription for instant dashboard updates
                docRef.onSnapshot(async doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        this.user = { ...this.user, ...data };
                        if (!this.user.redemptionHistory) this.user.redemptionHistory = [];
                        if (!this.user.completedLinks || Array.isArray(this.user.completedLinks)) this.user.completedLinks = {};
                        if (!this.user.referredDevices) this.user.referredDevices = [];
                        if (!this.user.completedDailyVisits || Array.isArray(this.user.completedDailyVisits)) this.user.completedDailyVisits = {};
                        
                        // Check date reset logic inside snapshot
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
                        
                        localStorage.setItem('CLASH_USER_DATA_' + this.deviceId, JSON.stringify(this.user));
                        this.renderDashboard();
                    } else {
                        this.user = {
                            coins: 0,
                            freeFireUid: '',
                            dailyLinkCompletedCount: 0,
                            completedLinks: {},
                            redemptionHistory: [],
                            lastResetDate: today,
                            referredBy: null,
                            referralClaimed: false,
                            referredDevices: [],
                            completedDailyVisits: {}
                        };
                        localStorage.setItem('CLASH_USER_DATA_' + this.deviceId, JSON.stringify(this.user));
                        await docRef.set(this.user);
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

    formatCoins(coins) {
        if (typeof coins !== 'number') coins = parseInt(coins || '0');
        if (coins <= 9999) return coins.toLocaleString('en-US'); // Format with thousands comma below 9,999 (e.g. 5,600)
        
        // Format to 1 decimal place if fractional (e.g., 12500 -> 12.5k)
        const formatted = (coins / 1000).toFixed(1);
        return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'k' : formatted + 'k';
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
        const refCount = (this.user.referredDevices || []).length;
        const refPercent = (this.globalSettings.referralCommissionPercent || 10);

        const countElem = document.getElementById('ref-stat-count');
        const rewardElem = document.getElementById('ref-stat-reward');
        if (countElem) countElem.innerText = refCount;
        if (rewardElem) rewardElem.innerText = refPercent + "% Rate";

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

            const midCode = this.integrations.bannerMiddleHtmlCode;
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

            const botCode = this.integrations.bannerBottomHtmlCode;
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

        if (this.user.freeFireUid) {
            document.getElementById('ff-uid').value = this.user.freeFireUid;
        }

        // Dynamically inject Global Popunder if enabled
        const popunderEnabled = this.globalSettings.adScriptPopunderEnabled === true || this.globalSettings.adScriptPopunderEnabled === 'true';
        let existingPop = document.getElementById('cf-global-popunder-script');
        if (popunderEnabled && this.globalSettings.adScriptPopunder) {
            if (!existingPop) {
                const holder = document.createElement('div');
                holder.id = 'cf-global-popunder-script';
                holder.style.display = 'none';
                holder.innerHTML = this.globalSettings.adScriptPopunder;
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
    executeIsolatedAdScript(containerElement, rawHtmlCode, slotTag = 'slot') {
        if (!containerElement || !rawHtmlCode) return;
        
        // Cache Check: If this slot is already running this exact HTML content, skip refreshing
        const cacheKey = `CF_LAST_AD_CODE_${slotTag}`;
        if (containerElement.getAttribute('data-ad-loaded') === 'true' && localStorage.getItem(cacheKey) === rawHtmlCode) {
            return;
        }
        
        localStorage.setItem(cacheKey, rawHtmlCode);
        containerElement.setAttribute('data-ad-loaded', 'true');
        containerElement.innerHTML = '';
        
        let initialHeight = 90;
        if (rawHtmlCode.includes('250') || rawHtmlCode.includes('300x250')) {
            initialHeight = 250;
        } else if (rawHtmlCode.includes('50') || rawHtmlCode.includes('320x50')) {
            initialHeight = 50;
        }
        
        containerElement.style.height = (initialHeight + 8) + 'px';

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = initialHeight + 'px';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.scrolling = 'no';
        containerElement.appendChild(iframe);

        try {
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`<!DOCTYPE html><html><head><base target="_blank"><style>html, body { margin:0; padding:0; display:flex; justify-content:center; align-items:center; background:transparent; overflow:visible; } iframe, img, div { max-width:100% !important; max-height:100% !important; margin:0 auto; display:block; }</style></head><body>${rawHtmlCode}</body></html>`);
            doc.close();

            const adjustH = () => {
                try {
                    if (iframe.contentWindow && iframe.contentWindow.document && iframe.contentWindow.document.body) {
                        const body = iframe.contentWindow.document.body;
                        const maxChildH = Math.max(...Array.from(body.querySelectorAll('iframe, img, div, ins')).map(el => el.offsetHeight), 0);
                        const actualH = maxChildH > 30 ? maxChildH : body.scrollHeight;
                        if (actualH > 30) {
                            iframe.style.height = actualH + 'px';
                            containerElement.style.height = actualH + 'px';
                        }
                    }
                } catch(e){}
            };
            setTimeout(adjustH, 500);
            setTimeout(adjustH, 1200);
            setTimeout(adjustH, 2500);
        } catch(e){}
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
        let targetUrl = link.url || (window.location.origin + "/verify.html?task=" + taskId);
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
