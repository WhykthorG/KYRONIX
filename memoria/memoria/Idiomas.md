# Idiomas

## Descrição
Sistema de internacionalização (i18n) do [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- 3 idiomas: Português (pt-BR), Inglês (en), Espanhol (es)
- Detecção automática do navegador
- Persistência da preferência no localStorage
- Seletor no Taskbar e nas Configurações
- Troca de idioma em tempo real

## Arquivos

### Configuração
| Arquivo | Função |
|---------|--------|
| `frontend/src/i18n/index.js` | Configuração i18next |
| `frontend/src/i18n/locales/pt-BR.json` | Traduções em português |
| `frontend/src/i18n/locales/en.json` | Traduções em inglês |
| `frontend/src/i18n/locales/es.json` | Traduções em espanhol |

### Componentes
| Arquivo | Função |
|---------|--------|
| `frontend/src/components/desktop/Taskbar.jsx` | Seletor no Taskbar |
| `frontend/src/pages/SettingsPage.jsx` | Seletor nas Configurações |

## Como Usar nos Componentes

```jsx
import { useTranslation } from 'react-i18next';

function MeuComponente() {
  const { t } = useTranslation();
  return <h1>{t('nav.dashboard')}</h1>;
}
```

## Categorias de Tradução
- `common` — Termos gerais (salvar, cancelar, etc.)
- `auth` — Autenticação
- `nav` — Navegação
- `status` — Status
- `dashboard` — Dashboard
- `toast` — Mensagens

## Ver Também
- [[Configuracoes]] — Configurações de idioma

