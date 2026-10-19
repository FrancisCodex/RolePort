/** Provider presets for the Settings page. Everything except Anthropic speaks the OpenAI chat API. */
export const AI_PRESETS = {
  anthropic: {
    label: "Claude",
    description: "Anthropic API. Best quality.",
    provider: "anthropic",
    baseUrl: null,
    needsKey: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-opus-5-5",
    reasoningEffort: null,
  },
  ollama: {
    label: "Ollama",
    description: "Free and private. Runs on your computer.",
    provider: "openai_compatible",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
    keyUrl: "https://ollama.com/download",
    defaultModel: "",
    // Thinking models are ~10x faster with reasoning off; turn it on for harder tasks if you have the time.
    reasoningEffort: "none",
  },
  openai: {
    label: "OpenAI",
    description: "OpenAI API key.",
    provider: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "",
    reasoningEffort: null,
  },
  openrouter: {
    label: "OpenRouter",
    description: "One key, hundreds of models.",
    provider: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "",
    reasoningEffort: null,
  },
  groq: {
    label: "Groq",
    description: "Fast hosted open models.",
    provider: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "",
    reasoningEffort: null,
  },
  custom: {
    label: "Custom",
    description: "LM Studio, vLLM or any OpenAI-compatible server.",
    provider: "openai_compatible",
    baseUrl: "http://localhost:1234/v1",
    needsKey: false,
    keyUrl: null,
    defaultModel: "",
    reasoningEffort: null,
  },
} as const;

export type AiPresetId = keyof typeof AI_PRESETS;
export const AI_PRESET_IDS = Object.keys(AI_PRESETS) as AiPresetId[];
