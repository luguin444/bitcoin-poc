import { Transaction } from "./transaction";

export type BlockInfoType = {
  index: number;
  previousHash: string;
  difficulty: number;
  maxDifficulty: number;
  feePerTx: number;
  transactions: Transaction[];
};

export enum TransactionType {
  REGULAR = 1,
  FEE = 2,
}

export type TransactionSearch = {
  transaction: Transaction | null;
  mempoolIndex: number;
  blockIndex: number;
};
