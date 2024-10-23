import * as ecc from "tiny-secp256k1";
import ECPairFactory from "ecpair";
import { SHA256 } from "crypto-js";
import { Validation } from "./validation";
import { TransactionOutput } from "./transactionOutput";

const ECPair = ECPairFactory(ecc);

export class TransactionInput {
  fromAddress: string;
  amount: number;
  signature: string;
  previousTx: string;

  constructor(txInput?: TransactionInput) {
    this.fromAddress = txInput?.fromAddress || "";
    this.amount = txInput?.amount || 0;
    this.signature = txInput?.signature || "";
    this.previousTx = txInput?.previousTx || ""; // utxo.tx that allows this txi to be spent  ( has funds )
  }

  sign(privateKey: string): void {
    const wallet = ECPair.fromPrivateKey(Buffer.from(privateKey, "hex"));
    const dataToSign = this.getHash();

    this.signature = wallet
      .sign(Buffer.from(dataToSign, "hex"))
      .toString("hex");
  }

  getHash(): string {
    return SHA256(this.fromAddress + this.amount + this.previousTx).toString();
  }

  isValid(): Validation {
    if (!this.signature) return new Validation(false, "Signature required");
    if (!this.previousTx) return new Validation(false, "Previous Tx required");
    if (this.amount < 1) return new Validation(false, "Amout greater than 0");
    if (!this.fromAddress) return new Validation(false, "Invalid fromAddress");

    const wallet = ECPair.fromPublicKey(Buffer.from(this.fromAddress, "hex"));

    // hash was really signed by the privateKey?
    if (
      !wallet.verify(
        Buffer.from(this.getHash(), "hex"),
        Buffer.from(this.signature, "hex")
      )
    )
      return new Validation(false, "Invalid signature");

    return new Validation();
  }

  static fromTxo(txo: TransactionOutput): TransactionInput {
    return new TransactionInput({
      fromAddress: txo.toAddress,
      amount: txo.amount,
      previousTx: txo.tx,
    } as TransactionInput);
  }
}
