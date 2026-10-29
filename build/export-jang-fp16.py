#!/usr/bin/env python3
"""build/export-jang-fp16.py — one-shot fp16 export of a JANG-quantized MLX model.

Why this exists: the vMLX embeddings route (/v1/embeddings) runs on stock
mlx-embeddings, whose model classes build fp16 layers only — no quantization
support, and no per-layer bits overrides. JANG-quantized checkpoints
(mx.quantize affine backend, per-layer bits) therefore cannot be served on
that route even though vMLX's chat loader reads them fine. This script
dequantizes every layer with stock mx.dequantize — the direct inverse of the
JANG quantizer's declared backend — and writes an fp16 copy that the
embeddings route loads natively via its per-request local-path resolution
(no serve restart required).

Provenance to record in the index manifest:
  base model:        unsloth/Qwen3-Embedding-0.6B
  JANG quantization: profile JANG_3M, quality max (jang-importance method,
                     mx.quantize affine backend, group_size 64, per-layer bits 3/8)

Usage (run with an MLX-capable python, e.g. a bundled vMLX python):
  python3 export-jang-fp16.py --src <JANG model dir> --dst <fp16 export dir>

The source directory is left untouched. The export dir receives the fp16
weights, a config with the quantization section removed, copies of the
tokenizer files, and export_manifest.json recording this recipe.
"""

from __future__ import annotations

import argparse
import datetime
import json
import shutil
import sys
from pathlib import Path


def load_weights(model_dir: Path) -> dict:
    """Load all safetensors shards of an MLX model dir into one dict."""
    import mlx.core as mx

    index_path = model_dir / "model.safetensors.index.json"
    if index_path.exists():
        shards: set[str] = set(
            json.loads(index_path.read_text())["weight_map"].values()
        )
        weights: dict = {}
        for shard in sorted(shards):
            weights.update(mx.load(str(model_dir / shard)))
        return weights
    files = sorted(model_dir.glob("*.safetensors"))
    if not files:
        sys.exit(f"no .safetensors found in {model_dir}")
    weights = {}
    for f in files:
        weights.update(mx.load(str(f)))
    return weights


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path, help="JANG-quantized model dir")
    ap.add_argument("--dst", required=True, type=Path, help="fp16 export dir to create")
    args = ap.parse_args()

    src: Path = args.src
    dst: Path = args.dst
    if not (src / "config.json").exists():
        sys.exit(f"missing config.json in {src}")
    if dst.exists() and any(dst.iterdir()):
        sys.exit(f"destination {dst} exists and is not empty")

    import mlx.core as mx

    config = json.loads((src / "config.json").read_text())
    quant = config.get("quantization", {})
    top_bits = int(quant.get("bits", 4))
    top_group = int(quant.get("group_size", 64))
    if not quant:
        sys.exit("source config has no quantization section — nothing to dequantize")

    weights = load_weights(src)
    out: dict[str, mx.array] = {}
    bits_hist: dict[int, int] = {}
    passthrough = 0

    def resolve_bits(param_base: str, packed_cols: int) -> int:
        entry = quant.get(param_base, {})
        bits = int(entry.get("bits", top_bits))
        group = int(entry.get("group_size", top_group))
        # Cross-check against the packed layout: bits*group/32 uint32 per group.
        per_group_bits = bits * group
        if per_group_bits % 32 == 0 and packed_cols % (per_group_bits // 32) == 0:
            return bits
        # Config disagreed with the actual packing — derive from candidates.
        for candidate in (2, 3, 4, 6, 8):
            pcb = candidate * group
            if pcb % 32 == 0 and packed_cols % (pcb // 32) == 0:
                print(f"  ! {param_base}: config bits={bits} did not match packing; using {candidate}")
                return candidate
        sys.exit(f"cannot determine bits for {param_base} (cols={packed_cols})")

    for key in sorted(weights):
        arr = weights[key]
        if key.endswith(".weight") and f"{key[:-len('.weight')]}.scales" in weights:
            base = key[: -len(".weight")]
            scales = weights[f"{base}.scales"]
            biases = weights.get(f"{base}.biases")
            entry = quant.get(base, {})
            group = int(entry.get("group_size", top_group))
            bits = resolve_bits(base, arr.shape[-1])
            deq = mx.dequantize(arr, scales, biases, group_size=group, bits=bits, mode="affine")
            out[key] = deq.astype(mx.float16)
            bits_hist[bits] = bits_hist.get(bits, 0) + 1
        elif key.endswith((".scales", ".biases")):
            continue  # consumed by the dequantized weights
        else:
            out[key] = arr.astype(mx.float16)
            passthrough += 1

    dst.mkdir(parents=True, exist_ok=True)
    mx.save_safetensors(str(dst / "model.safetensors"), out)

    export_config = dict(config)
    export_config.pop("quantization", None)
    (dst / "config.json").write_text(json.dumps(export_config, indent=2) + "\n")
    for name in (
        "tokenizer.json",
        "tokenizer_config.json",
        "vocab.json",
        "merges.txt",
        "generation_config.json",
        "jang_config.json",  # provenance: the JANG quantization record
    ):
        if (src / name).exists():
            shutil.copy2(src / name, dst / name)

    manifest = {
        "exported_by": "build/export-jang-fp16.py",
        "exported_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "base_model": "unsloth/Qwen3-Embedding-0.6B",
        "jang_quantization": {
            "method": "jang-importance",
            "profile": "JANG_3M",
            "quality": "max",
            "backend": "mx.quantize",
            "mode": "affine",
            "group_size": top_group,
            "per_layer_bits": {str(k): v for k, v in sorted(bits_hist.items())},
        },
        "export_format": "fp16 safetensors (dequantized per-layer with mx.dequantize)",
        "layers_dequantized": sum(bits_hist.values()),
        "layers_passthrough": passthrough,
        "note": "original JANG-quantized directory left untouched; this fp16 copy exists so the vMLX /v1/embeddings route (stock mlx-embeddings, fp16-only) can serve the model",
    }
    (dst / "export_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    total = sum(v.size for v in out.values())
    print(f"[export-jang-fp16] dequantized {sum(bits_hist.values())} layers by bits: {bits_hist}")
    print(f"[export-jang-fp16] passthrough tensors: {passthrough}")
    print(f"[export-jang-fp16] wrote {dst/'model.safetensors'} ({total / 1e9:.2f}B params)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
