import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.local'));

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEFAULT_PASSWORD = process.env.REQUESTED_PROFILES_PASSWORD || 'Teste@12345';

const requestedProfiles = [
  {
    email: 'davi.carlos@escola.com',
    fullName: 'Davi Carlos',
    profileType: 'administrador',
    cpf: '48788161803',
    department: 'Administracao',
  },
  {
    email: 'diego.nascimento@escola.com',
    fullName: 'Diego Nascimento',
    profileType: 'coordenador',
    cpf: '50436972883',
    department: 'Coordenacao',
  },
  {
    email: 'julia.varini@aluno.escola.com',
    fullName: 'Julia Varini',
    profileType: 'aluno',
    cpf: '56751024851',
    department: 'Ensino Medio',
  },
  {
    email: 'nicolas.araujo@escola.com',
    fullName: 'Nicolas de Araújo',
    profileType: 'secretario',
    cpf: '43332772805',
    department: 'Secretaria',
  },
  {
    email: 'paulo.eduardo@escola.com',
    fullName: 'Paulo Eduardo',
    profileType: 'professor',
    cpf: '44518371895',
    department: 'Corpo Docente',
  },
  {
    email: 'rhayan.eduardo@escola.com',
    fullName: 'Rhayan Eduardo',
    profileType: 'professor',
    cpf: '48661162858',
    department: 'Corpo Docente',
  },
];

async function listAllUsers(client) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const pageUsers = data?.users || [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function ensureAuthUsers(client) {
  const existingUsers = await listAllUsers(client);
  const existingByEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user])
  );

  for (const profile of requestedProfiles) {
    const metadata = {
      full_name: profile.fullName,
      profile_type: profile.profileType,
      cpf: profile.cpf,
    };
    const existing = existingByEmail.get(profile.email.toLowerCase());

    if (!existing) {
      const { error } = await client.auth.admin.createUser({
        email: profile.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: {},
      });

      if (error) {
        throw error;
      }

      console.log(`[auth] criado: ${profile.email}`);
      continue;
    }

    const { error } = await client.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        ...metadata,
      },
    });

    if (error) {
      throw error;
    }

    console.log(`[auth] atualizado: ${profile.email}`);
  }
}

async function ensureUserProfiles(client) {
  const rows = requestedProfiles.map((profile) => ({
    user_email: profile.email,
    full_name: profile.fullName,
    profile_type: profile.profileType,
    document_id: profile.cpf,
    department: profile.department,
    status: 'ativo',
    approved_by: 'admin@escola.com',
    approved_at: new Date().toISOString(),
    is_first_login: false,
  }));

  const { error } = await client
    .from('user_profiles')
    .upsert(rows, { onConflict: 'user_email' });

  if (error) {
    throw error;
  }

  console.log(`[profiles] upsert concluido: ${rows.length} registros`);
}

async function main() {
  const supabaseUrl = requiredEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await ensureAuthUsers(client);
  await ensureUserProfiles(client);

  console.log('\nPerfis solicitados prontos:');
  for (const profile of requestedProfiles) {
    console.log(`- ${profile.profileType.padEnd(13, ' ')} ${profile.fullName} -> ${profile.email}`);
  }
  console.log(`Senha padrao: ${DEFAULT_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
