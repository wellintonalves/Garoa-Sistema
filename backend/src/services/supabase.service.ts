import { createClient } from '@supabase/supabase-js';

export class SupabaseService {
  private static getClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL ou Key não configuradas no ambiente (SUPABASE_URL e SUPABASE_ANON_KEY).');
    }

    return createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Faz upload de uma imagem para um bucket público do Supabase e retorna a URL pública.
   * @param bucket Nome do bucket ('barbearias' ou 'barbeiros')
   * @param path Caminho do arquivo (ex: 'logo-123.png')
   * @param fileBuffer Buffer do arquivo recebido via multer
   * @param mimetype Tipo mime do arquivo (ex: 'image/png')
   */
  static async uploadImage(bucket: string, path: string, fileBuffer: Buffer, mimetype: string): Promise<string> {
    const supabase = this.getClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType: mimetype,
        upsert: true,
      });

    if (error) {
      throw new Error(`Erro no upload para o Supabase (${bucket}): ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }
}
