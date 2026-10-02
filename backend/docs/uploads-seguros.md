# Uploads de fotos: validação, isolamento e operação segura

## Comportamento implementado

- Endpoints genéricos exigem administrador autenticado. A foto do app do barbeiro só pode alterar seu próprio cadastro ativo. O serviço revalida papel, unidade ativa e propriedade do recurso no banco antes de chamar armazenamento.
- `/upload/barbeiro` requer `barbeiroId` de um cadastro existente. A tela cria o cadastro primeiro e só então envia a foto; se essa etapa falhar, mantém o ID criado para repetir sem duplicar o barbeiro.
- Multipart: um arquivo, nenhum campo extra, uma parte, nome de campo de até 32 bytes, arquivo de até 2 MiB e corpo total de até 2 MiB + 16 KiB. A contagem também cobre corpos chunked, preâmbulos e epílogos. O recebimento termina em até 30 segundos.
- Admissão por processo: no máximo oito recebimentos simultâneos, dois por unidade; dez tentativas por ator e trinta por unidade a cada quinze minutos. Há um limite independente de quatro processamentos de imagem que não é liberado pelo simples encerramento do socket.
- Apenas JPEG, PNG e WebP estáticos, com assinatura compatível com MIME, decodificação completa, até 16 milhões de pixels e até 8192 pixels por dimensão. A imagem é orientada e reencodificada para WebP de até 1024×1024 e 512 KiB, sem EXIF ou outros metadados de origem. SVG, GIF, documentos, arquivos truncados e animações são rejeitados.
- A atribuição direta de novas imagens por JSON foi bloqueada em criação/edição de barbeiro, perfil e configuração da loja. Um valor legado inalterado continua aceito e não é regravado; omissão mantém a foto. A limpeza explícita continua disponível.

## Armazenamento e substituição

As novas fotos usam `imagens-v2/<unidade>/<recurso>/arquivos/<uuid>.webp`, com criação exclusiva (`upsert: false`). O namespace não é compartilhado entre recursos e nunca reutiliza nomes. Arquivos legados fora dele não são excluídos, sobrescritos ou migrados.

A troca mantém um lock transacional do PostgreSQL e uma reserva durável no Storage (`pendente.webp`). A reserva também é criada exclusivamente. A listagem é paginada e limitada a dezesseis arquivos por recurso; metadados inválidos, inventário incompleto ou erro do provedor interrompem o fluxo. A URL atualmente referenciada no banco deve existir na listagem quando pertence ao novo namespace.

Somente arquivos gerenciados sem referência atual são removidos antes de uma nova foto. A nova referência é gravada no banco após confirmação do upload. Em condições normais, ficam a foto atual e a anterior por recurso (até 1 MiB), além do pequeno marcador durante a operação. Substituições repetidas não atingem uma quota vitalícia. O número de recursos segue os cadastros reais, sem fotos avulsas de rascunhos.

Se uma operação remota tiver resultado incerto, a reserva permanece. Isso impede que tentativas subsequentes acumulem gravações atrasadas ou que uma exclusão antiga alcance uma foto futura. Uma falha de gravação/commit do banco mantém a referência anterior. Nenhuma exclusão usa o caminho da foto atual.

## Verificação obrigatória antes de publicar

Não foram acessados buckets reais nem alteradas permissões. A configuração mantém a precedência existente de `SUPABASE_ANON_KEY`, com `SUPABASE_SERVICE_ROLE_KEY` como alternativa; nenhuma credencial nova é exigida pelo código.

Ainda é necessário verificar, com leitura das políticas do ambiente e teste em bucket exclusivamente de homologação, que a credencial já configurada pode:

1. Criar exclusivamente os objetos e marcadores do namespace de imagens
2. Listar o namespace inteiro, sem linhas ocultadas por políticas
3. Excluir somente marcadores e fotos gerenciadas sem referência atual

O fluxo antigo não exigia exclusão; uma política sem essa capacidade fará a nova operação falhar de forma segura, mantendo a foto existente. **Não ampliar acesso anônimo nem conceder novas permissões automaticamente.** Uma eventual alteração de credencial/política precisa de autorização própria e revisão da exposição do bucket. O backend e a leitura das fotos existentes continuam funcionando se essa verificação falhar; novos uploads não devem ser anunciados como validados em produção.

## Reserva pendente

Não há expiração automática de reservas de resultado incerto. Idade sozinha não prova que uma operação remota terminou. Para recuperar um recurso, um operador autorizado precisa verificar o resultado no provedor e a referência atual no banco, confirmar que não há operação remota pendente e só então autorizar a remoção do marcador específico. Não remover a foto atual, não limpar pastas inteiras e não reaproveitar UUIDs. O procedimento não foi executado em produção.

## Evidências locais

`node --import tsx scripts/testes_upload_seguro.ts`, dentro de `backend`, usa somente imagens sintéticas, HTTP local, persistência em memória e provedor simulado. Cobre formatos/decodificação/dimensões, remoção de EXIF/payload adicional, 256 substituições sucessivas, preservação de fotos atuais/legadas, paginação, inventário inválido, permissão DELETE negada, resultados remotos tardios, reserva durável, rollback, propriedade/papel, bloqueio de URLs entre recursos, multipart chunked, partes/campos/bytes, concorrência, desconexão e limites por ator/unidade.

Esses testes não comprovam as políticas atuais de Supabase nem concorrência real do PostgreSQL; a validação integrada local do banco e a revisão de implantação complementam essa evidência.

## Consultas de inspeção das políticas (somente leitura)

Executar somente no projeto Supabase correto, em uma sessão do operador já autorizada. Estas consultas não leem fotos nem credenciais e não mudam políticas:

```sql
BEGIN READ ONLY;
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('barbearias', 'barbeiros')
ORDER BY id;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename IN ('objects', 'buckets')
ORDER BY tablename, policyname;
ROLLBACK;
```

A existência de políticas não basta: revisar quais se aplicam ao papel da chave já configurada, seus predicados, acesso a SELECT/INSERT/DELETE e possíveis escritas diretas anônimas. Não executar GRANT, CREATE POLICY, ALTER POLICY ou alterar publicidade dos buckets como parte dessa inspeção. O teste com Storage simulado inclui DELETE negado por erro e por resposta vazia; ambos preservam a referência atual.

`testes_upload_postgres_local.ts` é uma integração adicional que só aceita banco novo `valen_upload_test`, usuário `valen_test`, host `127.0.0.1`, porta `55439`, sem parâmetros de conexão e com `ALLOW_LOCAL_SECURITY_TEST=1`. O runner deve criar o banco e aplicar o schema antes de executar. Usa PostgreSQL real e Storage inteiramente em memória: duas unidades sintéticas, lock concorrente, CAS, ownership e trigger diferido para simular uma falha real no commit. Não usa Supabase, dados de clientes nem credenciais de produção.
