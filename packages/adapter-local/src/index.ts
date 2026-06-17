import {
  LiteLLMAdapter,
  type LiteLLMAdapterConfig,
} from "@fountlayer/adapter-litellm";

export type LocalOpenAIAdapterConfig = LiteLLMAdapterConfig;

export class LocalOpenAIAdapter extends LiteLLMAdapter {}

export function createByokAdapter(
  config: LocalOpenAIAdapterConfig,
): LocalOpenAIAdapter {
  return new LocalOpenAIAdapter(config);
}
