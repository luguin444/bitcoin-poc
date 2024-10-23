import { SHA256 } from "crypto-js";
import { TransactionType } from "./protocols";
import { Validation } from "./validation";
import { TransactionInput } from "./transactionInput";
import { TransactionOutput } from "./transactionOutput";
import { BlockChain } from "./blockchain";

/**
 * Transaction class
 */
export class Transaction {
  type: TransactionType;
  timestamp: number;
  hash: string;
  txOutputs: TransactionOutput[];
  txInputs: TransactionInput[] | undefined;

  constructor(tx?: Transaction) {
    this.type = tx?.type || TransactionType.REGULAR;
    this.timestamp = tx?.timestamp || Date.now();
    this.txOutputs = tx?.txOutputs
      ? tx.txOutputs.map((txo) => new TransactionOutput(txo))
      : [];
    this.txInputs = tx?.txInputs
      ? tx.txInputs.map((txi) => new TransactionInput(txi))
      : undefined;

    this.hash = tx?.hash || this.getHash();

    this.txOutputs.forEach((txo) => (txo.tx = this.hash));
  }

  getHash(): string {
    const from =
      this.txInputs && this.txInputs.length > 0
        ? this.txInputs.map((txi) => txi.signature).join(",")
        : "";

    const to =
      this.txOutputs && this.txOutputs.length > 0
        ? this.txOutputs.map((txo) => txo.getHash()).join(",")
        : "";

    return SHA256(this.type + to + from + this.timestamp).toString();
  }

  isValid(difficulty: number, totalTransactionsFees: number): Validation {
    if (this.timestamp < 1) return new Validation(false, "Invalid Timestamp");

    if (
      !this.txOutputs ||
      !this.txOutputs.length ||
      this.txOutputs.map((txo) => txo.isValid()).some((v) => !v.success)
    )
      return new Validation(false, "Invalid TXOs");

    if (this.txInputs && this.txInputs.length) {
      const falsyValidations = this.txInputs
        ?.map((txi) => txi.isValid())
        .filter((v) => !v.success);

      if (falsyValidations && falsyValidations.length) {
        const message = falsyValidations.map((v) => v.message).join(" ");
        return new Validation(false, `Invalid tx: ${message}`);
      }
      const inputSum = this.txInputs
        .map((txi) => txi.amount)
        .reduce((a, b) => a + b, 0);

      const outputSum = this.txOutputs
        .map((txo) => txo.amount)
        .reduce((a, b) => a + b, 0);

      if (inputSum < outputSum) {
        return new Validation(
          false,
          `Invalid tx: input amounts must be equals or greater than outputs amounts.`
        );
      }
    }

    if (this.txOutputs.some((txo) => txo.tx !== this.getHash())) {
      return new Validation(false, "Invalid txo reference hash");
    }

    if (!this.hash || this.hash !== this.getHash())
      return new Validation(false, "Invalid hash");

    if (this.type === TransactionType.FEE) {
      const txo = this.txOutputs[0];

      if (
        txo.amount >
        BlockChain.getRewardAmountForBlockMine(difficulty) +
          totalTransactionsFees
      ) {
        return new Validation(false, "Invalid fee reward");
      }
    }

    return new Validation();
  }

  getFee(): number {
    if (this.txInputs && this.txInputs.length) {
      const inputSum = this.txInputs
        ?.map((txi) => txi.amount)
        .reduce((acc, amount) => acc + amount, 0);

      const outputSum = this.txOutputs
        ?.map((txo) => txo.amount)
        .reduce((acc, amount) => acc + amount, 0);

      return inputSum - outputSum;
    }

    return 0;
  }

  static getRewardTransactionFromTXO(txo: TransactionOutput): Transaction {
    const tx = new Transaction({
      type: TransactionType.FEE,
      txOutputs: [txo],
    } as Transaction);

    tx.hash = tx.getHash();
    tx.txOutputs[0].tx = tx.hash;

    return tx;
  }
}
