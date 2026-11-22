# AI Agent & RAG Blueprints (Shopify Hub + Zero-Zone)

Inspired by `Shubhamsaboo/awesome-llm-apps`, `langflow-ai/langflow`, `All-Hands-AI/OpenHands`, `ollama/ollama`, and `sindresorhus/awesome`.

---

## 1. Cloud-First LLM Routing Policy (2GB VRAM Safe)
- **Primary**: `OmniRoute` (`OMNIROUTE_API_KEY`) -> `NVIDIA NIM` (`NVIDIA_API_KEY`) via OpenAI-compatible `/v1/chat/completions` (`tools/llm_router.py`).
- **Local Fallback**: `Ollama` (`http://127.0.0.1:11434/v1`) is **disabled by default** and only activated when `ENABLE_LOCAL_OLLAMA=1` is explicitly exported, ensuring the local **2GB Quadro P2000** VRAM stays 100% dedicated to WebGL / UE5 rendering.

---

## 2. Shopify Hub (`shopifyhub.work`) RAG & Support Agent Blueprints

### Blueprint A: Arabic/English Storefront Support RAG Agent
1. **Ingestion**: Index store FAQ, return policies, and Neon/Supabase product catalog (`id`, `title_ar`, `title_en`, `price_egp`, `stock`) into `pgvector` (Supabase/Neon free tier).
2. **Retrieval**: Hybrid vector + keyword search scoped strictly by `tenant_id` (RLS enforced).
3. **Generation**: Route prompt through `OmniRoute` / `NVIDIA NIM` with RTL-safe numeric formatting and live currency conversion (`https://api.frankfurter.app`).

### Blueprint B: Automated Store QA & Lead Enrichment Pipeline
1. **Scrape**: Run `python3 tools/store_scraper.py <url>` (`D4Vinci/Scrapling` when installed, stdlib fallback otherwise) to extract JSON-LD product schema & OpenGraph tags.
2. **Verify**: Use the `playwright` MCP server (`.mcp.json`) in headless mode to verify storefront checkout/RTL layout on `https://shopifyhub.work` and 3D WebGL boot on `https://zero-zone-game.vercel.app`.
3. **Persist**: Inspect Postgres/Supabase tables via the `postgres` / `supabase` MCP servers.
