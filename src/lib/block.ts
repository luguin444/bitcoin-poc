import { SHA256 } from "crypto-js";
import { Validation } from "./validation";
import { BlockInfoType, TransactionType } from "./protocols";
import { Transaction } from "./transaction";

export class Block {
  index: number;
  timestamp: number;
  hash: string;
  previousHash: string | null;
  transactions: Transaction[];
  nonce: number;
  miner: string;

  constructor(block?: Block) {
    this.index = block?.index || 0;
    this.timestamp = block?.timestamp || Date.now();
    this.transactions =
      block?.transactions.map((tx) => new Transaction(tx)) ||
      ([] as Transaction[]);
    this.previousHash = block?.previousHash || null;
    this.nonce = block?.nonce || 0;
    this.miner = block?.miner || "";
    this.hash = block?.hash || this.getHash();
  }

  getHash(): string {
    const txs =
      this.transactions.length > 0
        ? this.transactions.map((tx) => tx.getHash()).join("")
        : "";

    return SHA256(
      this.index +
        txs +
        this.timestamp +
        this.previousHash +
        this.nonce +
        this.miner
    ).toString();
  }

  mine(difficuly: number, miner: string): void {
    this.miner = miner;

    const expectedPrefix = Array(difficuly + 1).join("0");

    do {
      this.nonce++;
      this.hash = this.getHash();
    } while (!this.hash.startsWith(expectedPrefix));
  }

  isValid(
    previousHash: string,
    previousIndex: number,
    difficuly: number,
    feePerTx: number
  ): Validation {
    if (this.transactions) {
      const feeTransaction = this.transactions.filter(
        (tx) => tx.type === TransactionType.FEE
      );

      if (feeTransaction.length === 0)
        return new Validation(false, "No fee TX");

      if (feeTransaction.length > 1)
        return new Validation(false, "Too many fees");

      if (
        !feeTransaction[0].txOutputs.some((txo) => txo.toAddress === this.miner)
      )
        return new Validation(false, "Invalid miner wallet fee");

      const totalFeesForTransactions =
        this.transactions.filter((tx) => tx.type !== TransactionType.FEE)
          .length * feePerTx;
      const validations = this.transactions.map((tx) => tx.isValid(difficuly, totalFeesForTransactions));
      const errors = validations
        .filter((v) => !v.success)
        .map((v) => v.message);

      if (errors.length > 0)
        return new Validation(
          false,
          `Invalid block due to invalid TX: ${errors.join(" ")}`
        );
    }

    if (this.index < 0) return new Validation(false, "Invalid index");
    if (this.index - 1 !== previousIndex)
      return new Validation(false, "Invalid index");

    if (this.timestamp < 1) return new Validation(false, "Invalid Timestamp");

    if (this.previousHash !== previousHash)
      return new Validation(false, "Invalid previous Hash");

    if (this.nonce < 1 || !this.miner) return new Validation(false, "No miner");

    const expectedPrefix = Array(difficuly + 1).join("0");

    if (!this.hash) return new Validation(false, "Invalid Hash");
    if (this.hash !== this.getHash() || !this.hash.startsWith(expectedPrefix))
      return new Validation(false, "Invalid Hash");

    return new Validation();
  }

  static fromBlockInfo(blockInfo: BlockInfoType): Block {
    const block = new Block();

    block.transactions = blockInfo.transactions.map(
      (tx) => new Transaction(tx)
    );
    block.index = blockInfo.index;
    block.previousHash = blockInfo.previousHash;

    return block;
  }
}
