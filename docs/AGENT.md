# AGENT.md - Diretrizes de Desenvolvimento para Agentes de IA

Este documento consolida as diretrizes operacionais de governança técnica para agentes de IA que assumem tarefas no desenvolvimento do **sep-mobile**.

## 1. Operações Git e Convenções de Commits

- **Fluxo de Branches**:
  - `main`/`master`: Branches principais estáveis e protegidas.
  - `develop` ou `feature/*`: Desenvolvimento de melhorias e correções locais.
- **Commits**:
  - Uso obrigatório de Conventional Commits (`feat(componente): ...`, `fix(layout): ...`).

## 2. Stack Tecnológica Confirmada

- **Backend Core**: Desenvolvido na stack principal **JavaScript/TypeScript** com dependências **NodeJS package.json, NodeJS package.json, NodeJS package.json**.
- **Interface**: Design premium dark-mode em PySide6/Qt.

## 3. Práticas de Engenharia

- **Arquitetura Limpa**: Segregação clara entre a lógica de negócios e os adaptadores de interface do usuário.
- **Robustez**: Tratamento adequado de erros locais de persistência de forma resiliente e inalterável (Audit Trail).

## 4. O que NÃO Fazer

- **NÃO comitar chaves, segredos ou certificados** no repositório. Use variáveis de ambiente e `.env.example`.
- **NÃO usar bibliotecas de terceiros** não homologadas pela Dynamis Tecnologia para desenhos de canvas ou tráfegos telemétricos.
- **NÃO expor lógica de negócios** diretamente em componentes de UI.

---

_Manual de Governança Técnica IA._

---

<sub style="font-size: 14px; color: #95A9D6;"><i>Documento gerado de forma autônoma por IA para o sep-mobile — Semantic Docs AI.</i></sub>
