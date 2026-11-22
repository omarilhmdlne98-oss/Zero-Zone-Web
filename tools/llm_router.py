#!/usr/bin/env python3
"""OpenAI-compatible cloud-first LLM router for Zero-Zone & Shopify Hub.

Primary endpoints: OmniRoute / NVIDIA NIM cloud APIs (0 MB local VRAM).
Fallback endpoint: Local Ollama ONLY when ENABLE_LOCAL_OLLAMA=1 is explicitly set,
preserving the 2GB Quadro P2000 VRAM budget for 3D WebGL / UE5 rendering.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.request import Request, urlopen


ROUTING_CONFIG = {
    "primary": [
        {
            "name": "omniroute",
            "base_url": os.getenv("OMNIROUTE_BASE_URL", "https://api.omniroute.dev/v1"),
            "api_key_env": "OMNIROUTE_API_KEY",
            "model": os.getenv("OMNIROUTE_MODEL", "meta/llama-3.3-70b-instruct"),
        },
        {
            "name": "nvidia_nim",
            "base_url": os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
            "api_key_env": "NVIDIA_API_KEY",
            "model": os.getenv("NVIDIA_NIM_MODEL", "meta/llama-3.1-70b-instruct"),
        },
    ],
    "local_fallback": {
        "name": "ollama_local",
        "enabled_env": "ENABLE_LOCAL_OLLAMA",
        "base_url": os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"),
        "model": os.getenv("OLLAMA_MODEL", "qwen2.5:3b"),
    },
}


def resolve_endpoint() -> dict:
    for provider in ROUTING_CONFIG["primary"]:
        key = os.getenv(provider["api_key_env"], "").strip()
        if key:
            return {**provider, "api_key": key, "mode": "cloud"}

    local = ROUTING_CONFIG["local_fallback"]
    if os.getenv(local["enabled_env"], "0") == "1":
        return {**local, "api_key": "ollama", "mode": "local_opt_in"}

    raise RuntimeError(
        "No cloud LLM API key found (OMNIROUTE_API_KEY or NVIDIA_API_KEY), and "
        "local Ollama is disabled to protect 2GB VRAM. Set ENABLE_LOCAL_OLLAMA=1 to opt in."
    )


def chat_completion(prompt: str, system_prompt: str = "You are a concise technical assistant.") -> dict:
    ep = resolve_endpoint()
    url = f"{ep['base_url'].rstrip('/')}/chat/completions"
    body = json.dumps(
        {
            "model": ep["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 512,
        }
    ).encode("utf-8")

    req = Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ep['api_key']}",
        },
        method="POST",
    )
    with urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return {"provider": ep["name"], "mode": ep["mode"], "response": data}


def main() -> int:
    ap = argparse.ArgumentParser(description="Cloud-first OpenAI-compatible LLM router (2GB VRAM safe).")
    ap.add_argument("--check", action="store_true", help="Print active routing policy without sending a request")
    ap.add_argument("--prompt", help="Optional prompt to send to the resolved provider")
    args = ap.parse_args()

    if args.check:
        safe_cfg = {
            "primary_order": [p["name"] for p in ROUTING_CONFIG["primary"]],
            "local_ollama_opt_in": os.getenv("ENABLE_LOCAL_OLLAMA", "0") == "1",
            "vram_policy": "cloud-first (0 MB local VRAM used by default)",
        }
        print(json.dumps(safe_cfg, indent=2))
        return 0

    if args.prompt:
        print(json.dumps(chat_completion(args.prompt), indent=2))
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
