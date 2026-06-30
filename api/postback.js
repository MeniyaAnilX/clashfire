// CLASH FIRE - Torox Postback Serverless Receiver API
// Path: /api/postback.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { query } = req;
        
        // Torox query parameters mapping
        // Configured URL on Torox Panel: https://clashfire.vercel.app/api/postback?user_id={user_id}&amount={amount}&status={status}&tx_id={id}&ip={ip}
        const userId = query.user_id;
        const amount = parseInt(query.amount || '0');
        const status = query.status; // status = 1 means successful conversion
        const txId = query.tx_id;
        const ip = query.ip || 'N/A';

        // 1. Basic validation checks
        if (!userId || !txId || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: "Missing parameters or invalid amount" });
        }

        // Only process status 1 (successful task completed)
        if (status !== '1') {
            return res.status(200).send("0"); // Tell Torox we received it, but status is not successful conversion
        }

        // Firestore REST API Configurations
        const projectId = "clashfirediamond";
        const dbUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

        // 2. Decode user physical device ID from user_id display tag (CF-xxxxxx)
        // Since Firebase users collection is keyed by permanent deviceId, we query the DB to find matching displayUserId.
        const searchRes = await fetch(`${dbUrl}/users`);
        if (!searchRes.ok) {
            throw new Error(`Failed to list users from database: ${searchRes.statusText}`);
        }
        
        const usersList = await searchRes.json();
        let targetDocId = null;
        let userData = null;

        if (usersList && usersList.documents) {
            for (const doc of usersList.documents) {
                // Get document path id (deviceId)
                const docId = doc.name.split('/').pop();
                
                // Read coin balance and device variables from Firestore fields mapping format
                const fields = doc.fields || {};
                const displayId = "CF-" + docId.substring(9, 15);
                
                if (displayId === userId) {
                    targetDocId = docId;
                    userData = doc;
                    break;
                }
            }
        }

        if (!targetDocId || !userData) {
            return res.status(404).json({ error: "User profile display ID not found" });
        }

        // 3. Double-Spend check: Ensure this transaction has not been credited already
        const fields = userData.fields || {};
        const completedTx = fields.completedToroxTx && fields.completedToroxTx.arrayValue && fields.completedToroxTx.arrayValue.values
            ? fields.completedToroxTx.arrayValue.values.map(v => v.stringValue)
            : [];

        if (completedTx.includes(txId)) {
            // Already credited, return success response '1' to Torox to stop retries
            return res.status(200).send("1");
        }

        // 4. Update coins balance & add transaction to local completed array list
        const currentCoins = fields.coins && fields.coins.integerValue 
            ? parseInt(fields.coins.integerValue) 
            : 0;
            
        const newCoinsVal = currentCoins + amount;
        completedTx.push(txId);

        // Map data back to Firestore REST JSON fields format
        const updatedFields = { ...fields };
        updatedFields.coins = { integerValue: newCoinsVal.toString() };
        updatedFields.completedToroxTx = {
            arrayValue: {
                values: completedTx.map(t => ({ stringValue: t }))
            }
        };

        // Write update back to Google Firestore REST endpoint
        const patchUrl = `${dbUrl}/users/${targetDocId}?updateMask.fieldPaths=coins&updateMask.fieldPaths=completedToroxTx`;
        const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `${dbUrl}/users/${targetDocId}`,
                fields: updatedFields
            })
        });

        if (!patchRes.ok) {
            const errorMsg = await patchRes.text();
            throw new Error(`Failed to update coins balance in database: ${errorMsg}`);
        }

        // 5. Success! Return 1 to indicate successfully processed transaction to Torox
        return res.status(200).send("1");

    } catch (error) {
        console.error("Torox Callback Processing Error:", error);
        return res.status(500).json({ error: "Internal server processing error", message: error.message });
    }
};
