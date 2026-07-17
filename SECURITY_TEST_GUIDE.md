# Guia de Testes — Melhorias de Segurança KYRONIX S.E.N.O

## Pré-requisitos

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente de teste
cp .env.example .env.local
# Editar .env.local com credenciais de teste (não produção)
```

---

## 1. Testar Cabeçalhos de Segurança (nginx)

### 1.1 Verificar HSTS
```bash
curl -I http://localhost:80 2>&1 | findstr "Strict-Transport-Security"
```
**Esperado:** `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 1.2 Verificar CSP
```bash
curl -I http://localhost:80 2>&1 | findstr "Content-Security-Policy"
```
**Esperado:** Header CSP presente com directivas de segurança

### 1.3 Verificar Permissions-Policy
```bash
curl -I http://localhost:80 2>&1 | findstr "Permissions-Policy"
```
**Esperado:** `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 1.4 Verificar CORS
```bash
curl -I -X OPTIONS http://localhost:80/api/test -H "Origin: http://localhost:5173" 2>&1 | findstr "Access-Control"
```
**Esperado:** Headers CORS presentes

---

## 2. Testar Endpoint de Credenciais TURN

### 2.1 Testar sem autenticação
```bash
curl http://localhost:3001/api/chat/turn-credentials
```
**Esperado:** Erro 401 (não autenticado)

### 2.2 Testar com autenticação
```bash
# Primeiro, obter token de acesso
TOKEN=$(curl -s -X POST http://localhost:3001/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@escola.com","password":"SUA_SENHA"}' | jq -r '.access_token')

# Depois, testar o endpoint
curl http://localhost:3001/api/chat/turn-credentials \
  -H "Authorization: Bearer $TOKEN"
```
**Esperado:** Resposta com `iceServers` contendo STUN/TURN

### 2.3 Verificar que credenciais não estão no bundle
```bash
# Build do frontend
cd frontend && npm run build

# Procurar por credenciais hardcoded
grep -r "3b2a44d642b81b1532d6f7e9" dist/
grep -r "fQA74ax484KGzd/r" dist/
```
**Esperado:** Nenhuma correspondência (credenciais removidas)

---

## 3. Testar Validação MIME

### 3.1 Testar tipo permitido
```bash
curl -X POST http://localhost:3001/api/storage/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mimeType":"image/jpeg","fileSize":1024000,"fileName":"foto.jpg"}'
```
**Esperado:** `{ "valid": true, "category": "images", ... }`

### 3.2 Testar tipo não permitido
```bash
curl -X POST http://localhost:3001/api/storage/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mimeType":"application/x-executable","fileSize":1024000,"fileName":"virus.exe"}'
```
**Esperado:** Erro 400 "Tipo de arquivo nao permitido"

### 3.3 Testar tamanho excedido
```bash
curl -X POST http://localhost:3001/api/storage/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mimeType":"image/jpeg","fileSize":50000000,"fileName":"foto.jpg"}'
```
**Esperado:** Erro 400 "Arquivo excede o tamanho maximo"

### 3.4 Testar nome perigoso
```bash
curl -X POST http://localhost:3001/api/storage/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mimeType":"image/jpeg","fileSize":1024,"fileName":"../../../etc/passwd"}'
```
**Esperado:** Erro 400 "Nome de arquivo contem caracteres nao permitidos"

---

## 4. Testar Upload com Validação

### 4.1 Via Interface (Browser)
1. Abrir http://localhost:5173
2. Fazer login
3. Navegar para uma página com upload (ex: Chat, Documentos)
4. Tentar enviar arquivo `.exe`
5. **Esperado:** Mensagem de erro "Tipo de arquivo nao permitido"

### 4.2 Via Console do Browser
```javascript
// Testar validação diretamente
const response = await fetch('/api/storage/validate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${window.__appSupabaseState?.accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mimeType: 'application/pdf',
    fileSize: 1024000,
    fileName: 'documento.pdf'
  })
});
console.log(await response.json());
```

---

## 5. Testar Dependências

### 5.1 Verificar npm audit
```bash
npm audit --omit=dev
```
**Esperado:** Apenas vulnerabilidades moderadas (uuid em exceljs)

### 5.2 Verificar ausência de xlsx
```bash
npm ls xlsx
```
**Esperado:** "empty" ou erro "not found"

### 5.3 Verificar ausência de @anthropic-ai/sdk
```bash
npm ls @anthropic-ai/sdk
```
**Esperado:** "empty" ou erro "not found"

---

## 6. Testar Credenciais de Teste

### 6.1 Verificar que scripts requerem env vars
```bash
# Remover variável de ambiente temporariamente
unset TEST_USER_PASSWORD

# Tentar executar script
node scripts/reset-test-auth.mjs
```
**Esperado:** Erro "Missing required environment variable: TEST_USER_PASSWORD"

### 6.2 Verificar Cypress config
```bash
# Remover variáveis de ambiente
unset CYPRESS_ADMIN_PASSWORD

# Tentar rodar Cypress
npx cypress run
```
**Esperado:** Erro "Variável de ambiente CYPRESS_ADMIN_PASSWORD não configurada"

---

## 7. Testes Automatizados

### 7.1 Rodar testes existentes
```bash
# Testes de segurança
npm run test:security

# Testes de integração
npm run test:integration

# Testes E2E (requer variáveis de ambiente configuradas)
npm run test:e2e
```

### 7.2 Testes de Validação MIME (adicionar ao suite)
```javascript
// tests/storage-validation.test.js
describe('Storage Validation', () => {
  it('should reject executable files', async () => {
    const response = await request(app)
      .post('/api/storage/validate')
      .send({ mimeType: 'application/x-executable', fileSize: 1000, fileName: 'test.exe' });
    expect(response.status).toBe(400);
  });

  it('should accept images', async () => {
    const response = await request(app)
      .post('/api/storage/validate')
      .send({ mimeType: 'image/jpeg', fileSize: 1000, fileName: 'test.jpg' });
    expect(response.status).toBe(200);
  });
});
```

---

## 8. Checklist de Verificação

### Segurança
- [ ] Headers HSTS presentes
- [ ] Header CSP presente
- [ ] Header Permissions-Policy presente
- [ ] CORS configurado corretamente
- [ ] Credenciais TURN não estão no bundle
- [ ] Upload rejeita tipos não permitidos
- [ ] Upload rejeita arquivos muito grandes
- [ ] Upload rejeita nomes perigosos

### Dependências
- [ ] npm audit sem vulnerabilidades HIGH
- [ ] xlsx removido
- [ ] @anthropic-ai/sdk removido
- [ ] exceljs instalado

### Credenciais
- [ ] Scripts requerem variáveis de ambiente
- [ ] Cypress requer variáveis de ambiente
- [ ] Nenhuma senha hardcoded no código

### Funcionalidade
- [ ] Login funciona
- [ ] Upload de imagens funciona
- [ ] Upload de documentos funciona
- [ ] Chamadas de vídeo funcionam (TURN)
- [ ] Exportação Excel funciona (exceljs)

---

## 9. Troubleshooting

### Problema: Headers não aparecem
```bash
# Verificar se nginx está rodando
docker ps | grep nginx

# Reiniciar nginx
docker restart nginx
```

### Problema: Endpoint TURN retorna erro
```bash
# Verificar variáveis de ambiente
echo $TURN_USERNAME
echo $TURN_CREDENTIAL

# Verificar logs do backend
docker logs backend
```

### Problema: Upload falha
```bash
# Verificar se Supabase Storage está configurado
# Acessar Supabase Dashboard > Storage > Buckets

# Verificar policies do bucket
```

### Problema: Cypress não roda
```bash
# Criar arquivo .env.test
echo "CYPRESS_ADMIN_PASSWORD=sua_senha" > .env.test

# Rodar com env vars
source .env.test && npx cypress run
```
