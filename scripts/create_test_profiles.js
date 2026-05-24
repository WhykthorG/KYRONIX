// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import bcrypt from 'bcryptjs';
import prisma from '../server/prismaClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const profiles = [
  { email: 'admin@teste.com', type: 'administrador', name: 'Admin Teste' },
  { email: 'coordenador@teste.com', type: 'coordenador', name: 'Coordenador Teste' },
  { email: 'professor@teste.com', type: 'professor', name: 'Professor Teste' },
  { email: 'aluno@teste.com', type: 'aluno', name: 'Aluno Teste' },
  { email: 'secretario@teste.com', type: 'secretario', name: 'Secretário Teste' },
];

async function createTestProfiles() {
  console.log('Iniciando a criação de perfis de teste...\n');

  for (const p of profiles) {
    const existing = await prisma.user.findUnique({ where: { email: p.email } });
    if (existing) {
      console.log(`[AVISO] Usuário ${p.email} já existe.`);
      continue;
    }

    const passwordHash = await bcrypt.hash('123456', 10);

    const user = await prisma.user.create({
      data: {
        email: p.email,
        passwordHash,
        fullName: p.name,
        profileType: p.type,
        status: 'ativo',
        emailConfirmed: true,
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        fullName: p.name,
        profileType: p.type,
        status: 'ativo',
      },
      create: {
        userId: user.id,
        userEmail: p.email,
        fullName: p.name,
        profileType: p.type,
        status: 'ativo',
      },
    });

    console.log(`[OK] Usuário e perfil criados: ${p.email}`);
    console.log('---');
  }

  console.log('\nProcesso concluído! Os usuários podem acessar usando as seguintes credenciais:');
  profiles.forEach(p => {
    console.log(`- ${p.type.padEnd(13, ' ')} -> Email: ${p.email} / Senha: 123456`);
  });
}

createTestProfiles().catch((error) => {
  console.error('Erro ao criar perfis de teste:', error);
  process.exit(1);
});
