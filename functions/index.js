const functions = require("firebase-functions");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Helper to hash FF UID for secure lookup key
function hashFfUid(ffUid) {
  return crypto.createHash("sha256").update(ffUid).digest("hex");
}

// Helper to hash recovery code
function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Generate random uppercase alphanumeric token
function generateRandomAlphanumeric(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Generate a random recovery code: FD-XXXX-XXXX
function generateRecoveryCode() {
  return `FD-${generateRandomAlphanumeric(4)}-${generateRandomAlphanumeric(4)}`;
}

// Brute Force Protection Helper
async function checkBruteForce(ffUid, ip) {
  const now = Date.now();
  const lockTime = 15 * 60 * 1000; // 15 minutes lock
  
  const attemptRef = db.collection("login_attempts").doc(ffUid);
  const doc = await attemptRef.get();
  
  if (doc.exists) {
    const data = doc.data();
    if (data.lockedUntil && data.lockedUntil > now) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Too many failed attempts. Try again in 15 minutes."
      );
    }
  }
}

async function recordFailedAttempt(ffUid) {
  const now = Date.now();
  const attemptRef = db.collection("login_attempts").doc(ffUid);
  const doc = await attemptRef.get();
  
  let attempts = 1;
  if (doc.exists) {
    const data = doc.data();
    // Reset count if last attempt was > 15 mins ago
    if (now - data.lastAttempt > 15 * 60 * 1000) {
      attempts = 1;
    } else {
      attempts = (data.attempts || 0) + 1;
    }
  }
  
  const updateData = {
    attempts: attempts,
    lastAttempt: now
  };
  
  if (attempts >= 5) {
    updateData.lockedUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
  }
  
  await attemptRef.set(updateData, { merge: true });
}

async function clearFailedAttempts(ffUid) {
  await db.collection("login_attempts").doc(ffUid).delete();
}

/**
 * 1. Login or Sign Up
 * Handles FF UID validation, PIN verification, new account initialization, and legacy account migration.
 */
exports.loginOrSignUp = functions.https.onCall(async (data, context) => {
  // App Check Verification (Production Only)
  if (process.env.NODE_ENV === "production" && !context.app) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "App Check token verification failed."
    );
  }

  const { ffUid, pin, legacyDeviceId } = data;
  const ip = context.rawRequest ? context.rawRequest.ip : "";

  // 1. Validation
  if (!ffUid || !/^\d{7,13}$/.test(ffUid)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "UID must contain only digits and be between 7 and 13 characters long."
    );
  }
  if (!pin || !/^\d{6}$/.test(pin)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "PIN must be exactly 6 digits."
    );
  }

  // 2. Brute-force check
  await checkBruteForce(ffUid, ip);

  const hashedUid = hashFfUid(ffUid);
  const bindingRef = db.collection("ffUidBindings").doc(hashedUid);
  const bindingDoc = await bindingRef.get();

  if (bindingDoc.exists) {
    // === EXISTING USER LOGIN ===
    const accountId = bindingDoc.data().accountId;
    const accountRef = db.collection("accounts").doc(accountId);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      throw new functions.https.HttpsError("not-found", "UID or PIN is incorrect.");
    }

    const accountData = accountDoc.data();

    // Verify PIN Hash
    const pinMatch = bcrypt.compareSync(pin, accountData.pinHash);
    if (!pinMatch) {
      await recordFailedAttempt(ffUid);
      throw new functions.https.HttpsError("unauthenticated", "UID or PIN is incorrect.");
    }

    // Success - Clear failed attempts
    await clearFailedAttempts(ffUid);

    // Update login timestamp
    await accountRef.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create Firebase Custom Auth Token
    const customToken = await admin.auth().createCustomToken(accountId);
    return { success: true, customToken: customToken };

  } else {
    // === NEW USER SIGNUP ===
    const accountId = db.collection("accounts").doc().id;
    const accountRef = db.collection("accounts").doc(accountId);
    const pinHash = bcrypt.hashSync(pin, 10);
    const recoveryCode = generateRecoveryCode();
    const recoveryHash = hashRecoveryCode(recoveryCode);

    // Prepare default account structure
    const newAccount = {
      ffUid: ffUid,
      pinHash: pinHash,
      recoveryCodeHash: recoveryHash,
      coins: 0,
      completedLinks: {},
      dailyLinkCompletedCount: 0,
      redemptionHistory: [],
      referredBy: null,
      referredDevices: [],
      completedDailyVisits: {},
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Perform transaction to secure atomic registration and prevent race duplicate signups
    await db.runTransaction(async (transaction) => {
      const bindingSnap = await transaction.get(bindingRef);
      if (bindingSnap.exists) {
        throw new Error("UID_ALREADY_EXISTS");
      }

      // Check if we need to migrate legacy device data
      if (legacyDeviceId) {
        const legacyRef = db.collection("users").doc(legacyDeviceId);
        const legacySnap = await transaction.get(legacyRef);
        
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
            
            // Mark legacy account as migrated & disabled
            transaction.update(legacyRef, {
              migrated: true,
              status: "disabled",
              migratedTo: accountId
            });
          }
        }
      }

      // Set entries in database
      transaction.set(accountRef, newAccount);
      transaction.set(bindingRef, { accountId: accountId });
    }).catch(err => {
      if (err.message === "UID_ALREADY_EXISTS") {
        throw new functions.https.HttpsError(
          "already-exists",
          "This UID is already registered."
        );
      }
      throw new functions.https.HttpsError("internal", err.message);
    });

    // Create Firebase Custom Auth Token
    const customToken = await admin.auth().createCustomToken(accountId);
    return {
      success: true,
      customToken: customToken,
      recoveryCode: recoveryCode // Returned ONLY once at registration
    };
  }
});

/**
 * 2. Reset PIN using Recovery Code
 */
exports.resetPinWithRecoveryCode = functions.https.onCall(async (data, context) => {
  if (process.env.NODE_ENV === "production" && !context.app) {
    throw new functions.https.HttpsError("failed-precondition", "App Check failed.");
  }

  const { ffUid, recoveryCode, newPin } = data;

  if (!ffUid || !recoveryCode || !newPin) {
    throw new functions.https.HttpsError("invalid-argument", "Missing parameters.");
  }
  if (!/^\d{6}$/.test(newPin)) {
    throw new functions.https.HttpsError("invalid-argument", "New PIN must be exactly 6 digits.");
  }

  const hashedUid = hashFfUid(ffUid);
  const bindingDoc = await db.collection("ffUidBindings").doc(hashedUid).get();

  if (!bindingDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Invalid recovery details.");
  }

  const accountId = bindingDoc.data().accountId;
  const accountRef = db.collection("accounts").doc(accountId);
  const accountDoc = await accountRef.get();

  if (!accountDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Invalid recovery details.");
  }

  const accountData = accountDoc.data();
  const inputHash = hashRecoveryCode(recoveryCode.trim());

  if (accountData.recoveryCodeHash !== inputHash) {
    throw new functions.https.HttpsError("unauthenticated", "Invalid recovery details.");
  }

  // Update PIN hash
  const newPinHash = bcrypt.hashSync(newPin, 10);
  await accountRef.update({ pinHash: newPinHash });

  return { success: true };
});

/**
 * 3. Secure Claim Task Reward (Atomic Transaction)
 */
exports.claimTaskReward = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required to claim rewards."
    );
  }

  if (process.env.NODE_ENV === "production" && !context.app) {
    throw new functions.https.HttpsError("failed-precondition", "App Check failed.");
  }

  const { taskId, rewardAmt, today } = data;
  const accountId = context.auth.uid;

  if (!taskId || !rewardAmt || !today) {
    throw new functions.https.HttpsError("invalid-argument", "Missing claim variables.");
  }

  const accountRef = db.collection("accounts").doc(accountId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(accountRef);
      if (!snap.exists) {
        throw new Error("ACCOUNT_NOT_FOUND");
      }

      const accData = snap.data();
      const completedLinks = accData.completedLinks || {};

      if (completedLinks[taskId]) {
        throw new Error("ALREADY_CLAIMED");
      }

      const currentCoins = parseFloat(accData.coins || 0);
      const currentCount = parseInt(accData.dailyLinkCompletedCount || 0);

      const updatedLinks = { ...completedLinks, [taskId]: true };
      const updatedCoins = parseFloat((currentCoins + rewardAmt).toFixed(2));
      const updatedCount = currentCount + 1;

      // Handle daily count reset logic in backend transaction
      let resetCount = updatedCount;
      let finalLinks = updatedLinks;
      let finalResetDate = accData.lastResetDate;

      if (accData.lastResetDate !== today) {
        resetCount = 1;
        finalLinks = { [taskId]: true };
        finalResetDate = today;
      }

      const updatePayload = {
        coins: updatedCoins,
        completedLinks: finalLinks,
        dailyLinkCompletedCount: resetCount,
        lastResetDate: finalResetDate
      };

      // Secure Backend Referral Commission Processing
      if (accData.referredBy && accData.lastReferralCommissionDate !== today) {
        const linksRef = db.collection("settings").doc("links");
        const linksDoc = await transaction.get(linksRef);
        let totalRequiredMissions = 5;
        if (linksDoc.exists && linksDoc.data().items && Array.isArray(linksDoc.data().items)) {
          totalRequiredMissions = linksDoc.data().items.length;
        }

        const completedCount = Object.keys(finalLinks).length;
        if (completedCount >= totalRequiredMissions) {
          const referrersRef = db.collection("accounts").where("ffUid", "==", accData.referredBy).limit(1);
          const referrerSnap = await transaction.get(referrersRef);
          
          if (!referrerSnap.empty) {
            const referrerDoc = referrerSnap.docs[0];
            if (referrerDoc.id !== accountId) {
              const refRef = referrerDoc.ref;
              const refData = referrerDoc.data();
              
              const gSettingsRef = db.collection("settings").doc("global");
              const gSettingsDoc = await transaction.get(gSettingsRef);
              let commPercent = 10;
              if (gSettingsDoc.exists && gSettingsDoc.data().referralCommissionPercent !== undefined) {
                commPercent = parseInt(gSettingsDoc.data().referralCommissionPercent);
              }
              
              const totalDailyMissionsReward = totalRequiredMissions * rewardAmt;
              const commissionCoins = parseFloat((totalDailyMissionsReward * (commPercent / 100)).toFixed(2));
              
              if (commissionCoins > 0) {
                const newRefCoins = parseFloat(((refData.coins || 0) + commissionCoins).toFixed(2));
                transaction.update(refRef, { coins: newRefCoins });
                updatePayload.lastReferralCommissionDate = today;
              }
            }
          }
        }
      }

      transaction.update(accountRef, updatePayload);
      return { success: true, newCoins: updatedCoins };
    });

    return result;
  } catch (err) {
    if (err.message === "ALREADY_CLAIMED") {
      throw new functions.https.HttpsError("already-exists", "This task reward was already claimed.");
    }
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * 4. Secure Create Redemption Request (Atomic Balance Deduction)
 */
exports.createRedemptionRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required to redeem diamonds."
    );
  }

  if (process.env.NODE_ENV === "production" && !context.app) {
    throw new functions.https.HttpsError("failed-precondition", "App Check failed.");
  }

  const { diamondAmount, costPoints, uidInput } = data;
  const accountId = context.auth.uid;

  if (!diamondAmount || !costPoints || !uidInput) {
    throw new functions.https.HttpsError("invalid-argument", "Missing parameters.");
  }
  if (!/^\d{7,13}$/.test(uidInput)) {
    throw new functions.https.HttpsError("invalid-argument", "Free Fire UID must be 7-13 digits.");
  }

  const accountRef = db.collection("accounts").doc(accountId);
  const redemptionId = db.collection("redemptions").doc().id;
  const redemptionRef = db.collection("redemptions").doc(redemptionId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(accountRef);
      if (!snap.exists) {
        throw new Error("ACCOUNT_NOT_FOUND");
      }

      const accData = snap.data();
      const currentCoins = parseFloat(accData.coins || 0);

      if (currentCoins < costPoints) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      // Add item to redemption history array
      const redemptionItem = {
        id: redemptionId,
        uid: uidInput,
        amount: diamondAmount,
        cost: costPoints,
        status: "pending",
        timestamp: Date.now()
      };

      const updatedHistory = accData.redemptionHistory || [];
      updatedHistory.push(redemptionItem);

      // Deduct coins and log details inside transaction
      transaction.update(accountRef, {
        coins: parseFloat((currentCoins - costPoints).toFixed(2)),
        redemptionHistory: updatedHistory
      });

      // Write redemption queue document
      transaction.set(redemptionRef, {
        redemptionId: redemptionId,
        accountId: accountId,
        freeFireUid: uidInput,
        amount: diamondAmount,
        cost: costPoints,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    });

    return result;
  } catch (err) {
    if (err.message === "INSUFFICIENT_FUNDS") {
      throw new functions.https.HttpsError("failed-precondition", "Insufficient diamond balance.");
    }
    throw new functions.https.HttpsError("internal", err.message);
  }
});
