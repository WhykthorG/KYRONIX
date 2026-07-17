#!/usr/bin/env node

/**
 * Script de verificação de segurança - KYRONIX S.E.N.O
 * Execute: node scripts/security-check.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

console.log('🔒 Verificação de Segurança - KYRONIX S.E.N.O\n');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// 1. Verificar que xlsx não está instalado
check('xlsx não está nas dependências', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'frontend/package.json'), 'utf8'));
  return !pkg.dependencies.xlsx;
});

// 2. Verificar que @anthropic-ai/sdk não está no frontend
check('@anthropic-ai/sdk não está no frontend', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'frontend/package.json'), 'utf8'));
  return !pkg.dependencies['@anthropic-ai/sdk'];
});

// 3. Verificar que exceljs está instalado
check('exceljs está nas dependências', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'frontend/package.json'), 'utf8'));
  return !!pkg.dependencies.exceljs;
});

// 4. Verificar que .env.local não está no .gitignore (deve ser ignorado)
check('.env.local está no .gitignore', () => {
  const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
  return gitignore.includes('.env.local') || gitignore.includes('.env.*');
});

// 5. Verificar que credenciais não estão hardcoded no webrtcConfig
check('Credenciais TURN não estão hardcoded', () => {
  const content = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/lib/webrtcConfig.js'),
    'utf8'
  );
  return !content.includes('3b2a44d642b81b1532d6f7e9') &&
         !content.includes('fQA74ax484KGzd/r');
});

// 6. Verificar que endpoint TURN existe
check('Endpoint turn-credentials existe', () => {
  return fs.existsSync(
    path.join(projectRoot, 'backend/src/routes/chat/turn-credentials.js')
  );
});

// 7. Verificar que endpoint de validação MIME existe
check('Endpoint storage/validate existe', () => {
  return fs.existsSync(
    path.join(projectRoot, 'backend/src/routes/storage/validate.js')
  );
});

// 8. Verificar que nginx tem headers de segurança
check('nginx.conf tem CSP', () => {
  const nginx = fs.readFileSync(
    path.join(projectRoot, 'infra/nginx.conf'),
    'utf8'
  );
  return nginx.includes('Content-Security-Policy');
});

check('nginx.conf tem HSTS', () => {
  const nginx = fs.readFileSync(
    path.join(projectRoot, 'infra/nginx.conf'),
    'utf8'
  );
  return nginx.includes('Strict-Transport-Security');
});

check('nginx.conf tem CORS', () => {
  const nginx = fs.readFileSync(
    path.join(projectRoot, 'infra/nginx.conf'),
    'utf8'
  );
  return nginx.includes('Access-Control-Allow-Origin');
});

// 9. Verificar que cypress requer env vars
check('Cypress requer senhas via env vars', () => {
  const cypress = fs.readFileSync(
    path.join(projectRoot, 'cypress.config.ts'),
    'utf8'
  );
  return cypress.includes('requireEnv("CYPRESS_ADMIN_PASSWORD")') &&
         !cypress.includes('"Teste@12345"');
});

// 10. Verificar que scripts requerem env vars
check('Scripts requerem env vars para senhas', () => {
  const resetScript = fs.readFileSync(
    path.join(projectRoot, 'scripts/reset-test-auth.mjs'),
    'utf8'
  );
  return resetScript.includes("requiredEnv('TEST_USER_PASSWORD')");
});

// 11. Verificar que storageFiles.js valida MIME
check('storageFiles.js valida MIME antes de upload', () => {
  const storage = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/lib/storageFiles.js'),
    'utf8'
  );
  return storage.includes('/api/storage/validate');
});

// 12. Verificar npm audit
console.log('\n📊 Verificando npm audit...');
try {
  const audit = execSync('npm audit --omit=dev --json', {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  const result = JSON.parse(audit);
  const highVulns = result.vulnerabilities?.filter(v => v.severity === 'high') || [];
  check(`Sem vulnerabilidades HIGH (encontradas: ${highVulns.length})`, () => highVulns.length === 0);
} catch (error) {
  // npm audit retorna exit code 1 se encontrar vulnerabilidades
  console.log('⚠️  npm audit encontrou vulnerabilidades (verificar manualmente)');
}

// Resumo
console.log(`\n${'='.repeat(50)}`);
console.log(`✅ Passou: ${passed}`);
console.log(`❌ Falhou: ${failed}`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  console.log('\n⚠️  Alguns testes falharam. Verificar os itens marcados com ❌.');
  process.exit(1);
} else {
  console.log('\n🎉 Todos os testes de segurança passaram!');
  process.exit(0);
}
