import { Client } from 'pg';

export async function corrigirDados(dbUrl: string): Promise<void> {
  const sslConfig = !dbUrl.includes('.railway.internal') ? { rejectUnauthorized: false } : false;
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: sslConfig
  });

  try {
    await client.connect();
    
    console.log('FIX ORPHANS: iniciado');

    // 1. Religar lançamentos órfãos pelo barbeiro
    const res1 = await client.query(`
      UPDATE lancamentos_financeiros l 
      SET "barbeariaId" = b."barbeariaId" 
      FROM barbeiros b 
      WHERE l."barbeariaId" IS NULL AND l."barbeiroId" = b.id;
    `);
    console.log(`FIX ORPHANS: Passo 1 - Lançamentos religados pelo barbeiro: ${res1.rowCount}`);

    // 2. Religar órfãos restantes pelo agendamento
    const res2 = await client.query(`
      UPDATE lancamentos_financeiros l 
      SET "barbeariaId" = a."barbeariaId" 
      FROM agendamentos a 
      WHERE l."barbeariaId" IS NULL AND l."agendamentoId" = a.id AND a."barbeariaId" IS NOT NULL;
    `);
    console.log(`FIX ORPHANS: Passo 2 - Lançamentos religados pelo agendamento: ${res2.rowCount}`);

    // 3. Reancorar datas históricas gravadas em meia-noite UTC
    const res3 = await client.query(`
      UPDATE lancamentos_financeiros 
      SET data = data + interval '3 hours' 
      WHERE to_char(data AT TIME ZONE 'UTC', 'HH24:MI:SS') = '00:00:00';
    `);
    console.log(`FIX ORPHANS: Passo 3 - Datas históricas corrigidas (3 horas adicionadas): ${res3.rowCount}`);

    // 4. Logar diagnóstico final
    const res4 = await client.query(`
      SELECT COUNT(*) as orfaos_restantes
      FROM lancamentos_financeiros 
      WHERE "barbeariaId" IS NULL;
    `);
    console.log(`FIX ORPHANS: Passo 4 - Lançamentos ainda com barbeariaId IS NULL: ${res4.rows[0].orfaos_restantes}`);

    console.log('FIX ORPHANS: concluido');
  } catch (error) {
    console.error('FIX ORPHANS: erro durante execução', error);
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}
