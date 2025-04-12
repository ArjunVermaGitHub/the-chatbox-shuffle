import { createOpenAI } from '@ai-sdk/openai';
import type {
  Plugin,
  // Using string literals as placeholders if types are causing issues,
  // but prefer importing actual types if @elizaos/core build is correct
  ObjectGenerationParams,
  TextEmbeddingParams,
  GenerateTextParams,
  DetokenizeTextParams,
  TokenizeTextParams,
  IAgentRuntime,
} from '@elizaos/core';
// Import the necessary parser and types from core
import { ModelType, logger, parseJSONObjectFromText } from '@elizaos/core';
import { generateObject, generateText } from 'ai';
import { type TiktokenModel, encodingForModel } from 'js-tiktoken';

// Import the local EmbeddingManager specific to this plugin
import { EmbeddingManager } from './embeddingManager';

// --- Tokenizer Functions (Tiktoken-based, suitable for many OpenAI-compatible models) ---
async function tokenizeText(prompt: string): Promise<number[]> {
  // Using gpt-4o's tokenizer is a reasonable default for OpenAI-compatible models
  const modelName = 'gpt-4o';
  try {
    const encoding = encodingForModel(modelName as TiktokenModel);
    const tokens = encoding.encode(prompt);
    // encoding.free(); // Important: free up memory allocated by tiktoken
    return tokens;
  } catch (e) {
    logger.error(
      `[Tokenizer] Failed to encode text with tiktoken model ${modelName}: ${e.message}`
    );
    // Fallback or rethrow depending on desired behavior
    return [];
  }
}

async function detokenizeText(tokens: number[]): Promise<string> {
  const modelName = 'gpt-4o';
  try {
    const encoding = encodingForModel(modelName as TiktokenModel);
    const text = encoding.decode(tokens);
    // encoding.free(); // Important: free up memory allocated by tiktoken
    return text;
  } catch (e) {
    logger.error(
      `[Tokenizer] Failed to decode tokens with tiktoken model ${modelName}: ${e.message}`
    );
    // Fallback or rethrow
    return '';
  }
}
// --- End Tokenizer Functions ---

// Helper to get required headers for OpenRouter
const getOpenRouterHeaders = (runtime: IAgentRuntime): Record<string, string> => {
  const referer = runtime.getSetting('APP_URL') || 'http://localhost:3000'; // Use APP_URL if set
  const title = runtime.getSetting('APP_NAME') || 'ElizaOS Agent'; // Use APP_NAME if set
  return {
    'HTTP-Referer': referer,
    'X-Title': title,
  };
};

// Get the singleton instance of the internal EmbeddingManager
const embeddingManager = EmbeddingManager.getInstance();

// Define the Plugin
export const openrouterPlugin: Plugin = {
  name: 'openrouter',
  description: 'Plugin for OpenRouter (Text/Object Gen) + Local Embeddings (fastembed BGE)',
  config: {}, // Config object (can be used for static config if needed)

  // Initialization function for the plugin
  async init(_config: Record<string, string>, runtime: IAgentRuntime) {
    // Config param is unused now, marked with underscore
    logger.info('[OpenRouter Plugin] Initializing...');
    try {
      const apiKey = runtime.getSetting('OPENROUTER_API_KEY');
      const smallModel = runtime.getSetting('OPENROUTER_SMALL_MODEL');
      const largeModel = runtime.getSetting('OPENROUTER_LARGE_MODEL');

      // Log presence of required settings
      if (!apiKey) {
        logger.warn(
          '[OpenRouter Plugin] OPENROUTER_API_KEY is not set. OpenRouter text/object generation will be unavailable.'
        );
      }
      if (!smallModel) {
        logger.warn(
          '[OpenRouter Plugin] OPENROUTER_SMALL_MODEL is not set. TEXT_SMALL/OBJECT_SMALL functionality will be unavailable.'
        );
      }
      if (!largeModel) {
        logger.warn(
          '[OpenRouter Plugin] OPENROUTER_LARGE_MODEL is not set. TEXT_LARGE/OBJECT_LARGE functionality will be unavailable.'
        );
      }

      // Validate API key connectivity if present
      if (apiKey) {
        const baseURL = runtime.getSetting('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';
        try {
          const response = await fetch(`${baseURL}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!response.ok) {
            const errorText = await response.text();
            logger.warn(
              `[OpenRouter Plugin] API key validation request failed (Status: ${response.status}). Check key/URL. Error: ${errorText}`
            );
          } else {
            logger.info('[OpenRouter Plugin] Initialized (OpenRouter API key appears valid).');
          }
        } catch (fetchError) {
          logger.warn(
            `[OpenRouter Plugin] Error during init validation request: ${fetchError.message}`
          );
        }
      } else {
        logger.info(
          '[OpenRouter Plugin] Initialized (OpenRouter API key not set, text/object models disabled).'
        );
      }

      // Proactively trigger lazy initialization of the internal EmbeddingManager
      // This starts the potential download in the background. Errors here are warnings.
      embeddingManager.generateEmbedding('init').catch((err) => {
        logger.warn(
          '[OpenRouter Plugin] Pre-initialization of internal embedding manager failed (will retry on first use):',
          err.message
        );
      });
    } catch (error) {
      // Catch any synchronous errors in the init setup
      logger.error(`[OpenRouter Plugin] Configuration error during init: ${error.message}`);
    }
  },

  // Model handlers registration
  models: {
    // --- Text Generation Handlers (Using OpenRouter API) ---
    [ModelType.TEXT_SMALL]: async (runtime: IAgentRuntime, params: GenerateTextParams) => {
      const { prompt, stopSequences = [] } = params;
      const apiKey = runtime.getSetting('OPENROUTER_API_KEY');
      const model = runtime.getSetting('OPENROUTER_SMALL_MODEL');
      const baseURL = runtime.getSetting('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';

      if (!apiKey || !model) {
        throw new Error(
          '[OpenRouter Plugin] API Key or Small Model not configured for TEXT_SMALL.'
        );
      }

      const headers = getOpenRouterHeaders(runtime);
      const openrouter = createOpenAI({ apiKey, baseURL, headers });

      try {
        const { text } = await generateText({
          model: openrouter.languageModel(model),
          prompt: prompt,
          system: runtime.character.system ?? undefined,
          stopSequences: stopSequences,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
          frequencyPenalty: params.frequencyPenalty,
          presencePenalty: params.presencePenalty,
        });
        return text;
      } catch (error) {
        logger.error(`[OpenRouter Plugin] TEXT_SMALL Error (Model: ${model}): ${error?.message}`);
        throw error; // Re-throw for the runtime to handle
      }
    },
    [ModelType.TEXT_LARGE]: async (runtime: IAgentRuntime, params: GenerateTextParams) => {
      const {
        prompt,
        stopSequences = [],
        maxTokens,
        temperature,
        frequencyPenalty,
        presencePenalty,
      } = params;
      const apiKey = runtime.getSetting('OPENROUTER_API_KEY');
      const model = runtime.getSetting('OPENROUTER_LARGE_MODEL');
      const baseURL = runtime.getSetting('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';

      if (!apiKey || !model) {
        throw new Error(
          '[OpenRouter Plugin] API Key or Large Model not configured for TEXT_LARGE.'
        );
      }

      const headers = getOpenRouterHeaders(runtime);
      const openrouter = createOpenAI({ apiKey, baseURL, headers });

      try {
        const { text } = await generateText({
          model: openrouter.languageModel(model),
          prompt: prompt,
          system: runtime.character.system ?? undefined,
          maxTokens: maxTokens,
          temperature: temperature,
          frequencyPenalty: frequencyPenalty,
          presencePenalty: presencePenalty,
          stopSequences: stopSequences,
        });
        return text;
      } catch (error) {
        logger.error(`[OpenRouter Plugin] TEXT_LARGE Error (Model: ${model}): ${error?.message}`);
        throw error;
      }
    },

    // --- Object Generation Handlers (Using OpenRouter API) ---
    [ModelType.OBJECT_SMALL]: async (runtime: IAgentRuntime, params: ObjectGenerationParams) => {
      const apiKey = runtime.getSetting('OPENROUTER_API_KEY');
      const model = runtime.getSetting('OPENROUTER_SMALL_MODEL');
      const baseURL = runtime.getSetting('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';

      if (!apiKey || !model) {
        throw new Error(
          '[OpenRouter Plugin] API Key or Small Model not configured for OBJECT_SMALL.'
        );
      }

      const headers = getOpenRouterHeaders(runtime);
      const openrouter = createOpenAI({ apiKey, baseURL, headers });

      try {
        if (params.schema) {
          logger.debug(
            `[OpenRouter Plugin] OBJECT_SMALL using generateObject (tool mode) for Model: ${model}`
          );
          // Attempt to use generateObject with 'tool' mode if schema is provided
          const { object } = await generateObject({
            model: openrouter.languageModel(model),
            schema: params.schema as any, // Pass schema (might need type assertion if not Zod)
            mode: 'tool',
            prompt: params.prompt,
            system: runtime.character.system ?? undefined,
            temperature: params.temperature,
          });
          return object;
        } else {
          // Fallback to text generation and parsing if no schema provided
          logger.debug(
            `[OpenRouter Plugin] OBJECT_SMALL using generateText + parsing for Model: ${model} (No schema provided)`
          );
          let jsonPrompt = params.prompt;
          // Ensure the prompt explicitly asks for JSON output
          if (!jsonPrompt.toLowerCase().includes('respond with valid json')) {
            jsonPrompt +=
              '\nPlease respond with valid JSON only, without any explanations or markdown formatting.';
          }

          const { text } = await generateText({
            model: openrouter.languageModel(model),
            prompt: jsonPrompt, // Use modified prompt
            system: runtime.character.system ?? undefined,
            temperature: params.temperature ?? 0.2, // Lower temp for structured output
            stopSequences: params.stopSequences,
          });

          const parsedObject = parseJSONObjectFromText(text);
          if (!parsedObject) {
            logger.error(
              `[OpenRouter Plugin] OBJECT_SMALL failed to parse JSON from text output (Model: ${model}). Output: ${text}`
            );
            throw new Error('Failed to parse JSON object from model response.');
          }
          return parsedObject;
        }
      } catch (error) {
        logger.error(`[OpenRouter Plugin] OBJECT_SMALL Error (Model: ${model}): ${error?.message}`);
        logger.debug(
          `[OpenRouter Plugin] Failing prompt for OBJECT_SMALL: ${params.prompt.substring(0, 500)}...`
        );
        throw error;
      }
    },

    [ModelType.OBJECT_LARGE]: async (runtime: IAgentRuntime, params: ObjectGenerationParams) => {
      const apiKey = runtime.getSetting('OPENROUTER_API_KEY');
      const model = runtime.getSetting('OPENROUTER_LARGE_MODEL');
      const baseURL = runtime.getSetting('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';

      if (!apiKey || !model) {
        throw new Error(
          '[OpenRouter Plugin] API Key or Large Model not configured for OBJECT_LARGE.'
        );
      }

      const headers = getOpenRouterHeaders(runtime);
      const openrouter = createOpenAI({ apiKey, baseURL, headers });

      try {
        if (params.schema) {
          logger.debug(
            `[OpenRouter Plugin] OBJECT_LARGE using generateObject (tool mode) for Model: ${model}`
          );
          const { object } = await generateObject({
            model: openrouter.languageModel(model),
            schema: params.schema as any, // Pass schema
            mode: 'tool',
            prompt: params.prompt,
            system: runtime.character.system ?? undefined,
            temperature: params.temperature,
          });
          return object;
        } else {
          logger.debug(
            `[OpenRouter Plugin] OBJECT_LARGE using generateText + parsing for Model: ${model} (No schema provided)`
          );
          let jsonPrompt = params.prompt;
          // Ensure the prompt explicitly asks for JSON output
          if (!jsonPrompt.toLowerCase().includes('respond with valid json')) {
            jsonPrompt +=
              '\nPlease respond with valid JSON only, without any explanations or markdown formatting.';
          }
          const { text } = await generateText({
            model: openrouter.languageModel(model),
            prompt: jsonPrompt, // Use modified prompt
            system: runtime.character.system ?? undefined,
            temperature: params.temperature ?? 0.2, // Lower temp for structured output
            stopSequences: params.stopSequences,
          });

          const parsedObject = parseJSONObjectFromText(text);
          if (!parsedObject) {
            logger.error(
              `[OpenRouter Plugin] OBJECT_LARGE failed to parse JSON from text output (Model: ${model}). Output: ${text}`
            );
            throw new Error('Failed to parse JSON object from model response.');
          }
          return parsedObject;
        }
      } catch (error) {
        logger.error(`[OpenRouter Plugin] OBJECT_LARGE Error (Model: ${model}): ${error?.message}`);
        logger.debug(
          `[OpenRouter Plugin] Failing prompt for OBJECT_LARGE: ${params.prompt.substring(0, 500)}...`
        );
        throw error;
      }
    },

    // --- Embedding Handler (Uses the internal EmbeddingManager) ---
    [ModelType.TEXT_EMBEDDING]: async (
      _runtime: IAgentRuntime, // Runtime instance not strictly needed here if manager is singleton
      params: TextEmbeddingParams | string | null
    ): Promise<number[]> => {
      const FALLBACK_DIMENSION = 384; // BGE-small-en-v1.5 dimension
      const createZeroVector = (dim = FALLBACK_DIMENSION) => Array(dim).fill(0);

      // --- Input Validation ---
      if (params === null) {
        logger.debug('[OpenRouter Plugin][Embed] Null input received, returning zero vector.');
        return createZeroVector();
      }
      let text: string;
      if (typeof params === 'string') {
        text = params;
      } else if (typeof params === 'object' && params !== null && typeof params.text === 'string') {
        // Handle TextEmbeddingParams object
        text = params.text;
      } else {
        logger.warn(
          '[OpenRouter Plugin][Embed] Invalid input type for TEXT_EMBEDDING, returning zero vector.'
        );
        return createZeroVector();
      }
      if (!text.trim()) {
        logger.debug('[OpenRouter Plugin][Embed] Empty text input, returning zero vector.');
        return createZeroVector();
      }
      // --- End Input Validation ---

      logger.debug(
        '[OpenRouter Plugin] Handling TEXT_EMBEDDING request using internal local EmbeddingManager.'
      );

      try {
        // Use the singleton instance of the internal EmbeddingManager
        const embedding = await embeddingManager.generateEmbedding(text);

        // Check if the embedding manager returned an empty array (indicating failure)
        if (!embedding || embedding.length === 0) {
          logger.warn(
            '[OpenRouter Plugin] Internal EmbeddingManager returned empty embedding, falling back to zero vector.'
          );
          return createZeroVector();
        }

        logger.debug(
          `[OpenRouter Plugin] Successfully generated local embedding with dimension ${embedding.length}`
        );
        return embedding;
      } catch (error) {
        // Catch errors specifically from the generateEmbedding call
        logger.error(
          '[OpenRouter Plugin] Error generating embedding via local EmbeddingManager:',
          error?.message || error
        );
        // Fallback to zero vector if local generation fails
        return createZeroVector();
      }
    },

    // --- Tokenizers (Uses Tiktoken) ---
    [ModelType.TEXT_TOKENIZER_ENCODE]: async (
      _runtime: IAgentRuntime, // Runtime not needed for tiktoken
      { prompt }: TokenizeTextParams
    ): Promise<number[]> => {
      try {
        return await tokenizeText(prompt);
      } catch (error) {
        logger.error('[OpenRouter Plugin] Tokenization (encode) failed:', error);
        return []; // Return empty array on failure
      }
    },
    [ModelType.TEXT_TOKENIZER_DECODE]: async (
      _runtime: IAgentRuntime, // Runtime not needed for tiktoken
      { tokens }: DetokenizeTextParams
    ): Promise<string> => {
      try {
        return await detokenizeText(tokens);
      } catch (error) {
        logger.error('[OpenRouter Plugin] Detokenization (decode) failed:', error);
        return ''; // Return empty string on failure
      }
    },
  },
};

// Export the plugin as the default export
export default openrouterPlugin;
