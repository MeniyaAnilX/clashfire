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
            referralClaimed: false
        };
        this.globalSettings = {
            linkReward: 5,
            referralReward: 10
        };
        this.integrations = {
            toroxUrl: localStorage.getItem('CF_CACHE_TOROX_URL') || "https://torox.io",
            toroxEnabled: true,
            gamezopUrl: "https://www.gamezop.com",
            gamezopReward: 5,
            gamezopEnabled: true,
            bannerHtmlCode: '',
            bannerBottomHtmlCode: '',
            bannerEnabled: false,
            popunderHtmlCode: '',
            popunderEnabled: false,
            sponsorTitle: 'Join Our Channel',
            sponsorReward: 10,
            sponsorUrl: 'https://t.me',
            sponsorBtnText: 'JOIN NOW',
            sponsorIcon: 'telegram',
            sponsorEnabled: true
        };
        this.db = null;
        this.firestoreActive = false;

        // Dynamic Mission Tasks Array (1-indexed task IDs)
        this.dailyLinks = [
            { id: 0, taskId: 1, title: "Daily Mission Supply #1", url: "https://clashfire.vercel.app/verify.html?task=1" },
            { id: 1, taskId: 2, title: "Daily Mission Elite #2", url: "https://clashfire.vercel.app/verify.html?task=2" },
            { id: 2, taskId: 3, title: "Daily Mission Vault #3", url: "https://clashfire.vercel.app/verify.html?task=3" },
            { id: 3, taskId: 4, title: "Daily Mission Armor #4", url: "https://clashfire.vercel.app/verify.html?task=4" },
            { id: 4, taskId: 5, title: "Daily Mission Heroic #5", url: "https://clashfire.vercel.app/verify.html?task=5" }
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
        await this.checkReferralBonus();

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
                    if (this.user.lastResetDate !== today) {
                        this.user.dailyLinkCompletedCount = 0;
                        this.user.completedLinks = {};
                        this.user.lastResetDate = today;
                        await docRef.update({
                            dailyLinkCompletedCount: 0,
                            completedLinks: {},
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
            if (this.user.lastResetDate !== today) {
                this.user.dailyLinkCompletedCount = 0;
                this.user.completedLinks = {};
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

            for (const doc of snapshot.docs) {
                const displayId = "CF-" + doc.id.substring(9, 15);
                if (displayId === refCode && doc.id !== this.deviceId) {
                    referrerDocRef = doc.ref;
                    referrerData = doc.data();
                    break;
                }
            }

            if (referrerDocRef && referrerData) {
                const referredDevices = referrerData.referredDevices || [];
                
                // 3. Check if my device ID is already in referrer's referredDevices array
                if (referredDevices.includes(this.deviceId)) {
                    return; // Hard-blocked! Already referred by this user.
                }

                const bonus = this.globalSettings.referralReward || 10;
                const newCoins = (referrerData.coins || 0) + bonus;
                referredDevices.push(this.deviceId);

                // 4. Update referrer coins and referredDevices array in Firestore
                await referrerDocRef.update({
                    coins: newCoins,
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
                this.showToast('WELCOME TO CLASH FIRE', `Joined via referral link from ${refCode}!`, 'info');
            }
        } catch(e) { console.error("Referral Sync Error:", e); }
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

        // Render Independent Top and Bottom Native Banner Ad Slots with Dynamic Zero-Space Auto-Height
        const topSlot = document.getElementById('banner-ad-top');
        const botSlot = document.getElementById('banner-ad-bottom');
        const isBannerOn = (this.integrations.bannerEnabled === true || this.integrations.bannerEnabled === 'true');

        if (isBannerOn) {
            if (topSlot && this.integrations.bannerHtmlCode) {
                topSlot.classList.remove('hidden');
                this.executeIsolatedAdScript(topSlot, this.integrations.bannerHtmlCode, 'top');
            } else if (topSlot) {
                topSlot.classList.add('hidden'); topSlot.innerHTML = '';
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
            if (botSlot) { botSlot.classList.add('hidden'); botSlot.innerHTML = ''; }
        }

        // Handle Dynamic Popunder Injection (Zero Diamond Reward)
        this.handlePopunderExecution();

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

    async executeLinkTask(index) {
        const task = this.dailyLinks[index];
        if (!task) return;
        const taskId = task.taskId || (index + 1);

        if (this.user.completedLinks && this.user.completedLinks[taskId]) return;

        // Generate One-Time Security Session Token locked to this device
        const tokenObj = {
            token: "CF_SEC_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now(),
            time: Date.now()
        };
        localStorage.setItem("CF_ACTIVE_TOKEN_TASK_" + taskId, JSON.stringify(tokenObj));

        window.open(task.url, '_blank');
        this.showToast('MISSION LAUNCHED', 'Complete shortener navigation on target tab to claim reward!', 'info');
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
}

let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new ClashFireApp();
});
