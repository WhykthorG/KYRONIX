// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
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

function buildAllowedUsers() {
  const password = process.env.TEST_USER_PASSWORD || 'Teste@12345';

  return [
    {
      email: 'admin@escola.com',
      password,
      fullName: 'Administrador Sistema',
      profileType: 'administrador',
      resetPassword: false,
      profileId: '550e8400-e29b-41d4-a716-446655440100',
    },
    {
      email: 'maria.santos@escola.com',
      password,
      fullName: 'Maria Silva Santos',
      profileType: 'professor',
      resetPassword: false,
      profileId: '550e8400-e29b-41d4-a716-446655440101',
    },
    {
      email: 'lucas.silva@aluno.escola.com',
      password,
      fullName: 'Lucas Gabriel Silva',
      profileType: 'aluno',
      resetPassword: false,
      profileId: '550e8400-e29b-41d4-a716-446655440111',
    },
    {
      email: 'coordenador@escola.com',
      password,
      fullName: 'Coordenador Teste',
      profileType: 'coordenador',
      resetPassword: false,
      profileId: '550e8400-e29b-41d4-a716-446655440120',
    },
    {
      email: 'secretario@escola.com',
      password,
      fullName: 'Secretário Teste',
      profileType: 'secretario',
      resetPassword: false,
      profileId: '550e8400-e29b-41d4-a716-446655440121',
    },
  ];
}

async function upsertAllowedProfiles(client, allowedUsers) {
  const profileRows = allowedUsers.map((user) => ({
    id: user.profileId,
    user_email: user.email,
    full_name: user.fullName,
    profile_type: user.profileType,
    status: 'ativo',
    phone: null,
    birth_date: null,
    document_id: null,
    address: null,
    registration_number: null,
    department:
      user.profileType === 'administrador' ? 'Administração'
        : user.profileType === 'professor' ? 'Matemática'
        : user.profileType === 'aluno' ? 'Ensino Médio'
        : user.profileType === 'coordenador' ? 'Coordenação'
        : user.profileType === 'secretario' ? 'Secretaria'
        : 'Família',
    approved_by: 'admin@escola.com',
    approved_at: '2024-01-01T00:00:00+00:00',
    is_first_login: false,
  }));

  const { error } = await client
    .from('user_profiles')
    .upsert(profileRows, { onConflict: 'user_email' });

  if (error) {
    throw error;
  }
}

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

async function main() {
  const supabaseUrl = requiredEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const allowedUsers = buildAllowedUsers();
  const allowedByEmail = new Map(
    allowedUsers.map((user) => [user.email.toLowerCase(), user])
  );

  const existingUsers = await listAllUsers(client);

  for (const user of existingUsers) {
    const email = user.email?.toLowerCase();
    if (!email || allowedByEmail.has(email)) {
      continue;
    }

    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }
  }

  const remainingUsers = await listAllUsers(client);
  const remainingByEmail = new Map(
    remainingUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user])
  );

  for (const allowedUser of allowedUsers) {
    const existing = remainingByEmail.get(allowedUser.email.toLowerCase());
    const metadata = {
      full_name: allowedUser.fullName,
      profile_type: allowedUser.profileType,
    };

    if (!existing) {
      const { error } = await client.auth.admin.createUser({
        email: allowedUser.email,
        password: allowedUser.password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: {},
      });
      if (error) {
        throw error;
      }
      continue;
    }

    const updatePayload = {
      user_metadata: {
        ...(existing.user_metadata || {}),
        ...metadata,
      },
    };

    if (allowedUser.resetPassword) {
      updatePayload.password = allowedUser.password;
      updatePayload.email_confirm = true;
    }

    const { error } = await client.auth.admin.updateUserById(existing.id, updatePayload);
    if (error) {
      throw error;
    }
  }

  await upsertAllowedProfiles(client, allowedUsers);
  console.log(`Auth reset concluido. Usuarios permitidos: ${allowedUsers.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
