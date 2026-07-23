# Auditoria de UX e benchmark competitivo — LWT Desktop

**Data:** 22 de julho de 2026

**Escopo:** biblioteca, criação e edição de textos, leitor, termos e expressões,
revisão, estatísticas, idiomas, tags, backup e configurações.

## Resumo executivo

O LWT já possui uma base funcional sólida: a proposta local-first é clara, os
fluxos principais existem de ponta a ponta, os estados dos termos são
consistentes e a interface responde bem à redução de largura. O maior ganho
agora não virá de adicionar mais funcionalidades, mas de reorganizar as
existentes em torno da atividade principal: **abrir um conteúdo, ler sem perder
o contexto, compreender uma palavra e continuar estudando**.

As três mudanças de maior impacto são:

1. Transformar a página inicial em um painel de continuidade, deixando
   “Adicionar conteúdo” como ação sob demanda em vez de um formulário sempre
   aberto.
2. Reestruturar o leitor em texto + painel contextual fixo, usando um painel
   lateral no desktop e uma folha inferior no mobile.
3. Corrigir imediatamente três problemas de interface: posição de rolagem
   preservada entre telas, elementos com `hidden` que continuam visíveis e
   contraste quebrado em Configurações no modo escuro.

Um protótipo navegável das propostas prioritárias acompanha este documento em
[`docs/ux-prototype/index.html`](ux-prototype/index.html).

> **Atualização de implementação — 23 de julho de 2026:** foram entregues a
> Home separada da Library, navegação primária, estados de primeiro uso/sem
> leitura atual/usuário recorrente, configuração direta do primeiro idioma e
> dicionário, formulário Add content sob demanda, até três textos recentes sem
> repetir o destaque, leitor em duas colunas, níveis exatos Learning 1–4 e
> `Finish lesson` em um clique com persistência e `Undo`, busca/filtros da
> Library e a tela global Vocabulary. O shell foi refinado para uma linguagem
> visual clara inspirada no GNOME/libadwaita: headerbar de 54 px, controles
> elevados, azul de destaque e `ViewSwitcher` para Home, Library, Vocabulary e
> Review. A sidebar permanente foi removida para preservar a área útil; os
> destinos administrativos ficam no menu primário e a navegação frequente vira
> barra inferior em janelas estreitas. A headerbar também substitui a decoração
> nativa, com ícones oficiais Adwaita, controles de janela, borda e cantos
> arredondados reais. Vocabulary agora permite edição direta com frase de
> contexto; Review apresenta contexto, intervalos e atalhos; idiomas são
> editados um por vez; Estatísticas sugere a próxima ação. O áudio local foi
> removido da interface, preservando dados legados apenas para round-trip de
> backup. Uma rodada final de fidelidade levou os componentes do protótipo para
> a aplicação real: capas e progresso na Home/Library, documento tipográfico e
> painel contextual no Reader, densidade de Vocabulary, sessão focada de Review
> e cartão guiado de primeiro idioma.

## Como a análise foi feita

- Inspeção da estrutura e dos estados implementados em `web/src/main.ts`,
  `web/src/styles.css`, componentes auxiliares e gateway mock.
- Execução do frontend com dados de demonstração.
- Inspeção visual em janelas de 1440 px e 390 px, principalmente no modo escuro.
- Navegação pelos fluxos de biblioteca, leitura, edição de termo, revisão,
  estatísticas, idiomas, tags, backup e configurações.
- Benchmark de padrões documentados publicamente por LinguaLeo, LingQ e
  Readlang. A análise competitiva não incluiu áreas autenticadas que não estavam
  publicamente acessíveis.

### Escala de prioridade

- **P0 — corrigir agora:** defeito que quebra compreensão, acessibilidade ou
  comportamento esperado.
- **P1 — próximo ciclo:** mudança estrutural com alto impacto no fluxo
  principal.
- **P2 — evolução:** melhoria importante, mas que pode vir após a nova
  arquitetura de navegação e leitura.

## O que já funciona bem

- A identidade visual é sóbria e adequada a uma ferramenta de leitura.
- Estados `Unknown`, `Learning`, `Known` e `Ignored` usam uma linguagem visual
  consistente no leitor.
- O sistema comunica carregamento, sucesso e erro na maioria dos formulários.
- A aplicação tem estados vazios e confirma ações irreversíveis.
- Os grids se reorganizam em larguras menores, sem sobreposição destrutiva.
- A largura máxima do conteúdo evita que a interface se espalhe por monitores
  muito grandes.
- O leitor preserva pontuação e apresenta progresso por termos únicos.
- O produto oferece um conjunto raro e valioso de capacidades offline:
  leitura, termos, expressões, revisão, estatísticas e backup.

## Problemas críticos

### P0.1 — Reiniciar a rolagem ao trocar de tela

**Evidência:** as telas são substituídas com `replaceChildren`, mas a posição de
rolagem da janela é mantida. Ao sair de uma região baixa da Biblioteca para
Idiomas ou Backup, a nova tela pode abrir no meio, ocultando título, explicação
e botão de voltar.

**Impacto:** o usuário pode interpretar que a tela está incompleta e perde a
orientação espacial.

**Proposta:** toda navegação para uma nova tela deve levar o foco ao título e
rolar para o topo. Ao voltar, a Biblioteca pode restaurar a posição anterior
intencionalmente.

**Critério de aceite:** entrar em qualquer tela sempre exibe o início dela; usar
“Voltar à biblioteca” restaura o item ou região de origem sem salto inesperado.

### P0.2 — Garantir que `[hidden]` realmente oculte componentes

**Evidência:** componentes que definem `display` no CSS anulam o comportamento
do atributo `hidden`. A grade de avaliações da revisão tem `hidden=true`, mas
permanece com `display: grid`; o cartão de atualização também aparece no
frontend web mesmo quando atualizações estão desabilitadas.

**Impacto:** na revisão, as respostas podem ser avaliadas antes de serem
reveladas. Em Configurações, o usuário pode ver uma função indisponível ou sem
contexto.

**Proposta:** adicionar uma regra global segura:

```css
[hidden] {
  display: none !important;
}
```

Adicionar testes de regressão para a etapa “mostrar resposta” e para a
visibilidade do atualizador.

**Critério de aceite:** as avaliações só aparecem após “Mostrar resposta” e o
cartão de atualização só aparece quando o recurso estiver habilitado.

### P0.3 — Corrigir Configurações no modo escuro

**Evidência:** `.settings-card` e seus campos não recebem tratamento no media
query escuro. O resultado observado foi um cartão branco com rótulos quase
brancos, além de quebra visual em relação às demais telas.

**Impacto:** rótulos ficam difíceis ou impossíveis de ler, impedindo o uso da
configuração.

**Proposta:** criar tokens semânticos de tema e aplicá-los a todos os cartões,
campos, bordas, textos auxiliares, estados e botões. Evitar regras esparsas por
componente.

**Critério de aceite:** todos os textos e controles passam por verificação de
contraste nos temas claro e escuro; nenhum cartão mantém cores fixas do tema
oposto.

### P0.4 — Não rebaixar silenciosamente estados legados 2, 3, 4 e 99

**Evidência:** o banco e a importação preservam os estados `1`, `2`, `3`, `4`,
`5`, `98` e `99`. Porém, o editor oferece somente `1 — Learning`, `5 — Known`
e `98 — Ignored`. Na versão auditada, abrir um termo com estado 2, 3 ou 4
inicializava o select como 1; um termo 99 era inicializado como 5. Essa falha
foi corrigida em 23 de julho de 2026: o editor agora expõe e preserva 1–5, 98 e
99.

**Impacto:** editar um termo migrado pode rebaixar seu nível sem aviso. Um termo
99, antes excluído de testes, pode virar 5 e entrar imediatamente na fila se não
tiver `next_review_at`. Isso altera dados de aprendizagem e comportamento do
agendador.

**Proposta:** antes de decidir se a nova experiência terá três ou sete rótulos,
preservar sempre o valor armazenado. A solução mais segura é expor os cinco
níveis de aprendizagem e os estados Ignorado/Bem conhecido no modo avançado,
com rótulos compreensíveis. Se a UI permanecer simplificada, mudar tradução,
romanização ou tags não pode mudar status.

**Critério de aceite:** abrir e salvar um termo migrado sem trocar explicitamente
seu status preserva o valor original e sua elegibilidade de revisão.

## Auditoria de paridade com o LWT original em PHP

Esta seção cruza a
[documentação oficial do LWT PHP 25.10.0](https://hapepo23.github.io/lwt/info.htm)
com os contratos do `LibraryGateway`, comandos Tauri, banco SQLite e interface
atuais. Ela avalia paridade funcional, não semelhança visual.

### Conclusão da paridade

O desktop migrou bem o núcleo de **textos, leitura, termos básicos, expressões,
tags, áudio local, arquivo, revisão SRS, estatísticas e backup**. Entretanto, a
migração ainda não é funcionalmente completa. As maiores lacunas são:

1. não existe uma tela global “Meus termos”;
2. importação e exportação de termos/Anki não existem;
3. os seis modos de teste foram substituídos por uma revisão única e sem frase;
4. checagem prévia, importação de texto longo e impressão anotada não existem;
5. a criação independente do primeiro idioma foi entregue; ainda falta
   gerenciamento completo de criar/excluir/trocar idioma;
6. atalhos do leitor/teste e controles avançados de áudio não foram migrados;
7. dados legados como texto anotado e regras avançadas são preservados no
   backup/banco, mas não podem ser vistos ou usados na interface;
8. a navegação primária foi reorganizada, mas ainda faltam destinos globais como
   Vocabulary e Help;
9. `Finish lesson` recuperou o resultado útil de `I KNOW ALL`: palavras não
   clicadas viram “Bem conhecido”, termos em aprendizagem permanecem no
   vocabulário e a operação oferece `Undo`.

### Paridade do menu principal

Legenda:

- **Migrado:** o fluxo essencial existe e está acessível.
- **Parcial:** existe uma versão reduzida ou com comportamento diferente.
- **Ausente:** não há tela, comando ou fluxo equivalente.
- **Não aplicável:** dependia da arquitetura PHP ou foi removido do próprio LWT
  original mais recente.

| Menu do LWT PHP | Estado no desktop | Verificação e recomendação |
| --- | --- | --- |
| Home | **Migrado com mudança** | Home e Library são separadas; Home oferece continuidade, revisão, primeiro uso e até três recentes sem duplicar o destaque. Ainda faltam idioma atual explícito, demo, Print e atalhos avançados. |
| My Texts | **Parcial** | Criar, editar, abrir, arquivar e excluir existem. Faltam busca por título, idioma/tags, ordenação, contagem clicável de termos, seleção múltipla, teste por texto, impressão e reprocessamento manual. |
| My Text Archive | **Migrado com mudança** | Arquivar/restaurar existe. Diferentemente do PHP, arquivar apenas muda uma flag e mantém sentenças/itens no SQLite. A economia de espaço do arquivo legado não foi preservada, mas isso pode ser uma decisão adequada para desktop. |
| My Text Tags | **Parcial** | Tags foram unificadas e podem ser criadas/atribuídas. Não podem ser editadas, excluídas ou pesquisadas, e não há visão separada para organização de textos. |
| My Languages | **Parcial** | O primeiro idioma e dicionário podem ser criados antes do primeiro texto. Ainda faltam excluir idioma, definir/trocar idioma atual, testar termos por idioma e reprocessar manualmente. |
| My Terms (Words and Expressions) | **Ausente** | Não existe tela nem endpoint de listagem global. Termos só aparecem dentro do leitor ou na fila automática. Criar uma área Vocabulário com busca, filtros, edição, seleção e ações em lote é prioridade alta. |
| My Term Tags | **Parcial** | A mesma infraestrutura de tags atende termos, mas não há gestão específica, edição/exclusão nem filtro global porque “Meus termos” não existe. |
| My Statistics | **Parcial** | Totais e revisão recente existem. Faltam drill-down clicável para termos por status/idioma, tendências completas e relação direta com a lista de vocabulário. A comparação do agendador legado é técnica e não substitui esse drill-down. |
| Check a Text | **Ausente** | Criar/editar salva diretamente. Não há prévia do parsing, lista de palavras/não-palavras nem visualização de traduções já conhecidas antes de salvar. Adicionar “Pré-visualizar análise” ao fluxo de importação. |
| Long Text Import | **Ausente** | O limite de 65.000 bytes continua, mas não há divisão automática por número de sentenças/parágrafos. É importante para livros, transcrições e conteúdos longos. |
| Import Terms | **Ausente** | Não há CSV/TSV, colagem, mapeamento de colunas, status inicial ou política de sobrescrita. O gateway não possui comando equivalente. |
| Backup/Restore/Empty Database | **Parcial** | Backup/restauração JSON transacional existe e é mais seguro. “Esvaziar banco” foi omitido; se necessário, deve ficar em Zona de risco e exigir backup/confirmação forte. |
| Settings/Preferences | **Parcial** | Paginação, contagens e atraso de revisão existem. Dimensões de frames e modo mobile não são necessários, mas quantidade de frases de contexto, delimitadores de anotação, filtros de status, termos similares e outras preferências não foram migrados. |
| Help/Information | **Ausente** | Não existe ajuda dentro do aplicativo, guia inicial nem referência de atalhos. Criar Ajuda local/offline e dicas contextuais. |
| Mobile LWT (Experimental) | **Não aplicável** | A versão PHP 25.10.0 removeu esse item e o desktop já é responsivo. A imagem fornecida pelo usuário representa uma versão anterior. |

### Paridade das capacidades de aprendizagem

| Capacidade do LWT PHP | Estado | Lacuna observada |
| --- | --- | --- |
| Leitura com estados visuais | **Migrado** | As cores agrupam estados para leitura rápida, enquanto o editor preserva os valores exatos 1–5, 98 e 99. |
| Termos e expressões de 2–9 palavras | **Migrado** | Criação e persistência existem. Falta uma seleção mais natural e o modo Show All para lidar com expressões sobrepostas. |
| Tradução, romanização e tags | **Migrado** | Funcionam no leitor. Falta frase de exemplo própria do termo e gestão global. |
| Frase de exemplo armazenada por termo | **Ausente** | A revisão não recebe sentença de contexto e o schema de `terms` não tem o campo legado. Ocorrências do parser podem gerar contexto dinamicamente, mas isso ainda não foi implementado. |
| Três dicionários/tradução de sentença | **Parcial** | Há Dictionary 1, Dictionary 2 e Translate por palavra. Não há ação de traduzir a sentença atual nem integração local semelhante ao `trans`. |
| Status 1–5, Ignorado e Bem conhecido | **Migrado** | Banco e editor preservam os sete valores; salvar tradução, romanização ou tags não colapsa um status migrado. |
| `I KNOW ALL` para as palavras novas do texto | **Migrado com mudança** | `Finish lesson` executa a ação em um clique, persiste a conclusão, mantém termos clicados/em aprendizagem e converte apenas palavras ainda não marcadas para 99; `Undo` reverte somente os termos criados por aquela conclusão. |
| Teste L2→L1 | **Parcial** | A revisão atual cobre reconhecimento básico, mas sem sentença de contexto e sem escolher termos por texto/idioma/tag. |
| Teste L1→L2 | **Ausente** | Não há modo de produção/recall. |
| Cloze/MCD com contexto | **Ausente** | Não há ocultação do termo na frase nem preferência por 1–3 sentenças. |
| Teste em tabela/lista | **Ausente** | Não há tabela configurável com revelar célula, ordenar e alterar status. |
| Fila e histórico SRS | **Migrado e modernizado** | O desktop possui eventos de revisão e `next_review_at`, algo que o legado não armazenava. Falta contexto e explicação dos intervalos. |
| Impressão com tradução/romanização | **Ausente** | Não há visual de impressão nem exportação amigável para estudo offline. |
| Improved Annotated Text/interlinear | **Dados preservados, UI ausente** | `annotated_content` existe em `texts` e no backup, mas não faz parte de `TextDetails`/`ReadingText`; o usuário não consegue ver, editar ou imprimir o conteúdo migrado. |
| Importação CSV/TSV de termos | **Ausente** | Nenhum contrato de gateway ou comando nativo. |
| Exportação TSV/flexível/Anki cloze | **Ausente** | `export_template` é armazenado e editável, mas não há comando que o utilize. Hoje o campo promete uma função inexistente. |
| Lista global, filtros e ações em lote de termos | **Ausente** | Impede auditar o vocabulário migrado e usar tags/status em escala. |
| Filtros e ações em lote de textos | **Ausente** | Apenas paginação e alternância ativo/arquivo. |
| Prévia do parsing antes de salvar | **Ausente** | Erros de idioma ou segmentação só ficam claros depois da criação. |
| Reprocessamento de textos | **Migrado parcialmente** | Editar texto e mudar regras relevantes reprocessa automaticamente e de forma transacional. Não há ação manual nem indicação detalhada do impacto. |
| Regras avançadas de idioma | **Dados preservados, mecanismo substituído** | `exceptions_split_sentences` e `regexp_word_characters` permanecem no banco/backup, mas o parser desktop usa regras Unicode simplificadas e a UI não expõe esses campos. |
| Assistente de idioma | **Ausente** | No legado, o primeiro passo podia ser configurar L1/L2. No desktop, o idioma é um texto livre no cadastro e só depois ganha configurações. |
| Áudio local | **Migrado e melhorado** | Upload, armazenamento gerenciado, troca e remoção existem. |
| Velocidade, repetição, saltos e sincronização aproximada | **Ausente** | O player nativo oferece play/pause/seek, mas faltam 0,5–1,5x explícito, loop, ± segundos e duplo clique na palavra para aproximar o áudio. |
| Atalhos no leitor e teste | **Ausente** | O legado tinha navegação de termos, status 1–5, editar, ignorar, bem conhecido, áudio e revelar resposta. O desktop depende principalmente de Tab/Enter do navegador. |
| Fonte/URL do texto | **Parcial** | A URL é salva e editável, mas não aparece como link útil no cabeçalho do leitor. |
| Banco demo/conteúdo de exemplo | **Ausente em produção** | O mock de desenvolvimento tem exemplos, mas uma instalação real vazia não oferece texto de demonstração nem assistente. |
| Múltiplos table sets | **Não aplicável por padrão** | Era uma solução PHP para múltiplos usuários/bibliotecas no mesmo banco. O desktop usa dados por usuário do sistema; perfis múltiplos exigiriam uma decisão de produto separada. |

### Recursos preservados no banco, mas “órfãos” na interface

Estes casos merecem atenção especial porque podem criar uma falsa sensação de
migração completa:

- `texts.annotated_content`: é restaurado e reexportado, porém invisível.
- `texts.audio_uri` e `text_audio`: preservados na migração e no backup para não
  causar perda silenciosa, mas deliberadamente não expostos na interface.
- `languages.export_template`: é editável, mas não existe exportação de termos.
- `languages.exceptions_split_sentences` e
  `languages.regexp_word_characters`: são preservados, mas não usados pelo parser
  desktop nem mostrados na UI.
- status 2, 3, 4 e 99: são preservados até que o termo seja salvo pela interface
  simplificada.

Recomendação: marcar no contrato de migração cada campo como **operacional**,
**somente preservado para round-trip** ou **não suportado com aviso**. Dados
somente preservados também devem ser visíveis em um relatório pós-importação.

### Prioridade de recuperação da paridade

#### P0 — proteger dados já migrados

1. Preservar estados 2, 3, 4 e 99 ao editar.
2. Tornar explícitos os campos apenas preservados no resumo de restauração.
3. Definir acesso seguro ao texto anotado migrado ou avisar claramente que ele
   não pode ser usado nesta versão.

#### P1 — restaurar o fluxo principal do produto

1. Navegação persistente com Início, Biblioteca, Vocabulário, Revisão,
   Progresso e Configurações.
2. Botão único `Finish lesson`: manter termos clicados no vocabulário e marcar
   as palavras nunca clicadas como “Bem conhecido”.
3. Tela global de Vocabulário/Meus termos.
4. Revisão com frase, reconhecimento, recall e cloze.
5. Importação e exportação CSV/TSV; exportação Anki pode vir na sequência.
6. Criação/assistente de idioma antes do primeiro texto.
7. Prévia de parsing e divisão de textos longos.

#### P2 — fluxos avançados valiosos

1. Impressão e texto interlinear/anotado.
2. Ações em lote de textos e termos.
3. Atalhos completos e controles avançados de áudio.
4. Show All para expressões, tradução de sentença e revisão por texto.
5. Ajuda offline completa e documentação de migração dentro do app.

## Melhorias estruturais

### P1.1 — Separar Home de Library e projetar os estados de continuidade

**Situação atual:** o formulário “Add a text” ocupa quase toda a primeira dobra
no desktop e várias telas no mobile. Biblioteca, importação e continuidade
competem na mesma tela; isso não escala quando a coleção cresce.

**Proposta:**

- Fazer de Home um painel de próximo passo, não a biblioteca completa.
- Quando houver leitura em andamento, exibir um único destaque `Continue
  reading`.
- Exibir abaixo até três textos recentemente estudados ou adicionados,
  excluindo o texto que já está em destaque.
- Manter Library como tela independente e escalável, com toda a coleção,
  busca, idioma, tag, ordenação, paginação e arquivo.
- Substituir o formulário permanente por um botão primário “Adicionar
  conteúdo”, abrindo modal ou tela dedicada.
- Oferecer no modal as origens “Colar texto”, “Arquivo” e futuramente “URL”.
- Se não houver leitura em andamento, mas já houver textos, substituir o
  destaque por “Choose your next text” e usar os recentes como opções.
- No primeiro uso, não renderizar cartões vazios de leitura ou revisão. Mostrar
  diretamente na Home o formulário do primeiro idioma, como fazia o LWT PHP:
  língua estudada, língua de tradução e dicionário principal opcional. Há
  espaço suficiente; um cartão intermediário com “+” só adicionaria um clique.
- Ao usar `Save language and add your first text`, avançar diretamente à etapa
  2, `Add your first text`. Regras avançadas usam bons padrões, continuam
  editáveis em Settings e não bloqueiam o início. Explicar o fluxo completo em
  três passos: idioma, texto, leitura.

**Resultado esperado:** o usuário recorrente chega ao conteúdo em um clique e o
usuário novo encontra uma única ação inequívoca e configura o idioma antes de
importar conteúdo. A Library pode crescer sem transformar a Home em uma grade
longa ou duplicar o texto em destaque.

### P1.2 — Criar uma navegação persistente e hierárquica

**Situação atual:** Arquivo, Configurações, Backup, Tags, Idiomas, Estatísticas
e Revisão têm o mesmo peso visual em uma fileira de botões. A ordem não reflete
frequência nem relacionamento.

**Proposta no desktop:**

- Navegação principal: Início, Biblioteca e Revisão.
- Organização: Tags e Idiomas.
- Acompanhamento: Estatísticas.
- Sistema: Configurações e Backup.

Usar uma barra lateral compacta ou uma barra superior com menu “Mais”. Em
janelas estreitas, usar navegação inferior para Início, Biblioteca e Revisão,
com o restante em “Mais”.

### P1.3 — Manter o texto visível ao editar uma palavra

**Situação atual:** ao selecionar um termo, um formulário alto é inserido acima
do texto. Em desktop e principalmente no mobile, a frase de origem sai da tela.
O usuário perde o contexto que motivou a consulta.

**Proposta:**

- Desktop: texto em uma coluna de leitura e editor em painel lateral fixo.
- Mobile: tradução rápida inline e detalhes em uma folha inferior expansível.
- Manter a frase atual destacada no texto.
- Ao trocar de palavra, atualizar o painel sem mudar a posição de leitura.
- Dar foco primeiro à tradução, deixando romanização, tags e ações avançadas
  progressivamente disponíveis.

Essa é a mudança mais importante do fluxo de aprendizagem.

### P1.4 — Reduzir o custo de compreender e salvar um termo

**Situação atual:** a pessoa seleciona a palavra, percorre um formulário,
consulta um link externo, volta, digita a tradução e salva.

**Proposta:**

- Mostrar tradução já salva imediatamente.
- Apresentar os dicionários no painel, sem ocupar uma nova região do leitor.
- Permitir escolher uma sugestão ou digitar uma tradução e salvar com
  `Enter`/`Ctrl+Enter`.
- Incluir a frase de contexto no painel.
- Oferecer ações rápidas “Aprendendo”, “Conhecido” e “Ignorar”.
- Manter integrações de rede opcionais e claramente rotuladas para preservar a
  promessa local-first.

### P1.5 — Simplificar a criação de expressões

**Situação atual:** “Create expression” inicia um modo separado, com instruções
textuais e dois cliques.

**Proposta:** permitir arrastar sobre palavras adjacentes ou usar `Shift+clique`
para estender a seleção. Mostrar uma pequena barra contextual “Salvar
expressão” acima da seleção. Manter o modo atual como alternativa acessível por
teclado.

### P1.6 — Reforçar hierarquia e segurança nos cartões da biblioteca

**Situação atual:** Abrir, Editar, Arquivar e Excluir ficam sempre expostos e
com peso visual semelhante.

**Proposta:**

- Tornar todo o cartão ou “Continuar leitura” a ação principal.
- Mover Editar, Arquivar e Excluir para um menu de contexto.
- Arquivar pode usar notificação com “Desfazer”, sem confirmação bloqueante.
- Manter confirmação explícita para Excluir e informar o que será removido.
- Exibir última leitura e progresso com linguagem curta e consistente.

### P1.7 — Adicionar busca, filtros e ordenação à Biblioteca

Os recursos de paginação existem, mas uma biblioteca grande exige recuperação,
não apenas navegação sequencial.

**Filtros mínimos:**

- Busca por título.
- Idioma.
- Tags.
- Ativos/arquivados.
- Ordenação por última leitura, título e progresso.

Persistir a preferência na sessão e anunciar a quantidade de resultados.

### P1.8 — Reorganizar Configurações de idioma

**Situação atual:** cada idioma mostra um formulário longo; em tela larga,
vários formulários aparecem lado a lado com campos estreitos. A advertência
sobre reprocessamento se aplica a todos os campos, mesmo quando o usuário só
quer alterar um dicionário.

**Proposta:**

- Mostrar uma lista de idiomas à esquerda e editar apenas um por vez.
- Separar “Leitura e dicionários” de “Análise avançada do texto”.
- Recolher regras de segmentação, substituição e RTL em “Opções avançadas”.
- Exibir a advertência apenas quando uma mudança realmente reprocessar textos.
- Mostrar resumo do impacto antes de salvar: “3 textos serão reprocessados; 2
  expressões serão removidas”.

### P1.9 — Melhorar a sessão de revisão

**Proposta:**

- Mostrar a frase de origem junto da palavra.
- Manter resposta e avaliações realmente ocultas até a revelação.
- Explicar as avaliações com próximo intervalo estimado: “De novo — 1 min”,
  “Difícil — 1 dia”, “Bom — 3 dias”, “Fácil — 7 dias”.
- Exibir atalhos `Espaço`, `1`, `2`, `3`, `4`.
- Mostrar uma barra discreta da sessão e permitir sair sem perder respostas já
  registradas.
- Oferecer “Revisar palavras deste texto” ao terminar uma leitura.

### P1.10 — Projetar acessibilidade além da cor

- Adicionar ícone ou padrão de sublinhado aos estados dos termos; azul, amarelo,
  verde e cinza não podem ser o único sinal.
- Garantir foco visível consistente em botões, links, selects e controles
  customizados.
- Usar alvos de pelo menos 40–44 px em janelas estreitas.
- Associar texto de ajuda com `aria-describedby`.
- Informar mudanças de estado e salvamento com regiões `aria-live`.
- Fornecer texto equivalente ao progresso, não apenas `<progress>`.
- Manter títulos de página focáveis após navegação.
- Localizar `lang`, rótulos e mensagens se a aplicação oferecer português.

### P1.11 — Recuperar a conclusão da lição em um clique

**Situação atual:** a pessoa pode chegar ao fim de um texto, reconhecer todas
as palavras e ainda encontrar itens azuis na barra de progresso. O leitor
atual oferece somente edição individual. Não existe uma ação para concluir a
sessão nem o equivalente ao `I KNOW ALL` do PHP.

**Comportamento confirmado no legado:** `texttodocount2()` exibia `I KNOW ALL`
ao lado da contagem “To Do” sempre que ela era maior que zero. Após uma
confirmação genérica, `all_words_wellknown.php` inseria com status 99 todas as
palavras simples e distintas daquele texto que ainda não possuíam termo salvo.
Termos já clicados permaneciam no vocabulário com seu status de aprendizagem.
O resultado era “zero pendentes”; não havia um estado persistente separado de
“texto concluído”. Expressões de múltiplas palavras não eram alteradas.

**Proposta:**

- Expor `Finish lesson` como uma única ação abaixo do painel contextual de
  vocabulário. Não repetir no cabeçalho, no rodapé ou como ação flutuante.
- Executar diretamente, sem diálogo intermediário: termos clicados já estão
  salvos no vocabulário; palavras simples nunca clicadas passam para status 99.
- Não modificar termos em aprendizagem, ignorados nem expressões.
- Após a ação, mostrar feedback resumido — por exemplo, “18 unmarked words set
  to Well Known; 6 learning terms kept in Vocabulary” — com `Undo`.
- Atualizar o progresso somando apenas as palavras convertidas. Termos em
  aprendizagem não contam como conhecidos e, portanto, a barra não deve saltar
  incorretamente para 100%.
- Desabilitar o botão e exibir `Lesson finished ✓` depois da conclusão.
- Para registrar conclusão independentemente do vocabulário, adicionar ao
  modelo um evento de leitura ou `completed_at`; hoje o schema não possui esse
  conceito.
- Manter o status 99 para round-trip fiel com o legado e exibi-lo como “Bem
  conhecido”, sem reduzi-lo silenciosamente a status 5.

Esse modelo reproduz a velocidade do LingQ e do LWT: o usuário só precisa clicar
nos termos que não conhece; o restante é assumido conhecido ao finalizar. Como
o status é global no idioma e afeta outros textos, `Undo` deve ser imediato e
real, não apenas uma mensagem.

**Critérios de aceite:**

- com 12 palavras nunca clicadas, um clique muda somente essas 12 para status
  99;
- termos clicados continuam em aprendizagem e no vocabulário;
- expressões, ignorados e estados existentes não são alterados;
- o feedback informa quantas palavras mudaram e oferece `Undo`;
- `Undo` restaura os estados e a contagem anteriores;
- textos sem palavras novas podem ser concluídos com uma única ação;
- a interface atualiza a contagem e o estilo dos termos sem recarregar ou
  perder a posição de leitura.

## Melhorias por tela

### Biblioteca e importação

| Prioridade | Melhoria | Motivo |
| --- | --- | --- |
| P1 | “Continuar lendo” e “Revisar agora” no topo | Expõe o próximo passo em vez da configuração. |
| P1 | Cadastro em modal/tela própria | Reduz várias telas de rolagem no mobile. |
| P1 | Busca, filtros e ordenação | Escala melhor que paginação isolada. |
| P1 | Menu de contexto para ações secundárias | Reduz ruído e cliques destrutivos acidentais. |
| P2 | Arrastar e soltar arquivo de texto/áudio | Torna a importação mais direta no desktop. |
| P2 | Suporte futuro a EPUB e importação por URL | Aproxima o produto do conteúdo real usado pelo aluno. |
| P2 | Pré-visualização antes de salvar | Permite conferir título, idioma, contagem e áudio. |

### Leitor

| Prioridade | Melhoria | Motivo |
| --- | --- | --- |
| P1 | Painel contextual fixo | Preserva texto e frase durante a edição. |
| P1 | Tradução rápida e contexto | Reduz interrupção cognitiva. |
| P1 | `Finish lesson` em um clique | Mantém termos clicados no vocabulário e assume as palavras não clicadas como conhecidas, com `Undo`. |
| P1 | Folha inferior no mobile | Evita empurrar o texto para muitas telas abaixo. |
| P1 | Seleção natural de expressões | Aproxima a ação do modelo mental de selecionar texto. |
| P2 | Largura de linha entre 55–75 caracteres | Melhora conforto em textos longos. |
| P2 | Player compacto e fixo | Mantém play/pause/velocidade acessíveis durante a leitura. |
| P2 | Modo por sentença | Ajuda iniciantes e idiomas com sintaxe distante. |
| P2 | Preferências do leitor no próprio leitor | Fonte, tamanho, espaçamento e tema ficam no contexto certo. |

### Revisão e estatísticas

| Prioridade | Melhoria | Motivo |
| --- | --- | --- |
| P1 | Contexto da frase e intervalos nas avaliações | Torna a decisão de memória compreensível. |
| P1 | Atalhos de teclado | Acelera sessões repetitivas. |
| P2 | Meta diária opcional | Cria continuidade sem exigir gamificação pesada. |
| P2 | Tendência semanal e palavras por idioma | Números isolados não mostram evolução. |
| P2 | Estado vazio útil em Estatísticas | Hoje aparece apenas uma tabela sem linhas. |
| P2 | Remover “Scheduler comparison” da UI comum | É informação de paridade técnica, não uma necessidade do aluno. |

### Tags, backup e configurações

| Prioridade | Melhoria | Motivo |
| --- | --- | --- |
| P1 | Editar, excluir e buscar tags | O fluxo atual só cria e lista. |
| P1 | Preferências em unidades humanas | “Pausa após avaliação” deve usar segundos, não milissegundos. |
| P2 | Mostrar data e conteúdo do último backup | Aumenta confiança na segurança dos dados. |
| P2 | Separar Restauração em “Zona de risco” | Diferencia exportação segura de substituição irreversível. |
| P2 | Tema Claro/Escuro/Sistema | Evita depender apenas da preferência do sistema operacional. |
| P2 | Aviso de alterações não salvas | Protege formulários longos de idioma e texto. |

## Benchmark competitivo

### Comparação resumida

| Produto | Padrões observados | O que adaptar ao LWT | O que evitar |
| --- | --- | --- | --- |
| **Readlang** | Leitor deliberadamente limpo; tradução imediata ao clicar; dicionário lateral; palavras consultadas viram flashcards contextuais; vocabulário pode ser editado, marcado e exportado. | Texto como protagonista, tradução inline, painel lateral e revisão gerada a partir da leitura. É a referência mais próxima da simplicidade desejada. | IA ou tradução em nuvem obrigatória. No LWT, qualquer integração deve ser opcional e transparente. |
| **LingQ** | Biblioteca com “Continue Studying”; conteúdo real e importado; áudio persistente; palavras novas/aprendendo com cores; termos clicados viram itens de aprendizagem; palavras azuis deixadas para trás são consideradas conhecidas; modo por sentença e revisão dentro do leitor. | Continuidade na Home, painel contextual, áudio sempre disponível e `Finish lesson` direto: salvar os termos clicados e assumir os demais como conhecidos. | Excesso de níveis, menus e atividades simultâneas. A ação em massa precisa de `Undo` para que um clique acidental não contamine o vocabulário. |
| **LinguaLeo** | Recomendações pelo nível, metas, exercícios variados, progresso por habilidade, conteúdo interativo e vocabulário reaproveitado em atividades. | Mostrar próximo passo, meta leve e progresso significativo; usar palavras pessoais em revisões mais contextuais. | Gamificação infantilizada, recompensas competindo com a leitura e dependência de conta/serviço remoto. |

### Padrões competitivos mais relevantes

#### 1. Biblioteca como ponto de continuidade

O LingQ documenta uma seção “Continue Studying” e opções de importação por URL,
texto, arquivo ou digitalização. Para o LWT, a primeira dobra deve responder
“onde eu parei?” e “o que preciso revisar?”, deixando a importação a um botão de
distância.

#### 2. Compreender sem sair da frase

Readlang enfatiza tradução rápida e uma interface de leitura sem distrações. O
LingQ abre traduções e dicionários a partir da palavra e mantém um modo focado
na sentença. Ambos reduzem a distância entre dúvida e compreensão. O formulário
alto acima do texto no LWT faz o oposto e deve ser substituído.

#### 3. Vocabulário nasce da leitura

No Readlang, palavras consultadas são salvas e reaparecem em flashcards de
contexto. No LingQ, a palavra muda visualmente e fica disponível para revisão.
O LWT já possui a infraestrutura necessária; falta apresentar essa continuidade
como um único fluxo.

#### 4. Progresso deve sugerir uma ação

LinguaLeo e LingQ usam metas, recomendações e acompanhamento para indicar o que
fazer em seguida. O LWT mostra contagens corretas, mas pouco acionáveis. “12
termos vencem hoje — cerca de 6 minutos” é mais útil que uma página separada
com “Due now: 12”.

#### 5. Finalizar a lição deve encerrar o ciclo do leitor

O guia oficial do LingQ explica o princípio operacional: palavras azuis que o
usuário não seleciona são assumidas como conhecidas, enquanto as palavras
selecionadas viram itens amarelos de aprendizagem. Relatos recentes e respostas
do suporte confirmam que `Finish Lesson` aplica essa mesma regra às palavras
azuis restantes. O LWT PHP fazia o equivalente por `I KNOW ALL`. Para preservar
a velocidade sem repetir a maior fragilidade relatada por usuários do LingQ, o
desktop deve fazer isso em um clique e oferecer `Undo` real imediatamente.

## Arquitetura de informação proposta

```text
Início
├── Continuar lendo
├── Revisão de hoje
└── Atividade recente

Biblioteca
├── Busca e filtros
├── Textos ativos
├── Arquivados
└── Adicionar conteúdo

Leitor
├── Texto e áudio
├── Painel contextual de termo/expressão
└── Revisar palavras deste texto

Revisão
├── Vencem hoje
├── Sessão atual
└── Vocabulário

Organizar
├── Tags
└── Idiomas

Progresso
└── Estatísticas

Sistema
├── Configurações
└── Backup e restauração
```

## Conceito visual proposto

- Superfícies mais calmas, com menos cartões aninhados.
- Uma única cor de ação primária; cores semânticas reservadas a estados.
- Tipografia de interface no shell e tipografia de leitura configurável no
  texto.
- Raio, borda, sombra, espaçamento e cores definidos por tokens.
- Títulos curtos, metadados discretos e ações secundárias em menus.
- Tema claro intencional e consistente, independentemente da preferência escura
  do sistema operacional.
- No leitor, largura de texto controlada e painel lateral entre 320 e 380 px.
- No mobile, navegação inferior e painel de termo em folha inferior.

## Plano de implementação sugerido

### Etapa 0 — correções de base

1. Corrigir `[hidden]`.
2. Consolidar o tema claro intencional em todas as telas.
3. Implementar política de rolagem e foco entre telas.
4. Criar tokens semânticos de cor e testes visuais dos temas.

### Etapa 1 — shell e Biblioteca

1. Criar navegação persistente em `ViewSwitcher` na headerbar, com fallback
   inferior responsivo e menu primário para operações menos frequentes.
2. Transformar a headerbar na titlebar da janela Tauri: desativar as decorações
   nativas, definir regiões de arraste, adicionar controles Adwaita para
   minimizar, maximizar/restaurar e fechar, conceder somente as permissões de
   janela necessárias e validar arraste, duplo clique, redimensionamento e
   maximização em Wayland e X11.
3. Separar Home e Library.
4. Mover importação para modal/tela própria.
5. Criar os estados de primeiro uso, sem leitura atual e usuário recorrente; no
   primeiro uso, configurar o idioma antes do texto.
6. Criar `Continue reading`, revisão de hoje e três textos recentes sem
   duplicar o destaque.
7. Adicionar busca, filtro, ordenação e paginação na Library.
8. Simplificar ações dos cartões.

### Etapa 2 — leitor contextual

1. Criar layout de duas colunas.
2. Transformar editor em painel lateral/folha inferior.
3. Preservar seleção, contexto e posição de leitura.
4. Simplificar status, tradução e expressões.
5. Implementar `Finish lesson` em um clique, registro de leitura e `Undo`.
6. Integrar a chamada de revisão ao leitor; não expor áudio local na interface.

### Etapa 3 — revisão, configurações e progresso

1. Adicionar contexto, intervalos e atalhos à revisão.
2. Reestruturar idiomas com seleção de um idioma por vez.
3. Criar estatísticas acionáveis e estados vazios.
4. Completar gerenciamento de tags e confiança do backup.

## Métricas para validar as mudanças

- Tempo e número de cliques para reabrir o último texto.
- Distância de rolagem até o primeiro texto da biblioteca.
- Tempo entre selecionar uma palavra e salvar sua tradução.
- Percentual de edições em que a frase de contexto continua visível.
- Taxa de conclusão e duração média de uma sessão de revisão.
- Taxa de conclusão de textos e quantidade de palavras não clicadas convertidas
  em `Well Known`.
- Quantidade de alterações em massa desfeitas após `I KNOW ALL`.
- Uso de “Continuar lendo” e “Revisar agora”.
- Erros ou cancelamentos em ações de excluir/restaurar.
- Sucesso dos fluxos por teclado e em zoom de 200%.
- Contraste e regressões nos temas claro e escuro.

## Referências do benchmark

- [LingQ — guia do aplicativo e do leitor](https://www.lingq.com/en/ios-app-support/)
- [LingQ — comportamento de `Finish Lesson` confirmado pelo suporte](https://forum.lingq.com/t/finishing-lessons-adds-all-words-as-known-error/1430553)
- [LingQ — como o método funciona](https://www.lingq.com/how-to-use-lingq/)
- [LingQ — importador de conteúdo](https://www.lingq.com/lingq-importer-chrome-extension/)
- [Readlang — visão geral](https://readlang.com/landing-page)
- [Readlang — funcionalidades](https://readlang.com/features)
- [Readlang — princípios do produto](https://readlang.com/about)
- [LinguaLeo — página oficial na App Store](https://apps.apple.com/us/app/lingualeo-language-learning/id480952151)
- [LinguaLeo — site oficial](https://lingualeo.com/en)

## Observação final

O objetivo não deve ser copiar a quantidade de funcionalidades dos
concorrentes. A melhor oportunidade do LWT é combinar a fluidez contextual do
Readlang, a continuidade entre biblioteca/leitor/revisão do LingQ e a clareza
de próximo passo do LinguaLeo com uma experiência privada, local e previsível.
