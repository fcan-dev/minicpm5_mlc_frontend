import type { ModelDescriptor, ModelId, ContextPreset } from "../types";
import type { ModelRuntime } from "./ModelRuntime";
import { MlcRuntime } from "./mlc";

// q3f16_1 is intentionally absent: MLC's int3 (group_size=40) WebGPU kernels
// produce token soup, while q4f16_1 is coherent on the same browser/GPU. The
// artifacts themselves are fine, so there is nothing to fix here - see the note
// on MODEL_IDS in `../types`.
const DESCRIPTORS: ModelDescriptor[] = [
  {
    id: "minicpm5-q4f16",
    labelI18n: "MiniCPM5 q4f16_1",
    engine: "mlc",
    quant: "q4f16_1",
    approxSizeMb: 1420,
    vramRequiredMb: 2000,
  },
  {
    // AWQ (activation-aware) 4-bit, group 128, converted from an AutoAWQ
    // checkpoint. Only the transformer linears are quantized, so embed_tokens
    // and lm_head stay f16 - that is why it is larger than q4f16_1 despite the
    // coarser group. vramRequiredMb is an estimate; it has not been run yet.
    id: "minicpm5-q4f16-awq",
    labelI18n: "MiniCPM5 q4f16_autoawq",
    engine: "mlc",
    quant: "q4f16_autoawq",
    approxSizeMb: 2116,
    vramRequiredMb: 2800,
  },
];

export function getModelDescriptors(): ModelDescriptor[] {
  return DESCRIPTORS;
}

export function findDescriptor(id: ModelId): ModelDescriptor {
  const d = DESCRIPTORS.find((x) => x.id === id);
  if (!d) throw new Error(`unknown model id: ${id}`);
  return d;
}

export function createRuntime(id: ModelId, context: ContextPreset): ModelRuntime {
  return new MlcRuntime(id, context);
}
