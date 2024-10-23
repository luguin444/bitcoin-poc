import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { BlockInfoType, TransactionType } from "../lib/protocols";
import { Block } from "../lib/block";
import { Wallet } from "../lib/wallet";
import { Transaction } from "../lib/transaction";
import { TransactionOutput } from "../lib/transactionOutput";
import { BlockChain } from "../lib/blockchain";

const BLOCKCHAIN_SERVER = process.env.BLOCKCHAIN_SERVER;
const minerWallet = new Wallet(process.env.MINER_WALLET);
console.log("Miner wallet:", minerWallet);

let totalMined = 0;

function getRewardTransaction(
  blockInfo: BlockInfoType,
  nextBlock: Block
): Transaction | undefined {
  let amount = 0;

  if (blockInfo.difficulty < blockInfo.maxDifficulty)
    amount =
      amount + BlockChain.getRewardAmountForBlockMine(blockInfo.difficulty);

  const netWorkFees = nextBlock.transactions
    .map((tx) => tx.getFee())
    .reduce((acc, feeFromTransaction) => acc + feeFromTransaction, 0);

  const feeCheck = nextBlock.transactions.length * blockInfo.feePerTx;

  if (netWorkFees < feeCheck) {
    console.log("Low fees in network. Awaiting for the next block");
    setTimeout(() => mine(), 5000);
    return;
  }

  amount = amount + netWorkFees;

  console.log("Amount", amount);
  console.log("netWorkFees", netWorkFees);
  console.log(
    "forBlock",
    BlockChain.getRewardAmountForBlockMine(blockInfo.difficulty)
  );
  console.log("diff", blockInfo.difficulty);

  const txo = new TransactionOutput({
    toAddress: minerWallet.publicKey,
    amount,
  } as TransactionOutput);

  const tx = Transaction.getRewardTransactionFromTXO(txo);

  return tx;
}

async function mine(): Promise<void> {
  console.log("Getting next block info...");

  const response = await axios.get(`${BLOCKCHAIN_SERVER}/blocks/next`);
  const blockInfo = response.data as BlockInfoType;
  console.log("Block info:", blockInfo);

  if (!blockInfo) {
    console.log("No transactions in mempool. Waiting 5 seconds...");
    setTimeout(mine, 5000);
    return;
  }

  const newBlock = Block.fromBlockInfo(blockInfo);

  const feeTransactionToMiner = getRewardTransaction(blockInfo, newBlock);
  if (!feeTransactionToMiner) return;

  newBlock.transactions.push(feeTransactionToMiner);
  newBlock.miner = minerWallet.publicKey;

  console.log(`Start Mining Block #${newBlock.index}...`);
  newBlock.mine(blockInfo.difficulty, minerWallet.publicKey);

  console.log(`Sending block #${newBlock.index} to blockchain...`);

  try {
    await axios.post(`${BLOCKCHAIN_SERVER}/blocks`, newBlock);
    totalMined++;
    console.log(`Block #${newBlock.index} sent and accepeted by blockchain.`);
    console.log(`Total mined: ${totalMined}`);
  } catch (error: any) {
    console.log(error.response.data);
  }

  setTimeout(mine, 1000);
}

mine();
