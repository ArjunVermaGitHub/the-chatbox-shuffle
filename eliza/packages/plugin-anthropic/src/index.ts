import { anthropic } from '@ai-sdk/anthropic';
import type {
  IAgentRuntime,
  ObjectGenerationParams,
  GenerateTextParams,
  Plugin,
} from '@elizaos/core';
import { ModelType, logger } from '@elizaos/core';
import { generateText } from 'ai';

export const anthropicPlugin: Plugin = {
  name: 'anthropic',
  description: 'Anthropic plugin (supports text generation only)',
  config: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_SMALL_MODEL: process.env.ANTHROPIC_SMALL_MODEL,
    ANTHROPIC_LARGE_MODEL: process.env.ANTHROPIC_LARGE_MODEL,
  },
  async init(config: Record<string, string>) {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn(
          'ANTHROPIC_API_KEY is not set in environment - Anthropic functionality will be limited'
        );
        return;
      }
    } catch (error) {
      logger.warn(
        `Anthropic plugin configuration issue: ${error.errors
          .map((e) => e.message)
          .join(', ')} - You need to configure the ANTHROPIC_API_KEY in your environment variables`
      );
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (runtime, { prompt, stopSequences = [] }: GenerateTextParams) => {
      const temperature = 0.7;
      const smallModel = runtime.getSetting('ANTHROPIC_SMALL_MODEL') ?? 'claude-3-haiku-20240307';
      const maxTokens = smallModel.includes('-3-') ? 4096 : 8192;

      const { text } = await generateText({
        model: anthropic(smallModel),
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        stopSequences,
      });
      return text;
    },

    [ModelType.TEXT_LARGE]: async (
      runtime,
      {
        prompt,
        maxTokens = 8192,
        stopSequences = [],
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams
    ) => {
      const largeModel = runtime.getSetting('ANTHROPIC_LARGE_MODEL') ?? 'claude-3-5-sonnet-latest';

      const { text } = await generateText({
        model: anthropic(largeModel),
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        stopSequences,
        frequencyPenalty,
        presencePenalty,
      });
      return text;
    },

    [ModelType.OBJECT_SMALL]: async (runtime, params: ObjectGenerationParams) => {
      const smallModel = runtime.getSetting('ANTHROPIC_SMALL_MODEL') ?? 'claude-3-haiku-20240307';
      try {
        const isReflection = params.schema?.facts && params.schema.relationships;

        let jsonPrompt = params.prompt;

        if (!jsonPrompt.includes('```json') && !jsonPrompt.includes('respond with valid JSON')) {
          jsonPrompt +=
            '\nPlease respond with valid JSON only, without any explanations, markdown formatting, or additional text.';
        }

        let systemPrompt = runtime.character.system
          ? `${runtime.character.system}\nYou must respond with valid JSON only.`
          : 'You must respond with valid JSON only.';

        if (isReflection) {
          systemPrompt +=
            " Ensure your response includes 'thought', 'facts', and 'relationships' properties exactly as specified in the prompt.";
        } else {
          systemPrompt += ' No markdown, no code blocks, no explanation text.';
        }

        const { text } = await generateText({
          model: anthropic(smallModel),
          prompt: jsonPrompt,
          system: systemPrompt,
          temperature: params.temperature || 0.2,
        });

        try {
          const extractJSON = (text: string): string => {
            const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            const match = text.match(jsonBlockRegex);

            if (match && match[1]) {
              return match[1].trim();
            }

            const jsonContentRegex = /\s*(\{[\s\S]*\})\s*$/;
            const contentMatch = text.match(jsonContentRegex);

            if (contentMatch && contentMatch[1]) {
              return contentMatch[1].trim();
            }

            return text.trim();
          };

          const extractedJsonText = extractJSON(text);
          logger.debug('Extracted JSON text:', extractedJsonText);

          let jsonObject;
          try {
            jsonObject = JSON.parse(text);
          } catch (parseError) {
            logger.debug('Initial JSON parse failed, attempting to fix common issues');

            let fixedJson = extractedJsonText
              .replace(/:\s*"([^"]*)(?:\n)([^"]*)"/g, ': "$1\\n$2"')
              .replace(/"([^"]*?)[^a-zA-Z0-9\s\.,;:\-_\(\)"'\[\]{}]([^"]*?)"/g, '"$1$2"')
              .replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:')
              .replace(/,(\s*[\]}])/g, '$1');

            const brokenStringRegex = /"([^"]*?)([^"]*?)"\s*,\s*"([^"]+)"\s*:/g;
            while (brokenStringRegex.test(fixedJson)) {
              fixedJson = fixedJson.replace(brokenStringRegex, '"$1$2",\n"$3":');
            }

            try {
              jsonObject = JSON.parse(fixedJson);
            } catch (finalError) {
              if (isReflection) {
                logger.debug('Attempting manual reconstruction of reflection schema');

                const thoughtMatch = extractedJsonText.match(/"thought"\s*:\s*"([^"]+)"/);
                const thoughtValue = thoughtMatch ? thoughtMatch[1] : '';

                jsonObject = {
                  thought: thoughtValue || 'Unable to extract valid thought from model response',
                  facts: [],
                  relationships: [],
                };

                const factMatches = extractedJsonText.match(/"claim"\s*:\s*"([^"]+)"/g);
                if (factMatches) {
                  jsonObject.facts = factMatches.map((match) => ({
                    claim: match.replace(/"claim"\s*:\s*"([^"]+)"/, '$1'),
                    type: 'fact',
                    in_bio: false,
                    already_known: false,
                  }));
                }

                logger.debug('Manually reconstructed object:', jsonObject);
              } else {
                throw finalError;
              }
            }
          }

          if (isReflection && jsonObject) {
            if (!jsonObject.thought) jsonObject.thought = '';
            if (!jsonObject.facts) jsonObject.facts = [];
            if (!jsonObject.relationships) jsonObject.relationships = [];
          }

          return jsonObject;
        } catch (parseError) {
          logger.error('Failed to parse JSON from Anthropic response:', parseError);
          logger.error('Raw response:', text);
          throw new Error('Invalid JSON returned from Anthropic model');
        }
      } catch (error) {
        logger.error('Error generating object:', error);
        throw error;
      }
    },

    [ModelType.OBJECT_LARGE]: async (runtime, params: ObjectGenerationParams) => {
      const largeModel = runtime.getSetting('ANTHROPIC_LARGE_MODEL') ?? 'claude-3-5-sonnet-latest';
      try {
        const isReflection = params.schema?.facts && params.schema.relationships;

        let jsonPrompt = params.prompt;

        if (!jsonPrompt.includes('```json') && !jsonPrompt.includes('respond with valid JSON')) {
          jsonPrompt +=
            '\nPlease respond with valid JSON only, without any explanations, markdown formatting, or additional text.';
        }

        let systemPrompt = runtime.character.system
          ? `${runtime.character.system}\nYou must respond with valid JSON only.`
          : 'You must respond with valid JSON only.';

        if (isReflection) {
          systemPrompt +=
            " Ensure your response includes 'thought', 'facts', and 'relationships' properties exactly as specified in the prompt.";
        } else {
          systemPrompt += ' No markdown, no code blocks, no explanation text.';
        }

        const { text } = await generateText({
          model: anthropic(largeModel),
          prompt: jsonPrompt,
          system: systemPrompt,
          temperature: params.temperature || 0.2,
        });

        try {
          const extractJSON = (text: string): string => {
            const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            const match = text.match(jsonBlockRegex);

            if (match && match[1]) {
              return match[1].trim();
            }

            const jsonContentRegex = /\s*(\{[\s\S]*\})\s*$/;
            const contentMatch = text.match(jsonContentRegex);

            if (contentMatch && contentMatch[1]) {
              return contentMatch[1].trim();
            }

            return text.trim();
          };

          const cleanupJSON = (jsonText: string): string => {
            return jsonText
              .replace(/Waiting for the debugger[^"]*?(\w)/g, '$1')
              .replace(/\[DEBUG\].*?(\n|$)/g, '\n')
              .replace(/\[LOG\].*?(\n|$)/g, '\n')
              .replace(/console\.log.*?(\n|$)/g, '\n');
          };

          let extractedJsonText = extractJSON(text);
          extractedJsonText = cleanupJSON(extractedJsonText);
          logger.debug('Extracted JSON text:', extractedJsonText);

          let jsonObject;
          try {
            jsonObject = JSON.parse(extractedJsonText);
          } catch (parseError) {
            logger.debug('Initial JSON parse failed, attempting to fix common issues');

            let fixedJson = extractedJsonText
              .replace(/:\s*"([^"]*)(?:\n)([^"]*)"/g, ': "$1\\n$2"')
              .replace(/"([^"]*?)[^a-zA-Z0-9\s\.,;:\-_\(\)"'\[\]{}]([^"]*?)"/g, '"$1$2"')
              .replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:')
              .replace(/,(\s*[\]}])/g, '$1');

            const brokenStringRegex = /"([^"]*?)([^"]*?)"\s*,\s*"([^"]+)"\s*:/g;
            while (brokenStringRegex.test(fixedJson)) {
              fixedJson = fixedJson.replace(brokenStringRegex, '"$1$2",\n"$3":');
            }

            try {
              jsonObject = JSON.parse(fixedJson);
            } catch (finalError) {
              if (isReflection) {
                logger.debug('Attempting manual reconstruction of reflection schema');

                const thoughtMatch = extractedJsonText.match(/"thought"\s*:\s*"([^"]+)"/);
                const thoughtValue = thoughtMatch ? thoughtMatch[1] : '';

                jsonObject = {
                  thought: thoughtValue || 'Unable to extract valid thought from model response',
                  facts: [],
                  relationships: [],
                };

                const factMatches = extractedJsonText.match(/"claim"\s*:\s*"([^"]+)"/g);
                if (factMatches) {
                  jsonObject.facts = factMatches.map((match) => ({
                    claim: match.replace(/"claim"\s*:\s*"([^"]+)"/, '$1'),
                    type: 'fact',
                    in_bio: false,
                    already_known: false,
                  }));
                }

                logger.debug('Manually reconstructed object:', jsonObject);
              } else {
                throw finalError;
              }
            }
          }

          if (isReflection && jsonObject) {
            if (!jsonObject.thought) jsonObject.thought = '';
            if (!jsonObject.facts) jsonObject.facts = [];
            if (!jsonObject.relationships) jsonObject.relationships = [];
          }

          return jsonObject;
        } catch (parseError) {
          logger.error('Failed to parse JSON from Anthropic response:', parseError);
          logger.error('Raw response:', text);
          throw new Error('Invalid JSON returned from Anthropic model');
        }
      } catch (error) {
        logger.error('Error generating object:', error);
        throw error;
      }
    },
  },
  tests: [
    {
      name: 'anthropic_plugin_tests',
      tests: [
        {
          name: 'anthropic_test_text_small',
          fn: async (runtime) => {
            try {
              const text = await runtime.useModel(ModelType.TEXT_SMALL, {
                prompt: 'What is the nature of reality in 10 words?',
              });
              if (text.length === 0) {
                throw new Error('Failed to generate text');
              }
              logger.log('generated with test_text_small:', text);
            } catch (error) {
              logger.error('Error in test_text_small:', error);
              throw error;
            }
          },
        },
        {
          name: 'anthropic_test_text_large',
          fn: async (runtime) => {
            try {
              const text = await runtime.useModel(ModelType.TEXT_LARGE, {
                prompt: 'What is the nature of reality in 10 words?',
              });
              if (text.length === 0) {
                throw new Error('Failed to generate text');
              }
              logger.log('generated with test_text_large:', text);
            } catch (error) {
              logger.error('Error in test_text_large:', error);
              throw error;
            }
          },
        },
      ],
    },
  ],
};

export default anthropicPlugin;
