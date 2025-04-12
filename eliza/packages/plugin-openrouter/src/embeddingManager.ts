//eliza_v2/packages/plugin-openrouter/src/embeddingManager.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger } from '@elizaos/core';
// REMOVED: import { type InitOptions } from 'fastembed'; // This type is not exported
import { EmbeddingModel, FlagEmbedding } from 'fastembed';

/**
 * Manages the local embedding model using fastembed.
 * This is self-contained within the openrouter plugin.
 */
export class EmbeddingManager {
  private static instance: EmbeddingManager | null = null;
  private modelsDir: string;
  private embeddingModel: FlagEmbedding | null = null;
  private embeddingInitialized = false;
  private embeddingInitializingPromise: Promise<void> | null = null;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    // Determine models directory (consistent logic)
    const modelsBaseDir = process.env.LLAMALOCAL_PATH?.trim()
      ? path.resolve(process.env.LLAMALOCAL_PATH.trim())
      : path.join(os.homedir(), '.eliza', 'models');
    // Store embedding model in a specific subdirectory to avoid conflicts
    this.modelsDir = path.join(modelsBaseDir, 'embeddings', 'bge-small-en-v1.5');

    this.ensureModelsDirectory();
    logger.debug('[EmbeddingManager] Initialized within OpenRouter Plugin');
  }

  /**
   * Returns the singleton instance of EmbeddingManager.
   * @returns {EmbeddingManager} The singleton instance.
   */
  public static getInstance(): EmbeddingManager {
    if (!EmbeddingManager.instance) {
      EmbeddingManager.instance = new EmbeddingManager();
    }
    return EmbeddingManager.instance;
  }

  /**
   * Ensures the directory for storing embedding models exists.
   */
  private ensureModelsDirectory(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      logger.debug('[EmbeddingManager] Created models directory:', this.modelsDir);
    } else {
      logger.debug('[EmbeddingManager] Models directory already exists:', this.modelsDir);
    }
  }

  /**
   * Initializes the embedding model if not already initialized.
   * Handles concurrent initialization attempts.
   * @returns {Promise<void>}
   */
  private async initializeEmbedding(): Promise<void> {
    // Check if already initialized
    if (this.embeddingInitialized) {
      logger.debug('[EmbeddingManager] Embedding model already initialized.');
      return;
    }

    // Check if initialization is already in progress
    if (this.embeddingInitializingPromise) {
      logger.info('[EmbeddingManager] Waiting for existing initialization to complete...');
      await this.embeddingInitializingPromise;
      // After waiting, check again if initialization was successful
      if (!this.embeddingInitialized) {
        throw new Error('[EmbeddingManager] Waited for initialization, but it failed.');
      }
      logger.debug('[EmbeddingManager] Initialization completed by another call.');
      return; // Initialization completed by another call
    }

    // Start initialization
    logger.info('[EmbeddingManager] Starting embedding model initialization...');
    this.embeddingInitializingPromise = (async () => {
      try {
        // Check again inside the promise in case of race conditions
        if (this.embeddingInitialized) {
          logger.debug('[EmbeddingManager] Initialization completed by another call before lock.');
          return;
        }

        logger.debug('[EmbeddingManager] Embedding models directory:', this.modelsDir);

        if (!this.embeddingModel) {
          logger.info(
            '[EmbeddingManager] Creating new FlagEmbedding instance with BGESmallENV15 model'
          );

          // Define options for FlagEmbedding.init
          // Use Partial<any> or a more specific known subset if InitOptions isn't available
          const initOptions: Partial<any> = {
            // Using Partial<any> as InitOptions is not exported
            cacheDir: this.modelsDir, // Directory where model files are stored/cached
            model: EmbeddingModel.BGESmallENV15,
            maxLength: 512,
            // Let fastembed handle its default progress logging
            showDownloadProgress: true, // Explicitly true, fastembed defaults might vary
          };

          this.embeddingModel = await FlagEmbedding.init(initOptions);

          this.embeddingInitialized = true; // Set flag only on success
          logger.success('[EmbeddingManager] FlagEmbedding instance created successfully');
        } else {
          logger.debug('[EmbeddingManager] Embedding model instance already exists.');
          this.embeddingInitialized = true; // Mark as initialized if instance exists
        }
      } catch (error) {
        logger.error('[EmbeddingManager] Embedding initialization failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          modelsDir: this.modelsDir,
          model: EmbeddingModel.BGESmallENV15,
        });
        this.embeddingInitialized = false; // Ensure flag is false on error
        throw error; // Re-throw error after logging
      } finally {
        // Clear the promise regardless of success or failure
        this.embeddingInitializingPromise = null;
      }
    })();

    // Wait for the initialization promise to resolve or reject
    await this.embeddingInitializingPromise;
    // After awaiting, check the final status
    if (!this.embeddingInitialized) {
      // This means the initialization process completed but failed
      throw new Error('[EmbeddingManager] Initialization process finished but failed.');
    }
    logger.debug('[EmbeddingManager] Initialization promise resolved successfully.');
  }

  /**
   * Generates an embedding for the given text using the local model.
   * Ensures the embedding model is initialized before generating.
   * @param {string} text - The text to embed.
   * @returns {Promise<number[]>} A promise that resolves with the embedding vector.
   * @throws {Error} If initialization or generation fails.
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Ensure the model is initialized (lazy loading)
      await this.initializeEmbedding();

      if (!this.embeddingModel) {
        // This case should ideally not be reached if initializeEmbedding throws on failure
        logger.error(
          '[EmbeddingManager] Embedding model is not available after initialization attempt.'
        );
        return []; // Return empty array if model is unexpectedly null
      }

      logger.debug('[EmbeddingManager] Generating query embedding for text length:', text.length);
      // Fastembed expects an array of strings, even for a single input
      const generator = this.embeddingModel.embed([text]);

      // Process the AsyncGenerator to get the result
      let embedding: number[] | undefined;
      for await (const result of generator) {
        // result is number[][]
        if (result && result.length > 0 && result[0] && result[0].length > 0) {
          embedding = result[0];
          break; // Stop after the first result for the single input string
        }
      }

      if (!embedding || embedding.length === 0) {
        logger.warn(
          '[EmbeddingManager] Fastembed returned no embeddings or an empty embedding for the input text.'
        );
        return []; // Return empty array if embedding is invalid
      }

      const dimensions = embedding.length;
      logger.debug('[EmbeddingManager] Embedding generation complete', { dimensions });

      // Ensure the output is a standard number array
      return Array.from(embedding);
    } catch (error) {
      logger.error('[EmbeddingManager] Embedding generation failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        textLength: text?.length ?? 'null/undefined',
      });
      // Return empty array on failure, let the caller handle fallback
      return [];
    }
  }
}
