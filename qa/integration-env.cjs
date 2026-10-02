// Intentionally separate from all user/environment credentials and databases.
const url = "postgresql://barber_qa@127.0.0.1:55439/valen_barber_ui_test";
exports.configure = () => {
  for (const key of Object.keys(process.env))
    if (
      /SECRET|TOKEN|API_KEY|DATABASE|DIRECT_URL|SUPABASE|RESEND|BACKUP|ASAAS/.test(
        key,
      )
    )
      delete process.env[key];
  Object.assign(process.env, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NODE_ENV: "test",
    JWT_SECRET: "isolated-admin-test-only-secret-00001",
    JWT_SECRET_BARBEIRO: "isolated-barber-test-only-secret-0002",
    JWT_SECRET_CLIENTE: "isolated-client-test-only-secret-0003",
    CORS_EXTRA_ORIGINS: "http://127.0.0.1:5189",
    ASSINATURA_PROVEDOR: "fake",
    ASSINATURA_FAKE_LOCAL_ENABLED: "true",
    BACKUP_ENABLED: "false",
    RUN_DB_COPY: "0",
    RUN_FIX_ORPHANS: "0",
  });
};
exports.url = url;
