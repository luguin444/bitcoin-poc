import { BlockInfoType, TransactionSearch } from "./protocols";
import { Block } from "./block";
import { TransactionType } from "./protocols";
import { Transaction } from "./transaction";
import { Validation } from "./validation";
import { TransactionInput } from "./transactionInput";
import { TransactionOutput } from "./transactionOutput";

export class BlockChain {
  blocks: Block[] = [];
  mempool: Transaction[] = [];
  nextIndex: number = 0;
  static readonly DIFFICULTY_FACTOR = 2;
  static readonly MAX_DIFFICULTY_FACTOR = 62;
  static readonly TX_PER_BLOCK = 2;

  constructor(miner: string) {
    const genisisblock = this.createGenisisBlock(miner);

    this.blocks = [genisisblock];
    this.mempool = [];
    this.nextIndex++;
  }

  createGenisisBlock(miner: string): Block {
    const amount = BlockChain.getRewardAmountForBlockMine(this.getDifficulty());

    const tx = Transaction.getRewardTransactionFromTXO(
      new TransactionOutput({
        toAddress: miner,
        amount,
      } as TransactionOutput)
    );

    const block = new Block();
    block.transactions = [tx];

    block.mine(this.getDifficulty(), miner);

    return block;
  }

  addBlock(block: Block): Validation {
    const nextBlock = this.getNextBlock();
    if (!nextBlock) return new Validation(false, "No transactions in mempool");

    const validation = block.isValid(
      nextBlock.previousHash,
      nextBlock.index - 1,
      nextBlock.difficulty,
      nextBlock.feePerTx
    );

    if (!validation.success)
      return new Validation(false, `Invalid block: ${validation.message}`);

    const hashesInsertedFromMempool = block.transactions
      .filter((tx) => tx.type !== TransactionType.FEE)
      .map((tx) => tx.hash);
    const newMempool = this.mempool.filter(
      (tx) => !hashesInsertedFromMempool.includes(tx.hash)
    );
    if (
      newMempool.length + hashesInsertedFromMempool.length !==
      this.mempool.length
    )
      return new Validation(false, `Invalid txs: not from mempool`);

    this.mempool = newMempool;

    this.blocks.push(block);
    this.nextIndex++;

    return new Validation();
  }

  getLastBlock(): Block {
    return this.blocks[this.blocks.length - 1];
  }

  getBlock(hash: string): Block | undefined {
    return this.blocks.find((block) => block.hash === hash);
  }

  getDifficulty(): number {
    return Math.ceil(this.blocks.length / BlockChain.DIFFICULTY_FACTOR) + 1;
  }

  isValid(): Validation {
    for (let i = this.blocks.length - 1; i > 0; i--) {
      const currentBlock = this.blocks[i];
      const previousBlock = this.blocks[i - 1];

      const validation = currentBlock.isValid(
        previousBlock.hash,
        previousBlock.index,
        this.getDifficulty(),
        this.getFeePerTx()
      );
      if (!validation.success) {
        return new Validation(
          false,
          `Invalid block #${currentBlock.index}: ${validation.message}`
        );
      }
    }

    return new Validation();
  }

  getFeePerTx(): number {
    return 1;
  }

  getNextBlock(): BlockInfoType | null {
    if (this.mempool.length === 0) return null;

    const transactions = this.mempool.slice(0, BlockChain.TX_PER_BLOCK);
    return {
      index: this.blocks.length,
      previousHash: this.getLastBlock().hash,
      difficulty: this.getDifficulty(),
      maxDifficulty: BlockChain.MAX_DIFFICULTY_FACTOR,
      feePerTx: this.getFeePerTx(),
      transactions: transactions,
    };
  }

  addTransaction(tx: Transaction): Validation {
    const totalFeeForTransaction = 1 * this.getFeePerTx(); // only one transaction
    const validation = tx.isValid(this.getDifficulty(), totalFeeForTransaction);
    if (!validation.success)
      return new Validation(
        false,
        `Invalid transaction: ${validation.message}`
      );

    if (tx.txInputs && tx.txInputs.length > 0) {
      const fromAddress = tx.txInputs[0].fromAddress;

      const pendingTx = this.mempool
        .filter((tx) => tx.txInputs && tx.txInputs.length > 0)
        .map((tx) => tx.txInputs)
        .flat()
        .some((txInput) => txInput!.fromAddress === fromAddress);

      if (pendingTx)
        return new Validation(
          false,
          "Wallet has pending transaction in mempool"
        );

      const utxos = this.getUtxo(fromAddress);

      for (let i = 0; i < tx.txInputs.length; i++) {
        const txi = tx.txInputs[i];

        const existValidUtxo = utxos.find(
          (txo) => txo.tx === txi.previousTx && txo.amount >= txi.amount // aqui o amout não deveria ser o somatório de txos?
        );
        if (!existValidUtxo)
          return new Validation(false, "Invalid transaction: no utxo valid");
      }
    }

    const hasAlreadyBeenInserted = this.blocks.some((block) =>
      block.transactions.some((blockTx) => blockTx.getHash() === tx.hash)
    );
    if (hasAlreadyBeenInserted)
      return new Validation(false, "Duplicated tx in blockchain");

    this.mempool.push(tx);

    return new Validation();
  }

  getTransaction(hash: string): TransactionSearch {
    const mempoolIndex = this.mempool.findIndex((tx) => tx.hash === hash);

    if (mempoolIndex !== -1)
      return {
        mempoolIndex,
        transaction: this.mempool[mempoolIndex],
        blockIndex: -1,
      } as TransactionSearch;

    const blockIndex = this.blocks.findIndex((block) =>
      block.transactions.some((tx) => tx.hash === hash)
    );
    if (blockIndex !== -1)
      return {
        mempoolIndex: -1,
        transaction: this.blocks[blockIndex].transactions.find(
          (tx) => tx.hash === hash
        ),
        blockIndex,
      } as TransactionSearch;

    return {
      mempoolIndex: -1,
      transaction: null,
      blockIndex: -1,
    } as TransactionSearch;
  }

  getTxInputs(publicKey: string): (TransactionInput | undefined)[] {
    return this.blocks
      .map((block) => block.transactions)
      .flat()
      .filter((tx) => tx.txInputs && tx.txInputs.length > 0)
      .map((tx) => tx.txInputs)
      .flat()
      .filter((txInput) => txInput!.fromAddress === publicKey);
  }

  getTxOutputs(publicKey: string): TransactionOutput[] {
    return this.blocks
      .map((block) => block.transactions)
      .flat()
      .filter((tx) => tx.txOutputs && tx.txOutputs.length > 0)
      .map((tx) => tx.txOutputs)
      .flat()
      .filter((txOutput) => txOutput.toAddress === publicKey);
  }

  getUtxo(publicKey: string): TransactionOutput[] {
    const txIns = this.getTxInputs(publicKey); // spent
    const txOuts = this.getTxOutputs(publicKey); // received

    if (txIns.length === 0) return txOuts;

    txIns.forEach((txIn) => {
      const index = txOuts.findIndex((txo) => txo.amount === txIn!.amount);
      txOuts.splice(index, 1); // remove txo found in index
    });

    return txOuts;
  }

  getBalance(publicKey: string): number {
    const utxos = this.getUtxo(publicKey);
    if (!utxos || utxos.length === 0) return 0;

    return utxos.reduce((acc, txo) => acc + txo.amount, 0);
  }

  static getRewardAmountForBlockMine(difficulty: number): number {
    return (64 - difficulty) * 10;
  }
}
