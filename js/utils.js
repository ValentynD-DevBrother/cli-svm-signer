import {Connection, Keypair, VersionedTransaction} from "@solana/web3.js";
import bs58 from "bs58";

import nacl from "tweetnacl";

export const PRIVATE_KEY_BYTES = bs58.decode("{SVM_PRIVATE_KEY}")
export const signTransaction = async (txDataBase64) => {
    const buffer = Buffer.from(txDataBase64, "base64");
    const txn = VersionedTransaction.deserialize(buffer);

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "finalized");

    const latestBlockhash = await connection.getLatestBlockhash();
    txn.message.recentBlockhash = latestBlockhash.blockhash;

    const privateKey = Uint8Array.from(PRIVATE_KEY_BYTES);
    const keypair = Keypair.fromSecretKey(privateKey);

    txn.sign([keypair]);

    return Buffer.from(txn.serialize()).toString("base64");
}

export const signMessage = (message) => {
    return bs58.encode(nacl.sign.detached(Buffer.from(message), PRIVATE_KEY_BYTES));
}