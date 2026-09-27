# Certificado do Supabase

`supabase-prod-ca-2021.crt` é o certificado público da autoridade Supabase Root 2021 CA, não uma credencial.

Obtido em 26/09/2026 de https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. O endereço foi conferido no código oficial do painel: https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json, campo `ssl:certificate_url` com ambiente `prod`.

SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
Validade até 26/04/2031. Revisar quando o provedor anunciar rotação da CA.

O helper de backup usa esta CA apenas em hosts terminados em `.supabase.co` ou `.supabase.com`, mantendo validação de certificado e hostname. Outros provedores usam as CAs padrão do Node ou um arquivo explícito em `BACKUP_ORIGEM_CA_FILE`, `BACKUP_DESTINO_CA_FILE` ou `BACKUP_LEDGER_CA_FILE`. O arquivo precisa existir também no ambiente de execução. Não configurar `NODE_TLS_REJECT_UNAUTHORIZED=0`.
