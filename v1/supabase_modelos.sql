-- Permite llaves de Mistral y OpenRouter en llaves_ia (se puede ejecutar varias veces).
alter table public.llaves_ia drop constraint if exists llaves_ia_proveedor_check;
alter table public.llaves_ia add constraint llaves_ia_proveedor_check
  check (proveedor in ('gemini', 'groq', 'mistral', 'openrouter'));
