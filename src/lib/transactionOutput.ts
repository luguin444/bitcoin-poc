import { Validation } from "./validation";
import { SHA256 } from "crypto-js";

export class TransactionOutput {
  toAddress: string;
  amount: number;
  tx: string;

  constructor(txOutput?: TransactionOutput) {
    this.toAddress = txOutput?.toAddress || "";
    this.amount = txOutput?.amount || 0;
    this.tx = txOutput?.tx || ""; // hash da transaction tat generated this output
  }

  getHash(): string {
    return SHA256(this.toAddress + this.amount).toString();
  }

  isValid(): Validation {
    if (this.amount < 1) return new Validation(false, "Negative amount");

    return new Validation();
  }
}
