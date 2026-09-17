export const en = {
  appName: "MiniCPM5 in Browser",
  chatsLabel: "Chats",
  newChat: "New chat",
  untitledChat: "New chat",
  emptyConversations: "No chats yet",
  renameConversation: "Rename",
  deleteConversation: "Delete",
  deleteConversationTitle: "Delete this chat?",
  deleteConversationBody:
    "This chat and all of its messages will be permanently deleted. This cannot be undone.",
  deleteConversationConfirm: "Delete chat",
  namingChat: "Naming chat",
  openSidebar: "Open chats",
  closeSidebar: "Close chats",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",

  settingsLabel: "Settings",
  systemMessageLabel: "System prompt",
  systemMessageDefault: "You are a helpful assistant. Be clear and concise.",
  temperatureLabel: "Temperature",
  topPLabel: "Top P",
  maxTokensLabel: "Max tokens",
  reasoningLabel: "Reasoning",
  modelLabel: "Model quant",
  modelHint: "Smaller quants use less memory; larger ones answer better",
  repoLabel: "Model repository",
  contextLabel: "Context window",

  reasoningTitle: "Reasoning",
  thinking: "Thinking",
  emptyChatTitle: "Ask MiniCPM5 anything",
  showReasoning: "Show reasoning",
  hideReasoning: "Hide reasoning",

  regenerate: "Regenerate",
  send: "Send",
  stop: "Stop",
  inputPlaceholder: "Send a message",
  streaming: "Writing a response",
  // One label per WebLLM load phase, so the bar always says what it is doing.
  loadPhaseFetch: "Downloading model files",
  loadPhaseCache: "Loading weights onto the GPU",
  loadPhaseShaders: "Compiling GPU kernels",
  loadPhasePrepare: "Preparing model",

  // Live decode rate shown while the model streams an answer.
  liveSpeed: "tok/s",
  contextUsageLabel: "Context",
  contextNearLimit: "Nearly full",
  contextHintRaise: "Raise the context window in Settings",

  benchmarkTitle: "Status",
  // The card below reports this origin's whole storage footprint, not a list of
  // model files, so the heading has to say so.
  storageTitle: "Browser storage",
  downloadedLabel: "Downloaded",
  notDownloadedLabel: "Not downloaded",
  clearModelCache: "Clear cached model",
  clearingModelCache: "Clearing",
  clearAllModelCache: "Clear all cached models",
  clearingAllModelCache: "Clearing all",
  loadTime: "Load time",
  avgSpeed: "Avg speed",
  // Download size of the quant, from the model descriptor; shown even before
  // the files are downloaded, because it is a static property of the model.
  sizeLabel: "Size",
  storageUsed: "Used by this site",
  storageQuota: "Available to this site",
  recheck: "Re-check",
  // Per-card actions and copy in the chat.
  downloadModel: "Download",
  downloading: "Downloading",
  copyMessage: "Copy",
  copied: "Copied",
  // Model cards are grouped under these collapsible sections.
  categoryLanguage: "Language Model",
  categoryEmbedder: "Embedding Model",
  categoryTts: "Text-to-Speech",
  noModelsYet: "No models yet",
  // Shown as a badge on the quant we suggest to new users.
  recommended: "Recommended",
  quantAwqHint: "Better quality, but larger",
  evictedLabel: "Cleared by browser",
  evictedHint: "The browser freed these files; the next run downloads them again",
  inUseLabel: "In use",
  // Accessible name prefix for a card in the metrics panel; clicking it
  // selects that quant, exactly like the Settings control does.
  selectModel: "Select",

  noWebgpuTitle: "WebGPU is not supported",
  noWebgpuBody:
    "This page runs the model on your GPU. Use a recent version of Chrome or Edge (Firefox and Safari may need a WebGPU flag enabled).",
  hardwareNote: "Requires WebGPU and roughly 2-4 GB of free memory.",

  errorLoad: "Could not load the model",
  errorGenerate: "Could not generate a response",
  cancel: "Cancel",
} as const;

export type EnKey = keyof typeof en;
