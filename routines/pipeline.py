#!/usr/bin/env python
"""Pipeline de sincronização completo.

Executa as rotinas na ordem correta de dependência:
  1. cores            (tabelas de opções do Ploomes)
  2. forma_pagamento  (tabelas de opções do Ploomes)
  3. produtos         (API Innovaro)
  4. preços           (API Innovaro)

Uso:
    python routines/pipeline.py
"""

from __future__ import annotations

import os
import sys
import traceback
from datetime import datetime


def _setup_django() -> None:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cemag_vendas.settings")
    import django
    django.setup()


def _header(titulo: str) -> None:
    print()
    print("=" * 60)
    print(f"  {titulo}")
    print("=" * 60)


def _run_etapa(numero: int, nome: str, fn) -> bool:
    """Executa uma etapa do pipeline. Retorna True se bem-sucedida."""
    _header(f"ETAPA {numero}/4 — {nome}")
    try:
        fn()
        return True
    except SystemExit as exc:
        code = exc.code if exc.code is not None else 0
        if code == 0:
            return True
        print(f"\n❌ Etapa '{nome}' encerrou com código {code}.")
        return False
    except Exception as exc:
        print(f"\n❌ Erro na etapa '{nome}': {exc}")
        traceback.print_exc()
        return False


def main() -> None:
    inicio = datetime.now()

    print()
    print("=" * 60)
    print("  PIPELINE DE SINCRONIZAÇÃO — CEMAG VENDAS")
    print("=" * 60)
    print(f"  Início: {inicio.strftime('%d/%m/%Y %H:%M:%S')}")
    print("  Ordem: cores → forma_pagamento → produtos → preços")
    print("=" * 60)

    from routines.sync_cores.sync_cores import sincronizar_cores
    from routines.sync_forma_pagamento.sync_forma_pagamento import sincronizar_formas_pagamento
    from routines.sync_produtos.sync_produtos import sync_produtos_innovaro
    from routines.sync_precos.sync_precos import sincronizar_precos

    etapas = [
        (1, "Cores",           lambda: sincronizar_cores(verbose=True)),
        (2, "Forma Pagamento", lambda: sincronizar_formas_pagamento(verbose=True)),
        (3, "Produtos",        lambda: sync_produtos_innovaro(verbose=True)),
        (4, "Preços",          sincronizar_precos),
    ]

    resultados: list[tuple[str, bool]] = []
    for numero, nome, fn in etapas:
        ok = _run_etapa(numero, nome, fn)
        resultados.append((nome, ok))
        if not ok:
            print(f"\n⛔  Pipeline interrompido na etapa '{nome}'.")
            break

    fim = datetime.now()
    duracao = fim - inicio

    print()
    print("=" * 60)
    print("  RESUMO DO PIPELINE")
    print("=" * 60)
    for nome, ok in resultados:
        status = "✅ OK" if ok else "❌ FALHOU"
        print(f"  {status}  —  {nome}")

    etapas_nao_executadas = len(etapas) - len(resultados)
    if etapas_nao_executadas:
        for _, nome, _ in etapas[len(resultados):]:
            print(f"  ⏭  PULADA  —  {nome}")

    print()
    print(f"  Fim:     {fim.strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"  Duração: {str(duracao).split('.')[0]}")
    print("=" * 60)

    tudo_ok = all(ok for _, ok in resultados) and etapas_nao_executadas == 0
    sys.exit(0 if tudo_ok else 1)


if __name__ == "__main__":
    _setup_django()
    main()
