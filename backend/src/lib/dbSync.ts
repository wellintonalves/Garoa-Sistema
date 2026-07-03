import { Client } from 'pg';

export async function copiarBanco(sourceUrl: string, targetUrl: string) {
  const startTime = Date.now();
  
  const sslSource = !sourceUrl.includes('.railway.internal') ? { rejectUnauthorized: false } : false;
  const sourceClient = new Client({
    connectionString: sourceUrl,
    ssl: sslSource
  });
  
  const sslTarget = !targetUrl.includes('.railway.internal') ? { rejectUnauthorized: false } : false;
  const targetClient = new Client({
    connectionString: targetUrl,
    ssl: sslTarget
  });

  try {
    await sourceClient.connect();
    await targetClient.connect();

    // List tables in public schema
    const result = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      AND table_name != '_prisma_migrations';
    `);
    
    const tables = result.rows.map(row => row.table_name);
    let totalLinhas = 0;

    // Disable triggers and FK checks in target
    await targetClient.query('SET session_replication_role = replica;');

    for (const table of tables) {
      // Truncate
      await targetClient.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      
      // Fetch data
      const dataResult = await sourceClient.query(`SELECT * FROM "${table}";`);
      const rows = dataResult.rows;
      
      if (rows.length > 0) {
        // Insert in batches of 500
        const batchSize = 500;
        const columns = Object.keys(rows[0]);
        const columnsQuoted = columns.map(c => `"${c}"`).join(', ');

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          const valuesStr: string[] = [];
          const flatValues: any[] = [];
          let paramIdx = 1;

          for (const row of batch) {
            const rowParams: string[] = [];
            for (const col of columns) {
              rowParams.push(`$${paramIdx}`);
              flatValues.push(row[col]);
              paramIdx++;
            }
            valuesStr.push(`(${rowParams.join(', ')})`);
          }

          const insertQuery = `INSERT INTO "${table}" (${columnsQuoted}) VALUES ${valuesStr.join(', ')};`;
          await targetClient.query(insertQuery, flatValues);
        }
      }
      
      totalLinhas += rows.length;

      // Verification
      const targetCountResult = await targetClient.query(`SELECT COUNT(*) FROM "${table}";`);
      const targetCount = parseInt(targetCountResult.rows[0].count, 10);
      
      if (targetCount !== rows.length) {
        throw new Error(`Divergência na tabela ${table}: Source=${rows.length}, Target=${targetCount}`);
      }
    }

    return {
      tabelas: tables.length,
      totalLinhas,
      duracaoMs: Date.now() - startTime
    };

  } finally {
    try {
      await targetClient.query('SET session_replication_role = DEFAULT;');
    } catch (e) {
      // Ignore if connection is broken
    }
    await sourceClient.end().catch(() => {});
    await targetClient.end().catch(() => {});
  }
}
