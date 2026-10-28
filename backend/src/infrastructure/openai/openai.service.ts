import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../observability/logger.service';

type JsonSchemaRequest = {
  systemPrompt: string;
  userInput: unknown;
  schemaName: string;
  schemaDescription: string;
  schema: Record<string, unknown>;
};

@Injectable()
export class OpenAiService {
  private hasWarnedMissingApiKey = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  getApiKey() {
    return this.configService.get<string>('openai.apiKey', '');
  }

  getModel() {
    return this.configService.get<string>('openai.model', 'gpt-4.1-mini');
  }

  async createStructuredJsonResponse(request: JsonSchemaRequest): Promise<string> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      if (!this.hasWarnedMissingApiKey) {
        this.logger.warn(
          'OPENAI_API_KEY is not configured. AI requests will use the safe fallback until a key is provided.',
          OpenAiService.name,
        );
        this.hasWarnedMissingApiKey = true;
      }

      throw new Error('OPENAI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getModel(),
          instructions: request.systemPrompt,
          input: JSON.stringify(request.userInput),
          tool_choice: 'none',
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: request.schemaName,
              description: request.schemaDescription,
              schema: request.schema,
              strict: true,
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenAI Responses API failed with status ${response.status}.`,
          errorText,
          OpenAiService.name,
        );
        throw new Error(`OpenAI request failed with ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as {
        output_text?: string;
        output?: Array<{
          type?: string;
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
      };

      const outputText = payload.output_text ?? this.extractOutputText(payload.output);

      if (!outputText) {
        this.logger.error('OpenAI response did not contain output_text.', undefined, OpenAiService.name);
        throw new Error('OpenAI response did not contain output_text');
      }

      return outputText;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
      this.logger.error(`OpenAI structured response failed: ${message}`, undefined, OpenAiService.name);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOutputText(output?: Array<{ content?: Array<{ type?: string; text?: string }> }>) {
    if (!output) {
      return null;
    }

    for (const item of output) {
      for (const contentPart of item.content ?? []) {
        if (contentPart.type === 'output_text' && contentPart.text) {
          return contentPart.text;
        }
      }
    }

    return null;
  }
}
