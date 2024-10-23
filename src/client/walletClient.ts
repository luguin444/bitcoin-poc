import dotenv from "dotenv";
dotenv.config();
import { Wallet } from "../lib/wallet";
import axios from "axios";
import readline from "readline";
import { TransactionType } from "../lib/protocols";
import { Transaction } from "../lib/transaction";
import { TransactionInput } from "../lib/transactionInput";
import { TransactionOutput } from "../lib/transactionOutput";

const BLOCKCHAIN_SERVER = process.env.BLOCKCHAIN_SERVER;

let myWalletPublicKey = "";
let myWalletPrivateKey = "";

const rl = readline.createInterface({
  input: process.stdin, // keyboard
  output: process.stdout, // terminal
});

function preMenu() {
  rl.question("Press any key to continue...", () => {
    menu();
  });
}

function createWallet() {
  console.clear();
  const wallet = new Wallet();
  myWalletPublicKey = wallet.publicKey;
  myWalletPrivateKey = wallet.privateKey;

  console.log(wallet);
  preMenu();
}

function recoverWallet() {
  console.clear();

  rl.question("Enter your private key: ", (answer) => {
    const wallet = new Wallet(answer);
    console.log(wallet);

    myWalletPublicKey = wallet.publicKey;
    myWalletPrivateKey = wallet.privateKey;

    preMenu();
  });
}

async function getBalance() {
  const { data } = await axios.get(
    `${BLOCKCHAIN_SERVER}/wallets/${myWalletPublicKey}`
  );

  console.log("Balance: ", data.balance);

  preMenu();
}

function sendTx() {
  rl.question("To wallet: ", (answer) => {
    const toWallet = answer;

    if (toWallet.length !== 66) {
      console.log("Invalid wallet");
      preMenu();
    }

    rl.question("Amount: ", async (answer) => {
      const amount = parseInt(answer);

      if (isNaN(amount) || amount <= 0) {
        console.log("Invalid amount");
        preMenu();
      }

      const walletResponse = await axios.get(
        `${BLOCKCHAIN_SERVER}/wallets/${myWalletPublicKey}`
      );
      const balance = walletResponse.data.balance as number;
      const fee = walletResponse.data.fee as number;
      const utxos = walletResponse.data.utxos as TransactionOutput[];

      if (balance < amount + fee) {
        console.log("Insufficient balance ( tx + fee )");
        preMenu();
        return;
      }

      const txInputs = utxos.map((txo) => TransactionInput.fromTxo(txo));
      txInputs.forEach((txInput) => txInput.sign(myWalletPrivateKey));

      const txOutputs = [] as TransactionOutput[];
      txOutputs.push(
        new TransactionOutput({
          toAddress: toWallet,
          amount,
        } as TransactionOutput)
      );

      // transação de troco
      const remainingAmount = balance - amount - fee;
      txOutputs.push(
        new TransactionOutput({
          toAddress: myWalletPublicKey,
          amount: remainingAmount,
        } as TransactionOutput)
      );

      const tx = new Transaction({
        txOutputs,
        txInputs,
      } as Transaction);

      tx.txInputs![0].sign(myWalletPrivateKey);
      tx.hash = tx.getHash();
      tx.txOutputs.forEach((txo, i, arr) => (arr[i].tx = tx.hash));

      console.log("Transaction: ", tx);
      console.log("Remaining amount: ", remainingAmount);

      try {
        const res = await axios.post(`${BLOCKCHAIN_SERVER}/transactions`, tx);
        console.log("Transaction accepted. Waiting for the miners...");
      } catch (error: any) {
        console.error(error.response ? error.response.data : error.message);
      }
      preMenu();
    });
  });
}

function menu() {
  setTimeout(() => {
    console.clear();

    if (myWalletPublicKey) {
      console.log(`You are logged as ${myWalletPublicKey}`);

      console.log("1 - Balance: ");
      console.log("2 - Send Tx: ");

      rl.question("Choose an option: ", async (answer) => {
        switch (answer) {
          case "1":
            getBalance();
            break;
          case "2":
            sendTx();
            break;
          default:
            console.log("Invalid option");
            menu();
        }
      });
    } else {
      console.log("You are not logged in.");

      console.log("1 - Create Wallet: ");
      console.log("2 - Login / Recover wallet: ");

      rl.question("Choose an option: ", async (answer) => {
        switch (answer) {
          case "1":
            createWallet();
            break;
          case "2":
            recoverWallet();
            break;
          default:
            console.log("Invalid option");
            menu();
        }
      });
    }
  }, 1000);
}

menu();
