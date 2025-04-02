import {VersionedTransaction, Keypair, Connection} from "@solana/web3.js";
import bs58 from "bs58";
const PRIVATE_KEY_BYTES = bs58.decode("{PRIVATE_KEY_HERE}")

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("Usage: node script.js <txDataBase64>");
        process.exit(1);
    }

    const txDataBase64 = args[0];
    const buffer = Buffer.from(txDataBase64, "base64");
    const txn = VersionedTransaction.deserialize(buffer);

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "finalized");

    // Update blockhash before signing
    const latestBlockhash = await connection.getLatestBlockhash();
    txn.message.recentBlockhash = latestBlockhash.blockhash;

    const privateKey = Uint8Array.from(PRIVATE_KEY_BYTES);
    const keypair = Keypair.fromSecretKey(privateKey);

    txn.sign([keypair]);

    const serializedTxn = Buffer.from(txn.serialize()).toString("base64");
    console.log("\n ****SIGNED AND SERIALIZED **** \n", serializedTxn, "\n");
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});

