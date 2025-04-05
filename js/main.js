import {signTransaction} from "./utils.js";

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("Usage: node script.js <txDataBase64>");
        process.exit(1);
    }

    const txDataBase64 = args[0];
    const serializedTxn = await signTransaction(txDataBase64);
    console.log("\n ****SIGNED AND SERIALIZED **** \n", serializedTxn, "\n");
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});


