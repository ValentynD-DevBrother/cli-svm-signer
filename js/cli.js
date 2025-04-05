import readline from 'readline';
import fetch from 'node-fetch';

import { signMessage, signTransaction } from "./utils.js";

const BASE_URL = "http://localhost:3000/api/svm";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Initial actions list
let actions = [
    {id: 1, name: "Create Pool", endpoint: "create-pool"},
    {id: 2, name: "Join Pool", endpoint: "join-pool"},
    {id: 3, name: "Leave Pool", endpoint: "leave-pool"},
    {id: 4, name: "Claim Earnings", endpoint: "claim-earnings"},
    {id: 5, name: "Set Threshold (Admin)", endpoint: "admin/update-lock-threshold"},
    {id: 6, name: "Withdraw Pool (Admin)", endpoint: "admin/withdraw-pool"},
    {id: 7, name: "Deposit Earnings (Admin)", endpoint: "admin/deposit-earnings"},
    {id: 8, name: "Update Lock Duration (Admin)", endpoint: "admin/update-unlock-date"},
    {id: 9, name: "Update APR (Admin)", endpoint: "admin/update-apr"},
    {id: 10, name: "Refund Creation Fee (Admin)", endpoint: "admin/refund-creation-fee"},
    {id: 11, name: "End Pool (Admin)", endpoint: "admin/end-pool"},
    {id: 12, name: "Toggle Pool Visibility (Admin)", endpoint: "admin/toggle-pool-visibility"},
    {id: 13, name: "Update Pool Config (Admin)", endpoint: "admin/pool-config"},
    {id: 0, name: "Exit"}
];

// Global state
let walletAddress = null;
let currentPoolId = null;

async function makeApiCall(endpoint, params, method = 'GET', body = null) {
    const url = new URL(`${BASE_URL}/${endpoint}`);

    if (['GET', 'PUT'].includes(method)) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }


    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    console.log(`\nMaking ${method} request to: ${url.toString()}`);
    if (body) {
        console.log('With body:', body);
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    console.log('Response:', data);
    return data;
}

function question(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

function updateActionsList() {
    // Remove create-pool if pool is already created
    if (currentPoolId !== null) {
        actions = actions.filter(action => action.endpoint !== "create-pool");
    }
}

async function getAdminSignature() {
    try {
        const signature = await signMessage("Auth admin");
        return signature;
    } catch (error) {
        console.error('Error getting admin signature:', error);
        throw error;
    }
}

async function handleAction(action) {
    console.log(`\nSelected action: ${action.name}`);

    const params = {};
    let body = null;
    let method = 'GET';

    // Use stored wallet address for all actions
    params.wallet = walletAddress;

    // Use stored poolId if available, otherwise ask for it
    if (action.endpoint !== "create-pool") {
        if (currentPoolId) {
            params.poolId = currentPoolId;
            console.log(`Using pool ID: ${currentPoolId}`);
        } else {
            params.poolId = await question("Enter pool ID: ");
        }
    }

    // Action-specific parameters
    switch (action.endpoint) {
        case "create-pool":
            params.mint = await question("Enter token mint address: ");
            params.lockDuration = await question("Enter lock duration: ");
            break;
        case "join-pool":
            params.amount = await question("Enter amount: ");
            break;
        case "leave-pool":
        case "claim-earnings":
            params.receiptId = Number(await question("Enter receipt ID: "));
            break;
        case "admin/update-lock-threshold":
            params.lockThreshold = await question("Enter lock threshold: ");
            params.updateSmartContract = await question("Update smart contract? (true/false): ");
            break;
        case "admin/withdraw-pool":
            const blockJoinPoolInput = await question("Block join pool? (true/false): ");
            params.blockJoinPool = blockJoinPoolInput.toLowerCase() === 'true';
            break;
        case "admin/deposit-earnings":
            params.earnings = Number(await question("Enter earnings: "));
            params.solEarnings = Number(await question("Enter SOL earnings: "));
            params.offset = Number(await question("Enter offset: "));
            break;
        case "admin/update-unlock-date":
            params.unlockDate = await question("Enter unlock date (Unix timestamp): ");
            break;
        case "admin/update-apr":
            method = 'PUT';
            params.apr = await question("Enter APR: ");
            break;
        case "admin/toggle-pool-visibility":
            method = 'PUT';
            break;
        case "admin/pool-config":
            method = 'PUT';
            params.lockDuration = await question("Enter lock duration: ");
            params.lockThreshold = await question("Enter lock threshold: ");
            break;
    }

    // Add admin signature for admin functions
    if (action.endpoint.startsWith("admin/")) {
        try {
            params.signature = await getAdminSignature();
        } catch (error) {
            console.error("Failed to get admin signature:", error);
            return;
        }
    }

    // Make initial request
    let response;
    if (action.endpoint === "admin/update-apr") {
        // For update-apr, make a PUT request with parameters in URL
        response = await makeApiCall(action.endpoint, params, method);
    } else {
        response = await makeApiCall(action.endpoint, params, method);
    }

    if (response.transactionBase64) {
        // Sign the transaction
        console.log("\nSigning transaction...");
        const signedTx = await signTransaction(response.transactionBase64);

        // Prepare POST body
        body = {
            wallet: params.wallet,
            transactionBase64: signedTx
        };

        // Add action-specific fields to POST body
        if (action.endpoint === "create-pool") {
            body.poolId = response.poolId;
            // Store the pool ID and update actions list
            currentPoolId = response.poolId;
            updateActionsList();
        } else {
            // Only add poolId for actions that need it
            if (action.endpoint !== "claim-earnings" && params.poolId) {
                body.poolId = params.poolId;
            }
            if (params.amount) body.amount = Number(params.amount);
            if (params.lockThreshold) body.lockThreshold = Number(params.lockThreshold);
            if (params.blockJoinPool !== undefined) body.blockJoinPool = params.blockJoinPool;
            if (params.earnings !== undefined) body.earnings = Number(params.earnings);
            if (params.solEarnings !== undefined) body.solEarnings = Number(params.solEarnings);
            if (params.offset !== undefined) body.offset = Number(params.offset);
            if (params.unlockDate) body.unlockDate = params.unlockDate;
            if (params.lockDuration) body.lockDuration = params.lockDuration;

            // Add receiptId from GET response for join-pool action
            if (action.endpoint === "join-pool" && response.receiptId) {
                body.receiptId = response.receiptId;
            }
            // Add receiptId from params for other actions that need it
            else if (params.receiptId !== undefined) {
                body.receiptId = Number(params.receiptId);
            }
        }
        console.log(`\nSending signed data to backend!`);
        // Make POST request
        await makeApiCall(action.endpoint, {}, 'POST', body);
    }
}

async function main() {
    // Get wallet address on initialization
    walletAddress = await question("Enter your wallet address: ");
    console.log(`Wallet address set to: ${walletAddress}\n`);

    while (true) {
        console.log("\nAvailable Actions:");
        actions.forEach(action => {
            console.log(`${action.id}. ${action.name}`);
        });

        const choice = await question("\nSelect an action (0-13): ");
        const actionId = parseInt(choice);

        if (isNaN(actionId) || actionId < 0 || actionId > 13) {
            console.log("Invalid choice. Please try again.");
            continue;
        }

        if (actionId === 0) {
            console.log("Exiting...");
            break;
        }

        const selectedAction = actions.find(a => a.id === actionId);
        if (!selectedAction) {
            console.log("Invalid action. Please try again.");
            continue;
        }

        await handleAction(selectedAction);
    }

    rl.close();
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
}); 