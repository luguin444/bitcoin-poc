import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import { BlockChain } from "../lib/blockchain";
import { Block } from "../lib/block";
import { Transaction } from "../lib/transaction";
import { Wallet } from "../lib/wallet";

const PORT: number = parseInt(`${process.env.BLOCKCHAIN_PORT || 4000}`);

const app = express();

if (process.argv.includes("--run")) app.use(morgan("tiny"));
app.use(express.json());

const wallet = new Wallet(process.env.BLOCKCHAIN_WALLET);
const blockchain = new BlockChain(wallet.publicKey);

app.get("/status", (req: Request, res: Response) => {
  res.json({
    numberOfBlocks: blockchain.blocks.length,
    isValid: blockchain.isValid(),
    lastBlock: blockchain.getLastBlock(),
  });
});

app.get("/blocks/next", (req: Request, res: Response, next: NextFunction) => {
  res.json(blockchain.getNextBlock());
});

app.get("/blocks/:indexOrHash", (req: Request, res: Response) => {
  const { indexOrHash } = req.params;
  const isIndex = /^[0-9]+$/.test(indexOrHash);

  if (isIndex) {
    return res.json(blockchain.blocks[parseInt(indexOrHash)]);
  }

  res.json(blockchain.getBlock(indexOrHash));
});

app.post("/blocks", (req: Request, res: Response, next: NextFunction) => {
  const block = new Block(req.body as Block);

  const validation = blockchain.addBlock(block);

  if (!validation.success) return res.status(400).json(validation);
  else return res.status(201).json(block);
});

app.get("/transactions", (req: Request, res: Response) => {
  res.json({
    mempool: blockchain.mempool,
    total: blockchain.mempool.length,
  });
});

app.get("/transactions/:hash", (req: Request, res: Response) => {
  res.json(blockchain.getTransaction(req.params.hash));
});

app.post("/transactions", (req: Request, res: Response) => {
  const transaction = new Transaction(req.body as Transaction);

  const validation = blockchain.addTransaction(transaction);

  if (!validation.success) return res.status(400).json(validation);
  else return res.status(201).json(transaction);
});

app.get("/wallets/:publicKey", (req: Request, res: Response) => {
  const publicKey = req.params.publicKey;

  const utxos = blockchain.getUtxo(publicKey);
  const balance = blockchain.getBalance(publicKey);

  res.json({
    fee: blockchain.getFeePerTx(),
    balance,
    utxos,
  });
});

/* c8 ignore start */
// should not run in test environment
if (process.argv.includes("--run")) {
  app.listen(PORT, () => {
    console.log(`Blockchain server is running at ${PORT}.`);
    console.log(`Wallet from blockchain owner: ${wallet.publicKey}.`);
  });
}
/* c8 ignore end */

export { app };
